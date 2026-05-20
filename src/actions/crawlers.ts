"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { rawQuery } from "@/lib/mysql/hhdb";

// ─── DB Stats types ──────────────────────────────────────────────

export type PipelineStatusCounts = {
  pending: number;
  success: number;
  failed: number;
};

export type QpubDbStats = {
  scrapedToday: number;
  scrapedThisMonth: number;
  scrape: PipelineStatusCounts;
  parse: PipelineStatusCounts;
  load: PipelineStatusCounts;
};

// ─── DB Stats action ─────────────────────────────────────────────

export async function getQpubDbStats(): Promise<QpubDbStats> {
  await requirePermission("worker", "read");

  type StatusRow = { status: string; cnt: number };

  const [scrapeRows, parseRows, loadRows, recentRows] = await Promise.all([
    rawQuery<StatusRow>(
      `SELECT scrape_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY scrape_status`,
    ),
    rawQuery<StatusRow>(
      `SELECT parse_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY parse_status`,
    ),
    rawQuery<StatusRow>(
      `SELECT load_status AS status, COUNT(*) AS cnt FROM scrape_status GROUP BY load_status`,
    ),
    rawQuery<{ scraped_today: number; scraped_this_month: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(scraped_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS scraped_today,
        COALESCE(SUM(CASE WHEN scraped_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS scraped_this_month
      FROM scrape_status
      WHERE scraped_at IS NOT NULL
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

  return {
    scrapedToday: Number(recentRows[0]?.scraped_today ?? 0),
    scrapedThisMonth: Number(recentRows[0]?.scraped_this_month ?? 0),
    scrape: toCounts(scrapeRows),
    parse: toCounts(parseRows),
    load: toCounts(loadRows),
  };
}

// ─── Reset Failed Records ────────────────────────────────────────

/**
 * Reset all failed scrape/parse/load records so they can be retried.
 * Returns the number of records reset.
 */
export async function resetFailedRecords(): Promise<number> {
  await requirePermission("worker", "execute");

  const result = await rawQuery<{ affected: number }>(
    `UPDATE scrape_status
     SET scrape_status = CASE WHEN scrape_status = 'failed' THEN 'pending' ELSE scrape_status END,
         parse_status = CASE WHEN parse_status = 'failed' THEN 'pending' ELSE parse_status END,
         load_status = CASE WHEN load_status = 'failed' THEN 'pending' ELSE load_status END,
         retry_count = 0,
         error = NULL
     WHERE scrape_status = 'failed' OR parse_status = 'failed' OR load_status = 'failed'`,
  );

  // rawQuery returns rows for SELECT; for UPDATE it returns an array with affectedRows info
  // Use a count query to report how many were affected
  const countResult = await rawQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM scrape_status
     WHERE retry_count = 0 AND error IS NULL
       AND (scrape_status = 'pending' OR parse_status = 'pending' OR load_status = 'pending')`,
  );

  return Number(countResult[0]?.cnt ?? 0);
}
