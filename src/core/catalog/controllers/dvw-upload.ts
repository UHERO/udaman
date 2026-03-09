import { createLogger } from "@/core/observability/logger";
import { rawQuery as dvwQuery } from "@/lib/mysql/dvw-db";

import { DvwUploadCollection } from "../collections/universe-upload-collection";
import { makeDate } from "../utils/date-helpers";
import {
  parseDvwXlsx,
  streamDataRows,
  type DvwParseResult,
} from "../utils/dvw-xlsx-parser";
import type { DvwDataRow } from "../utils/dvw-xlsx-validator";
import {
  prepareUpload,
  type UploadConfig,
  type UploadHandlers,
} from "./universe-upload";

const log = createLogger("catalog.dvw-upload");

/** Maps of `handle:module` → database ID for each dimension table */
export type DvwDimensionMaps = {
  groups: Map<string, number>;
  markets: Map<string, number>;
  destinations: Map<string, number>;
  categories: Map<string, number>;
  indicators: Map<string, number>;
};

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
    },
    "Parsed DVW XLSX (data sheet deferred)",
  );
  return result;
}

/**
 * Wipe all DVW data — truncate dimension tables, data_points, data_toc.
 * Direct port of Rails `delete_universe_dvw`.
 */
export async function wipeDvwUniverse(): Promise<void> {
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
 * Build a `handle:module` → id map by querying a dimension table.
 */
async function buildDimensionMap(table: string): Promise<Map<string, number>> {
  const rows = await dvwQuery<{ id: number; handle: string; module: string }>(
    `SELECT id, handle, module FROM \`${table}\``,
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${row.handle}:${row.module}`, row.id);
  }
  return map;
}

/**
 * Load metadata: all 5 dimension tables, then build handle:module → id maps.
 * Returns the maps for use by loadDvwData (avoids per-row SQL JOINs).
 */
export async function loadDvwMetadata(
  dimensions: DvwParseResult["dimensions"],
): Promise<DvwDimensionMaps> {
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

  // Build dimension ID maps for fast lookup during data insertion
  const [groups, markets, destinations, categories, indicators] =
    await Promise.all([
      buildDimensionMap("groups"),
      buildDimensionMap("markets"),
      buildDimensionMap("destinations"),
      buildDimensionMap("categories"),
      buildDimensionMap("indicators"),
    ]);

  log.info(
    {
      groups: groups.size,
      markets: markets.size,
      destinations: destinations.size,
      categories: categories.size,
      indicators: indicators.size,
    },
    "Built dimension ID maps",
  );

  return { groups, markets, destinations, categories, indicators };
}

// ─── Data insertion helpers ───────────────────────────────────────────

const DATA_BATCH_SIZE = 1000;
const DATA_PLACEHOLDER = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";
const DATA_INSERT_COLS =
  "`module`, `frequency`, `date`, `value`, `group_id`, `market_id`, `destination_id`, `category_id`, `indicator_id`";

/**
 * Resolve dimension IDs for a single data row and return the flat param array.
 */
function resolveDataRowParams(
  row: DvwDataRow,
  dimMaps: DvwDimensionMaps,
): (string | number | null)[] {
  const date = makeDate(row.year, row.qm);
  const groupId = row.group
    ? (dimMaps.groups.get(`${row.group}:${row.module}`) ?? null)
    : null;
  const marketId = row.market
    ? (dimMaps.markets.get(`${row.market}:${row.module}`) ?? null)
    : null;
  const destId = row.destination
    ? (dimMaps.destinations.get(`${row.destination}:${row.module}`) ?? null)
    : null;
  const catId = row.category
    ? (dimMaps.categories.get(`${row.category}:${row.module}`) ?? null)
    : null;
  const indId =
    dimMaps.indicators.get(`${row.indicator}:${row.module}`) ?? null;

  return [
    row.module,
    row.frequency,
    date,
    row.value,
    groupId,
    marketId,
    destId,
    catId,
    indId,
  ];
}

/**
 * Insert a chunk of DVW data rows into the database.
 * Dimension IDs are resolved in JS via pre-built maps (no per-row SQL JOINs).
 * Returns the number of rows inserted.
 */
export async function insertDvwDataChunk(
  rows: DvwDataRow[],
  dimMaps: DvwDimensionMaps,
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += DATA_BATCH_SIZE) {
    const batch = rows.slice(i, i + DATA_BATCH_SIZE);
    const params: (string | number | null)[] = [];
    for (const row of batch) {
      params.push(...resolveDataRowParams(row, dimMaps));
    }
    const placeholders = Array(batch.length).fill(DATA_PLACEHOLDER).join(",");
    await dvwQuery(
      `INSERT INTO data_points (${DATA_INSERT_COLS}) VALUES ${placeholders}`,
      params,
    );
    totalInserted += batch.length;
  }

  return totalInserted;
}

/**
 * Generate data_toc (table of contents) from data_points.
 */
export async function generateDvwDataToc(): Promise<void> {
  await dvwQuery(
    `INSERT INTO data_toc (module, group_id, market_id, destination_id, category_id, indicator_id, frequency, \`count\`)
     SELECT module, group_id, market_id, destination_id, category_id, indicator_id, frequency, count(*)
     FROM data_points
     GROUP BY module, group_id, market_id, destination_id, category_id, indicator_id, frequency`,
  );
  log.info("Generated DVW data_toc");
}

/**
 * Load data points from an iterable of data rows using batched inserts.
 * Dimension IDs are resolved in JS via pre-built maps (no per-row SQL JOINs).
 */
async function loadDvwData(
  dataRows: Iterable<DvwDataRow>,
  dimMaps: DvwDimensionMaps,
): Promise<number> {
  log.info("Loading DVW data points (streamed + batched)");

  let batch: (string | number | null)[] = [];
  let batchCount = 0;
  let totalInserted = 0;

  async function flushBatch(): Promise<void> {
    if (batchCount === 0) return;
    const placeholders = Array(batchCount).fill(DATA_PLACEHOLDER).join(",");
    await dvwQuery(
      `INSERT INTO data_points (${DATA_INSERT_COLS}) VALUES ${placeholders}`,
      batch,
    );
    totalInserted += batchCount;
    if (totalInserted % 50000 < DATA_BATCH_SIZE) {
      log.info({ totalInserted }, "DVW data point insert progress");
    }
    batch = [];
    batchCount = 0;
  }

  for (const row of dataRows) {
    batch.push(...resolveDataRowParams(row, dimMaps));
    batchCount++;

    if (batchCount >= DATA_BATCH_SIZE) {
      await flushBatch();
    }
  }

  // Flush remaining rows
  await flushBatch();

  // Generate data_toc (table of contents)
  await generateDvwDataToc();

  log.info({ inserted: totalInserted }, "Loaded DVW data points");
  return totalInserted;
}

// ─── Exported config & handlers (used by worker processor) ───────────

export const dvwUploadConfig: UploadConfig = {
  universe: "UHERO",
  fileSubdir: "dvw_files",
  uploadCollection: DvwUploadCollection,
  skipPublicDataPoints: true,
};

export const dvwUploadHandlers: UploadHandlers = {
  parseFile,
  wipeUniverse: wipeDvwUniverse,
  loadMetadata: async (parsed) => {
    const { dimensions } = parsed as DvwParseResult;
    return loadDvwMetadata(dimensions);
  },
  loadData: async (parsed, metaContext) => {
    const { dataSheet } = parsed as DvwParseResult;
    return loadDvwData(
      streamDataRows(dataSheet),
      metaContext as DvwDimensionMaps,
    );
  },
};

// ─── Main entry point (used by API route) ─────────────────────────────

export async function prepareDvwUpload(
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<{ uploadId: number; filePath: string }> {
  return prepareUpload(dvwUploadConfig, fileBuffer, originalFilename);
}
