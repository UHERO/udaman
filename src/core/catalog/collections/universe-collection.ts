import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getDataDir } from "@/lib/data-dir";
import { NotFoundError } from "@/lib/errors";
import { mysql, rawQuery } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";
import { createLogger } from "@/core/observability/logger";

import Universe from "../models/universe";
import type { UniverseAttrs } from "../models/universe";

const log = createLogger("catalog.universe-collection");

/** Batch size for LIMIT/OFFSET streaming during archive export */
const ARCHIVE_BATCH = 5_000;

/** Batch size for chunked DELETE … WHERE id IN (…) */
const DELETE_BATCH = 1_000;

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
    if (!row) throw new NotFoundError("Universe", name);
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

  /**
   * Archive all universe-scoped data to a directory of CSV files,
   * one per table. Uses LIMIT/OFFSET batches to cap memory usage.
   * Returns the archive directory path.
   */
  static async archiveToCsv(name: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dataDir = getDataDir();
    const archiveDir = join(dataDir, "backup", `${dateStr}-${name}-archive`);
    await mkdir(archiveDir, { recursive: true });

    // Tables with a direct `universe` column
    const directTables = [
      "series",
      "categories",
      "geographies",
      "measurements",
      "units",
      "sources",
      "source_details",
      "data_sources",
      "data_lists",
      "users",
      "feature_toggles",
      "api_applications",
    ];

    for (const table of directTables) {
      await this.exportTableToCsv(
        join(archiveDir, `${table}.csv`),
        `SELECT * FROM \`${table}\` WHERE universe = ?`,
        [name],
      );
      log.info({ table }, "archived table");
    }

    // Join tables (no universe column — joined via FK)
    const joinTables: { file: string; sql: string }[] = [
      {
        file: "data_list_measurements",
        sql: `SELECT dlm.* FROM data_list_measurements dlm
              JOIN data_lists dl ON dl.id = dlm.data_list_id
              WHERE dl.universe = ?`,
      },
      {
        file: "measurement_series",
        sql: `SELECT ms.* FROM measurement_series ms
              JOIN measurements m ON m.id = ms.measurement_id
              WHERE m.universe = ?`,
      },
      {
        file: "data_lists_series",
        sql: `SELECT dls.* FROM data_lists_series dls
              JOIN data_lists dl ON dl.id = dls.data_list_id
              WHERE dl.universe = ?`,
      },
      {
        file: "data_points",
        sql: `SELECT d.* FROM data_points d
              JOIN series s ON s.xseries_id = d.xseries_id
              WHERE s.universe = ?`,
      },
      {
        file: "public_data_points",
        sql: `SELECT p.* FROM public_data_points p
              JOIN series s ON s.id = p.series_id
              WHERE s.universe = ?`,
      },
    ];

    for (const { file, sql } of joinTables) {
      await this.exportTableToCsv(
        join(archiveDir, `${file}.csv`),
        sql,
        [name],
      );
      log.info({ table: file }, "archived table");
    }

    return archiveDir;
  }

  /**
   * Delete all records belonging exclusively to a universe.
   * Shared xseries/data_points referenced by other universes are preserved.
   * data_points and xseries are deleted in batches of DELETE_BATCH to
   * avoid holding massive locks or blowing memory.
   */
  static async deleteUniverse(
    name: string,
    onProgress?: (step: string) => void,
  ): Promise<{ deleted: Record<string, number>; skipped: Record<string, number> }> {
    const deleted: Record<string, number> = {};
    const skipped: Record<string, number> = {};
    const progress = onProgress ?? (() => {});

    const del = async (label: string, sql: string, params: (string | number)[] = [name]) => {
      const result = await rawQuery(sql, params);
      const count = (result as any).count ?? 0;
      deleted[label] = (deleted[label] ?? 0) + Number(count);
      log.info({ table: label, count: deleted[label] }, `deleted ${label}`);
    };

    await rawQuery("SET FOREIGN_KEY_CHECKS = 0");
    try {
      // 1. public_data_points
      progress("Deleting public_data_points");
      await del(
        "public_data_points",
        `DELETE p FROM public_data_points p
         JOIN series s ON s.id = p.series_id
         WHERE s.universe = ?`,
      );

      // 2. Identify exclusive xseries (no other universe references them)
      progress("Identifying exclusive xseries");
      const sharedXseries = await rawQuery<{ id: number }>(
        `SELECT DISTINCT s.xseries_id AS id FROM series s
         WHERE s.xseries_id IN (SELECT xseries_id FROM series WHERE universe = ?)
         AND s.universe != ?`,
        [name, name],
      );
      const sharedIds = new Set(sharedXseries.map((r) => r.id));

      const allXseries = await rawQuery<{ id: number }>(
        `SELECT DISTINCT xseries_id AS id FROM series WHERE universe = ? AND xseries_id IS NOT NULL`,
        [name],
      );
      const exclusiveIds = allXseries
        .map((r) => r.id)
        .filter((id) => !sharedIds.has(id));

      if (sharedIds.size > 0) {
        skipped["data_points_shared_xseries"] = sharedIds.size;
      }

      // 3. data_points — chunked delete for exclusive xseries only
      progress(`Deleting data_points (${exclusiveIds.length} exclusive xseries)`);
      deleted["data_points"] = 0;
      for (let i = 0; i < exclusiveIds.length; i += DELETE_BATCH) {
        const chunk = exclusiveIds.slice(i, i + DELETE_BATCH);
        const placeholders = chunk.map(() => "?").join(",");
        await del(
          "data_points",
          `DELETE FROM data_points WHERE xseries_id IN (${placeholders})`,
          chunk,
        );
      }

      // 4. Join tables
      progress("Deleting join tables");
      await del(
        "data_list_measurements",
        `DELETE dlm FROM data_list_measurements dlm
         JOIN data_lists dl ON dl.id = dlm.data_list_id
         WHERE dl.universe = ?`,
      );
      await del(
        "measurement_series",
        `DELETE ms FROM measurement_series ms
         JOIN measurements m ON m.id = ms.measurement_id
         WHERE m.universe = ?`,
      );
      await del(
        "data_lists_series",
        `DELETE dls FROM data_lists_series dls
         JOIN data_lists dl ON dl.id = dls.data_list_id
         WHERE dl.universe = ?`,
      );

      // 5. user_series
      progress("Deleting user_series");
      await del(
        "user_series",
        `DELETE us FROM user_series us
         JOIN users u ON u.id = us.user_id
         WHERE u.universe = ?`,
      );

      // 6. geo_trees
      progress("Deleting geo_trees");
      await del(
        "geo_trees",
        `DELETE gt FROM geo_trees gt
         JOIN geographies g ON g.id = gt.geography_id
         WHERE g.universe = ?`,
      );

      // 7. data_source_actions, data_source_downloads
      progress("Deleting data_source audit tables");
      await del(
        "data_source_actions",
        `DELETE dsa FROM data_source_actions dsa
         JOIN data_sources ds ON ds.id = dsa.data_source_id
         WHERE ds.universe = ?`,
      );
      await del(
        "data_source_downloads",
        `DELETE dsd FROM data_source_downloads dsd
         JOIN data_sources ds ON ds.id = dsd.data_source_id
         WHERE ds.universe = ?`,
      );

      // 8. reload_job_series, series_reload_logs
      progress("Deleting reload audit tables");
      await del(
        "reload_job_series",
        `DELETE rjs FROM reload_job_series rjs
         JOIN series s ON s.id = rjs.series_id
         WHERE s.universe = ?`,
      );
      await del(
        "series_reload_logs",
        `DELETE srl FROM series_reload_logs srl
         JOIN series s ON s.id = srl.series_id
         WHERE s.universe = ?`,
      );

      // 9. reload_jobs
      progress("Deleting reload_jobs");
      await del(
        "reload_jobs",
        `DELETE FROM reload_jobs WHERE universe = ?`,
      );

      // 10. Direct universe-scoped tables
      progress("Deleting universe-scoped tables");
      const directTables = [
        "data_sources",
        "data_lists",
        "categories",
        "series",
        "measurements",
        "geographies",
        "units",
        "sources",
        "source_details",
        "feature_toggles",
        "api_applications",
        "users",
      ];
      for (const table of directTables) {
        await del(table, `DELETE FROM \`${table}\` WHERE universe = ?`);
      }

      // 11. Exclusive xseries — chunked delete
      progress(`Deleting xseries (${exclusiveIds.length} exclusive)`);
      deleted["xseries"] = 0;
      for (let i = 0; i < exclusiveIds.length; i += DELETE_BATCH) {
        const chunk = exclusiveIds.slice(i, i + DELETE_BATCH);
        const placeholders = chunk.map(() => "?").join(",");
        await del(
          "xseries",
          `DELETE FROM xseries WHERE id IN (${placeholders})`,
          chunk,
        );
      }

      // 12. Universe record itself
      progress("Deleting universe record");
      await del("universe", `DELETE FROM universe WHERE name = ?`);
    } finally {
      await rawQuery("SET FOREIGN_KEY_CHECKS = 1");
    }

    return { deleted, skipped };
  }

  // ─── Private helpers ────────────────────────────────────��────────────

  /**
   * Stream a query result to a CSV file in ARCHIVE_BATCH-sized chunks.
   * Writes the header row once, then appends data rows in batches so
   * we never hold the full result set in memory.
   */
  private static async exportTableToCsv(
    filePath: string,
    baseSql: string,
    params: (string | number)[],
  ): Promise<number> {
    let offset = 0;
    let totalRows = 0;
    let headerWritten = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const sql = `${baseSql} LIMIT ${ARCHIVE_BATCH} OFFSET ${offset}`;
      const rows = await rawQuery<Record<string, unknown>>(sql, params);
      if (rows.length === 0) break;

      if (!headerWritten) {
        const headers = Object.keys(rows[0]);
        await writeFile(filePath, this.csvLine(headers) + "\n");
        headerWritten = true;
      }

      const headers = Object.keys(rows[0]);
      const lines = rows.map((row) =>
        this.csvLine(headers.map((h) => row[h])),
      );
      await appendFile(filePath, lines.join("\n") + "\n");

      totalRows += rows.length;
      offset += ARCHIVE_BATCH;

      // If we got fewer than a full batch, we've reached the end
      if (rows.length < ARCHIVE_BATCH) break;
    }

    // Create an empty file with a header comment if no rows
    if (!headerWritten) {
      await writeFile(filePath, "# (no data)\n");
    }

    return totalRows;
  }

  /** Escape a single value for CSV (RFC 4180). */
  private static csvEscape(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = val instanceof Date ? val.toISOString() : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /** Build one CSV line from an array of values. */
  private static csvLine(values: unknown[]): string {
    return values.map((v) => this.csvEscape(v)).join(",");
  }
}

export default UniverseCollection;
