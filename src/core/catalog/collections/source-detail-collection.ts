import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import SourceDetail from "../models/source-detail";
import type { SourceDetailAttrs } from "../models/source-detail";
import type { Universe } from "../types/shared";

export type CreateSourceDetailPayload = {
  description?: string | null;
  universe?: Universe;
};

export type UpdateSourceDetailPayload = Partial<CreateSourceDetailPayload>;

class SourceDetailCollection {
  /** Fetch all source details, optionally filtered by universe */
  static async list(
    options: { universe?: Universe } = {},
  ): Promise<SourceDetail[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<SourceDetailAttrs>`
        SELECT * FROM source_details WHERE universe = ${universe} ORDER BY description ASC
      `;
      return rows.map((row) => new SourceDetail(row));
    }
    const rows = await mysql<SourceDetailAttrs>`
      SELECT * FROM source_details ORDER BY description ASC
    `;
    return rows.map((row) => new SourceDetail(row));
  }

  /** Fetch a single source detail by ID */
  static async getById(id: number): Promise<SourceDetail> {
    const rows = await mysql<SourceDetailAttrs>`
      SELECT * FROM source_details WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Source detail not found: ${id}`);
    return new SourceDetail(row);
  }

  /** Create a new source detail */
  static async create(
    payload: CreateSourceDetailPayload,
  ): Promise<SourceDetail> {
    const { description, universe = "UHERO" } = payload;

    await mysql`
      INSERT INTO source_details (universe, description, created_at, updated_at)
      VALUES (${universe}, ${description ?? null}, NOW(), NOW())
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a source detail */
  static async update(
    id: number,
    updates: UpdateSourceDetailPayload,
  ): Promise<SourceDetail> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE source_details
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a source detail (throws if referenced by series or measurements) */
  static async delete(id: number): Promise<void> {
    const seriesRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM series WHERE source_detail_id = ${id}
    `;
    if (seriesRefs[0].cnt > 0) {
      throw new Error(
        `Cannot delete source detail (id=${id}): referenced by series`,
      );
    }

    const measurementRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM measurements WHERE source_detail_id = ${id}
    `;
    if (measurementRefs[0].cnt > 0) {
      throw new Error(
        `Cannot delete source detail (id=${id}): referenced by measurements`,
      );
    }

    await mysql`DELETE FROM source_details WHERE id = ${id}`;
  }
}

export default SourceDetailCollection;
