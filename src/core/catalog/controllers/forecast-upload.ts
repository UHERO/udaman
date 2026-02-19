import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";
import { mysql } from "@/lib/mysql/db";

import LoaderCollection from "../collections/loader-collection";
import MeasurementCollection from "../collections/measurement-collection";
import SeriesCollection from "../collections/series-collection";
import Series from "../models/series";
import type { Universe } from "../types/shared";
import {
  type ForecastRow,
  parseForecastCSV,
} from "../utils/forecast-csv-parser";

const log = createLogger("catalog.forecast-upload");

export type ForecastUploadResult = {
  seriesIds: number[];
  created: number;
  updated: number;
  message: string;
};

/**
 * Build the FCID string from year + quarter.
 * e.g. year=2025, quarter=3 → "25Q3"
 */
function buildFcid(year: number, quarter: number): string {
  return `${String(year % 100).padStart(2, "0")}Q${quarter}`;
}

/**
 * Validate forecast version string.
 * Valid: "FF" (default), "F2", "F3", "HF", "H2", etc.
 */
function validateVersion(version: string): boolean {
  return /^[FH](\d+|F)$/.test(version);
}

/**
 * Generate a standard-format CSV that DataFileReader can parse.
 *
 * Format (columns layout):
 *   date,E&25Q3FF@HI.Q,E_NF&25Q3FF@HI.Q,...
 *   2019-01-01,663.74,500.23,...
 */
function generateStandardCSV(
  rows: ForecastRow[],
  dates: string[],
  fcid: string,
  version: string,
  freq: "A" | "Q",
): string {
  // Build full forecast names for column headers
  const forecastNames = rows.map((row) => {
    const forecastPrefix = `${row.prefix}&${fcid}${version}`;
    return Series.buildName(forecastPrefix, row.geo, freq);
  });

  const lines: string[] = [];

  // Header row
  lines.push(["date", ...forecastNames].join(","));

  // Data rows — one per date
  for (const date of dates) {
    const values = rows.map((row) => {
      const val = row.data.get(date);
      return val != null ? String(val) : "";
    });
    lines.push([date, ...values].join(","));
  }

  return lines.join("\n") + "\n";
}

