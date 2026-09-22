import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery, scopedConnection } from "@/lib/mysql/db";

import CategoryCollection from "../collections/category-collection";
import DataListCollection from "../collections/data-list-collection";
import LoaderCollection from "../collections/loader-collection";
import MeasurementCollection from "../collections/measurement-collection";
import SeriesCollection from "../collections/series-collection";
import SourceCollection from "../collections/source-collection";
import UnitCollection from "../collections/unit-collection";
import { DbedtUploadCollection } from "../collections/universe-upload-collection";
import Series from "../models/series";
import { AdaptiveThrottle } from "../utils/adaptive-throttle";
import { makeDate } from "../utils/date-helpers";
import type {
  DbedtDataRow,
  DbedtMetaRow,
  DbedtParseResult,
} from "../utils/dbedt-xlsx-parser";
import {
  parseDbedtXlsx,
  streamDbedtDataRows,
} from "../utils/dbedt-xlsx-parser";
import {
  prepareUpload,
  type UploadConfig,
  type UploadHandlers,
} from "./universe-upload";

const log = createLogger("catalog.dbedt-upload");

/** Area ID → geography handle mapping (hardcoded, matches Rails) */
const AREA_TO_GEO: Record<number, string> = {
  1: "HI",
  2: "HAW",
  3: "HON",
  4: "KAU",
  5: "MAU",
};

// ─── Handlers ─────────────────────────────────────────────────────────

async function parseFile(filePath: string): Promise<DbedtParseResult> {
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(filePath);
  const result = parseDbedtXlsx(buffer);
  log.info(
    { indicatorRows: result.indicatorRows.length },
    "Parsed DBEDT XLSX (data sheet deferred)",
  );
  return result;
}

/** Rows per bounded DELETE statement. */
const DELETE_CHUNK_ROWS = 5000;
/** Key values per `IN (...)` list when deleting by parent id. */
const DELETE_ID_BATCH = 200;

/**
 * Delete rows in bounded chunks instead of one unbounded statement.
 *
 * `DELETE ... WHERE <col> IN (ids) LIMIT n` is repeated until a statement
 * affects fewer than `n` rows, with an adaptive pause between statements.
 * Each statement holds locks and undo for at most `n` rows, so concurrent
 * reloads / public syncs / page loads on the same table get a turn between
 * chunks instead of queueing behind a single multi-minute transaction.
 *
 * Uses MySQL's per-statement `affectedRows` from Bun's result array, so it
 * doesn't depend on running on the same connection as a `ROW_COUNT()` call.
 */
async function deleteInChunks(
  table: string,
  idColumn: string,
  ids: number[],
  throttle: AdaptiveThrottle,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += DELETE_ID_BATCH) {
    const batch = ids.slice(i, i + DELETE_ID_BATCH);
    const placeholders = batch.map(() => "?").join(",");
    const sql = `DELETE FROM \`${table}\` WHERE \`${idColumn}\` IN (${placeholders}) LIMIT ${DELETE_CHUNK_ROWS}`;
    for (;;) {
      const result = (await throttle.time(() =>
        rawQuery(sql, batch),
      )) as unknown as { affectedRows?: number };
      const affected = result.affectedRows ?? 0;
      total += affected;
      if (affected < DELETE_CHUNK_ROWS) break;
      await throttle.pause();
    }
  }
  return total;
}

/**
 * Wipe all DBEDT data except series, xseries, data_sources, and geographies.
 * Port of Rails `delete_universe_dbedt`, restructured so no single statement
 * touches more than a bounded number of rows on the big tables.
 */
