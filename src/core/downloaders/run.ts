/**
 * Shared run lifecycle for every downloader:
 *   claim → impl.run → write the output Download → record status → release.
 * Never enqueues reloads: reloads stay on the off-hours schedules, and
 * manual reloads refresh what they need through ensureFreshKey (load.ts).
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import DownloadCollection from "@catalog/collections/download-collection";
import DownloaderCollection from "@catalog/collections/downloader-collection";
import type Download from "@catalog/models/download";
import type Downloader from "@catalog/models/downloader";
import { formatHst } from "@catalog/utils/time";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";
import { mysql } from "@/lib/mysql/helpers";

import { referencedKeys } from "./keys";
import { getImpl } from "./registry";
import { sourceHelpers } from "./sources";
import { applyWrite, readTidyRows, writeTidy } from "./tidy";
import type { DownloaderContext, DownloaderImpl } from "./types";

const log = createLogger("downloaders");

export type RunOptions = {
  /** Keyed run: fetch only these keys (implementations without keyed runs do a normal run). */
  keys?: string[] | null;
  force?: boolean;
  full?: boolean;
  /** Extra sink for progress lines (BullMQ job.log, CLI stdout) */
  log?: (msg: string) => void;
};

export type RunOutcome = {
  status: "ok" | "error" | "busy" | "disabled";
  changed: boolean;
  message: string;
  stats: Record<string, unknown>;
};

export function cacheDirFor(handle: string): string {
  return join(/*turbopackIgnore: true*/ getDataDir(), "downloaders", handle);
}

/** Find or create the output Download row for a downloader. */
export async function ensureOutputDownload(
  impl: DownloaderImpl,
  downloader: Downloader,
): Promise<Download> {
  try {
    const dl = await DownloadCollection.getByHandle(impl.outputHandle);
    if (dl.downloaderId !== downloader.id || dl.downloaderRole !== "output") {
      await mysql`
        UPDATE downloads
        SET downloader_id = ${downloader.id}, downloader_role = 'output',
            filename_ext = 'csv', updated_at = NOW()
        WHERE id = ${dl.id}
      `;
      return DownloadCollection.getById(dl.id);
    }
    return dl;
  } catch {
    await mysql`
      INSERT INTO downloads (handle, url, filename_ext, notes, downloader_id,
                             downloader_role, historical, created_at, updated_at)
      VALUES (${impl.outputHandle}, NULL, 'csv',
              ${`Parsed output of downloader ${impl.handle} (read with ${impl.loadMethod}).`},
              ${downloader.id}, 'output', 0, NOW(), NOW())
    `;
    return DownloadCollection.getByHandle(impl.outputHandle);
  }
}

/** In-process dedup: concurrent callers for the same handle share one run. */
const inFlight = new Map<string, Promise<RunOutcome>>();

export function runDownloader(
  handle: string,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  // Keyed runs for different keys must not be merged into one; only
  // dedupe identical requests.
  const dedupKey = `${handle}|${(opts.keys ?? []).join(",")}|${opts.force ? 1 : 0}|${opts.full ? 1 : 0}`;
  const running = inFlight.get(dedupKey);
  if (running) return running;
  const p = runOnce(handle, opts).finally(() => inFlight.delete(dedupKey));
  inFlight.set(dedupKey, p);
  return p;
}

