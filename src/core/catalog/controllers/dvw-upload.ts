import { createLogger } from "@/core/observability/logger";
import { rawQuery as dvwQuery } from "@/lib/mysql/dvw-db";

import { DvwUploadCollection } from "../collections/universe-upload-collection";
import { AdaptiveThrottle } from "../utils/adaptive-throttle";
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

// ─── Staging tables ───────────────────────────────────────────────────
//
// The load never touches the live tables. Every table gets a `<name>_new`
// twin (CREATE TABLE ... LIKE), all inserts go there, and `finalizeDvwLoad`
// swaps the whole set into place with one atomic RENAME TABLE. Readers of
// the DVW portal see either the complete old dataset or the complete new
// one — never an empty table — and a failed upload leaves the live data
// intact.
//
// CREATE TABLE ... LIKE does not copy FOREIGN KEY constraints, so the
// staging set has none and no FOREIGN_KEY_CHECKS juggling is needed (which
// would be unreliable anyway: it's a session variable and the pool hands
// out arbitrary connections). Retired `_old` tables are dropped child-first
// (data_toc, data_points, then dimensions) so any FKs the original tables
// carried can't block the drop.

/** Live DVW tables, parents first. */
const DVW_TABLES = [
  "groups",
  "markets",
  "destinations",
  "categories",
  "indicators",
  "data_points",
  "data_toc",
] as const;

const STAGING_SUFFIX = "_new";
const RETIRED_SUFFIX = "_old";

function q(table: string): string {
  return `\`${table}\``;
}

/** Name of the staging twin for a live table. */
export function dvwStagingTable(table: string): string {
  return `${table}${STAGING_SUFFIX}`;
}

/** Drop leftover staging/retired tables from a previous (failed) run. */
async function dropDvwScratchTables(): Promise<void> {
  // Child-first so FK constraints on retired tables can't block the drop.
  for (const table of [...DVW_TABLES].reverse()) {
    await dvwQuery(`DROP TABLE IF EXISTS ${q(table + RETIRED_SUFFIX)}`);
    await dvwQuery(`DROP TABLE IF EXISTS ${q(table + STAGING_SUFFIX)}`);
  }
}

/**
 * Prepare an empty staging set for a new DVW load.
 *
 * Drops any scratch tables left by an earlier failed run, then creates
 * `<table>_new` for every DVW table. Live tables are untouched.
 */
export async function prepareDvwStaging(): Promise<void> {
  await dropDvwScratchTables();
  for (const table of DVW_TABLES) {
    await dvwQuery(
      `CREATE TABLE ${q(table + STAGING_SUFFIX)} LIKE ${q(table)}`,
    );
  }
  log.info({ tables: DVW_TABLES.length }, "Created DVW staging tables");
}

/**
 * Historical name for the "start a fresh load" step. It used to TRUNCATE
 * the live tables; it now creates the staging set instead. Kept exported so
 * existing callers (stream route init, worker handlers) keep working.
 */
export async function wipeDvwUniverse(): Promise<void> {
  await prepareDvwStaging();
}

/**
 * Atomically swap the staging set into place and drop the retired tables.
 * Safe to call only after every staging table has been fully loaded.
 */
export async function swapDvwStagingTables(): Promise<void> {
  const pairs = DVW_TABLES.flatMap((t) => [
    `${q(t)} TO ${q(t + RETIRED_SUFFIX)}`,
    `${q(t + STAGING_SUFFIX)} TO ${q(t)}`,
  ]);
  await dvwQuery(`RENAME TABLE ${pairs.join(", ")}`);
  log.info("Swapped DVW staging tables into place");

  for (const table of [...DVW_TABLES].reverse()) {
    await dvwQuery(`DROP TABLE IF EXISTS ${q(table + RETIRED_SUFFIX)}`);
  }
  log.info("Dropped retired DVW tables");
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

  const target = q(dvwStagingTable(table));
  const throttle = new AdaptiveThrottle();

  for (let i = 0; i < insertRows.length; i += 1000) {
    const batch = insertRows.slice(i, i + 1000);
    const placeholders = batch.map(() => placeholder).join(",");
    const params = batch.flat() as (string | number | null)[];
    await throttle.run(
      () =>
        dvwQuery(
          `INSERT INTO ${target} (${cols}) VALUES ${placeholders}`,
          params,
        ),
      i + 1000 >= insertRows.length,
    );
  }

  // Resolve parent references. One self-join UPDATE per batch of edges
  // (instead of one statement per edge): a derived table of
  // (parent_handle, child_handle) pairs joined back to the staging table on
  // module + handle. Parent rows for the same module share the same id, so
  // the join is unambiguous.
  const PARENT_BATCH = 500;
  for (let i = 0; i < parentSet.length; i += PARENT_BATCH) {
    const batch = parentSet.slice(i, i + PARENT_BATCH);
    const rowsSql = batch
      .map(() => "SELECT ? AS parent_handle, ? AS child_handle")
      .join(" UNION ALL ");
    await throttle.run(
      () =>
        dvwQuery(
          `UPDATE ${target} child
             JOIN (${rowsSql}) edges ON edges.child_handle = child.handle
             JOIN ${target} parent
               ON parent.module = child.module
              AND parent.handle = edges.parent_handle
           SET child.parent_id = parent.id`,
          batch.flat(),
        ),
      i + PARENT_BATCH >= parentSet.length,
    );
  }

  log.info({ table, inserted: insertRows.length }, "Loaded DVW dimension");
}

