import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Universe from "../models/universe";
import type { UniverseAttrs } from "../models/universe";

export type UniverseStats = {
  series: number;
  categories: number;
  dataLists: number;
  measurements: number;
  geographies: number;
  units: number;
  sources: number;
  sourceDetails: number;
  loaders: number;
  users: number;
};

export type CreateUniversePayload = {
  name: string;
  description?: string | null;
  dataPortalUrl?: string | null;
};

export type UpdateUniversePayload = {
  description?: string | null;
  dataPortalUrl?: string | null;
};

class UniverseCollection {
  /** Fetch all universes */
  static async list(): Promise<Universe[]> {
    const rows = await mysql<UniverseAttrs>`
      SELECT name, description, data_portal_url FROM universe ORDER BY name
    `;
    return rows.map((row) => new Universe(row));
  }

  /** Count related entities scoped to a single universe */
  static async getStats(name: string): Promise<UniverseStats> {
    const rows = await mysql<{
      series: number | bigint;
      categories: number | bigint;
      data_lists: number | bigint;
      measurements: number | bigint;
      geographies: number | bigint;
      units: number | bigint;
      sources: number | bigint;
      source_details: number | bigint;
      loaders: number | bigint;
      users: number | bigint;
    }>`
      SELECT
        (SELECT COUNT(*) FROM series         WHERE universe = ${name}) AS series,
        (SELECT COUNT(*) FROM categories     WHERE universe = ${name}) AS categories,
        (SELECT COUNT(*) FROM data_lists     WHERE universe = ${name}) AS data_lists,
        (SELECT COUNT(*) FROM measurements   WHERE universe = ${name}) AS measurements,
        (SELECT COUNT(*) FROM geographies    WHERE universe = ${name}) AS geographies,
        (SELECT COUNT(*) FROM units          WHERE universe = ${name}) AS units,
        (SELECT COUNT(*) FROM sources        WHERE universe = ${name}) AS sources,
        (SELECT COUNT(*) FROM source_details WHERE universe = ${name}) AS source_details,
        (SELECT COUNT(*) FROM data_sources   WHERE universe = ${name}) AS loaders,
        (SELECT COUNT(*) FROM users          WHERE universe = ${name}) AS users
    `;
    const row = rows[0];
    return {
      series: Number(row.series),
      categories: Number(row.categories),
      dataLists: Number(row.data_lists),
      measurements: Number(row.measurements),
      geographies: Number(row.geographies),
      units: Number(row.units),
      sources: Number(row.sources),
      sourceDetails: Number(row.source_details),
      loaders: Number(row.loaders),
      users: Number(row.users),
    };
  }

  /** Fetch a single universe by name */
  static async getByName(name: string): Promise<Universe> {
    const rows = await mysql<UniverseAttrs>`
      SELECT name, description, data_portal_url
      FROM universe
      WHERE name = ${name}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Universe not found: ${name}`);
    return new Universe(row);
  }

  /** Create a new universe */
  static async create(payload: CreateUniversePayload): Promise<Universe> {
    const { name, description = null, dataPortalUrl = null } = payload;
    await mysql`
      INSERT INTO universe (name, description, data_portal_url)
      VALUES (${name}, ${description}, ${dataPortalUrl})
    `;
    return this.getByName(name);
  }

  /** Update mutable fields on a universe (description, data_portal_url) */
  static async update(
    name: string,
    updates: UpdateUniversePayload,
  ): Promise<Universe> {
    if (!Object.keys(updates).length) return this.getByName(name);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getByName(name);

    await mysql`
      UPDATE universe
      SET ${mysql(updateObj, ...cols)}
      WHERE name = ${name}
    `;
    return this.getByName(name);
  }

  /** Rename a universe (FK CASCADE propagates to referencing tables) */
  static async rename(oldName: string, newName: string): Promise<Universe> {
    await mysql`UPDATE universe SET name = ${newName} WHERE name = ${oldName}`;
    return this.getByName(newName);
  }

  /** Delete a universe (FK RESTRICT throws if referenced) */
  static async delete(name: string): Promise<void> {
    await mysql`DELETE FROM universe WHERE name = ${name}`;
  }
}

export default UniverseCollection;
