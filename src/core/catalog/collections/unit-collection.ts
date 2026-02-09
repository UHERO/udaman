import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Unit from "../models/unit";
import type { UnitAttrs } from "../models/unit";
import type { Universe } from "../types/shared";

export type CreateUnitPayload = {
  shortLabel?: string | null;
  longLabel?: string | null;
  universe?: Universe;
};

export type UpdateUnitPayload = Partial<CreateUnitPayload>;

class UnitCollection {
  /** Fetch all units, optionally filtered by universe */
  static async list(options: { universe?: Universe } = {}): Promise<Unit[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<UnitAttrs>`
        SELECT * FROM units WHERE universe = ${universe} ORDER BY short_label ASC
      `;
      return rows.map((row) => new Unit(row));
    }
    const rows = await mysql<UnitAttrs>`
      SELECT * FROM units ORDER BY short_label ASC
    `;
    return rows.map((row) => new Unit(row));
  }

  /** Fetch a single unit by ID */
  static async getById(id: number): Promise<Unit> {
    const rows = await mysql<UnitAttrs>`
      SELECT * FROM units WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Unit not found: ${id}`);
    return new Unit(row);
  }

  /** Find by short_label or create with that label (mirrors Rails Unit.get_or_new) */
  static async getOrCreate(label: string, universe: Universe = "UHERO"): Promise<Unit> {
    const rows = await mysql<UnitAttrs>`
      SELECT * FROM units
      WHERE universe = ${universe} AND short_label = ${label}
      LIMIT 1
    `;
    if (rows[0]) return new Unit(rows[0]);

    await mysql`
      INSERT INTO units (universe, short_label, long_label, created_at, updated_at)
      VALUES (${universe}, ${label}, ${label}, NOW(), NOW())
    `;
    return this.getOrCreate(label, universe);
  }

  /** Create a new unit */
  static async create(payload: CreateUnitPayload): Promise<Unit> {
    const { shortLabel, longLabel, universe = "UHERO" } = payload;

    await mysql`
      INSERT INTO units (universe, short_label, long_label, created_at, updated_at)
      VALUES (${universe}, ${shortLabel ?? null}, ${longLabel ?? null}, NOW(), NOW())
    `;

    const [{ insertId }] = await mysql<{ insertId: number }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a unit */
  static async update(id: number, updates: UpdateUnitPayload): Promise<Unit> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE units
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a unit (throws if referenced by series or measurements) */
  static async delete(id: number): Promise<void> {
    const seriesRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM series WHERE unit_id = ${id}
    `;
    if (seriesRefs[0].cnt > 0) {
      throw new Error(`Cannot delete unit (id=${id}): referenced by series`);
    }

    const measurementRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM measurements WHERE unit_id = ${id}
    `;
    if (measurementRefs[0].cnt > 0) {
      throw new Error(`Cannot delete unit (id=${id}): referenced by measurements`);
    }

    await mysql`DELETE FROM units WHERE id = ${id}`;
  }
}

export default UnitCollection;
