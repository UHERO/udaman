"use server";

import { rawQuery } from "@database/mysql";

import { requireAuth } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

/**
 * Data for /admin/perf. Everything comes from tables the app already
 * writes: `app_logs` rows the worker stamps per finished job (category
 * "worker"), the nightly batch's summary row (`loader.batch_reload`), the
 * per-universe public sweep rows (`loader.public_sweep`), and live state
 * on `data_sources` and `downloads`.
 */

export type JobRun = {
  name: string;
  queue: string;
  worker: string | null;
  /** ISO timestamp of completion */
  at: string;
  waitMs: number | null;
  runMs: number;
  status: "completed" | "failed";
  rssMB: number | null;
  heapMB: number | null;
  err: string | null;
};

export type NightlyRun = {
  at: string;
  elapsedSec: number | null;
  lockWaitMs: number | null;
  reloaded: number | null;
  total: number | null;
  failed: number | null;
  perDepth: { depth: number; count: number; failed: number; seconds: number }[];
};

export type SweepRun = {
  at: string;
  universe: string;
  mode: string;
  elapsedSec: number;
  updated: number;
  inserted: number;
  deleted: number;
  skipped: number;
};

export type LoaderRow = {
  id: number;
  seriesId: number | null;
  seriesName: string | null;
  runtime: number | null;
  lastRunAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type StaleDownload = {
  handle: string;
  url: string;
  lastDownloadAt: string | null;
};

export type PerfData = {
  days: number;
  generatedAt: string;
  jobRuns: JobRun[];
  nightly: NightlyRun[];
  sweeps: SweepRun[];
  slowestLoaders: LoaderRow[];
  loaderErrors: LoaderRow[];
  loaderErrorCount: number;
  staleDownloads: StaleDownload[];
  staleDownloadCount: number;
};

type LogRow = {
  name: string;
  level: string;
  created_at: Date | string;
  metadata: string | Record<string, unknown> | null;
};

function meta(row: LogRow): Record<string, unknown> {
  if (!row.metadata) return {};
  if (typeof row.metadata === "string") {
    try {
      return JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return row.metadata;
}

const iso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : new Date(d).toISOString();

const num = (v: unknown): number | null =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

export async function getPerfData(days = 30): Promise<PerfData> {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "dev") {
    throw new AuthorizationError("Unauthorized: admin or dev role required");
  }

  const [jobRows, nightlyRows, sweepRows, slowest, errors, errorCount, stale, staleCount] =
    await Promise.all([
      rawQuery<LogRow>(
        `SELECT name, level, created_at, metadata
         FROM app_logs
         WHERE category = 'worker'
           AND created_at >= NOW() - INTERVAL ? DAY
         ORDER BY created_at DESC
         LIMIT 5000`,
        [days],
      ),
      rawQuery<LogRow>(
        `SELECT name, level, created_at, metadata
         FROM app_logs
         WHERE category = 'loader' AND name = 'loader.batch_reload'
           AND created_at >= NOW() - INTERVAL ? DAY
         ORDER BY created_at DESC
         LIMIT 200`,
        [days],
      ),
      rawQuery<LogRow>(
        `SELECT name, level, created_at, metadata
         FROM app_logs
         WHERE category = 'loader' AND name = 'loader.public_sweep'
           AND created_at >= NOW() - INTERVAL ? DAY
         ORDER BY created_at DESC
         LIMIT 1000`,
        [days],
      ),
      rawQuery<{
        id: number;
        series_id: number | null;
        series_name: string | null;
        runtime: number | null;
        last_run_at: Date | null;
        last_error: string | null;
        last_error_at: Date | null;
      }>(
        `SELECT ds.id, ds.series_id, s.name AS series_name, ds.runtime,
                ds.last_run_at, ds.last_error, ds.last_error_at
         FROM data_sources ds
         LEFT JOIN series s ON s.id = ds.series_id
         WHERE ds.disabled = 0 AND ds.runtime IS NOT NULL
         ORDER BY ds.runtime DESC
         LIMIT 20`,
      ),
      rawQuery<{
        id: number;
        series_id: number | null;
        series_name: string | null;
        runtime: number | null;
        last_run_at: Date | null;
        last_error: string | null;
        last_error_at: Date | null;
      }>(
        `SELECT ds.id, ds.series_id, s.name AS series_name, ds.runtime,
                ds.last_run_at, ds.last_error, ds.last_error_at
         FROM data_sources ds
         LEFT JOIN series s ON s.id = ds.series_id
         WHERE ds.disabled = 0 AND ds.last_error_at >= NOW() - INTERVAL 1 DAY
         ORDER BY ds.last_error_at DESC
         LIMIT 20`,
      ),
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM data_sources
         WHERE disabled = 0 AND last_error_at >= NOW() - INTERVAL 1 DAY`,
      ),
      rawQuery<{ handle: string; url: string; last_download_at: Date | null }>(
        `SELECT handle, url, last_download_at
         FROM downloads
         WHERE url IS NOT NULL AND url <> '' AND freeze_file = 0
           AND (last_download_at IS NULL OR last_download_at < NOW() - INTERVAL 1 DAY)
         ORDER BY last_download_at
         LIMIT 20`,
      ),
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM downloads
         WHERE url IS NOT NULL AND url <> '' AND freeze_file = 0
           AND (last_download_at IS NULL OR last_download_at < NOW() - INTERVAL 1 DAY)`,
      ),
    ]);

  const jobRuns: JobRun[] = jobRows.map((r) => {
    const m = meta(r);
    return {
      name: r.name,
      queue: String(m.queue ?? ""),
      worker: m.worker == null ? null : String(m.worker),
      at: iso(r.created_at)!,
      waitMs: num(m.waitMs),
      runMs: num(m.runMs) ?? 0,
      status: m.status === "failed" || r.level === "error" ? "failed" : "completed",
      rssMB: num(m.rssMB),
      heapMB: num(m.heapMB),
      err: m.err == null ? null : String(m.err),
    };
  });

  const nightly: NightlyRun[] = nightlyRows.map((r) => {
    const m = meta(r);
    const perDepthRaw = Array.isArray(m.perDepth) ? m.perDepth : [];
    return {
      at: iso(r.created_at)!,
      elapsedSec: num(m.elapsedSec),
      lockWaitMs: num(m.lockWaitMs),
      reloaded: num(m.reloaded),
      total: num(m.total),
      failed: num(m.failed),
      perDepth: perDepthRaw.map((d) => {
        const x = d as Record<string, unknown>;
        return {
          depth: num(x.depth) ?? 0,
          count: num(x.count) ?? 0,
          failed: num(x.failed) ?? 0,
          seconds: num(x.seconds) ?? 0,
        };
      }),
    };
  });

  const sweeps: SweepRun[] = sweepRows.map((r) => {
    const m = meta(r);
    return {
      at: iso(r.created_at)!,
      universe: String(m.universe ?? ""),
      mode: String(m.mode ?? ""),
      elapsedSec: num(m.elapsedSec) ?? 0,
      updated: num(m.updated) ?? 0,
      inserted: num(m.inserted) ?? 0,
      deleted: num(m.deleted) ?? 0,
      skipped: num(m.skipped) ?? 0,
    };
  });

  const toLoader = (r: (typeof slowest)[number]): LoaderRow => ({
    id: r.id,
    seriesId: r.series_id,
    seriesName: r.series_name,
    runtime: num(r.runtime),
    lastRunAt: iso(r.last_run_at),
    lastError: r.last_error,
    lastErrorAt: iso(r.last_error_at),
  });

  return {
    days,
    generatedAt: new Date().toISOString(),
    jobRuns,
    nightly,
    sweeps,
    slowestLoaders: slowest.map(toLoader),
    loaderErrors: errors.map(toLoader),
    loaderErrorCount: Number(errorCount[0]?.cnt ?? 0),
    staleDownloads: stale.map((r) => ({
      handle: r.handle,
      url: r.url,
      lastDownloadAt: iso(r.last_download_at),
    })),
    staleDownloadCount: Number(staleCount[0]?.cnt ?? 0),
  };
}
