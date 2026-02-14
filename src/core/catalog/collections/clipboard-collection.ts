import { mysql } from "@/lib/mysql/db";

import type { SeasonalAdjustment } from "../types/shared";

/** Row shape returned by the clipboard summary query. */
export interface ClipboardSeriesRow {
  id: number;
  name: string;
  frequency: string | null;
  seasonalAdjustment: SeasonalAdjustment | null;
  geography: string | null;
  unitShortLabel: string | null;
  sourceDescription: string | null;
  minDate: Date | null;
  maxDate: Date | null;
}

class ClipboardCollection {
  /**
   * Get all series on the user's clipboard with summary info for display.
   */
  static async list(userId: number): Promise<ClipboardSeriesRow[]> {
    const rows = await mysql<{
      id: number;
      xseries_id: number;
      name: string;
      frequency: string | null;
      seasonal_adjustment: string | null;
      geography: string | null;
      unit_short_label: string | null;
      source_description: string | null;
    }>`
      SELECT
        s.id,
        s.xseries_id,
        s.name,
        xs.frequency,
        xs.seasonal_adjustment,
        g.handle AS geography,
        u.short_label AS unit_short_label,
        src.description AS source_description
      FROM user_series us
        JOIN series s ON s.id = us.series_id
        JOIN xseries xs ON xs.id = s.xseries_id
        LEFT JOIN geographies g ON g.id = s.geography_id
        LEFT JOIN units u ON u.id = s.unit_id
        LEFT JOIN sources src ON src.id = s.source_id
      WHERE us.user_id = ${userId}
      ORDER BY s.name
    `;

    if (rows.length === 0) return [];

    // Fetch date ranges in a separate query (same pattern as SeriesCollection)
    const xseriesIds = rows.map((r) => r.xseries_id);
    const dateRows = await mysql<{
      id: number;
      min_date: Date | null;
      max_date: Date | null;
    }>`
      SELECT
        xseries_id AS id,
        MIN(date) AS min_date,
        MAX(date) AS max_date
      FROM data_points
      WHERE xseries_id IN ${mysql(xseriesIds)} AND current = 1
      GROUP BY xseries_id
    `;
    const dateMap = new Map(dateRows.map((d) => [d.id, d]));

    return rows.map((r) => {
      const dateInfo = dateMap.get(r.xseries_id);
      return {
        id: r.id,
        name: r.name,
        frequency: r.frequency,
        seasonalAdjustment: r.seasonal_adjustment as SeasonalAdjustment | null,
        geography: r.geography,
        unitShortLabel: r.unit_short_label,
        sourceDescription: r.source_description,
        minDate: dateInfo?.min_date ?? null,
        maxDate: dateInfo?.max_date ?? null,
      };
    });
  }

  /** Return the count of series on the user's clipboard. */
  static async count(userId: number): Promise<number> {
    const rows = await mysql<{ cnt: number }>`
      SELECT COUNT(*) AS cnt FROM user_series WHERE user_id = ${userId}
    `;
    return Number(rows[0].cnt);
  }

  /**
   * Add a single series to the user's clipboard.
   * Silently ignores duplicates.
   */
  static async addSeries(userId: number, seriesId: number): Promise<void> {
    await mysql`
      INSERT IGNORE INTO user_series (user_id, series_id)
      VALUES (${userId}, ${seriesId})
    `;
  }

  /**
   * Add multiple series to the user's clipboard.
   * Silently ignores duplicates. Returns the number of rows actually inserted.
   */
  static async addMultipleSeries(
    userId: number,
    seriesIds: number[],
  ): Promise<number> {
    if (seriesIds.length === 0) return 0;

    const before = await this.count(userId);

    // Insert each one with INSERT IGNORE
    for (const sid of seriesIds) {
      await mysql`
        INSERT IGNORE INTO user_series (user_id, series_id)
        VALUES (${userId}, ${sid})
      `;
    }

    const after = await this.count(userId);
    return after - before;
  }

  /** Remove a single series from the user's clipboard. */
  static async removeSeries(userId: number, seriesId: number): Promise<void> {
    await mysql`
      DELETE FROM user_series
      WHERE user_id = ${userId} AND series_id = ${seriesId}
    `;
  }

  /** Clear all series from the user's clipboard. */
  static async clear(userId: number): Promise<number> {
    const count = await this.count(userId);
    await mysql`DELETE FROM user_series WHERE user_id = ${userId}`;
    return count;
  }

  /**
   * Get series names, xseries_ids, and frequency for all clipboard series (for bulk export).
   */
  static async getSeriesExportInfo(
    userId: number,
  ): Promise<
    { id: number; xseriesId: number; name: string; frequency: string | null }[]
  > {
    const rows = await mysql<{
      id: number;
      xseries_id: number;
      name: string;
      frequency: string | null;
    }>`
      SELECT s.id, s.xseries_id, s.name, xs.frequency
      FROM user_series us
        JOIN series s ON s.id = us.series_id
        JOIN xseries xs ON xs.id = s.xseries_id
      WHERE us.user_id = ${userId}
      ORDER BY s.name
    `;
    return rows.map((r) => ({
      id: r.id,
      xseriesId: r.xseries_id,
      name: r.name,
      frequency: r.frequency,
    }));
  }

  /**
   * Bulk-fetch current (date, value) pairs for multiple xseries IDs.
   * Returns a map of xseries_id → array of { date, value }.
   */
  static async getBulkCurrentValues(
    xseriesIds: number[],
  ): Promise<Map<number, { date: string; value: number | null }[]>> {
    if (xseriesIds.length === 0) return new Map();

    const rows = await mysql<{
      xseries_id: number;
      date: Date;
      value: number | null;
    }>`
      SELECT xseries_id, date, value
      FROM data_points
      WHERE xseries_id IN ${mysql(xseriesIds)} AND current = 1
      ORDER BY date
    `;

    const map = new Map<number, { date: string; value: number | null }[]>();
    for (const r of rows) {
      const dateStr =
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date);
      if (!map.has(r.xseries_id)) map.set(r.xseries_id, []);
      map.get(r.xseries_id)!.push({ date: dateStr, value: r.value });
    }
    return map;
  }

  /** Get series IDs on the clipboard (for bulk operations). */
  static async getSeriesIds(userId: number): Promise<number[]> {
    const rows = await mysql<{ series_id: number }>`
      SELECT series_id FROM user_series WHERE user_id = ${userId}
    `;
    return rows.map((r) => Number(r.series_id));
  }
}

export default ClipboardCollection;
