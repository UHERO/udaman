import { createLogger } from "@/core/observability/logger";
import { mysql, rawQuery } from "@/lib/mysql/db";

import CategoryCollection from "../collections/category-collection";
import DataListCollection from "../collections/data-list-collection";
import LoaderCollection from "../collections/loader-collection";
import MeasurementCollection from "../collections/measurement-collection";
import SeriesCollection from "../collections/series-collection";
import type { Universe } from "../types/shared";
import {
  geotypeForZip,
  getFactbookFilePath,
  readFactbookFile,
  type FactbookHeader,
  type FactbookRow,
} from "../utils/factbook-parser";

/**
 * Factbook (Hawaii Housing Factbook / HHF) upload pipeline.
 *
 * Unlike the DBEDT upload, the factbook file doesn't contain a self-describing
 * metadata sheet — we only get a single wide pipe-separated table of
 * `zip|zipname|year|<measurement_col_1>|...`. So this controller is responsible
 * for bootstrapping the metadata (categories, data lists, measurements, series,
 * geographies, loaders) from the file header on first run, and then keeping
 * them stable on subsequent runs while wiping & reloading the data points.
 *
 * Phases:
 *   1. Ensure HHF root + 7 child categories (6 named + 'unmapped'), each with
 *      a backing data list.
 *   2. Upsert geographies keyed by zip (preserves existing).
 *   3. Upsert measurements keyed by sanitized column prefix (preserves existing).
 *   4. Assign any measurement not already in a data list to 'unmapped'.
 *   5. Upsert one annual series per (measurement, geography) with a loader.
 *   6. Wipe all HHF data points.
 *   7. Insert data points in 1000-row batches (one per non-null cell).
 */

const log = createLogger("catalog.factbook-upload");

const HHF: Universe = "HHF";

/** Seven child categories under the HHF root. Order here drives list_order. */
const CATEGORY_NAMES = [
  "demographics",
  "property-market",
  "rental-market",
  "zoning",
  "housing-stock",
  "access",
  "unmapped",
] as const;

const UNMAPPED_CATEGORY_NAME = "unmapped";

export type FactbookUploadResult = {
  filePath: string;
  geographiesCreated: number;
  geographiesExisting: number;
  measurementsCreated: number;
  measurementsExisting: number;
  seriesCreated: number;
  seriesExisting: number;
  dataPointsInserted: number;
  unmappedMeasurements: number;
};

// ─── Phase 1: Categories & data lists ─────────────────────────────────

async function ensureHhfCategoriesAndLists(): Promise<{
  rootId: number;
  categoriesByName: Map<string, { id: number; dataListId: number }>;
}> {
  // Find or create the HHF root category
  const rootRows = await mysql<{ id: number }>`
    SELECT id FROM categories
    WHERE universe = ${HHF} AND ancestry IS NULL
    LIMIT 1
  `;
  let rootId: number;
  if (rootRows[0]) {
    rootId = rootRows[0].id;
  } else {
    const root = await CategoryCollection.create({
      universe: HHF,
      name: "HHF",
      listOrder: 0,
    });
    rootId = root.id;
    log.info({ rootId }, "Created HHF root category");
  }
  const rootAncestry = String(rootId);

  // Load existing child categories under root
  const childRows = await mysql<{
    id: number;
    name: string | null;
    data_list_id: number | null;
  }>`
    SELECT id, name, data_list_id FROM categories
    WHERE universe = ${HHF} AND ancestry = ${rootAncestry}
  `;
  const existingByName = new Map<
    string,
    { id: number; dataListId: number | null }
  >();
  for (const row of childRows) {
    if (row.name) {
      existingByName.set(row.name, {
        id: row.id,
        dataListId: row.data_list_id,
      });
    }
  }

  // Ensure each named category + backing data list
  const categoriesByName = new Map<
    string,
    { id: number; dataListId: number }
  >();
  for (let i = 0; i < CATEGORY_NAMES.length; i++) {
    const name = CATEGORY_NAMES[i];
    const existing = existingByName.get(name);

    let categoryId: number;
    let dataListId: number | null;

    if (existing) {
      categoryId = existing.id;
      dataListId = existing.dataListId;
    } else {
      // Create a data list first so the category can link to it at insert time
      const dl = await DataListCollection.create({
        name,
        universe: HHF,
      });
      const cat = await CategoryCollection.create({
        universe: HHF,
        name,
        ancestry: rootAncestry,
        listOrder: i,
        dataListId: dl.id,
      });
      categoryId = cat.id;
      dataListId = dl.id;
      log.info({ name, categoryId, dataListId }, "Created HHF category");
    }

    // If the category exists but was never linked to a data list, repair it
    if (!dataListId) {
      let dl;
      try {
        dl = await DataListCollection.getByName(name, HHF);
      } catch {
        dl = await DataListCollection.create({ name, universe: HHF });
      }
      await CategoryCollection.update(categoryId, { dataListId: dl.id });
      dataListId = dl.id;
      log.info(
        { name, categoryId, dataListId },
        "Linked data list to HHF category",
      );
    }

    categoriesByName.set(name, { id: categoryId, dataListId });
  }

  return { rootId, categoriesByName };
}

