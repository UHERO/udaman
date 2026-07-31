"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";

import { ISLANDS, type IslandCode } from "@/core/crawlers/qpub/config";
import { createLogger } from "@/core/observability/logger";
import { HEARTBEAT_STALE_SECONDS } from "@/core/workers/scraper-heartbeat";
import { requirePermission } from "@/lib/auth/permissions";
import { rawQuery } from "@/lib/mysql/hhdb";

const log = createLogger("action.crawlers");

/** Scrapes older than this are considered stale and get re-claimed. */
const FRESH_MONTHS = 6;

// ─── Types ──────────────────────────────────────────────────────────

export type PipelineStatusCounts = {
  pending: number;
  success: number;
  failed: number;
};

/** One stage's progress across all records. */
export type StageProgress = PipelineStatusCounts & {
  total: number;
  percent: number;
};

/** Scrape progress for one county, keyed off the TMK's leading digit. */
export type CountyProgress = {
  islandCode: string;
  name: string;
  total: number;
  scraped: number;
  percent: number;
};

/** A worker process reporting in via scraper_heartbeats. */
export type ScraperInstance = {
  id: string;
  /** WORKER_NAME if set, else the OS hostname. */
  workerName: string;
  /** OS hostname — may differ from workerName, and drifts across networks. */
  host: string;
  pid: number;
  state: string;
  detail: string | null;
  scrapedCount: number;
  captchaCount: number;
  uptimeSeconds: number;
  lastSeenSeconds: number;
  /** last_seen_at within HEARTBEAT_STALE_SECONDS. */
  active: boolean;
};

export type FailedRecord = {
  tmk: string;
  stage: "scrape" | "parse" | "load";
  error: string;
  updatedAt: string;
  retryCount: number;
};

export type QpubDashboardStats = {
  // Scrape progress — overall and per county
  totalRecords: number;
  freshScrapes: number;
  scrapePercent: number;
  counties: CountyProgress[];

  // Downstream stages, now run as discrete batch passes
  parse: StageProgress;
  load: StageProgress;

  // Raw scrape stage counts (drives the Clear Pending button)
  scrape: PipelineStatusCounts;

  // Activity
  scrapedToday: number;
  scrapedThisMonth: number;

  // Running scrape-runner processes
  instances: ScraperInstance[];

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

/** One row per county, from a single GROUP BY over scrape_status. */
type CountyRow = {
  island: string;
  total: number;
  fresh: number;
  scrape_success: number;
  scrape_pending: number;
  scrape_failed: number;
  parse_success: number;
  parse_pending: number;
  parse_failed: number;
  load_success: number;
  load_pending: number;
  load_failed: number;
};
type ActivityRow = { scraped_today: number; scraped_this_month: number };
type HeartbeatRow = {
  id: string;
  worker_name: string;
  host: string;
  pid: number;
  state: string;
  detail: string | null;
  scraped_count: number;
  captcha_count: number;
  uptime_s: number;
  last_seen_s: number;
};
type FailedRow = {
  tmk: string;
  scrape_status: string;
  parse_status: string;
  load_status: string;
  error: string | null;
  updated_at: string;
  retry_count: number;
};

/** Read the live scraper roster. Never throws — an empty roster is a valid answer. */
async function getScraperInstances(): Promise<ScraperInstance[]> {
  try {
    const rows = await rawQuery<HeartbeatRow>(
      `SELECT id, worker_name, host, pid, state, detail, scraped_count, captcha_count,
              TIMESTAMPDIFF(SECOND, started_at, NOW())   AS uptime_s,
              TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS last_seen_s
       FROM scraper_heartbeats
       ORDER BY worker_name, pid`,
    );

    return rows.map((r) => {
      const lastSeenSeconds = Number(r.last_seen_s);
      return {
        id: r.id,
        workerName: r.worker_name,
        host: r.host,
        pid: Number(r.pid),
        state: r.state,
        detail: r.detail,
        scrapedCount: Number(r.scraped_count),
        captchaCount: Number(r.captcha_count),
        uptimeSeconds: Number(r.uptime_s),
        lastSeenSeconds,
        active: lastSeenSeconds <= HEARTBEAT_STALE_SECONDS,
      };
    });
  } catch (err) {
    // Most likely the migration hasn't been applied yet. The rest of the
    // dashboard is still useful, so degrade instead of failing the page.
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message }, "Could not read scraper_heartbeats");
    return [];
  }
}

