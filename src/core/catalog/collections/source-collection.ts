import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Source from "../models/source";
import type { SourceAttrs } from "../models/source";
import type { Universe } from "../types/shared";

export type CreateSourcePayload = {
  description?: string | null;
  link?: string | null;
  universe?: Universe;
};

export type UpdateSourcePayload = Partial<CreateSourcePayload>;

class SourceCollection {
  /** Fetch all sources, optionally filtered by universe */
  static async list(options: { universe?: Universe } = {}): Promise<Source[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<SourceAttrs>`
        SELECT * FROM sources WHERE universe = ${universe} ORDER BY description ASC
      `;
      return rows.map((row) => new Source(row));
    }
    const rows = await mysql<SourceAttrs>`
      SELECT * FROM sources ORDER BY description ASC
    `;
    return rows.map((row) => new Source(row));
  }

  /** Fetch a single source by ID */
  static async getById(id: number): Promise<Source> {
    const rows = await mysql<SourceAttrs>`
      SELECT * FROM sources WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Source not found: ${id}`);
    return new Source(row);
  }

  /** Find by description (or link) or create (mirrors Rails Source.get_or_new) */
  static async getOrCreate(
    description: string,
    link: string | null = null,
    universe: Universe = "UHERO",
  ): Promise<Source> {
    const byDesc = await mysql<SourceAttrs>`
      SELECT * FROM sources
      WHERE universe = ${universe} AND description = ${description}
      LIMIT 1
    `;
    if (byDesc[0]) return new Source(byDesc[0]);

    if (link) {
      const byLink = await mysql<SourceAttrs>`
        SELECT * FROM sources
        WHERE universe = ${universe} AND link = ${link}
        LIMIT 1
      `;
      if (byLink[0]) return new Source(byLink[0]);
    }

    await mysql`
      INSERT INTO sources (universe, description, link, created_at, updated_at)
      VALUES (${universe}, ${description}, ${link}, NOW(), NOW())
    `;
    return this.getOrCreate(description, link, universe);
  }

  /** Create a new source */
  static async create(payload: CreateSourcePayload): Promise<Source> {
    const { description, link, universe = "UHERO" } = payload;

    await mysql`
      INSERT INTO sources (universe, description, link, created_at, updated_at)
      VALUES (${universe}, ${description ?? null}, ${link ?? null}, NOW(), NOW())
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a source */
  static async update(
    id: number,
    updates: UpdateSourcePayload,
  ): Promise<Source> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE sources
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a source (throws if referenced by series or measurements) */
  static async delete(id: number): Promise<void> {
    const seriesRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM series WHERE source_id = ${id}
    `;
    if (seriesRefs[0].cnt > 0) {
      throw new Error(`Cannot delete source (id=${id}): referenced by series`);
    }

    const measurementRefs = await mysql<{ cnt: number }>`
      SELECT COUNT(*) as cnt FROM measurements WHERE source_id = ${id}
    `;
    if (measurementRefs[0].cnt > 0) {
      throw new Error(
        `Cannot delete source (id=${id}): referenced by measurements`,
      );
    }

    await mysql`DELETE FROM sources WHERE id = ${id}`;
  }
}

export default SourceCollection;