// ─── Phase 2: Geographies ─────────────────────────────────────────────

async function upsertGeographies(rows: FactbookRow[]): Promise<{
  byZip: Map<string, number>;
  created: number;
  existing: number;
}> {
  // Collect unique zip → first-seen zipname
  const uniqueZips = new Map<string, string>();
  for (const row of rows) {
    if (!uniqueZips.has(row.zip)) {
      uniqueZips.set(row.zip, row.zipname);
    }
  }

  // Load all existing HHF geos in one query
  const existingRows = await mysql<{ id: number; handle: string | null }>`
    SELECT id, handle FROM geographies WHERE universe = ${HHF}
  `;
  const byZip = new Map<string, number>();
  for (const row of existingRows) {
    if (row.handle) byZip.set(row.handle, row.id);
  }

  let created = 0;
  let existing = 0;
  for (const [zip, zipname] of uniqueZips) {
    if (byZip.has(zip)) {
      existing++;
      continue;
    }
    await mysql`
      INSERT INTO geographies (
        universe, handle, display_name, display_name_short, geotype,
        created_at, updated_at
      ) VALUES (
        ${HHF}, ${zip}, ${zipname}, ${zipname}, ${geotypeForZip(zip)},
        NOW(), NOW()
      )
    `;
    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    byZip.set(zip, insertId);
    created++;
  }

  log.info(
    { created, existing, total: uniqueZips.size },
    "Upserted HHF geographies",
  );
  return { byZip, created, existing };
}

// ─── Phase 3: Measurements ────────────────────────────────────────────

async function upsertMeasurements(header: FactbookHeader): Promise<{
  byPrefix: Map<string, number>;
  createdPrefixes: string[];
  existingPrefixes: string[];
}> {
  const existingRows = await mysql<{ id: number; prefix: string }>`
    SELECT id, prefix FROM measurements WHERE universe = ${HHF}
  `;
  const byPrefix = new Map<string, number>();
  for (const row of existingRows) byPrefix.set(row.prefix, row.id);

  const createdPrefixes: string[] = [];
  const existingPrefixes: string[] = [];

  for (const idx of header.measurementIndices) {
    const prefix = header.sanitizedColumns[idx];
    const rawName = header.rawColumns[idx];
    if (byPrefix.has(prefix)) {
      existingPrefixes.push(prefix);
      continue;
    }
    const m = await MeasurementCollection.create({
      universe: HHF,
      prefix,
      dataPortalName: rawName,
      decimals: 2,
      seasonalAdjustment: "not_applicable",
    });
    byPrefix.set(prefix, m.id);
    createdPrefixes.push(prefix);
  }

  log.info(
    { created: createdPrefixes.length, existing: existingPrefixes.length },
    "Upserted HHF measurements",
  );
  return { byPrefix, createdPrefixes, existingPrefixes };
}

