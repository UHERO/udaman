import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import type { DataPoint } from "../types/shared";

const log = createLogger("catalog.data-point-collection");

export type VintageDataPoint = {
  date: Date;
  value: number | null;
  created_at: Date;
  updated_at: Date | null;
  data_source_id: number;
  current: boolean;
  pseudo_history: number | null;
  color: string | null;
};

/** Lightweight vintage point for chart overlays */
export type SeriesVintagePoint = {
  date: string;
  value: number;
  publishedAt: string;
};

/** Max vintage points fetched per observation date for chart overlays */
const VINTAGE_CHART_LIMIT_PER_DATE = 100;

// ─── Public sync helpers ───────────────────────────────────────────────

export type PublicSyncOptions = {
  /** Force a full (non-watermarked) pass over every series. */
  full?: boolean;
  /**
   * Cooperative yield hook, called between chunks. The UPDATE_PUBLIC
   * worker passes the heavy-DB-lock yieldPoint here so a waiting
   * priority job (upload) can take the lock mid-sweep instead of timing
   * out behind it. Each chunk is self-contained, so a gap between chunks
   * is safe.
   */
  yieldPoint?: () => Promise<void>;
};

/** Series per chunk for the public sync statements. */
const PUBLIC_SYNC_CHUNK_SIZE = 500;
/** Pause between chunks so other connections get a turn. */
const PUBLIC_SYNC_SLEEP_MS = 50;
/** An incremental sync self-heals with a full pass at least this often. */
const FULL_SYNC_INTERVAL_HOURS = 24;