export async function getQpubDashboardStats(): Promise<QpubDashboardStats> {
  await requirePermission("worker", "read");

  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const [countyRows, activityRows, failedRows, instances] = await Promise.all([
    // Per-county breakdown of every stage. The county is the TMK's leading
    // digit, so one GROUP BY covers both the county bars and — once summed —
    // the overall totals, replacing four separate full scans.
    rawQuery<CountyRow>(`
        SELECT
          LEFT(tmk, 1) AS island,
          COUNT(*) AS total,
          COALESCE(SUM(scraped_at >= NOW() - INTERVAL ${FRESH_MONTHS} MONTH), 0) AS fresh,
          COALESCE(SUM(scrape_status = 'success'), 0) AS scrape_success,
          COALESCE(SUM(scrape_status = 'pending'), 0) AS scrape_pending,
          COALESCE(SUM(scrape_status = 'failed'),  0) AS scrape_failed,
          COALESCE(SUM(parse_status  = 'success'), 0) AS parse_success,
          COALESCE(SUM(parse_status  = 'pending'), 0) AS parse_pending,
          COALESCE(SUM(parse_status  = 'failed'),  0) AS parse_failed,
          COALESCE(SUM(load_status   = 'success'), 0) AS load_success,
          COALESCE(SUM(load_status   = 'pending'), 0) AS load_pending,
          COALESCE(SUM(load_status   = 'failed'),  0) AS load_failed
        FROM scrape_status
        GROUP BY island
        ORDER BY island
      `),
    // Activity counters
    rawQuery<ActivityRow>(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(scraped_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS scraped_today,
          COALESCE(SUM(CASE WHEN scraped_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS scraped_this_month
        FROM scrape_status
        WHERE scraped_at IS NOT NULL
      `),
    // Failed records (most recent 20)
    rawQuery<FailedRow>(`
        SELECT tmk, scrape_status, parse_status, load_status, error, updated_at, retry_count
        FROM scrape_status
        WHERE scrape_status = 'failed' OR parse_status = 'failed' OR load_status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 20
      `),
    getScraperInstances(),
  ]);

  const sum = (pick: (r: CountyRow) => number | string) =>
    countyRows.reduce((acc, r) => acc + Number(pick(r)), 0);

  const totalRecords = sum((r) => r.total);
  const freshScrapes = sum((r) => r.fresh);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const counties: CountyProgress[] = countyRows.map((r) => {
    const total = Number(r.total);
    const scraped = Number(r.fresh);
    return {
      islandCode: r.island,
      // Unknown leading digits shouldn't vanish from the dashboard — they're
      // a data problem worth seeing.
      name: ISLANDS[r.island as IslandCode] ?? `Island ${r.island}`,
      total,
      scraped,
      percent: pct(scraped, total),
    };
  });

  const scrape: PipelineStatusCounts = {
    success: sum((r) => r.scrape_success),
    pending: sum((r) => r.scrape_pending),
    failed: sum((r) => r.scrape_failed),
  };

  const stage = (
    success: number,
    pending: number,
    failed: number,
  ): StageProgress => ({
    success,
    pending,
    failed,
    total: totalRecords,
    percent: pct(success, totalRecords),
  });

  const parse = stage(
    sum((r) => r.parse_success),
    sum((r) => r.parse_pending),
    sum((r) => r.parse_failed),
  );
  const load = stage(
    sum((r) => r.load_success),
    sum((r) => r.load_pending),
    sum((r) => r.load_failed),
  );

  function determineFailedStage(row: FailedRow): "scrape" | "parse" | "load" {
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
    scrapePercent: pct(freshScrapes, totalRecords),
    counties,
    parse,
    load,
    scrape,
    scrapedToday: Number(activityRows[0]?.scraped_today ?? 0),
    scrapedThisMonth: Number(activityRows[0]?.scraped_this_month ?? 0),
    instances,
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

// ─── Clear Stale Scrapers ───────────────────────────────────────────

/**
 * Remove heartbeat rows that have stopped reporting.
 *
 * A worker deletes its own row on clean shutdown, but a crash — or a machine
 * whose hostname changed, leaving its old identity orphaned — leaves a row
 * that will never update again. This clears exactly the rows the dashboard
 * shows as stale; a live worker re-registers within one heartbeat interval,
 * so clearing an active one by mistake is self-correcting.
 */
export async function clearStaleScrapers(): Promise<number> {
  const { userId } = await requirePermission("worker", "execute");
  log.info("clearStaleScrapers action called");

  try {
    const result = await rawQuery<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM scraper_heartbeats
       WHERE last_seen_at < NOW() - INTERVAL ${HEARTBEAT_STALE_SECONDS} SECOND`,
    );
    const count = Number(result[0]?.cnt ?? 0);

    if (count > 0) {
      await rawQuery(
        `DELETE FROM scraper_heartbeats
         WHERE last_seen_at < NOW() - INTERVAL ${HEARTBEAT_STALE_SECONDS} SECOND`,
      );
    }

    invalidateCache();
    log.info({ count }, "clearStaleScrapers action completed");
    return count;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "clearStaleScrapers failed");
    AppLogCollection.logError(err, {
      userId,
      name: "crawler.clear_stale_scrapers",
    });
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