// ─── Phase 4: Assign unmapped measurements ────────────────────────────

/**
 * Any measurement that isn't already in *any* data list is considered
 * "unmapped" and gets added to the unmapped data list. On subsequent uploads,
 * once a measurement has been moved into a real category's data list, it will
 * no longer qualify as unmapped and this function will leave it alone.
 */
async function assignUnmappedMeasurements(
  measurementIds: number[],
  unmappedDataListId: number,
): Promise<number> {
  if (measurementIds.length === 0) return 0;

  const assignedRows = await mysql<{ measurement_id: number }>`
    SELECT DISTINCT measurement_id FROM data_list_measurements
    WHERE measurement_id IN ${mysql(measurementIds)}
  `;
  const assigned = new Set(assignedRows.map((r) => r.measurement_id));

  let addedCount = 0;
  for (const mid of measurementIds) {
    if (assigned.has(mid)) continue;
    await DataListCollection.addMeasurement(unmappedDataListId, mid);
    addedCount++;
  }
  log.info({ addedCount }, "Assigned unmapped HHF measurements");
  return addedCount;
}

// ─── Phase 5: Series + loaders ────────────────────────────────────────

type SeriesKey = string; // `${prefix}|${zip}`

async function upsertSeries(opts: {
  header: FactbookHeader;
  zipsByHandle: Map<string, number>;
  measurementsByPrefix: Map<string, number>;
}): Promise<{
  byKey: Map<SeriesKey, { id: number; xseriesId: number; loaderId: number }>;
  created: number;
  existing: number;
}> {
  const { header, zipsByHandle, measurementsByPrefix } = opts;

  const byKey = new Map<
    SeriesKey,
    { id: number; xseriesId: number; loaderId: number }
  >();
  let created = 0;
  let existing = 0;

  for (const idx of header.measurementIndices) {
    const prefix = header.sanitizedColumns[idx];
    const measurementId = measurementsByPrefix.get(prefix);
    if (measurementId == null) continue;

    for (const [zip, geoId] of zipsByHandle) {
      const name = `${prefix}@${zip}.A`;
      const key: SeriesKey = `${prefix}|${zip}`;

      let series = await SeriesCollection.findByNameAndUniverse(name, HHF);
      if (series) {
        existing++;
      } else {
        series = await SeriesCollection.create({
          universe: HHF,
          name,
          frequency: "year",
          geographyId: geoId,
          decimals: 2,
        });
        created++;
      }

      const seriesId = series.id!;
      const xseriesId = series.xseriesId!;

      // Link measurement ↔ series (idempotent)
      await MeasurementCollection.addSeries(measurementId, seriesId);

      // Find an existing HHF loader for this series, or create one
      const loaders = await LoaderCollection.getBySeriesId(seriesId);
      const existingLoader = loaders.find((l) => l.universe === HHF);
      let loaderId: number;
      if (existingLoader) {
        loaderId = existingLoader.id;
      } else {
        const loader = await LoaderCollection.create({
          seriesId,
          code: `FactbookUpload.load(${seriesId})`,
          priority: 0,
          scale: 1,
          presaveHook: "",
          clearBeforeLoad: false,
          pseudoHistory: false,
          universe: HHF,
        });
        loaderId = loader.id;
      }

      byKey.set(key, { id: seriesId, xseriesId, loaderId });
    }
  }

  log.info({ created, existing }, "Upserted HHF series");
  return { byKey, created, existing };
}

// ─── Phase 6: Wipe data points ────────────────────────────────────────

async function wipeFactbookDataPoints(): Promise<void> {
  log.info("Wiping HHF data_points");
  await rawQuery("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await rawQuery(
      `DELETE d FROM data_points d
       JOIN series s ON s.xseries_id = d.xseries_id
       WHERE s.universe = 'HHF'`,
    );
  } finally {
    await rawQuery("SET FOREIGN_KEY_CHECKS = 1");
  }
}