export async function wipeDbedtUniverse(): Promise<void> {
  const throttle = new AdaptiveThrottle();

  // Delete categories with ancestry (keep root)
  await mysql`
    DELETE FROM categories
    WHERE universe = 'DBEDT' AND ancestry IS NOT NULL
  `;
  log.info("Deleted DBEDT child categories");

  // Delete data lists (and their join table entries via cascade)
  const dbedtLists = await mysql<{ id: number }>`
    SELECT id FROM data_lists WHERE universe = 'DBEDT'
  `;
  for (const { id } of dbedtLists) {
    await mysql`DELETE FROM data_list_measurements WHERE data_list_id = ${id}`;
  }
  await mysql`DELETE FROM data_lists WHERE universe = 'DBEDT'`;
  log.info("Deleted DBEDT data lists");

  // Resolve the DBEDT key space once; every big delete below is a plain
  // single-table DELETE by indexed key, so it can be chunked with LIMIT.
  const seriesRows = await mysql<{ id: number; xseries_id: number | null }>`
    SELECT id, xseries_id FROM series WHERE universe = 'DBEDT'
  `;
  const seriesIds = seriesRows.map((r) => r.id);
  const xseriesIds = [
    ...new Set(
      seriesRows.map((r) => r.xseries_id).filter((x): x is number => x != null),
    ),
  ];
  const measurementRows = await mysql<{ id: number }>`
    SELECT id FROM measurements WHERE universe = 'DBEDT'
  `;
  const measurementIds = measurementRows.map((r) => r.id);

  // Child rows — no FK constraint can be violated by removing these, so
  // they run on ordinary pooled connections with FK checks left on.
  log.info({ series: seriesIds.length }, "Deleting DBEDT public_data_points");
  const publicDeleted = await deleteInChunks(
    "public_data_points",
    "series_id",
    seriesIds,
    throttle,
  );
  log.info({ deleted: publicDeleted }, "Deleted DBEDT public_data_points");

  log.info({ xseries: xseriesIds.length }, "Deleting DBEDT data_points");
  const pointsDeleted = await deleteInChunks(
    "data_points",
    "xseries_id",
    xseriesIds,
    throttle,
  );
  log.info({ deleted: pointsDeleted }, "Deleted DBEDT data_points");

  log.info("Deleting DBEDT measurement_series");
  const msDeleted = await deleteInChunks(
    "measurement_series",
    "measurement_id",
    measurementIds,
    throttle,
  );
  log.info({ deleted: msDeleted }, "Deleted DBEDT measurement_series");

  // Parent rows. `series.unit_id` / `series.source_id` are ON DELETE RESTRICT
  // and the (kept) DBEDT series still point at these units/sources until
  // loadDbedtData re-links them, so FK checks must be off for these three
  // deletes. FOREIGN_KEY_CHECKS is a session variable: it only applies if
  // set on the same connection that runs the DELETEs, which scopedConnection
  // guarantees (the pool would otherwise hand each statement a random
  // connection). These tables are small, so one short transaction is fine.
  await scopedConnection(async (exec) => {
    await exec("SET FOREIGN_KEY_CHECKS = 0");
    try {
      log.info("Deleting DBEDT measurements");
      await exec("DELETE FROM measurements WHERE universe = 'DBEDT'");

      log.info("Deleting DBEDT units");
      await exec("DELETE FROM units WHERE universe = 'DBEDT'");

      log.info("Deleting DBEDT sources");
      await exec("DELETE FROM sources WHERE universe = 'DBEDT'");
    } finally {
      await exec("SET FOREIGN_KEY_CHECKS = 1");
    }
  });
}

/**
 * Load metadata from the indicator sheet: categories, data lists, measurements.
 * Returns a map of indId → metaRow for use by loadData.
 */
export async function loadDbedtMetadata(
  indicatorRows: DbedtMetaRow[],
): Promise<Map<number, DbedtMetaRow>> {
  log.info("loadDbedtMetadata: start");

  const allMeta = new Map<number, DbedtMetaRow>();
  // Map indId → ancestry path for building category hierarchy
  const catsAncestry = new Map<number, string>();

  // Find DBEDT root category
  const rootRows = await mysql<{ id: number }>`
    SELECT id FROM categories
    WHERE universe = 'DBEDT' AND ancestry IS NULL
    LIMIT 1
  `;
  if (!rootRows[0]) {
    throw new Error("No DBEDT root category found");
  }
  const rootCatId = String(rootRows[0].id);

  // Track last category so measurement rows can link to it
  let lastCategory: { id: number; dataListId: number | null } | null = null;

  // Each indicator row is several round trips; pause proportionally to how
  // long the last row took so a busy server slows this loop down.
  const throttle = new AdaptiveThrottle();
  let rowsProcessed = 0;

  for (const row of indicatorRows) {
    allMeta.set(row.indId, row);
    if (rowsProcessed++ > 0 && rowsProcessed % 10 === 0) {
      await throttle.pause();
    }
    const rowStart = performance.now();

    if (!row.unit) {
      // ── Category entry ──────────────────────────────────────────
      if (row.order == null) {
        throw new Error(`Order missing for indicator ${row.indId}`);
      }

      let ancestry = rootCatId;
      if (row.parentId != null) {
        const parentAncestry = catsAncestry.get(row.parentId);
        if (parentAncestry) {
          ancestry = parentAncestry;
        }
      }

      const category = await CategoryCollection.create({
        meta: `DBEDT_${row.indId}`,
        universe: "DBEDT",
        name: row.indicatorForTable,
        ancestry,
        listOrder: row.order,
      });

      catsAncestry.set(row.indId, `${ancestry}/${category.id}`);
      lastCategory = { id: category.id, dataListId: category.dataListId };
      log.debug(
        { meta: `DBEDT_${row.indId}`, name: row.indicatorForTable },
        "Created category",
      );
    } else {
      // ── Measurement entry ───────────────────────────────────────
      if (row.order == null || row.decimal == null) {
        throw new Error(`Order or decimal missing for indicator ${row.indId}`);
      }

      const parentLabel = `DBEDT_${row.parentId}`;

      // Find or create data list
      let dataList: { id: number };
      try {
        dataList = await DataListCollection.getByName(parentLabel, "DBEDT");
      } catch {
        dataList = await DataListCollection.create({
          name: parentLabel,
          universe: "DBEDT",
        });
        // Link parent category to this data list
        if (lastCategory) {
          await CategoryCollection.update(lastCategory.id, {
            dataListId: dataList.id,
          });
        }
      }

      // Create measurement
      const measurement = await MeasurementCollection.create({
        universe: "DBEDT",
        prefix: `DBEDT_${row.indId}`,
        dataPortalName: row.indicator,
      });

      // Add measurement to data list
      await DataListCollection.addMeasurement(
        dataList.id,
        measurement.id,
        row.order,
      );

      log.debug(
        { prefix: `DBEDT_${row.indId}`, dataList: parentLabel },
        "Added measurement to data list",
      );
    }
    throttle.record(performance.now() - rowStart);
  }

  log.info({ totalMeta: allMeta.size }, "loadDbedtMetadata: done");
  return allMeta;
}

