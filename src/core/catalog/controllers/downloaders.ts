/*************************************************************************
 * DOWNLOADERS Controller
 * Code that fetches an outside source (API batches, scraped report files,
 * a Google Sheet) into source Downloads + one parsed output Download that
 * load statements read through the downloader's own load method.
 *************************************************************************/

import DownloaderCollection from "@catalog/collections/downloader-collection";
import type {
  CreateDownloaderPayload,
  UpdateDownloaderPayload,
} from "@catalog/collections/downloader-collection";
import type Download from "@catalog/models/download";
import type { SerializedDownloader } from "@catalog/models/downloader";

import { resolveRefs } from "@/core/downloaders/keys";
import { DOWNLOADERS } from "@/core/downloaders/registry";
import { cacheDirFor } from "@/core/downloaders/run";
import { readTidyIndex } from "@/core/downloaders/tidy";
import { enqueueDownloaderRun } from "@/core/workers/enqueue";
import { mysql } from "@/lib/mysql/helpers";

export type DownloaderSummary = SerializedDownloader & {
  /** null when no implementation is registered for the handle */
  loadSignature: string | null;
  outputHandle: string | null;
  sourceCount: number;
  historicalCount: number;
};

export type DownloadRef = {
  id: number;
  handle: string | null;
  url: string | null;
  historical: boolean;
  lastDownloadAt: string | null;
  lastChangeAt: string | null;
  notes: string | null;
};

export type DownloaderRefRow = {
  loaderId: number;
  seriesId: number | null;
  seriesName: string | null;
  universe: string;
  eval: string;
  keys: Array<{ key: string; label: string; found: boolean }>;
  error: string | null;
};

export type DownloaderRun = {
  id: number;
  at: string;
  status: "completed" | "failed";
  message: string;
  runMs: number | null;
};

export type DownloaderDetail = {
  downloader: DownloaderSummary;
  output: (DownloadRef & { keyCount: number; rowCount: number }) | null;
  sources: DownloadRef[];
  refs: DownloaderRefRow[];
  runs: DownloaderRun[];
  cacheDir: string;
  /** bls_api: series whose full history is loaded */
  historyComplete: number | null;
};

function toRef(d: Download): DownloadRef {
  return {
    id: d.id,
    handle: d.handle,
    url: d.url,
    historical: d.historical,
    lastDownloadAt: d.lastDownloadAt?.toISOString() ?? null,
    lastChangeAt: d.lastChangeAt?.toISOString() ?? null,
    notes: d.notes,
  };
}

export async function getDownloaders(): Promise<DownloaderSummary[]> {
  const [rows, counts] = await Promise.all([
    DownloaderCollection.list(),
    mysql<{ downloader_id: number; n: number; hist: number }>`
      SELECT downloader_id, COUNT(*) AS n, SUM(historical) AS hist
      FROM downloads
      WHERE downloader_id IS NOT NULL AND downloader_role = 'source'
      GROUP BY downloader_id
    `,
  ]);
  const byId = new Map(counts.map((c) => [c.downloader_id, c]));
  return rows.map((d) => {
    const impl = DOWNLOADERS[d.handle];
    const c = byId.get(d.id);
    return {
      ...d.toJSON(),
      loadSignature: impl?.loadSignature ?? null,
      outputHandle: impl?.outputHandle ?? null,
      sourceCount: Number(c?.n ?? 0),
      historicalCount: Number(c?.hist ?? 0),
    };
  });
}

async function getRuns(handle: string): Promise<DownloaderRun[]> {
  const rows = await mysql<{
    id: number | bigint;
    created_at: Date | string;
    metadata: string | Record<string, unknown> | null;
  }>`
    SELECT id, created_at, metadata FROM app_logs
    WHERE category = 'worker' AND name = 'downloader.run'
      AND metadata LIKE ${`%${handle}%`}
    ORDER BY id DESC
    LIMIT 15
  `;
  return rows.map((r) => {
    const m = (
      typeof r.metadata === "string"
        ? JSON.parse(r.metadata)
        : (r.metadata ?? {})
    ) as Record<string, unknown>;
    return {
      id: Number(r.id),
      at: new Date(r.created_at as string | Date).toISOString(),
      status: m.status === "failed" ? "failed" : "completed",
      message: String(m.result ?? m.err ?? ""),
      runMs: typeof m.runMs === "number" ? m.runMs : null,
    };
  });
}

