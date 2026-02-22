import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import DataPointModel from "../models/data-point";
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
   * Sync the public_data_points table for a given universe.
   * Ported from Rails DataPoint.update_public_data_points.
   *
   * Three-step transaction:
   *   1. UPDATE existing rows where source data changed
   *   2. INSERT new rows that don't exist yet
   *   3. DELETE rows whose source data no longer exists (or series is quarantined)
   *
   * NOTE: In the future this will be dispatched to a job queue
   * rather than executed on the main thread.
   */
  static async updatePublicDataPoints(universe: string): Promise<void> {
    log.info({ universe }, "updatePublicDataPoints: starting");

    // Check if quarantined series should be removed from public
    const toggleRows = await mysql<{ status: boolean | number | null }>`
      SELECT status FROM feature_toggles
      WHERE name = 'remove_quarantined_from_public' AND universe = ${universe}
      LIMIT 1
    `;
    const removeQuarantine = Boolean(toggleRows[0]?.status);

    const quarantineClause = removeQuarantine ? "OR xs.quarantined = 1" : "";

    // 1. UPDATE existing public data points where source data has changed
    await rawQuery(
      `UPDATE public_data_points p
       JOIN (
         SELECT s.id, s.xseries_id
         FROM series s
         JOIN xseries xs ON xs.id = s.xseries_id
         WHERE s.universe = ?
         AND COALESCE(xs.quarantined, 0) = 0
       ) sub ON sub.id = p.series_id
       JOIN data_points d
         ON d.xseries_id = sub.xseries_id
         AND d.date = p.date
         AND d.current = 1
       SET p.value = d.value,
           p.pseudo_history = d.pseudo_history,
           p.updated_at = COALESCE(d.updated_at, d.created_at)
       WHERE COALESCE(d.updated_at, d.created_at) > p.updated_at`,
      [universe],
    );
    log.info({ universe }, "updatePublicDataPoints: update done");

    // 2. INSERT new public data points
    await rawQuery(
      `INSERT INTO public_data_points (series_id, date, value, pseudo_history, created_at, updated_at)
       SELECT s.id, d.date, d.value, d.pseudo_history, d.created_at, COALESCE(d.updated_at, d.created_at)
       FROM series s
       JOIN xseries xs ON xs.id = s.xseries_id
       JOIN data_points d ON d.xseries_id = s.xseries_id
       LEFT JOIN public_data_points p ON p.series_id = s.id AND p.date = d.date
       WHERE s.universe = ?
         AND NOT xs.quarantined
         AND d.current = 1
         AND p.created_at IS NULL`,
      [universe],
    );
    log.info({ universe }, "updatePublicDataPoints: insert done");

    // 3. DELETE stale public data points
    await rawQuery(
      `DELETE p
       FROM public_data_points p
       JOIN series s ON s.id = p.series_id
       JOIN xseries xs ON xs.id = s.xseries_id
       LEFT JOIN data_points d ON d.xseries_id = xs.id AND d.date = p.date AND d.current = 1
       WHERE s.universe = ?
         AND (d.created_at IS NULL ${quarantineClause})`,
      [universe],
    );
    log.info({ universe }, "updatePublicDataPoints: delete done");
  }

  /**
   * Update public data points for all universes.
   * Ported from Rails DataPoint.update_public_all_universes.
   */
  static async updatePublicAllUniverses(): Promise<void> {
    const universes = ["UHERO", "FC", "COH", "CCOM"];
    for (const u of universes) {
      await this.updatePublicDataPoints(u);
    }
  }
}

export default DataPointCollection;
