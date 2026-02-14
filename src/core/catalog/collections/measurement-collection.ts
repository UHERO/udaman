import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Measurement from "../models/measurement";
import type { MeasurementAttrs } from "../models/measurement";
import type { SeasonalAdjustment, Universe } from "../types/shared";

export type CreateMeasurementPayload = {
  prefix: string;
  dataPortalName?: string | null;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  decimals?: number;
  percent?: boolean;
  real?: boolean;
  restricted?: boolean;
  seasonalAdjustment?: SeasonalAdjustment | null;
  frequencyTransform?: string | null;
  sourceLink?: string | null;
  notes?: string | null;
  universe?: Universe;
};

export type UpdateMeasurementPayload = Partial<CreateMeasurementPayload>;

class MeasurementCollection {
  /** Fetch all measurements, optionally filtered by universe */
  static async list(
    options: { universe?: Universe } = {},
  ): Promise<Measurement[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<MeasurementAttrs>`
        SELECT * FROM measurements WHERE universe = ${universe} ORDER BY prefix ASC
      `;
      return rows.map((row) => new Measurement(row));
    }
    const rows = await mysql<MeasurementAttrs>`
      SELECT * FROM measurements ORDER BY prefix ASC
    `;
    return rows.map((row) => new Measurement(row));
  }

  /** Fetch all measurements with unit short labels (for list pages) */
  static async listWithUnits(options: { universe?: Universe } = {}) {
    const { universe } = options;
    const rows = universe
      ? await mysql<MeasurementAttrs & { unit_short_label: string | null }>`
          SELECT m.*, u.short_label as unit_short_label
          FROM measurements m
          LEFT JOIN units u ON u.id = m.unit_id
          WHERE m.universe = ${universe}
          ORDER BY m.prefix ASC
        `
      : await mysql<MeasurementAttrs & { unit_short_label: string | null }>`
          SELECT m.*, u.short_label as unit_short_label
          FROM measurements m
          LEFT JOIN units u ON u.id = m.unit_id
          ORDER BY m.prefix ASC
        `;
    return rows.map((row) => ({
      ...new Measurement(row).toJSON(),
      unitShortLabel: row.unit_short_label ?? null,
    }));
  }

  /** Fetch a single measurement by ID */
  static async getById(id: number): Promise<Measurement> {
    const rows = await mysql<MeasurementAttrs>`
      SELECT * FROM measurements WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Measurement not found: ${id}`);
    return new Measurement(row);
  }

  /** Fetch a measurement by prefix within a universe */
  static async getByPrefix(
    prefix: string,
    universe: Universe = "UHERO",
  ): Promise<Measurement> {
    const rows = await mysql<MeasurementAttrs>`
      SELECT * FROM measurements
      WHERE universe = ${universe} AND prefix = ${prefix}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Measurement not found: ${universe}/${prefix}`);
    return new Measurement(row);
  }

  /** Create a new measurement */
  static async create(payload: CreateMeasurementPayload): Promise<Measurement> {
    const {
      prefix,
      dataPortalName,
      unitId,
      sourceId,
      sourceDetailId,
      decimals = 1,
      percent = false,
      real = false,
      restricted = false,
      seasonalAdjustment,
      frequencyTransform,
      sourceLink,
      notes,
      universe = "UHERO",
    } = payload;

    await mysql`
      INSERT INTO measurements (
        universe, prefix, data_portal_name, unit_id, source_id,
        source_detail_id, decimals, percent, real, restricted,
        seasonal_adjustment, frequency_transform, source_link, notes,
        created_at, updated_at
      ) VALUES (
        ${universe}, ${prefix}, ${dataPortalName ?? null}, ${unitId ?? null},
        ${sourceId ?? null}, ${sourceDetailId ?? null}, ${decimals},
        ${percent ? 1 : 0}, ${real ? 1 : 0}, ${restricted ? 1 : 0},
        ${seasonalAdjustment ?? null}, ${frequencyTransform ?? null},
        ${sourceLink ?? null}, ${notes ?? null}, NOW(), NOW()
      )
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a measurement */
  static async update(
    id: number,
    updates: UpdateMeasurementPayload,
  ): Promise<Measurement> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE measurements
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Get series IDs associated with a measurement */
  static async getSeriesIds(measurementId: number): Promise<number[]> {
    const rows = await mysql<{ series_id: number }>`
      SELECT series_id FROM measurement_series
      WHERE measurement_id = ${measurementId}
    `;
    return rows.map((row) => row.series_id);
  }

  /** Add a series to a measurement */
  static async addSeries(
    measurementId: number,
    seriesId: number,
  ): Promise<void> {
    const existing = await mysql<{ id: number }>`
      SELECT id FROM measurement_series
      WHERE measurement_id = ${measurementId} AND series_id = ${seriesId}
      LIMIT 1
    `;
    if (existing[0]) return;

    await mysql`
      INSERT INTO measurement_series (measurement_id, series_id)
      VALUES (${measurementId}, ${seriesId})
    `;
  }

  /** Remove a series from a measurement */
  static async removeSeries(
    measurementId: number,
    seriesId: number,
  ): Promise<void> {
    await mysql`
      DELETE FROM measurement_series
      WHERE measurement_id = ${measurementId} AND series_id = ${seriesId}
    `;
  }

  /** Delete a measurement and its bridge table rows */
  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM measurement_series WHERE measurement_id = ${id}`;
    await mysql`DELETE FROM data_list_measurements WHERE measurement_id = ${id}`;
    await mysql`DELETE FROM measurements WHERE id = ${id}`;
  }
}

export default MeasurementCollection;