// ─── Phase 7: Insert data points ──────────────────────────────────────

async function insertFactbookDataPoints(
  rows: FactbookRow[],
  seriesByKey: Map<
    SeriesKey,
    { id: number; xseriesId: number; loaderId: number }
  >,
): Promise<number> {
  const dataPoints: {
    xseriesId: number;
    dataSourceId: number;
    date: string;
    value: number;
  }[] = [];

  for (const row of rows) {
    const date = `${row.year}-01-01`;
    for (const [sanitized, value] of Object.entries(row.values)) {
      if (value == null) continue;
      const key: SeriesKey = `${sanitized}|${row.zip}`;
      const series = seriesByKey.get(key);
      if (!series) continue;
      dataPoints.push({
        xseriesId: series.xseriesId,
        dataSourceId: series.loaderId,
        date,
        value,
      });
    }
  }

  // Dedupe in case of duplicate (year, zip) rows in the source file
  const seen = new Set<string>();
  const unique = dataPoints.filter((dp) => {
    const k = `${dp.xseriesId}|${dp.dataSourceId}|${dp.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  log.info({ count: unique.length }, "Inserting HHF data_points");
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    const placeholders = batch.map(() => "(?, ?, ?, ?, true, NOW())").join(",");
    const params: (string | number)[] = [];
    for (const dp of batch) {
      params.push(dp.xseriesId, dp.dataSourceId, dp.date, dp.value);
    }
    await rawQuery(
      `INSERT INTO data_points (xseries_id, data_source_id, \`date\`, \`value\`, \`current\`, created_at) VALUES ${placeholders}`,
      params,
    );
  }

  return unique.length;
}

// ─── Main entry point ─────────────────────────────────────────────────

export async function runFactbookUpload(
  filePath?: string,
): Promise<FactbookUploadResult> {
  const resolved = filePath ?? getFactbookFilePath();
  log.info({ filePath: resolved }, "runFactbookUpload: start");

  const { header, rows } = await readFactbookFile(resolved);
  log.info(
    {
      rowCount: rows.length,
      measurementCount: header.measurementIndices.length,
    },
    "Parsed factbook file",
  );

  // Phase 1
  const { categoriesByName } = await ensureHhfCategoriesAndLists();
  const unmapped = categoriesByName.get(UNMAPPED_CATEGORY_NAME);
  if (!unmapped) {
    throw new Error("Failed to resolve HHF 'unmapped' category/data list");
  }

  // Phase 2
  const {
    byZip: zipsByHandle,
    created: geographiesCreated,
    existing: geographiesExisting,
  } = await upsertGeographies(rows);

  // Phase 3
  const {
    byPrefix: measurementsByPrefix,
    createdPrefixes,
    existingPrefixes,
  } = await upsertMeasurements(header);

  // Phase 4
  const allMeasurementIds = Array.from(measurementsByPrefix.values());
  const unmappedCount = await assignUnmappedMeasurements(
    allMeasurementIds,
    unmapped.dataListId,
  );

  // Phase 5
  const {
    byKey: seriesByKey,
    created: seriesCreated,
    existing: seriesExisting,
  } = await upsertSeries({
    header,
    zipsByHandle,
    measurementsByPrefix,
  });

  // Phase 6
  await wipeFactbookDataPoints();

  // Phase 7
  const dataPointsInserted = await insertFactbookDataPoints(rows, seriesByKey);

  const result: FactbookUploadResult = {
    filePath: resolved,
    geographiesCreated,
    geographiesExisting,
    measurementsCreated: createdPrefixes.length,
    measurementsExisting: existingPrefixes.length,
    seriesCreated,
    seriesExisting,
    dataPointsInserted,
    unmappedMeasurements: unmappedCount,
  };

  log.info(result, "runFactbookUpload: done");
  return result;
}
