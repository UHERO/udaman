"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";
import { rawQuery } from "@/lib/mysql/hhdb";

const log = createLogger("action.crawlers");

// ─── Types ──────────────────────────────────────────────────────────

export type PipelineStatusCounts = {
  pending: number;
  success: number;
  failed: number;
};

export type FailedRecord = {
  tmk: string;
  stage: "scrape" | "parse" | "load";
  error: string;
  updatedAt: string;
  retryCount: number;
};

export type QpubDashboardStats = {
  // Scrape progress
  totalRecords: number;
  freshScrapes: number;
  scrapePercent: number;

  // Pipeline stage counts
  scrape: PipelineStatusCounts;
  parse: PipelineStatusCounts;
  load: PipelineStatusCounts;

  // Activity
  scrapedToday: number;
  scrapedThisMonth: number;

  // Last batch load (24h window)
  parsedLastBatch: number;
  loadedLastBatch: number;
  scrapeToLoadPercent: number;

  // Failed records (most recent 20)
  recentFailures: FailedRecord[];

  // Cache metadata
  cachedAt: string;
};

// ─── In-memory cache ────────────────────────────────────────────────

let cache: { data: QpubDashboardStats; timestamp: number } | null = null;
const CACHE_TTL_MS = 15_000;

function invalidateCache() {
  cache = null;
}

// ─── Dashboard stats action ─────────────────────────────────────────

type StatusRow = { status: string; cnt: number };
type ProgressRow = { total: number; fresh: number };
type ActivityRow = { scraped_today: number; scraped_this_month: number };
type BatchRow = { parsed_last_batch: number; loaded_last_batch: number };
type FailedRow = {
  tmk: string;
  scrape_status: string;
  parse_status: string;
  load_status: string;
  error: string | null;
  updated_at: string;
  retry_count: number;
};