/**
 * Build a `handle:module` → id map by querying a dimension table.
 */
async function buildDimensionMap(table: string): Promise<Map<string, number>> {
  const rows = await dvwQuery<{ id: number; handle: string; module: string }>(
    `SELECT id, handle, module FROM ${q(dvwStagingTable(table))}`,
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
  const throttle = new AdaptiveThrottle();
  const target = q(dvwStagingTable("data_points"));
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += DATA_BATCH_SIZE) {
    const batch = rows.slice(i, i + DATA_BATCH_SIZE);
    const params: (string | number | null)[] = [];
    for (const row of batch) {
      params.push(...resolveDataRowParams(row, dimMaps));
    }
    const placeholders = Array(batch.length).fill(DATA_PLACEHOLDER).join(",");
    await throttle.run(
      () =>
        dvwQuery(
          `INSERT INTO ${target} (${DATA_INSERT_COLS}) VALUES ${placeholders}`,
          params,
        ),
      i + DATA_BATCH_SIZE >= rows.length,
    );
    totalInserted += batch.length;
  }

  return totalInserted;
}

/**
 * Build data_toc (table of contents) in the staging set from the staged
 * data_points.
 */
async function buildDvwStagingToc(): Promise<void> {
  await dvwQuery(
    `INSERT INTO ${q(dvwStagingTable("data_toc"))} (module, group_id, market_id, destination_id, category_id, indicator_id, frequency, \`count\`)
     SELECT module, group_id, market_id, destination_id, category_id, indicator_id, frequency, count(*)
     FROM ${q(dvwStagingTable("data_points"))}
     GROUP BY module, group_id, market_id, destination_id, category_id, indicator_id, frequency`,
  );
  log.info("Generated DVW data_toc (staging)");
}

/**
 * Finalize a DVW load: build the TOC in staging, then atomically swap the
 * staging set into place and drop the retired tables.
 *
 * Call once, after all data chunks have been inserted.
 */
export async function finalizeDvwLoad(): Promise<void> {
  await buildDvwStagingToc();
  await swapDvwStagingTables();
}

/**
 * Historical name for the finalize step. It used to only build data_toc
 * against the live table; since the load now goes through staging tables
 * it also performs the swap. Kept exported so the stream route's finalize
 * phase keeps working unchanged.
 */
export async function generateDvwDataToc(): Promise<void> {
  await finalizeDvwLoad();
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

  const throttle = new AdaptiveThrottle();
  const target = q(dvwStagingTable("data_points"));
  async function flushBatch(): Promise<void> {
    if (batchCount === 0) return;
    const placeholders = Array(batchCount).fill(DATA_PLACEHOLDER).join(",");
    const params = batch;
    await throttle.run(() =>
      dvwQuery(
        `INSERT INTO ${target} (${DATA_INSERT_COLS}) VALUES ${placeholders}`,
        params,
      ),
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

  // Build data_toc in staging and swap everything live
  await finalizeDvwLoad();

  log.info({ inserted: totalInserted }, "Loaded DVW data points");
  return totalInserted;
}

// ─── Exported config & handlers (used by worker processor) ───────────

export const dvwUploadConfig: UploadConfig = {
  universe: "UHERO",
  fileSubdir: "dvw_files",
  uploadCollection: DvwUploadCollection,
  skipPublicDataPoints: true,
  uploadLabel: "DBEDT Tour",
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
