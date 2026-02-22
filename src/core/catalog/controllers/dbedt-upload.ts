import "server-only";

import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import CategoryCollection from "../collections/category-collection";
import DataListCollection from "../collections/data-list-collection";
import LoaderCollection from "../collections/loader-collection";
import MeasurementCollection from "../collections/measurement-collection";
import SeriesCollection from "../collections/series-collection";
import SourceCollection from "../collections/source-collection";
import UnitCollection from "../collections/unit-collection";
import { DbedtUploadCollection } from "../collections/universe-upload-collection";
import Series from "../models/series";
import { makeDate } from "../utils/date-helpers";
import type {
  DbedtDataRow,
  DbedtMetaRow,
  DbedtParseResult,
} from "../utils/dbedt-xlsx-parser";
import { parseDbedtXlsx } from "../utils/dbedt-xlsx-parser";
import { orchestrateUpload, type UploadResult } from "./universe-upload";

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
    {
      indicatorRows: result.indicatorRows.length,
      dataRows: result.dataRows.length,
    },
    "Parsed DBEDT XLSX",
  );
  return result;
}

/**
 * Wipe all DBEDT data except series, xseries, data_sources, and geographies.
 * Direct port of Rails `delete_universe_dbedt`.
 */
async function wipeDbedtUniverse(): Promise<void> {
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

  await rawQuery("SET FOREIGN_KEY_CHECKS = 0");
  try {
    log.info("Deleting DBEDT public_data_points");
    await rawQuery(
      `DELETE p FROM public_data_points p
       JOIN series s ON s.id = p.series_id
       WHERE s.universe = 'DBEDT'`,
    );

    log.info("Deleting DBEDT data_points");
    await rawQuery(
      `DELETE d FROM data_points d
       JOIN series s ON s.xseries_id = d.xseries_id
       WHERE s.universe = 'DBEDT'`,
    );

    log.info("Deleting DBEDT measurement_series");
    await rawQuery(
      `DELETE ms FROM measurement_series ms
       JOIN measurements m ON m.id = ms.measurement_id
       WHERE m.universe = 'DBEDT'`,
    );

    log.info("Deleting DBEDT measurements");
    await rawQuery("DELETE FROM measurements WHERE universe = 'DBEDT'");

    log.info("Deleting DBEDT units");
    await rawQuery("DELETE FROM units WHERE universe = 'DBEDT'");

    log.info("Deleting DBEDT sources");
    await rawQuery("DELETE FROM sources WHERE universe = 'DBEDT'");
  } finally {
    await rawQuery("SET FOREIGN_KEY_CHECKS = 1");
  }
}

/**
 * Load metadata from the indicator sheet: categories, data lists, measurements.
 * Returns a map of indId → metaRow for use by loadData.
 */
async function loadDbedtMetadata(
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

  for (const row of indicatorRows) {
    allMeta.set(row.indId, row);

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
  }

  log.info({ totalMeta: allMeta.size }, "loadDbedtMetadata: done");
  return allMeta;
}

/**
 * Load series data from the data sheet.
 * Returns count of data points inserted.
 */
async function loadDbedtData(
  dataRows: DbedtDataRow[],
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
    await rawQuery(
      `INSERT INTO data_points (xseries_id, data_source_id, \`date\`, \`value\`, \`current\`, created_at) VALUES ${placeholders}`,
      params,
    );
  }

  log.info({ inserted: uniquePoints.length }, "loadDbedtData: done");
  return uniquePoints.length;
}

// ─── Main entry point ─────────────────────────────────────────────────

export async function processDbedtUpload(
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<UploadResult> {
  return orchestrateUpload(
    {
      universe: "DBEDT",
      fileSubdir: "dbedt_files",
      uploadCollection: DbedtUploadCollection,
    },
    fileBuffer,
    originalFilename,
    {
      parseFile,
      wipeUniverse: wipeDbedtUniverse,
      loadMetadata: async (parsed) => {
        const { indicatorRows } = parsed as DbedtParseResult;
        return loadDbedtMetadata(indicatorRows);
      },
      loadData: async (parsed, metaContext) => {
        const { dataRows } = parsed as DbedtParseResult;
        return loadDbedtData(
          dataRows,
          metaContext as Map<number, DbedtMetaRow>,
        );
      },
    },
  );
}