export async function processForecastUpload(opts: {
  fileContent: string;
  filename: string;
  year: number;
  quarter: number;
  version?: string;
  freq: "A" | "Q";
}): Promise<ForecastUploadResult> {
  const { fileContent, filename, year, quarter, freq } = opts;
  const version = opts.version || "FF";

  if (!validateVersion(version)) {
    throw new Error(
      `Invalid version "${version}". Must match pattern like "FF", "F2", "HF", etc.`,
    );
  }

  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}. Must be 1-4.`);
  }

  const fcid = buildFcid(year, quarter);
  log.info(
    { filename, fcid, version, freq },
    "Starting forecast upload processing",
  );

  // Save raw file to DATA_DIR/forecasts/tables/ (archive/reference)
  const rawRelPath = `forecasts/tables/${filename}`;
  const rawFullPath = join(getDataDir(), rawRelPath);
  await mkdir(dirname(rawFullPath), { recursive: true });
  await writeFile(rawFullPath, fileContent, "utf-8");
  log.info({ path: rawRelPath }, "Saved raw forecast file");

  // Parse CSV
  const parsed = parseForecastCSV(fileContent);
  log.info(
    { rowCount: parsed.rows.length, dateCount: parsed.dates.length },
    "Parsed forecast CSV",
  );

  // Generate and save standard-format CSV for DataFileReader
  const freqLabel = freq === "A" ? "annual" : "quarterly";
  const standardCSV = generateStandardCSV(
    parsed.rows,
    parsed.dates,
    fcid,
    version,
    freq,
  );
  const standardRelPath = `forecasts/${year}/Q${quarter}-${freqLabel}.csv`;
  const standardFullPath = join(getDataDir(), standardRelPath);
  await mkdir(dirname(standardFullPath), { recursive: true });
  await writeFile(standardFullPath, standardCSV, "utf-8");
  log.info({ path: standardRelPath }, "Saved standard-format forecast CSV");

  const seriesIds: number[] = [];
  let created = 0;
  let updated = 0;

  const freqLong = freq === "A" ? "year" : "quarter";

  for (const row of parsed.rows) {
    try {
      // Build forecast series name: PREFIX&FCIDVERSION@GEO.FREQ
      const forecastPrefix = `${row.prefix}&${fcid}${version}`;
      const forecastName = Series.buildName(forecastPrefix, row.geo, freq);

      log.info(
        { baseName: row.baseName, forecastName },
        "Processing forecast row",
      );

      // Find or create FC series
      let series = await SeriesCollection.findByNameAndUniverse(
        forecastName,
        "FC" as Universe,
      );

      if (series) {
        // Update dataPortalName if provided
        if (row.dispName && row.dispName !== series.dataPortalName) {
          await SeriesCollection.update(series.id!, {
            dataPortalName: row.dispName,
          });
        }
        updated++;
      } else {
        // Create new FC series
        series = await SeriesCollection.create({
          name: forecastName,
          universe: "FC" as Universe,
          dataPortalName: row.dispName || null,
          frequency: freqLong,
        });
        created++;
      }

      seriesIds.push(series.id!);

      // Apply measurement metadata: look up FC measurement by prefix
      try {
        const measurement = await MeasurementCollection.getByPrefix(
          row.prefix,
          "FC" as Universe,
        );

        // Overwrite unset series fields from measurement
        const updatePayload: Record<string, unknown> = {};
        if (!series.unitId && measurement.unitId)
          updatePayload.unitId = measurement.unitId;
        if (!series.sourceId && measurement.sourceId)
          updatePayload.sourceId = measurement.sourceId;
        if (!series.sourceDetailId && measurement.sourceDetailId)
          updatePayload.sourceDetailId = measurement.sourceDetailId;
        if (measurement.decimals != null && series.decimals === 1)
          updatePayload.decimals = measurement.decimals;
        if (!series.sourceLink && measurement.sourceLink)
          updatePayload.sourceLink = measurement.sourceLink;

        if (Object.keys(updatePayload).length > 0) {
          await SeriesCollection.update(series.id!, updatePayload);
        }

        // Link to measurement
        await MeasurementCollection.addSeries(measurement.id, series.id!);
      } catch {
        // No FC measurement for this prefix — that's fine, skip
        log.debug(
          { prefix: row.prefix },
          "No FC measurement found for prefix",
        );
      }

      // Check for existing loader from same file
      const existingLoaders = await LoaderCollection.getBySeriesId(series.id!);
      const alreadyLoaded = existingLoaders.some(
        (l) => l.eval?.includes(standardRelPath) && !l.disabled,
      );

      if (alreadyLoaded) {
        log.info(
          { forecastName, standardRelPath },
          "Skipping loader creation — already loaded from same file",
        );
      } else {
        // Create loader pointing to the standard CSV with the full forecast name
        const code = `"${forecastName}".tsn.load_from("${standardRelPath}")`;
        const loader = await LoaderCollection.create({
          seriesId: series.id!,
          code,
          priority: 50,
          scale: 1,
          presaveHook: "",
          clearBeforeLoad: true,
          pseudoHistory: false,
          universe: "FC" as Universe,
        });

        // Demote existing loaders (lower priority so new forecast takes precedence)
        await mysql`
          UPDATE data_sources
          SET priority = priority - 10
          WHERE series_id = ${series.id!}
            AND id != ${loader.id}
            AND disabled = 0
        `;

        // Load data
        if (series.xseriesId) {
          await SeriesCollection.updateData({
            xseriesId: series.xseriesId,
            data: row.data,
            dataSourceId: loader.id,
            pseudoHistory: false,
          });
        }
      }
    } catch (err) {
      log.error(
        { baseName: row.baseName, err },
        "Error processing forecast row",
      );
      throw err;
    }
  }

  const message = `Forecast upload complete: ${created} created, ${updated} updated (${seriesIds.length} total series)`;
  log.info({ created, updated, total: seriesIds.length }, message);

  return { seriesIds, created, updated, message };
}