type PublicSyncWatermark = {
  synced_at: string | null;
  full_synced_at: string | null;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function placeholders(arr: unknown[]): string {
  return arr.map(() => "?").join(",");
}

/** Current DB time as an HST wall-clock string ("YYYY-MM-DD HH:MM:SS"). */
async function dbNowString(): Promise<string> {
  const rows = await mysql<{ now: string }>`
    SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now
  `;
  return rows[0].now;
}

/** Hours between two "YYYY-MM-DD HH:MM:SS" wall-clock strings. */
function hoursBetween(a: string, b: string): number {
  const ms =
    new Date(b.replace(" ", "T") + "Z").getTime() -
    new Date(a.replace(" ", "T") + "Z").getTime();
  return ms / 3_600_000;
}

async function getPublicSyncWatermark(
  universe: string,
): Promise<PublicSyncWatermark | null> {
  const rows = await mysql<PublicSyncWatermark>`
    SELECT DATE_FORMAT(synced_at, '%Y-%m-%d %H:%i:%s') AS synced_at,
           DATE_FORMAT(full_synced_at, '%Y-%m-%d %H:%i:%s') AS full_synced_at
    FROM public_sync_watermarks
    WHERE universe = ${universe}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function setPublicSyncWatermark(
  universe: string,
  syncedAt: string,
  full: boolean,
): Promise<void> {
  if (full) {
    await mysql`
      INSERT INTO public_sync_watermarks (universe, synced_at, full_synced_at)
      VALUES (${universe}, ${syncedAt}, ${syncedAt})
      ON DUPLICATE KEY UPDATE synced_at = VALUES(synced_at),
                              full_synced_at = VALUES(full_synced_at)
    `;
  } else {
    await mysql`
      INSERT INTO public_sync_watermarks (universe, synced_at, full_synced_at)
      VALUES (${universe}, ${syncedAt}, NULL)
      ON DUPLICATE KEY UPDATE synced_at = VALUES(synced_at)
    `;
  }
}

/**
 * Has anything that can change a series' current data points happened
 * since `since`? Every loader reload ends with an UPDATE of data_sources
 * (updated_at = NOW()), loader creation stamps created_at, and series
 * metadata edits stamp series.updated_at. These are tiny indexed lookups
 * (data_sources.series_id, series PK) — deliberately NOT a scan of
 * data_points timestamps, which would read the whole index per run.
 */
async function chunkHasActivity(
  seriesIds: number[],
  since: string,
): Promise<boolean> {
  const ph = placeholders(seriesIds);
  const ds = await rawQuery<{ found: number }>(
    `SELECT 1 AS found FROM data_sources
     WHERE series_id IN (${ph})
       AND (updated_at > ? OR created_at > ?)
     LIMIT 1`,
    [...seriesIds, since, since],
  );
  if (ds.length > 0) return true;
  const sr = await rawQuery<{ found: number }>(
    `SELECT 1 AS found FROM series
     WHERE id IN (${ph}) AND updated_at > ?
     LIMIT 1`,
    [...seriesIds, since],
  );
  return sr.length > 0;
}

/** Run a write statement and return the affected-row count (0 if unknown). */
async function rawQueryAffected(
  sql: string,
  params: (string | number)[],
): Promise<number> {
  const res = (await rawQuery(sql, params)) as unknown as {
    affectedRows?: number;
    count?: number;
  };
  return Number(res?.affectedRows ?? res?.count ?? 0);
}

class DataPointCollection {
  /**
   * Gets current data points for a given xseries, with calculated YOY, YTD, and LVL.
   * Returns the specialized projection type (not model instances) since the result
   * includes computed columns from the CTE query.
   */
  static async getBySeriesId(opts: {
    xseriesId: number;
  }): Promise<DataPoint[]> {
    const { xseriesId } = opts;
    const rows = await mysql<DataPoint>`
      WITH current_data AS (
        SELECT
          date,
          value,
          updated_at,
          pseudo_history,
          data_source_id,
          SUM(value) OVER (
            PARTITION BY YEAR(date)
            ORDER BY date
            ROWS UNBOUNDED PRECEDING
          ) AS ytd_sum,
          DATE_SUB(date, INTERVAL 1 YEAR) AS prev_year_date,
          LAG(value, 1) OVER (ORDER BY date) AS prev_value
        FROM (
          SELECT
            date,
            value,
            updated_at,
            pseudo_history,
            data_source_id,
            ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) as rn
          FROM data_points
          WHERE xseries_id = ${xseriesId} AND current = 1
        ) ranked
        WHERE rn = 1
      ),
      prev_year_data AS (
        SELECT
          date,
          value AS prev_year_value,
          SUM(value) OVER (
            PARTITION BY YEAR(date)
            ORDER BY date
            ROWS UNBOUNDED PRECEDING
          ) AS prev_ytd_sum
        FROM (
          SELECT
            date,
            value,
            updated_at,
            ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) as rn
          FROM data_points
          WHERE xseries_id = ${xseriesId} AND current = 1
        ) ranked
        WHERE rn = 1
      )
      SELECT
        c.date,
        c.value,
        CASE
          WHEN p.prev_year_value IS NOT NULL AND p.prev_year_value != 0
          THEN (c.value / p.prev_year_value - 1) * 100
          ELSE NULL
        END AS yoy,
        CASE
          WHEN p.prev_ytd_sum IS NOT NULL AND p.prev_ytd_sum != 0
          THEN (c.ytd_sum / p.prev_ytd_sum - 1) * 100
          ELSE NULL
        END AS ytd,
        CASE
          WHEN c.prev_value IS NOT NULL
          THEN c.value - c.prev_value
          ELSE NULL
        END AS lvl_change,
        c.updated_at,
        c.pseudo_history,
        c.data_source_id as loader_id,
        ds.color
      FROM current_data c
      LEFT JOIN prev_year_data p ON c.prev_year_date = p.date
      LEFT JOIN data_sources ds ON ds.id = c.data_source_id
      ORDER BY c.date DESC
    `;

    return rows;
  }

  /**
   * Gets all vintages (current + non-current) for a specific xseries + date,
   * ordered by created_at DESC (most recent first).
   */
  static async getVintagesByDate(opts: {
    xseriesId: number;
    date: string;
  }): Promise<VintageDataPoint[]> {
    const { xseriesId, date } = opts;
    const rows = await mysql<VintageDataPoint>`
      SELECT
        dp.date,
        dp.value,
        dp.created_at,
        dp.updated_at,
        dp.data_source_id,
        dp.current,
        dp.pseudo_history,
        ds.color
      FROM data_points dp
      LEFT JOIN data_sources ds ON ds.id = dp.data_source_id
      WHERE dp.xseries_id = ${xseriesId}
        AND dp.date = ${date}
      ORDER BY dp.created_at DESC
    `;

    return rows;
  }

  /**
   * Gets all vintages for an xseries — only dates that have more than one
   * data point (i.e. actual revision history). Returns a map of date string
   * to vintage array, ordered by created_at DESC within each date.
   */
  static async getAllVintages(opts: {
    xseriesId: number;
  }): Promise<Record<string, VintageDataPoint[]>> {
    const { xseriesId } = opts;
    const rows = await mysql<VintageDataPoint>`
      SELECT
        dp.date,
        dp.value,
        dp.created_at,
        dp.updated_at,
        dp.data_source_id,
        dp.current,
        dp.pseudo_history,
        ds.color
      FROM data_points dp
      LEFT JOIN data_sources ds ON ds.id = dp.data_source_id
      WHERE dp.xseries_id = ${xseriesId}
      ORDER BY dp.date DESC, dp.created_at DESC
    `;

    const map: Record<string, VintageDataPoint[]> = {};
    for (const row of rows) {
      const dateStr =
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(row);
    }
    return map;
  }
  /**
   * Gets non-current (vintage) data points for a set of series names, for
   * chart overlays. Returns a map of series name to vintage points ordered
   * by date DESC, created_at DESC. Every requested name gets an entry (empty
   * array when the series has no vintages). The limit caps how many vintages
   * are returned per observation date (most recently published first), not
   * per series.
   */
  static async getVintagesBySeriesNames(opts: {
    names: string[];
    universe?: string;
    limitPerDate?: number;
  }): Promise<Record<string, SeriesVintagePoint[]>> {
    const {
      names,
      universe,
      limitPerDate = VINTAGE_CHART_LIMIT_PER_DATE,
    } = opts;
    const map: Record<string, SeriesVintagePoint[]> = {};

    for (const name of names) {
      map[name] = [];
      type Row = { date: Date | string; value: number; created_at: Date };
      let rows: Row[];
      if (universe) {
        rows = await mysql<Row>`
          SELECT date, value, created_at FROM (
            SELECT dp.date, dp.value, dp.created_at,
              ROW_NUMBER() OVER (
                PARTITION BY dp.date ORDER BY dp.created_at DESC
              ) AS rn
            FROM series s
            JOIN data_points dp ON dp.xseries_id = s.xseries_id
            WHERE s.name = ${name}
              AND s.universe = ${universe.toUpperCase()}
              AND dp.current = 0
              AND dp.value IS NOT NULL
          ) ranked
          WHERE rn <= ${limitPerDate}
          ORDER BY date DESC, created_at DESC
        `;
      } else {
        rows = await mysql<Row>`
          SELECT date, value, created_at FROM (
            SELECT dp.date, dp.value, dp.created_at,
              ROW_NUMBER() OVER (
                PARTITION BY dp.date ORDER BY dp.created_at DESC
              ) AS rn
            FROM series s
            JOIN data_points dp ON dp.xseries_id = s.xseries_id
            WHERE s.name = ${name}
              AND dp.current = 0
              AND dp.value IS NOT NULL
          ) ranked
          WHERE rn <= ${limitPerDate}
          ORDER BY date DESC, created_at DESC
        `;
      }

      for (const row of rows) {
        map[name].push({
          date:
            row.date instanceof Date
              ? row.date.toISOString().slice(0, 10)
              : String(row.date).slice(0, 10),
          value: Number(row.value),
          publishedAt: row.created_at.toISOString().slice(0, 10),
        });
      }
    }

    return map;
  }

  /**
   * Sync the public_data_points table for a given universe.
   * Ported from Rails DataPoint.update_public_data_points.
   *
   * Three steps, each run per chunk of ~PUBLIC_SYNC_CHUNK_SIZE series so
   * that no single statement scans or locks a whole universe's slice of
   * data_points (the original universe-wide statements held shared locks
   * on millions of rows and thrashed the buffer pool):
   *   1. UPDATE existing rows where source data changed
   *   2. INSERT new rows that don't exist yet
   *   3. DELETE rows whose source data no longer exists (or series is quarantined)
   *
   * Incremental mode: a per-universe watermark (public_sync_watermarks)
   * records when the last sync started. Chunks whose series have had no
   * loader activity (data_sources created/updated) or series metadata
   * changes since the watermark are skipped. Every reload path ends by
   * stamping data_sources.updated_at, so this covers reload-driven writes
   * including `current` flag flips that don't touch data_points timestamps.
   * Writes that bypass loaders (manual point edits) are picked up by the
   * automatic full pass, which runs when there is no watermark, when the
   * last full pass is older than FULL_SYNC_INTERVAL_HOURS, or when
   * `{ full: true }` is passed.
   */
  static async updatePublicDataPoints(
    universe: string,
    opts: PublicSyncOptions = {},
  ): Promise<void> {
    const t0 = Date.now();
    log.info({ universe }, `Public update: starting ${universe}`);

    // Timestamps come from the DB (HST wall-clock, per the app convention)
    // so they compare cleanly against NOW()-stamped columns. Taken at the
    // START of the run so anything written while we work is re-examined
    // next time.
    const runStartedAt = await dbNowString();

    // Check if quarantined series should be removed from public
    const toggleRows = await mysql<{ status: boolean | number | null }>`
      SELECT status FROM feature_toggles
      WHERE name = 'remove_quarantined_from_public' AND universe = ${universe}
      LIMIT 1
    `;
    const removeQuarantine = Boolean(toggleRows[0]?.status);

    // Decide full vs incremental
    const wm = await getPublicSyncWatermark(universe);
    let full = Boolean(opts.full);
    let reason = opts.full ? "requested" : "incremental";
    if (!full && (!wm || !wm.synced_at)) {
      full = true;
      reason = "no watermark";
    } else if (!full && !wm?.full_synced_at) {
      full = true;
      reason = "no prior full pass";
    } else if (
      !full &&
      wm?.full_synced_at &&
      hoursBetween(wm.full_synced_at, runStartedAt) >= FULL_SYNC_INTERVAL_HOURS
    ) {
      full = true;
      reason = "full pass overdue";
    }
    const since = full ? null : (wm?.synced_at ?? null);
    log.info(
      { universe, mode: full ? "full" : "incremental", reason, since },
      `Public update: ${universe} running ${full ? "full" : "incremental"} sync (${reason})`,
    );

    // All series in the universe, with their quarantine flag. Steps 1+2
    // apply only to non-quarantined series; step 3 applies to all (the
    // quarantine clause is what removes quarantined series' rows).
    const seriesRows = await mysql<{
      id: number;
      xseries_id: number;
      quarantined: number | boolean | null;
    }>`
      SELECT s.id, s.xseries_id, COALESCE(xs.quarantined, 0) AS quarantined
      FROM series s
      JOIN xseries xs ON xs.id = s.xseries_id
      WHERE s.universe = ${universe}
      ORDER BY s.id
    `;
    const eligible = seriesRows.filter((r) => !Number(r.quarantined));
    const eligibleChunks = chunk(eligible, PUBLIC_SYNC_CHUNK_SIZE);
    const allChunks = chunk(seriesRows, PUBLIC_SYNC_CHUNK_SIZE);
    log.info(
      {
        universe,
        series: seriesRows.length,
        eligible: eligible.length,
        chunks: eligibleChunks.length,
      },
      `Public update: ${universe} resolved ${seriesRows.length} series (${eligible.length} eligible, ${seriesRows.length - eligible.length} quarantined) in ${eligibleChunks.length} chunks`,
    );

    const totals = { updated: 0, inserted: 0, deleted: 0, skipped: 0 };

    // ── Steps 1 + 2: UPDATE changed, INSERT missing ─────────────────────
    log.info(
      { universe },
      `Public update: ${universe} step 1/2 — updating changed and inserting missing public data points`,
    );
    for (let i = 0; i < eligibleChunks.length; i++) {
      const c = eligibleChunks[i];
      const ids = c.map((r) => r.id);
      const xids = c.map((r) => r.xseries_id);

      if (since && !(await chunkHasActivity(ids, since))) {
        totals.skipped++;
        continue;
      }

      if (opts.yieldPoint) await opts.yieldPoint();

      const updated = await rawQueryAffected(
        `UPDATE public_data_points p
         JOIN series s ON s.id = p.series_id
         JOIN data_points d
           ON d.xseries_id = s.xseries_id
           AND d.date = p.date
           AND d.current = 1
         SET p.value = d.value,
             p.pseudo_history = COALESCE(d.pseudo_history, 0),
             p.updated_at = COALESCE(d.updated_at, d.created_at)
         WHERE p.series_id IN (${placeholders(ids)})
           AND d.xseries_id IN (${placeholders(xids)})
           AND (COALESCE(d.updated_at, d.created_at) > p.updated_at
             OR NOT (p.value <=> d.value)
             OR p.pseudo_history != COALESCE(d.pseudo_history, 0))`,
        [...ids, ...xids],
      );

      const inserted = await rawQueryAffected(
        `INSERT INTO public_data_points (series_id, date, value, pseudo_history, created_at, updated_at)
         SELECT s.id, d.date, d.value, COALESCE(d.pseudo_history, 0), d.created_at, COALESCE(d.updated_at, d.created_at)
         FROM series s
         JOIN data_points d ON d.xseries_id = s.xseries_id
         LEFT JOIN public_data_points p ON p.series_id = s.id AND p.date = d.date
         WHERE s.id IN (${placeholders(ids)})
           AND d.xseries_id IN (${placeholders(xids)})
           AND d.current = 1
           AND p.created_at IS NULL`,
        [...ids, ...xids],
      );

      totals.updated += updated;
      totals.inserted += inserted;
      log.debug(
        {
          universe,
          chunk: i + 1,
          of: eligibleChunks.length,
          updated,
          inserted,
        },
        "updatePublicDataPoints: chunk upserted",
      );
      if (i + 1 < eligibleChunks.length) await Bun.sleep(PUBLIC_SYNC_SLEEP_MS);
    }
    log.info(
      { universe, ...totals },
      `Public update: ${universe} step 1/2 done — ${totals.updated} updated, ${totals.inserted} inserted, ${totals.skipped} quiet chunks skipped`,
    );

    // ── Step 3: DELETE stale ────────────────────────────────────────────
    log.info(
      { universe, removeQuarantine },
      `Public update: ${universe} step 2/2 — deleting stale${removeQuarantine ? " and quarantined" : ""} public data points`,
    );
    for (let i = 0; i < allChunks.length; i++) {
      const c = allChunks[i];
      const ids = c.map((r) => r.id);
      const xids = c.map((r) => r.xseries_id);
      const hasQuarantined = c.some((r) => Number(r.quarantined));

      // Quarantined series must always be swept when the toggle is on;
      // otherwise a quiet chunk can be skipped.
      if (
        since &&
        !(removeQuarantine && hasQuarantined) &&
        !(await chunkHasActivity(ids, since))
      ) {
        continue;
      }

      if (opts.yieldPoint) await opts.yieldPoint();

      const quarantineClause = removeQuarantine ? "OR xs.quarantined = 1" : "";
      const deleted = await rawQueryAffected(
        `DELETE p
         FROM public_data_points p
         JOIN series s ON s.id = p.series_id
         JOIN xseries xs ON xs.id = s.xseries_id
         LEFT JOIN data_points d
           ON d.xseries_id = xs.id AND d.date = p.date AND d.current = 1
         WHERE p.series_id IN (${placeholders(ids)})
           AND xs.id IN (${placeholders(xids)})
           AND (d.created_at IS NULL ${quarantineClause})`,
        [...ids, ...xids],
      );
      totals.deleted += deleted;
      log.debug(
        { universe, chunk: i + 1, of: allChunks.length, deleted },
        "updatePublicDataPoints: chunk deleted",
      );
      if (i + 1 < allChunks.length) await Bun.sleep(PUBLIC_SYNC_SLEEP_MS);
    }

    log.info(
      { universe, deleted: totals.deleted },
      `Public update: ${universe} step 2/2 done — ${totals.deleted} deleted`,
    );

    await setPublicSyncWatermark(universe, runStartedAt, full);
    const elapsedSec = Math.round((Date.now() - t0) / 1000);
    log.info(
      { universe, mode: full ? "full" : "incremental", elapsedSec, ...totals },
      `Public update: completed ${universe} in ${elapsedSec}s (${totals.updated} updated, ${totals.inserted} inserted, ${totals.deleted} deleted)`,
    );
  }

  /** Update public data points for a single series. */
  static async updatePublicDataPointsForSeries(
    seriesId: number,
    universe: string,
  ): Promise<void> {
    log.info(
      { seriesId, universe },
      "updatePublicDataPointsForSeries: starting",
    );

    // 1. UPDATE existing public data points
    await rawQuery(
      `UPDATE public_data_points p
       JOIN (
         SELECT s.id, s.xseries_id
         FROM series s
         JOIN xseries xs ON xs.id = s.xseries_id
         WHERE s.id = ?
           AND s.universe = ?
           AND COALESCE(xs.quarantined, 0) = 0
       ) sub ON sub.id = p.series_id
       JOIN data_points d
         ON d.xseries_id = sub.xseries_id
         AND d.date = p.date
         AND d.current = 1
       SET p.value = d.value,
           p.pseudo_history = COALESCE(d.pseudo_history, 0),
           p.updated_at = COALESCE(d.updated_at, d.created_at)
       WHERE COALESCE(d.updated_at, d.created_at) > p.updated_at
          OR NOT (p.value <=> d.value)
          OR p.pseudo_history != COALESCE(d.pseudo_history, 0)`,
      [seriesId, universe],
    );

    // 2. INSERT new public data points
    await rawQuery(
      `INSERT INTO public_data_points (series_id, date, value, pseudo_history, created_at, updated_at)
       SELECT s.id, d.date, d.value, COALESCE(d.pseudo_history, 0), d.created_at, COALESCE(d.updated_at, d.created_at)
       FROM series s
       JOIN xseries xs ON xs.id = s.xseries_id
       JOIN data_points d ON d.xseries_id = s.xseries_id
       LEFT JOIN public_data_points p ON p.series_id = s.id AND p.date = d.date
       WHERE s.id = ?
         AND s.universe = ?
         AND COALESCE(xs.quarantined, 0) = 0
         AND d.current = 1
         AND p.created_at IS NULL`,
      [seriesId, universe],
    );

    // 3. DELETE stale public data points
    await rawQuery(
      `DELETE p
       FROM public_data_points p
       JOIN series s ON s.id = p.series_id
       JOIN xseries xs ON xs.id = s.xseries_id
       LEFT JOIN data_points d ON d.xseries_id = xs.id AND d.date = p.date AND d.current = 1
       WHERE s.id = ?
         AND s.universe = ?
         AND d.created_at IS NULL`,
      [seriesId, universe],
    );

    log.info({ seriesId, universe }, "updatePublicDataPointsForSeries: done");
  }

  /**
   * Update public data points for all universes.
   * Ported from Rails DataPoint.update_public_all_universes.
   */
  static async updatePublicAllUniverses(
    opts: PublicSyncOptions = {},
  ): Promise<void> {
    const rows = await mysql<{ name: string }>`SELECT name FROM universe`;
    if (rows.length === 0) {
      throw new Error("No universes found");
    }
    const universes = rows.map((r) => r.name);
    const t0 = Date.now();
    log.info(
      { universes },
      `Public update: starting all universes (${universes.join(", ")})`,
    );
    for (let i = 0; i < universes.length; i++) {
      log.info(
        { universe: universes[i], progress: `${i + 1}/${universes.length}` },
        `Public update: universe ${i + 1}/${universes.length} — ${universes[i]}`,
      );
      await this.updatePublicDataPoints(universes[i], opts);
    }
    const elapsedSec = Math.round((Date.now() - t0) / 1000);
    log.info(
      { universes, elapsedSec },
      `Public update: completed all universes in ${elapsedSec}s`,
    );
  }
}

export default DataPointCollection;