/**
 * Load series data from the data sheet.
 * Returns count of data points inserted.
 */
export async function loadDbedtData(
  dataRows: Iterable<DbedtDataRow>,
  metadata: Map<number, DbedtMetaRow>,
): Promise<number> {
  log.info("loadDbedtData: start");

  // Caches
  const geoIdCache = new Map<string, number>();
  const sourceIdCache = new Map<string, number>();
  const unitIdCache = new Map<string, number>();

  let currentSeriesName: string | null = null;
  let currentSeries: { id: number; xseriesId: number | null } | null = null;
  let currentDataSourceId: number | null = null;
  let currentMeasurementPrefix: string | null = null;
  let seriesProcessed = 0;
  const throttle = new AdaptiveThrottle();
  let seriesStart = 0;

  const dataPoints: {
    xseriesId: number;
    dataSourceId: number;
    date: string;
    value: number | null;
  }[] = [];

  for (const row of dataRows) {
    const indMeta = metadata.get(row.indId);
    if (!indMeta) {
      log.warn({ indId: row.indId }, "No metadata found, skipping row");
      continue;
    }

    const prefix = `DBEDT_${row.indId}`;
    const geoHandle = AREA_TO_GEO[row.areaId];
    if (!geoHandle) {
      throw new Error(
        `Area ID=${row.areaId} is blank/unknown around row ${dataPoints.length}`,
      );
    }

    // Resolve geography ID
    if (!geoIdCache.has(geoHandle)) {
      const geoRows = await mysql<{ id: number }>`
        SELECT id FROM geographies
        WHERE universe = 'DBEDT' AND handle = ${geoHandle}
        LIMIT 1
      `;
      if (!geoRows[0]) {
        throw new Error(`Area handle ${geoHandle} missing from db`);
      }
      geoIdCache.set(geoHandle, geoRows[0].id);
    }
    const geoId = geoIdCache.get(geoHandle)!;

    const name = Series.buildName(prefix, geoHandle, row.frequency);

    // Find or update measurement
    if (currentMeasurementPrefix !== prefix) {
      currentMeasurementPrefix = prefix;
    }

    // If series changed, handle series creation/update
    if (currentSeriesName !== name) {
      currentSeriesName = name;
      currentDataSourceId = null;
      seriesProcessed++;

      // Throttle every 10 series, proportionally to how long the previous
      // series' round trips took, so a busy server slows this loop down.
      if (seriesStart > 0) throttle.record(performance.now() - seriesStart);
      if (seriesProcessed % 10 === 0) {
        await throttle.pause();
      }
      seriesStart = performance.now();

      // Resolve source
      const sourceStr = indMeta.source;
      let sourceId: number | null = null;
      if (sourceStr && sourceStr.toLowerCase() !== "none") {
        if (!sourceIdCache.has(sourceStr)) {
          const source = await SourceCollection.getOrCreate(
            sourceStr,
            null,
            "DBEDT",
          );
          sourceIdCache.set(sourceStr, source.id);
        }
        sourceId = sourceIdCache.get(sourceStr)!;
      }

      // Resolve unit
      const unitStr = indMeta.unit;
      if (!unitStr) {
        throw new Error(`Unit missing for indicator ${row.indId}`);
      }
      let unitId: number | null = null;
      if (unitStr.toLowerCase() !== "none") {
        if (!unitIdCache.has(unitStr)) {
          const unit = await UnitCollection.getOrCreate(unitStr, "DBEDT");
          unitIdCache.set(unitStr, unit.id);
        }
        unitId = unitIdCache.get(unitStr)!;
      }

      // Find or create series
      let series = await SeriesCollection.findByNameAndUniverse(name, "DBEDT");

      if (series) {
        await SeriesCollection.update(series.id!, {
          description: indMeta.indicatorForTable,
          dataPortalName: indMeta.indicatorForTable,
          unitId,
          sourceId,
          decimals: indMeta.decimal ?? 1,
        });

        // Find existing loader
        const loaders = await LoaderCollection.getBySeriesId(series.id!);
        const dbedtLoader = loaders.find((l) => l.universe === "DBEDT");
        if (dbedtLoader) {
          currentDataSourceId = dbedtLoader.id;
        }
      } else {
        series = await SeriesCollection.create({
          universe: "DBEDT",
          name,
          frequency: Series.frequencyFromCode(row.frequency),
          geographyId: geoId,
          description: indMeta.indicatorForTable,
          dataPortalName: indMeta.indicatorForTable,
          unitId,
          sourceId,
          decimals: indMeta.decimal ?? 1,
        });
      }

      currentSeries = {
        id: series.id!,
        xseriesId: series.xseriesId ?? null,
      };

      // Create loader if needed
      if (!currentDataSourceId) {
        const loader = await LoaderCollection.create({
          seriesId: series.id!,
          code: `DbedtUpload.load(${series.id})`,
          priority: 0,
          scale: 1,
          presaveHook: "",
          clearBeforeLoad: false,
          pseudoHistory: false,
          universe: "DBEDT",
        });
        currentDataSourceId = loader.id;
      }

      // Link measurement to series
      try {
        const measurement = await MeasurementCollection.getByPrefix(
          prefix,
          "DBEDT",
        );
        await MeasurementCollection.addSeries(measurement.id, series.id!);
      } catch {
        // Measurement not found — create one
        const measurement = await MeasurementCollection.create({
          universe: "DBEDT",
          prefix,
          dataPortalName: indMeta.indicatorForTable,
        });
        await MeasurementCollection.addSeries(measurement.id, series.id!);
      }
    }

    if (!currentSeries?.xseriesId || !currentDataSourceId) continue;

    // Collect data point
    const date = makeDate(row.year, row.qm);
    dataPoints.push({
      xseriesId: currentSeries.xseriesId,
      dataSourceId: currentDataSourceId,
      date,
      value: row.value,
    });
  }

  // Batch insert data points
  log.info({ totalPoints: dataPoints.length }, "Inserting data points");

  // Deduplicate by composite key and batch in groups of 1000
  const seen = new Set<string>();
  const uniquePoints = dataPoints.filter((dp) => {
    const key = `${dp.xseriesId}|${dp.dataSourceId}|${dp.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (let i = 0; i < uniquePoints.length; i += 1000) {
    const batch = uniquePoints.slice(i, i + 1000);
    const placeholders = batch.map(() => "(?, ?, ?, ?, true, NOW())").join(",");
    const params: (string | number)[] = [];
    for (const dp of batch) {
      params.push(dp.xseriesId, dp.dataSourceId, dp.date, dp.value ?? 0);
    }
    await throttle.run(
      () =>
        rawQuery(
          `INSERT INTO data_points (xseries_id, data_source_id, \`date\`, \`value\`, \`current\`, created_at) VALUES ${placeholders}`,
          params,
        ),
      i + 1000 >= uniquePoints.length,
    );
  }

  log.info({ inserted: uniquePoints.length }, "loadDbedtData: done");
  return uniquePoints.length;
}

// ─── Exported config & handlers (used by worker processor) ───────────

export const dbedtUploadConfig: UploadConfig = {
  universe: "DBEDT",
  fileSubdir: "dbedt_files",
  uploadCollection: DbedtUploadCollection,
  uploadLabel: "DBEDT Econ",
};

export const dbedtUploadHandlers: UploadHandlers = {
  parseFile,
  wipeUniverse: wipeDbedtUniverse,
  loadMetadata: async (parsed) => {
    const { indicatorRows } = parsed as DbedtParseResult;
    return loadDbedtMetadata(indicatorRows);
  },
  loadData: async (parsed, metaContext) => {
    const { dataSheet } = parsed as DbedtParseResult;
    return loadDbedtData(
      streamDbedtDataRows(dataSheet),
      metaContext as Map<number, DbedtMetaRow>,
    );
  },
};

// ─── Main entry point (used by API route) ─────────────────────────────

export async function prepareDbedtUpload(
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<{ uploadId: number; filePath: string }> {
  return prepareUpload(dbedtUploadConfig, fileBuffer, originalFilename);
}