export async function getQpubDashboardStats(): Promise<QpubDashboardStats> {
  await requirePermission("worker", "read");

  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const [scrapeRows, parseRows, loadRows, activityRows, progressRows, batchRows, failedRows] =
    await Promise.all([
      // Pipeline stage counts
      rawQuery<StatusRow>(
        `SELECT scrape_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY scrape_status`,
      ),
      rawQuery<StatusRow>(
        `SELECT parse_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY parse_status`,
      ),
      rawQuery<StatusRow>(
        `SELECT load_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY load_status`,
      ),
      // Activity counters
      rawQuery<ActivityRow>(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(scraped_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS scraped_today,
          COALESCE(SUM(CASE WHEN scraped_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS scraped_this_month
        FROM scrape_status
        WHERE scraped_at IS NOT NULL
      `),
      // Scrape progress
      rawQuery<ProgressRow>(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN scraped_at >= NOW() - INTERVAL 6 MONTH THEN 1 ELSE 0 END), 0) AS fresh
        FROM scrape_status
      `),
      // Last batch (24h window)
      rawQuery<BatchRow>(`
        SELECT
          COALESCE(SUM(CASE WHEN parsed_at >= NOW() - INTERVAL 24 HOUR THEN 1 ELSE 0 END), 0) AS parsed_last_batch,
          COALESCE(SUM(CASE WHEN loaded_at >= NOW() - INTERVAL 24 HOUR THEN 1 ELSE 0 END), 0) AS loaded_last_batch
        FROM scrape_status
      `),
      // Failed records (most recent 20)
      rawQuery<FailedRow>(`
        SELECT tmk, scrape_status, parse_status, load_status, error, updated_at, retry_count
        FROM scrape_status
        WHERE scrape_status = 'failed' OR parse_status = 'failed' OR load_status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 20
      `),
    ]);

  function toCounts(rows: StatusRow[]): PipelineStatusCounts {
    const counts: PipelineStatusCounts = { pending: 0, success: 0, failed: 0 };
    for (const row of rows) {
      const key = row.status as keyof PipelineStatusCounts;
      if (key in counts) counts[key] = Number(row.cnt);
    }
    return counts;
  }

  const scrape = toCounts(scrapeRows);
  const parse = toCounts(parseRows);
  const load = toCounts(loadRows);

  const totalRecords = Number(progressRows[0]?.total ?? 0);
  const freshScrapes = Number(progressRows[0]?.fresh ?? 0);
  const scrapePercent =
    totalRecords > 0 ? Math.round((freshScrapes / totalRecords) * 100) : 0;

  const parsedLastBatch = Number(batchRows[0]?.parsed_last_batch ?? 0);
  const loadedLastBatch = Number(batchRows[0]?.loaded_last_batch ?? 0);
  const scrapeToLoadPercent =
    scrape.success > 0
      ? Math.round((load.success / scrape.success) * 100)
      : 0;

  function determineFailedStage(
    row: FailedRow,
  ): "scrape" | "parse" | "load" {
    if (row.scrape_status === "failed") return "scrape";
    if (row.parse_status === "failed") return "parse";
    return "load";
  }

  const recentFailures: FailedRecord[] = failedRows.map((row) => ({
    tmk: row.tmk,
    stage: determineFailedStage(row),
    error: row.error ?? "",
    updatedAt: String(row.updated_at),
    retryCount: Number(row.retry_count),
  }));

  const stats: QpubDashboardStats = {
    totalRecords,
    freshScrapes,
    scrapePercent,
    scrape,
    parse,
    load,
    scrapedToday: Number(activityRows[0]?.scraped_today ?? 0),
    scrapedThisMonth: Number(activityRows[0]?.scraped_this_month ?? 0),
    parsedLastBatch,
    loadedLastBatch,
    scrapeToLoadPercent,
    recentFailures,
    cachedAt: new Date().toISOString(),
  };

  cache = { data: stats, timestamp: Date.now() };
  return stats;
}

// ─── Reset Failed Records ────────────────────────────────────────────

/**
 * Reset all failed scrape/parse/load records so they can be retried.
 * Scrape failures reset to 'success' (available for re-claiming by staleness).
 * Parse/load failures reset to 'pending' (batch loader picks up pending/failed).
 * Returns the number of records reset.
 */
export async function resetFailedRecords(): Promise<number> {
  const { userId } = await requirePermission("worker", "execute");
  log.info("resetFailedRecords action called");

  try {
    const countResult = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM scrape_status
       WHERE scrape_status = 'failed' OR parse_status = 'failed' OR load_status = 'failed'`,
    );
    const count = Number(countResult[0]?.cnt ?? 0);

    if (count > 0) {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status = CASE WHEN scrape_status = 'failed' THEN 'success' ELSE scrape_status END,
             parse_status = CASE WHEN parse_status = 'failed' THEN 'pending' ELSE parse_status END,
             load_status = CASE WHEN load_status = 'failed' THEN 'pending' ELSE load_status END,
             retry_count = 0,
             error = NULL
         WHERE scrape_status = 'failed' OR parse_status = 'failed' OR load_status = 'failed'`,
      );
    }

    invalidateCache();
    log.info({ count }, "resetFailedRecords action completed");
    return count;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "resetFailedRecords failed");
    AppLogCollection.logError(err, { userId, name: "crawler.reset_failed" });
    throw err;
  }
}

// ─── Clear Pending Records ──────────────────────────────────────────

/**
 * Reset orphaned scrape_status='pending' records back to 'success'.
 * Pending means "claimed by an active scraper" — this clears records
 * left in pending by crashed scrapers or the old seed method.
 * Returns the number of records cleared.
 */
export async function clearPendingRecords(): Promise<number> {
  const { userId } = await requirePermission("worker", "execute");
  log.info("clearPendingRecords action called");

  try {
    const countResult = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM scrape_status WHERE scrape_status = 'pending'`,
    );
    const count = Number(countResult[0]?.cnt ?? 0);

    if (count > 0) {
      await rawQuery(
        `UPDATE scrape_status
         SET scrape_status = 'success'
         WHERE scrape_status = 'pending'`,
      );
    }

    invalidateCache();
    log.info({ count }, "clearPendingRecords action completed");
    return count;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "clearPendingRecords failed");
    AppLogCollection.logError(err, { userId, name: "crawler.clear_pending" });
    throw err;
  }
}
