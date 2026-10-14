/**
 * Load-statement side: a downloader's load method (load_from_bls_api,
 * load_from_dotax_*) resolves its arguments to a key, makes sure the output
 * is fresh enough, and reads that key's rows from the output Download.
 */

import DownloadCollection from "@catalog/collections/download-collection";
import DownloaderCollection from "@catalog/collections/downloader-collection";
import { formatHst, hstToInstant } from "@catalog/utils/time";

import { createLogger } from "@/core/observability/logger";

import { getImpl } from "./registry";
import { runDownloader } from "./run";
import { readTidyIndex } from "./tidy";
import type { DownloaderImpl } from "./types";

const log = createLogger("downloaders.load");

/**
 * When this process last tried a load-time run, per downloader (normal
 * runs) and per key (keyed runs), whatever the outcome — so a source that
 * is down, or a load statement whose key never resolves, costs one attempt
 * per hour per process rather than one per loader.
 */
const attemptedAt = new Map<string, number>();
const RETRY_MS = 60 * 60 * 1000;

function recentlyAttempted(id: string): boolean {
  const t = attemptedAt.get(id);
  return t != null && Date.now() - t < RETRY_MS;
}

/**
 * Freshness gate, the downloader counterpart of DownloadCollection.ensureFresh:
 *  - output older than max_age_minutes → normal run, inline (deduplicated
 *    in-process and claimed across processes, so a batch reload of 400
 *    loaders runs it once);
 *  - output fresh but the key missing (a new load statement) → keyed run
 *    for that key when the downloader supports it.
 * Failures are logged and the existing file is used. No reloads are ever
 * triggered here.
 */
export async function ensureFreshKey(
  impl: DownloaderImpl,
  key: string,
): Promise<void> {
  const downloader = await DownloaderCollection.getByHandle(impl.handle);
  if (!downloader.enabled) return;

  let lastDownloadAt: Date | null = null;
  let path: string | null = null;
  try {
    const output = await DownloadCollection.getByHandle(impl.outputHandle);
    lastDownloadAt = output.lastDownloadAt;
    path = output.savePath();
  } catch {
    // never run yet
  }

  let ranFull = false;
  if (downloader.maxAgeMinutes != null) {
    const maxAgeMs = downloader.maxAgeMinutes * 60 * 1000;
    const stale =
      !lastDownloadAt ||
      Date.now() - hstToInstant(lastDownloadAt).getTime() > maxAgeMs;
    if (stale && !recentlyAttempted(impl.handle)) {
      attemptedAt.set(impl.handle, Date.now());
      try {
        const out = await runDownloader(impl.handle);
        ranFull = out.status === "ok";
        if (out.status !== "ok") {
          log.warn({ downloader: impl.handle }, out.message);
        }
      } catch (e) {
        log.warn(
          { downloader: impl.handle, err: String(e) },
          "load-time run failed; using the existing output",
        );
      }
      if (!path) {
        try {
          path = (
            await DownloadCollection.getByHandle(impl.outputHandle)
          ).savePath();
        } catch {
          // still no output
        }
      }
    }
  }

  if (ranFull || !impl.supportsKeyedRuns) return;
  if (path && readTidyIndex(path, impl).has(key)) return;
  const id = `${impl.handle}|${key}`;
  if (recentlyAttempted(id)) return;
  attemptedAt.set(id, Date.now());
  try {
    const out = await runDownloader(impl.handle, { keys: [key] });
    if (out.status !== "ok")
      log.warn({ downloader: impl.handle, key }, out.message);
  } catch (e) {
    log.warn(
      { downloader: impl.handle, key, err: String(e) },
      "keyed run failed",
    );
  }
}

export type DownloaderSeriesData = {
  data: Map<string, number>;
  /** One-letter frequency code from the output, if known */
  freq: string | null;
  description: string;
};

/** Resolve args, refresh if needed, and read the key from the output. */
export async function loadFromDownloader(
  handle: string,
  args: unknown[],
): Promise<DownloaderSeriesData> {
  const impl = getImpl(handle);
  const call = `${impl.loadMethod}(${args
    .filter((a) => a !== undefined)
    .map((a) => JSON.stringify(a))
    .join(", ")})`;
  const resolved = impl.keyFromArgs(args);
  await ensureFreshKey(impl, resolved.key);

  let output;
  try {
    output = await DownloadCollection.getByHandle(impl.outputHandle);
  } catch {
    throw new Error(
      `${call}: downloader ${impl.handle} has not produced any output yet — run it from the Downloaders page`,
    );
  }
  const entry = readTidyIndex(output.savePath(), impl).get(resolved.key);
  if (!entry || entry.data.size === 0) {
    throw new Error(
      `${call}: ${resolved.label} not found in ${impl.outputHandle} (last refreshed ${formatHst(output.lastDownloadAt)})`,
    );
  }
  if (
    resolved.frequency &&
    entry.freq &&
    resolved.frequency.toUpperCase() !== entry.freq.toUpperCase()
  ) {
    throw new Error(
      `${call}: frequency "${resolved.frequency}" does not match the source data (${entry.freq})`,
    );
  }
  return {
    data: new Map(entry.data),
    freq: entry.freq ?? resolved.frequency ?? null,
    description: `loaded from downloader ${impl.handle} (${output.handle}) with ${impl.loadMethod} parameters shown`,
  };
}
