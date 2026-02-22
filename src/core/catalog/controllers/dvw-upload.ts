import "server-only";

import { createLogger } from "@/core/observability/logger";
import { rawQuery as dvwQuery } from "@/lib/mysql/dvw-db";

import { DvwUploadCollection } from "../collections/universe-upload-collection";
import { makeDate } from "../utils/date-helpers";
import { parseDvwXlsx, type DvwParseResult } from "../utils/dvw-xlsx-parser";
import { orchestrateUpload, type UploadResult } from "./universe-upload";

const log = createLogger("catalog.dvw-upload");

// ─── Handlers ─────────────────────────────────────────────────────────

async function parseFile(filePath: string): Promise<DvwParseResult> {
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(filePath);
  const result = parseDvwXlsx(buffer);
  log.info(
    {
      dimensions: Object.fromEntries(
        Object.entries(result.dimensions).map(([k, v]) => [
          k,
          (v as unknown[]).length,
        ]),
      ),
      dataRows: result.dataRows.length,
    },
    "Parsed DVW XLSX",
  );
  return result;
}

/**
 * Wipe all DVW data — truncate dimension tables, data_points, data_toc.
 * Direct port of Rails `delete_universe_dvw`.
 */
async function wipeDvwUniverse(): Promise<void> {
  await dvwQuery("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await dvwQuery("TRUNCATE TABLE data_points");
    log.info("Truncated DVW data_points");
    await dvwQuery("TRUNCATE TABLE data_toc");
    log.info("Truncated DVW data_toc");
    await dvwQuery("TRUNCATE TABLE indicators");
    log.info("Truncated DVW indicators");
    await dvwQuery("TRUNCATE TABLE categories");
    log.info("Truncated DVW categories");
    await dvwQuery("TRUNCATE TABLE destinations");
    log.info("Truncated DVW destinations");
    await dvwQuery("TRUNCATE TABLE markets");
    log.info("Truncated DVW markets");
    await dvwQuery("TRUNCATE TABLE `groups`");
    log.info("Truncated DVW groups");
  } finally {
    await dvwQuery("SET FOREIGN_KEY_CHECKS = 1");
  }
}

/**
 * Increment ordering for a dimension level.
 * Resets all lower levels when a higher level increments.
 */
function incrOrder(ordering: Record<number, number>, level: number): number {
  for (let n = level + 1; ordering[n] != null; n++) {
    ordering[n] = 0;
  }
  ordering[level] = (ordering[level] ?? 0) + 1;
  return ordering[level];
}

/**
 * Load dimension rows into the DVW database.
 * Port of Rails `load_meta_csv`.
 */
