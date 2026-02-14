import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import DataList from "../models/data-list";
import type { DataListAttrs } from "../models/data-list";
import type { Universe } from "../types/shared";

export type CreateDataListPayload = {
  name?: string | null;
  universe?: Universe;
};

export type UpdateDataListPayload = Partial<CreateDataListPayload>;

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

    const updateObj = buildUpdateObject(updates);
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

  /** Remove a measurement from a data list */
  static async removeMeasurement(
    dataListId: number,
    measurementId: number,
  ): Promise<void> {
    await mysql`
      DELETE FROM data_list_measurements
      WHERE data_list_id = ${dataListId} AND measurement_id = ${measurementId}
    `;
  }
}

export default DataListCollection;