async function runOnce(handle: string, opts: RunOptions): Promise<RunOutcome> {
  const impl = getImpl(handle);
  const downloader = await DownloaderCollection.getByHandle(handle);
  const emit = (msg: string) => {
    log.info({ downloader: handle }, msg);
    opts.log?.(msg);
  };

  if (!downloader.enabled) {
    return {
      status: "disabled",
      changed: false,
      message: `${handle} is disabled`,
      stats: {},
    };
  }
  if (!(await DownloaderCollection.claim(downloader.id))) {
    return {
      status: "busy",
      changed: false,
      message: `${handle} is already running (claimed ${formatHst(downloader.runningSince, "yyyy-MM-dd HH:mm")})`,
      stats: {},
    };
  }

  const started = Date.now();
  const keyed = Boolean(opts.keys?.length) && impl.supportsKeyedRuns;
  const cacheDir = cacheDirFor(handle);
  mkdirSync(cacheDir, { recursive: true });
  const statePatch: Record<string, unknown> = {};
  let refErrors = 0;

  const ctx: DownloaderContext = {
    downloader,
    keys: keyed ? opts.keys! : null,
    force: Boolean(opts.force),
    full: Boolean(opts.full),
    cacheDir,
    async referencedKeys() {
      const { keys, errors } = await referencedKeys(impl, DownloaderCollection);
      refErrors = errors.length;
      for (const e of errors.slice(0, 5)) {
        emit(`loader ${e.loaderId} (${e.seriesName ?? "?"}): ${e.error}`);
      }
      return keys;
    },
    setState(patch) {
      Object.assign(statePatch, patch);
    },
    sources: sourceHelpers({
      downloaderId: downloader.id,
      cacheDir,
      full: Boolean(opts.full),
      log: emit,
    }),
    log: emit,
  };

  emit(
    `run ${handle}${keyed ? ` keys=${opts.keys!.join(",")}` : ""}${opts.force ? " force" : ""}${opts.full ? " full" : ""}`,
  );

  try {
    const result = await impl.run(ctx);
    const stats: Record<string, unknown> = {
      ...(result.stats ?? {}),
      keyed,
      ...(refErrors ? { loaderArgErrors: refErrors } : {}),
      ...(result.failedKeys?.length
        ? {
            keysFailed: result.failedKeys.slice(0, 200),
            keysFailedCount: result.failedKeys.length,
          }
        : {}),
    };

    let changed = false;
    if (!result.error) {
      // A run with nothing new to write (write: null) still counts as a
      // check, so the output is stamped fresh for ensureFreshKey.
      const output = await ensureOutputDownload(impl, downloader);
      if (result.write) {
        const path = output.savePath();
        const rows = applyWrite(readTidyRows(path, impl.layout), result.write);
        changed = writeTidy(path, rows, impl.layout);
        stats.outputRows = rows.length;
        stats.outputKeys = new Set(rows.map((r) => r.key)).size;
      }
      await stampOutput(output, { changed, keyed, handle });
    }

    const error =
      result.error ??
      (result.failedKeys?.length
        ? `${result.failedKeys.length} key(s) failed: ${result.failedKeys.slice(0, 10).join(", ")}`
        : null);
    const ok = !result.error;
    const state =
      ok && Object.keys(statePatch).length
        ? { ...downloader.state, ...statePatch }
        : undefined;

    const seconds = (Date.now() - started) / 1000;
    await DownloaderCollection.finishRun(downloader.id, {
      ok,
      changed,
      full: !keyed,
      seconds,
      error,
      stats,
      state,
    });
    const message = ok
      ? `${handle}: ${changed ? "output changed" : "no changes"}${error ? ` (${error})` : ""} in ${seconds.toFixed(1)}s`
      : `${handle}: ${error}`;
    emit(message);
    return { status: ok ? "ok" : "error", changed, message, stats };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await DownloaderCollection.finishRun(downloader.id, {
      ok: false,
      changed: false,
      full: !keyed,
      seconds: (Date.now() - started) / 1000,
      error: msg,
      stats: { exception: msg },
    }).catch((err) => {
      log.error({ err: String(err) }, "failed to record downloader error");
    });
    emit(`${handle} failed: ${msg}`);
    throw e;
  }
}

/**
 * Bump the output Download's timestamps and log a change. A keyed run does
 * not count as a refresh of the whole output, so it leaves
 * last_download_at alone (otherwise one series' refresh would make every
 * other key look fresh to ensureFreshKey).
 */
async function stampOutput(
  output: Download,
  {
    changed,
    keyed,
    handle,
  }: { changed: boolean; keyed: boolean; handle: string },
) {
  if (!keyed) {
    await mysql`
      UPDATE downloads
      SET last_download_at = NOW(),
          last_change_at = IF(${changed ? 1 : 0} OR last_change_at IS NULL, NOW(), last_change_at)
      WHERE id = ${output.id}
    `;
  } else if (changed) {
    await mysql`UPDATE downloads SET last_change_at = NOW() WHERE id = ${output.id}`;
  }
  if (changed) {
    await mysql`
      INSERT INTO dsd_log_entries (download_id, time, url, location, status, dl_changed, mimetype, created_at, updated_at)
      VALUES (${output.id}, NOW(), ${`downloader://${handle}`}, NULL, 200, 1, 'text/csv', NOW(), NOW())
    `;
  }
}