async function loadDvwDimension(
  table: string,
  rows: DvwParseResult["dimensions"]["group"],
): Promise<void> {
  if (rows.length === 0) return;
  log.info({ table, rowCount: rows.length }, "Loading DVW dimension");

  const isIndicators = table === "indicators";
  const parentSet: [string, string][] = [];
  const ordering: Record<string, Record<number, number>> = {};

  const insertRows: (string | number | null)[][] = [];

  for (const row of rows) {
    if (!row.module) continue;

    // A single row can belong to multiple modules (comma-separated)
    const modules = row.module.split(/\s*,\s*/);
    for (const mod of modules) {
      ordering[mod] ??= { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      const level = row.level ?? row.dimLevels?.[mod.toLowerCase()] ?? null;
      if (level == null) continue; // skip if no level specified

      const order =
        row.dimOrders?.[mod.toLowerCase()] ?? incrOrder(ordering[mod], level);

      const header = row.data === "0" ? 1 : 0; // semantically inverted

      insertRows.push([
        row.id, // handle
        mod, // module
        row.namew, // namew
        row.info, // info
        row.namet, // namet
        header, // header
        level, // level
        order, // order
        ...(isIndicators ? [row.unit ?? null, row.decimal ?? null] : []),
      ]);

      if (row.parent) {
        parentSet.push([row.parent, row.id]);
      }
    }
  }

  // Batch insert
  const baseCols =
    "`handle`, `module`, `namew`, `info`, `namet`, `header`, `level`, `order`";
  const cols = isIndicators ? `${baseCols}, \`unit\`, \`decimal\`` : baseCols;
  const basePlaceholder = "?, ?, ?, ?, ?, ?, ?, ?";
  const placeholder = isIndicators
    ? `(${basePlaceholder}, ?, ?)`
    : `(${basePlaceholder})`;

  for (let i = 0; i < insertRows.length; i += 1000) {
    const batch = insertRows.slice(i, i + 1000);
    const placeholders = batch.map(() => placeholder).join(",");
    const params = batch.flat() as (string | number | null)[];
    await dvwQuery(
      `INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`,
      params,
    );
  }

  // Resolve parent references
  for (const [parentHandle, childHandle] of parentSet) {
    await dvwQuery(
      `UPDATE \`${table}\` t1 JOIN \`${table}\` t2 ON t1.module = t2.module SET t2.parent_id = t1.id WHERE t1.handle = ? AND t2.handle = ?`,
      [parentHandle, childHandle],
    );
  }

  log.info({ table, inserted: insertRows.length }, "Loaded DVW dimension");
}

/**
 * Load metadata: all 5 dimension tables.
 */
async function loadDvwMetadata(
  dimensions: DvwParseResult["dimensions"],
): Promise<void> {
  await loadDvwDimension("groups", dimensions.group);
  log.info("Loaded groups");
  await loadDvwDimension("markets", dimensions.market);
  log.info("Loaded markets");
  await loadDvwDimension("destinations", dimensions.destination);
  log.info("Loaded destinations");
  await loadDvwDimension("categories", dimensions.category);
  log.info("Loaded categories");
  await loadDvwDimension("indicators", dimensions.indicator);
  log.info("Loaded indicators");
}

/**
 * Load data points from the data sheet.
 * Port of Rails `load_series_csv`.
 */
async function loadDvwData(
  dataRows: DvwParseResult["dataRows"],
): Promise<number> {
  log.info({ totalRows: dataRows.length }, "Loading DVW data points");

  // Build insert rows — each row needs dimension ID resolution via SQL JOINs
  for (let i = 0; i < dataRows.length; i += 1000) {
    const batch = dataRows.slice(i, i + 1000);
    for (const row of batch) {
      const date = makeDate(row.year, row.qm);
      await dvwQuery(
        `INSERT INTO data_points
          (\`module\`, \`frequency\`, \`date\`, \`value\`, \`group_id\`, \`market_id\`, \`destination_id\`, \`category_id\`, \`indicator_id\`)
         SELECT ?, ?, ?, ?, g.id, m.id, d.id, c.id, i.id
           FROM indicators i
             LEFT JOIN \`groups\` g ON g.handle = ? AND g.module = ?
             LEFT JOIN markets m ON m.handle = ? AND m.module = ?
             LEFT JOIN destinations d ON d.handle = ? AND d.module = ?
             LEFT JOIN categories c ON c.handle = ? AND c.module = ?
          WHERE i.handle = ?
            AND i.module = ?`,
        [
          row.module,
          row.frequency,
          date,
          row.value,
          row.group,
          row.module,
          row.market,
          row.module,
          row.destination,
          row.module,
          row.category,
          row.module,
          row.indicator,
          row.module,
        ],
      );
    }
  }

  // Generate data_toc (table of contents)
  await dvwQuery(
    `INSERT INTO data_toc (module, group_id, market_id, destination_id, category_id, indicator_id, frequency, \`count\`)
     SELECT DISTINCT module, group_id, market_id, destination_id, category_id, indicator_id, frequency, count(*)
     FROM data_points
     GROUP BY 1, 2, 3, 4, 5, 6, 7`,
  );
  log.info("Generated DVW data_toc");

  log.info({ inserted: dataRows.length }, "Loaded DVW data points");
  return dataRows.length;
}

// ─── Main entry point ─────────────────────────────────────────────────

export async function processDvwUpload(
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<UploadResult> {
  return orchestrateUpload(
    {
      universe: "UHERO",
      fileSubdir: "dvw_files",
      uploadCollection: DvwUploadCollection,
      skipPublicDataPoints: true,
    },
    fileBuffer,
    originalFilename,
    {
      parseFile,
      wipeUniverse: wipeDvwUniverse,
      loadMetadata: async (parsed) => {
        const { dimensions } = parsed as DvwParseResult;
        return loadDvwMetadata(dimensions);
      },
      loadData: async (parsed) => {
        const { dataRows } = parsed as DvwParseResult;
        return loadDvwData(dataRows);
      },
    },
  );
}
