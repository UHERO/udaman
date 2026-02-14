import { mysql, rawQuery } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import TimeSeries from "../models/time-series";
import type { TimeSeriesAttrs } from "../models/time-series";
import type { SeasonalAdjustment } from "../types/shared";

// ─── Payload types ───────────────────────────────────────────────────

export type CreateTimeSeriesPayload = {
  primarySeriesId?: number | null;
  frequency?: string | null;
  seasonalAdjustment?: SeasonalAdjustment | null;
  seasonallyAdjusted?: boolean | null;
  restricted?: boolean;
  quarantined?: boolean;
  percent?: boolean | null;
  real?: boolean | null;
  baseYear?: number | null;
  frequencyTransform?: string | null;
  factorApplication?: string | null;
  factors?: string | null;
  aremosMissing?: number | null;
  aremosDiff?: number | null;
  mult?: number | null;
  units?: number;
};

export type UpdateTimeSeriesPayload = Partial<CreateTimeSeriesPayload> & {
  lastDemetraDate?: Date | null;
  lastDemetraDatestring?: string | null;
};

// `real` is a reserved keyword in MariaDB, so we must backtick-quote it
// in raw SQL. Tagged template literals (mysql`...`) use backticks as
// delimiters, making it impossible to embed literal backticks reliably.
// Queries that reference the `real` column use rawQuery() instead.

const SELECT_COLS = `
  id, primary_series_id, restricted, quarantined,
  frequency, seasonally_adjusted, seasonal_adjustment,
  aremos_missing, aremos_diff, mult, units,
  percent, \`real\`, base_year, frequency_transform,
  last_demetra_date, last_demetra_datestring,
  factor_application, factors,
  created_at, updated_at`;

const SELECT_COLS_PREFIXED = SELECT_COLS.replace(/(\w+)/g, "x.$1");

// ─── Collection ──────────────────────────────────────────────────────

class TimeSeriesCollection {
  /** Fetch a TimeSeries by its id (xseries.id). */
  static async getById(id: number): Promise<TimeSeries> {
    const rows = await rawQuery<TimeSeriesAttrs>(
      `SELECT ${SELECT_COLS} FROM xseries WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error(`TimeSeries not found: ${id}`);
    return new TimeSeries(row);
  }

  /** Fetch the TimeSeries associated with a series id. */
  static async getBySeriesId(seriesId: number): Promise<TimeSeries> {
    const rows = await rawQuery<TimeSeriesAttrs>(
      `SELECT ${SELECT_COLS_PREFIXED}
       FROM xseries x
       JOIN series s ON s.xseries_id = x.id
       WHERE s.id = ? LIMIT 1`,
      [seriesId],
    );
    const row = rows[0];
    if (!row) throw new Error(`TimeSeries not found for series: ${seriesId}`);
    return new TimeSeries(row);
  }

  /** Create a new TimeSeries record. Returns the new model instance. */
  static async create(payload: CreateTimeSeriesPayload): Promise<TimeSeries> {
    await rawQuery(
      `INSERT INTO xseries (
        primary_series_id, frequency, seasonal_adjustment, seasonally_adjusted,
        restricted, quarantined, percent, \`real\`, base_year,
        frequency_transform, factor_application, factors,
        aremos_missing, aremos_diff, mult, units,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        payload.primarySeriesId ?? null,
        payload.frequency ?? null,
        payload.seasonalAdjustment ?? null,
        payload.seasonallyAdjusted ?? null,
        payload.restricted ?? false,
        payload.quarantined ?? false,
        payload.percent ?? null,
        payload.real ?? null,
        payload.baseYear ?? null,
        payload.frequencyTransform ?? null,
        payload.factorApplication ?? null,
        payload.factors ?? null,
        payload.aremosMissing ?? null,
        payload.aremosDiff ?? null,
        payload.mult ?? null,
        payload.units ?? 1,
      ] as any[],
    );

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a TimeSeries record. Returns the updated model instance. */
  static async update(
    id: number,
    payload: UpdateTimeSeriesPayload,
  ): Promise<TimeSeries> {
    const updateObj = buildUpdateObject(payload);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE xseries
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return this.getById(id);
  }

  /** Delete a TimeSeries record by id. Also cascades to data_points. */
  static async delete(id: number): Promise<void> {
    // data_points references xseries_id — delete explicitly
    await mysql`DELETE FROM data_points WHERE xseries_id = ${id}`;
    await mysql`DELETE FROM xseries WHERE id = ${id}`;
  }

  /** Set the primary series for a TimeSeries. */
  static async setPrimarySeries(
    id: number,
    seriesId: number,
  ): Promise<TimeSeries> {
    return this.update(id, { primarySeriesId: seriesId });
  }

  /** Update the base year for a TimeSeries. */
  static async setBaseYear(
    id: number,
    baseYear: number | null,
  ): Promise<TimeSeries> {
    return this.update(id, { baseYear });
  }
}

export default TimeSeriesCollection;
