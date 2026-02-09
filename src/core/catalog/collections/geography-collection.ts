import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Geography from "../models/geography";
import type { GeographyAttrs } from "../models/geography";
import type { Universe } from "../types/shared";

export type CreateGeographyPayload = {
  handle?: string | null;
  displayName?: string | null;
  displayNameShort?: string | null;
  fips?: string | null;
  listOrder?: number | null;
  geotype?: string | null;
  universe?: Universe;
};

export type UpdateGeographyPayload = Partial<CreateGeographyPayload>;

class GeographyCollection {
  /** Fetch all geographies, optionally filtered by universe */
  static async list(options: { universe?: Universe } = {}): Promise<Geography[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<GeographyAttrs>`
        SELECT * FROM geographies
        WHERE universe = ${universe}
        ORDER BY list_order ASC, display_name ASC
      `;
      return rows.map((row) => new Geography(row));
    }
    const rows = await mysql<GeographyAttrs>`
      SELECT * FROM geographies
      ORDER BY list_order ASC, display_name ASC
    `;
    return rows.map((row) => new Geography(row));
  }

  /** Fetch a single geography by ID */
  static async getById(id: number): Promise<Geography> {
    const rows = await mysql<GeographyAttrs>`
      SELECT * FROM geographies WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Geography not found: ${id}`);
    return new Geography(row);
  }

  /** Create a new geography */
  static async create(payload: CreateGeographyPayload): Promise<Geography> {
    const {
      handle,
      displayName,
      displayNameShort,
      fips,
      listOrder,
      geotype,
      universe = "UHERO",
    } = payload;

    await mysql`
      INSERT INTO geographies (
        universe, handle, display_name, display_name_short,
        fips, list_order, geotype, created_at, updated_at
      ) VALUES (
        ${universe}, ${handle ?? null}, ${displayName ?? null},
        ${displayNameShort ?? null}, ${fips ?? null}, ${listOrder ?? null},
        ${geotype ?? null}, NOW(), NOW()
      )
    `;

    const [{ insertId }] = await mysql<{ insertId: number }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a geography */
  static async update(id: number, updates: UpdateGeographyPayload): Promise<Geography> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE geographies
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a geography (throws if referenced by series) */
  static async delete(id: number): Promise<void> {
    const seriesRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM series WHERE geography_id = ${id}
    `;
    if (seriesRefs[0].cnt > 0) {
      throw new Error(`Cannot delete geography (id=${id}): referenced by series`);
    }

    await mysql`DELETE FROM geographies WHERE id = ${id}`;
  }
}

export default GeographyCollection;
