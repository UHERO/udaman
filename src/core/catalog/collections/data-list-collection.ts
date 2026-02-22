import { mysql, rawQuery } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import DataList from "../models/data-list";
import type { DataListAttrs } from "../models/data-list";
import Series from "../models/series";
import type { Universe } from "../types/shared";
import MeasurementCollection from "./measurement-collection";

export type CreateDataListPayload = {
  name?: string | null;
  universe?: Universe;
};

export type UpdateDataListPayload = Partial<{
  name: string | null;
  universe: Universe;
  startYear: number | null;
  ownedBy: number | null;
}>;

class DataListCollection {
  /** Fetch all data lists, optionally filtered by universe */
  static async list(
    options: { universe?: Universe } = {},
  ): Promise<DataList[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<DataListAttrs>`
        SELECT * FROM data_lists WHERE universe = ${universe} ORDER BY name ASC
      `;
      return rows.map((row) => new DataList(row));
    }
    const rows = await mysql<DataListAttrs>`
      SELECT * FROM data_lists ORDER BY name ASC
    `;
    return rows.map((row) => new DataList(row));
  }

  /** Fetch all data lists with their measurement counts */
  static async listWithCounts(options: { universe?: Universe } = {}) {
    const { universe } = options;
    const rows = universe
      ? await mysql<DataListAttrs & { measurement_count: number }>`
          SELECT dl.*, COUNT(dlm.measurement_id) as measurement_count
          FROM data_lists dl
          LEFT JOIN data_list_measurements dlm ON dlm.data_list_id = dl.id
          WHERE dl.universe = ${universe}
          GROUP BY dl.id
          ORDER BY dl.name ASC
        `
      : await mysql<DataListAttrs & { measurement_count: number }>`
          SELECT dl.*, COUNT(dlm.measurement_id) as measurement_count
          FROM data_lists dl
          LEFT JOIN data_list_measurements dlm ON dlm.data_list_id = dl.id
          GROUP BY dl.id
          ORDER BY dl.name ASC
        `;
    return rows.map((row) => ({
      ...new DataList(row).toJSON(),
      measurementCount: Number(row.measurement_count),
    }));
  }

  /** Fetch the email of the owner of a data list */
  static async getOwnerEmail(ownedBy: number | null): Promise<string | null> {
    if (!ownedBy) return null;
    const rows = await mysql<{ email: string }>`
      SELECT email FROM users WHERE id = ${ownedBy} LIMIT 1
    `;
    return rows[0]?.email ?? null;
  }

  /** List users (id + email) for owner selection */
  static async listUsers(): Promise<{ id: number; email: string }[]> {
    return mysql<{ id: number; email: string }>`
      SELECT id, email FROM users ORDER BY email ASC
    `;
  }

  /** Fetch a single data list by ID */
  static async getById(id: number): Promise<DataList> {
    const rows = await mysql<DataListAttrs>`
      SELECT * FROM data_lists WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`DataList not found: ${id}`);
    return new DataList(row);
  }

  /** Fetch a single data list by name */
  static async getByName(
    name: string,
    universe: Universe = "UHERO",
  ): Promise<DataList> {
    const rows = await mysql<DataListAttrs>`
      SELECT * FROM data_lists
      WHERE universe = ${universe} AND name = ${name}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`DataList not found: ${name}`);
    return new DataList(row);
  }

  /** Create a new data list */
  static async create(payload: CreateDataListPayload): Promise<DataList> {
    const { name, universe = "UHERO" } = payload;

    await mysql`
      INSERT INTO data_lists (universe, name, created_at, updated_at)
      VALUES (${universe}, ${name ?? null}, NOW(), NOW())
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a data list */
  static async update(
    id: number,
    updates: UpdateDataListPayload,
  ): Promise<DataList> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates, {
      startYear: "startyear",
      ownedBy: "owned_by",
    });
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE data_lists
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a data list (throws if referenced by categories) */
  static async delete(id: number): Promise<void> {
    const categoryRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM categories WHERE data_list_id = ${id}
    `;
    if (categoryRefs[0].cnt > 0) {
      throw new Error(
        `Cannot delete data list (id=${id}): referenced by categories`,
      );
    }

    await mysql`DELETE FROM data_list_measurements WHERE data_list_id = ${id}`;
    await mysql`DELETE FROM data_lists WHERE id = ${id}`;
  }

  /** Get measurement IDs associated with a data list, ordered by list_order */
  static async getMeasurementIds(
    dataListId: number,
  ): Promise<{ measurementId: number; listOrder: number; indent: string }[]> {
    return mysql<{ measurementId: number; listOrder: number; indent: string }>`
      SELECT measurement_id as measurementId, list_order as listOrder, indent
      FROM data_list_measurements
      WHERE data_list_id = ${dataListId}
      ORDER BY list_order ASC
    `;
  }

  /** Add a measurement to a data list */
  static async addMeasurement(
    dataListId: number,
    measurementId: number,
    listOrder?: number,
    indent: string = "indent0",
  ): Promise<void> {
    // Check if already linked
    const existing = await mysql<{ id: number }>`
      SELECT id FROM data_list_measurements
      WHERE data_list_id = ${dataListId} AND measurement_id = ${measurementId}
      LIMIT 1
    `;
    if (existing[0]) return;

    // Default list_order to last + 1
    if (listOrder == null) {
      const rows = await mysql<{ maxOrder: number | null }>`
        SELECT MAX(list_order) as maxOrder
        FROM data_list_measurements WHERE data_list_id = ${dataListId}
      `;
      listOrder = (rows[0]?.maxOrder ?? -1) + 1;
    }

    await mysql`
      INSERT INTO data_list_measurements (data_list_id, measurement_id, list_order, indent)
      VALUES (${dataListId}, ${measurementId}, ${listOrder}, ${indent})
    `;
  }

  /** Remove a measurement from a data list, then re-sequence list_order */
  static async removeMeasurement(
    dataListId: number,
    measurementId: number,
  ): Promise<void> {
    await mysql`
      DELETE FROM data_list_measurements
      WHERE data_list_id = ${dataListId} AND measurement_id = ${measurementId}
    `;
    // Re-sequence remaining list_order values to close gaps
    const remaining = await mysql<{ measurement_id: number }>`
      SELECT measurement_id FROM data_list_measurements
      WHERE data_list_id = ${dataListId}
      ORDER BY list_order ASC
    `;
    for (let i = 0; i < remaining.length; i++) {
      await mysql`
        UPDATE data_list_measurements
        SET list_order = ${i}
        WHERE data_list_id = ${dataListId} AND measurement_id = ${remaining[i].measurement_id}
      `;
    }
  }

  /** Get measurements with display data for the edit table */
  static async getMeasurementsForEdit(dataListId: number): Promise<
    {
      measurementId: number;
      prefix: string;
      dataPortalName: string | null;
      listOrder: number;
      indent: string;
    }[]
  > {
    return mysql<{
      measurementId: number;
      prefix: string;
      dataPortalName: string | null;
      listOrder: number;
      indent: string;
    }>`
      SELECT
        m.id AS measurementId,
        m.prefix,
        m.data_portal_name AS dataPortalName,
        dlm.list_order AS listOrder,
        dlm.indent
      FROM data_list_measurements dlm
      JOIN measurements m ON m.id = dlm.measurement_id
      WHERE dlm.data_list_id = ${dataListId}
      ORDER BY dlm.list_order ASC
    `;
  }

  /** Swap list_order of a measurement with its neighbor */
  static async moveMeasurement(
    dataListId: number,
    measurementId: number,
    direction: "up" | "down",
  ): Promise<void> {
    const items = await mysql<{ measurement_id: number; list_order: number }>`
      SELECT measurement_id, list_order FROM data_list_measurements
      WHERE data_list_id = ${dataListId}
      ORDER BY list_order ASC
    `;
    const idx = items.findIndex((i) => i.measurement_id === measurementId);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx];
    const b = items[swapIdx];
    await mysql`
      UPDATE data_list_measurements
      SET list_order = ${b.list_order}
      WHERE data_list_id = ${dataListId} AND measurement_id = ${a.measurement_id}
    `;
    await mysql`
      UPDATE data_list_measurements
      SET list_order = ${a.list_order}
      WHERE data_list_id = ${dataListId} AND measurement_id = ${b.measurement_id}
    `;
  }

  /** Adjust indent level of a measurement (in = +1, out = -1, clamped 0–3) */
  static async setMeasurementIndent(
    dataListId: number,
    measurementId: number,
    direction: "in" | "out",
  ): Promise<void> {
    const rows = await mysql<{ indent: string }>`
      SELECT indent FROM data_list_measurements
      WHERE data_list_id = ${dataListId} AND measurement_id = ${measurementId}
      LIMIT 1
    `;
    if (!rows[0]) return;

    const current = parseInt(rows[0].indent.replace("indent", "")) || 0;
    const next = Math.max(
      0,
      Math.min(3, current + (direction === "in" ? 1 : -1)),
    );
    const newIndent = `indent${next}`;

    await mysql`
      UPDATE data_list_measurements
      SET indent = ${newIndent}
      WHERE data_list_id = ${dataListId} AND measurement_id = ${measurementId}
    `;
  }

  /**
   * Bulk-fetch all series data for a data list, filtered by frequency/geography/SA.
   * Returns raw rows to be grouped by the controller.
   */
  static async getSuperTableData(
    dataListId: number,
    filters: { freq?: string; geo?: string; sa?: string },
  ) {
    const freqLong = Series.frequencyFromCode(filters.freq ?? "A") ?? "year";
    const geo = filters.geo ?? "HI";

    let saClause = "";
    const params: (string | number)[] = [dataListId, freqLong, geo];

    if (filters.sa === "sa") {
      saClause =
        "AND (xs.seasonal_adjustment = 'seasonally_adjusted' OR xs.seasonally_adjusted = 1)";
    } else if (filters.sa === "ns") {
      saClause =
        "AND (xs.seasonal_adjustment = 'not_seasonally_adjusted' OR xs.seasonally_adjusted = 0)";
    }
    // "all" or undefined → no SA filter

    const sql = `
      SELECT
        s.id AS series_id,
        s.name AS series_name,
        s.dataPortalName AS data_portal_name,
        s.decimals,
        m.id AS measurement_id,
        m.prefix AS measurement_prefix,
        dlm.list_order,
        dlm.indent,
        xs.frequency AS frequency,
        u.short_label AS unit_short_label,
        dp.date AS date,
        dp.value AS value
      FROM data_list_measurements dlm
      JOIN measurements m ON m.id = dlm.measurement_id
      JOIN measurement_series ms ON ms.measurement_id = m.id
      JOIN series s ON s.id = ms.series_id
      JOIN xseries xs ON xs.id = s.xseries_id
      JOIN geographies g ON g.id = s.geography_id
      LEFT JOIN units u ON u.id = s.unit_id
      LEFT JOIN data_points dp ON dp.xseries_id = xs.id AND dp.current = 1
      WHERE dlm.data_list_id = ?
        AND xs.frequency = ?
        AND g.handle = ?
        ${saClause}
      ORDER BY dlm.list_order ASC, s.name DESC, dp.date ASC
    `;

    return rawQuery<{
      series_id: number;
      series_name: string;
      data_portal_name: string | null;
      decimals: number;
      measurement_id: number;
      measurement_prefix: string;
      list_order: number;
      indent: string;
      frequency: string;
      unit_short_label: string | null;
      date: Date | null;
      value: number | null;
    }>(sql, params);
  }

  /**
   * Get the distinct frequencies and geography handles that exist
   * for series belonging to a data list's measurements.
   */
  static async getAvailableFilters(dataListId: number) {
    const [freqRows, geoRows] = await Promise.all([
      rawQuery<{ frequency: string }>(
        `SELECT DISTINCT xs.frequency
         FROM data_list_measurements dlm
         JOIN measurement_series ms ON ms.measurement_id = dlm.measurement_id
         JOIN series s ON s.id = ms.series_id
         JOIN xseries xs ON xs.id = s.xseries_id
         WHERE dlm.data_list_id = ?
           AND xs.frequency IS NOT NULL
         ORDER BY xs.frequency`,
        [dataListId],
      ),
      rawQuery<{ handle: string; display_name: string | null }>(
        `SELECT DISTINCT g.handle, g.display_name
         FROM data_list_measurements dlm
         JOIN measurement_series ms ON ms.measurement_id = dlm.measurement_id
         JOIN series s ON s.id = ms.series_id
         JOIN geographies g ON g.id = s.geography_id
         WHERE dlm.data_list_id = ?
           AND g.handle IS NOT NULL
         ORDER BY g.display_name`,
        [dataListId],
      ),
    ]);

    return {
      frequencies: freqRows.map((r) => r.frequency),
      geographies: geoRows.map((r) => ({
        handle: r.handle,
        displayName: r.display_name,
      })),
    };
  }
  /**
   * Replace all measurements in a data list from a list of prefixes.
   * Looks up each prefix, deletes existing entries, inserts new ones in order.
   * Returns the list of unknown prefixes (if any).
   */
  static async replaceAllMeasurements(
    dataListId: number,
    prefixes: string[],
    universe: Universe,
  ): Promise<{ unknownPrefixes: string[] }> {
    const unknownPrefixes: string[] = [];
    const measurementIds: number[] = [];

    for (const prefix of prefixes) {
      try {
        const m = await MeasurementCollection.getByPrefix(prefix, universe);
        measurementIds.push(m.id);
      } catch {
        unknownPrefixes.push(prefix);
      }
    }

    if (unknownPrefixes.length > 0) {
      return { unknownPrefixes };
    }

    // Delete all existing entries
    await mysql`
      DELETE FROM data_list_measurements WHERE data_list_id = ${dataListId}
    `;

    // Insert new entries in order
    for (let i = 0; i < measurementIds.length; i++) {
      await mysql`
        INSERT INTO data_list_measurements (data_list_id, measurement_id, list_order, indent)
        VALUES (${dataListId}, ${measurementIds[i]}, ${i}, 'indent0')
      `;
    }

    return { unknownPrefixes: [] };
  }

  /** Get all distinct series IDs for all measurements in a data list */
  static async getAllSeriesIds(dataListId: number): Promise<number[]> {
    const rows = await mysql<{ series_id: number }>`
      SELECT DISTINCT ms.series_id
      FROM data_list_measurements dlm
      JOIN measurement_series ms ON ms.measurement_id = dlm.measurement_id
      WHERE dlm.data_list_id = ${dataListId}
    `;
    return rows.map((r) => r.series_id);
  }
}

export default DataListCollection;