export async function getDownloaderDetail({
  id,
}: {
  id: number;
}): Promise<DownloaderDetail> {
  const d = await DownloaderCollection.getById(id);
  const impl = DOWNLOADERS[d.handle];
  const [downloads, refRows, runs] = await Promise.all([
    DownloaderCollection.getDownloads(d.id),
    impl ? DownloaderCollection.getLoaderRefs(impl.loadMethod) : [],
    getRuns(d.handle),
  ]);
  const outputDl = downloads.find((x) => x.downloaderRole === "output") ?? null;
  const index = outputDl
    ? readTidyIndex(outputDl.savePath(), impl ?? {})
    : new Map();
  let rowCount = 0;
  for (const e of index.values()) rowCount += e.data.size;

  const sources = downloads.filter((x) => x.downloaderRole === "source");
  const history = (d.state.history ?? null) as Record<string, unknown> | null;
  return {
    downloader: {
      ...d.toJSON(),
      loadSignature: impl?.loadSignature ?? null,
      outputHandle: impl?.outputHandle ?? null,
      sourceCount: sources.length,
      historicalCount: sources.filter((s) => s.historical).length,
    },
    output: outputDl
      ? { ...toRef(outputDl), keyCount: index.size, rowCount }
      : null,
    sources: sources.map(toRef),
    refs: impl
      ? resolveRefs(impl, refRows).map((r) => ({
          loaderId: r.loaderId,
          seriesId: r.seriesId,
          seriesName: r.seriesName,
          universe: r.universe,
          eval: r.eval,
          keys: r.keys.map((k) => ({
            key: k.key,
            label: k.label,
            found: index.has(k.key),
          })),
          error: r.error,
        }))
      : [],
    runs,
    cacheDir: cacheDirFor(d.handle),
    historyComplete: history ? Object.keys(history).length : null,
  };
}

export async function triggerDownloaderRun(
  id: number,
  opts: { force?: boolean; full?: boolean } = {},
) {
  const d = await DownloaderCollection.getById(id);
  const job = await enqueueDownloaderRun({ handle: d.handle, ...opts });
  return {
    message: `Queued ${d.handle}${opts.full ? " (full refetch)" : ""}`,
    jobId: job.id ?? null,
  };
}

/** Form data for new / edit */
export type DownloaderFormData = {
  id: number | null;
  handle: string;
  config: string;
  enabled: boolean;
  maxAgeMinutes: number | null;
  notes: string;
};

export async function getDownloaderForEdit({
  id,
}: {
  id: number;
}): Promise<DownloaderFormData> {
  const d = await DownloaderCollection.getById(id);
  return {
    id: d.id,
    handle: d.handle,
    config: JSON.stringify(d.config, null, 2),
    enabled: d.enabled,
    maxAgeMinutes: d.maxAgeMinutes,
    notes: d.notes ?? "",
  };
}

/** Registered implementations that have no row yet (choices for "new"). */
export async function getUnconfiguredHandles(): Promise<string[]> {
  const existing = new Set(
    (await DownloaderCollection.list()).map((d) => d.handle),
  );
  return Object.keys(DOWNLOADERS).filter((h) => !existing.has(h));
}

export async function createDownloader(payload: CreateDownloaderPayload) {
  if (!DOWNLOADERS[payload.handle]) {
    throw new Error(`No downloader implementation for "${payload.handle}"`);
  }
  const data = await DownloaderCollection.create(payload);
  return { message: "Downloader created", data };
}

export async function updateDownloader(
  id: number,
  payload: UpdateDownloaderPayload,
) {
  const data = await DownloaderCollection.update(id, payload);
  return { message: "Downloader updated", data };
}

export async function deleteDownloader(id: number) {
  await DownloaderCollection.delete(id);
  return { message: "Downloader deleted" };
}

export async function setDownloadHistorical(
  downloadId: number,
  historical: boolean,
) {
  await DownloaderCollection.setHistorical(downloadId, historical);
  return {
    message: historical ? "Marked historical" : "Historical mark cleared",
  };
}

export async function releaseDownloaderClaim(id: number) {
  await DownloaderCollection.releaseClaim(id);
  return { message: "Run claim released" };
}
