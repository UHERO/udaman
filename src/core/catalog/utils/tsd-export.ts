/**
 * TSD export pipeline.
 * Ported from Rails Series.run_tsd_exports + ExportWorker.
 *
 * Steps:
 *   1. rsync BnkLists from NAS to local in_path
 *   2. Read each .txt file → list of series names
 *   3. For each series, fetch current data and convert to TSD
 *   4. Write .tsd output files
 *   5. rsync output back to NAS
 *
 * NOTE: In the future this will be dispatched to a job queue
 * rather than executed on the main thread.
 */
import { exec } from "child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { promisify } from "util";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/db";

import { seriesToTsd } from "./tsd-generator";
import type { TsdFrequency, TsdSeriesInput } from "./tsd-generator";

const log = createLogger("catalog.tsd-export");
const execAsync = promisify(exec);

const DATA_PATH = process.env.DATA_PATH ?? "/mnt/data";
const NAS_PATH = "udaman@128.171.200.230:/volume1/UHEROroot/work/udamandata";

const FREQ_MAP: Record<string, TsdFrequency> = {
  A: "year",
  S: "semi",
  Q: "quarter",
  M: "month",
  W: "week",
  D: "day",
};

interface SeriesDataRow {
  name: string;
  frequency: string;
  date: Date;
  value: number;
}

/** Fetch current data points for a list of series names */
async function fetchSeriesData(
  names: string[],
): Promise<Map<string, TsdSeriesInput>> {
  if (names.length === 0) return new Map();

  const placeholders = names.map(() => "?").join(",");
  const rows = await rawQuery<SeriesDataRow>(
    `SELECT s.name, xs.frequency, dp.date, dp.value
     FROM series s
     JOIN xseries xs ON xs.id = s.xseries_id
     JOIN data_points dp ON dp.xseries_id = xs.id AND dp.current = 1
     WHERE s.name IN (${placeholders})
     ORDER BY s.name, dp.date`,
    names,
  );

  const result = new Map<string, TsdSeriesInput>();
  for (const row of rows) {
    let entry = result.get(row.name);
    if (!entry) {
      const freq = (row.frequency?.toLowerCase() ?? "month") as TsdFrequency;
      entry = { name: row.name, data: new Map(), frequency: freq };
      result.set(row.name, entry);
    }
    const d = new Date(row.date);
    const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    entry.data.set(dateKey, row.value);
  }

  return result;
}

/** Write a TSD file for a list of series names */
async function writeDataListTsd(
  names: string[],
  outputPath: string,
): Promise<void> {
  const seriesData = await fetchSeriesData(names);
  let output = "";
  for (const name of names) {
    const entry = seriesData.get(name);
    if (!entry || entry.data.size === 0) continue;
    output += seriesToTsd(entry);
  }
  writeFileSync(outputPath, output);
}

/** Run the full TSD export pipeline */
export async function runTsdExport(): Promise<{
  success: boolean;
  message: string;
}> {
  const outPath = join(DATA_PATH, "udaman_tsd");
  const inPath = join(DATA_PATH, "BnkLists");

  log.info({ outPath, inPath }, "runTsdExport: starting");

  // Ensure directories exist
  if (!existsSync(outPath)) mkdirSync(outPath, { recursive: true });
  if (!existsSync(inPath)) mkdirSync(inPath, { recursive: true });

  // 1. Sync input files from NAS
  try {
    await execAsync(`rsync -r --del ${NAS_PATH}/BnkLists/ ${inPath}`);
    log.info("runTsdExport: synced BnkLists from NAS");
  } catch (e) {
    log.error(
      { error: e instanceof Error ? e.message : String(e) },
      "runTsdExport: could not sync BnkLists from NAS - using existing files",
    );
  }

  // 2. Read input .txt files and process each
  let files: string[];
  try {
    files = readdirSync(inPath).filter((f) => f.endsWith(".txt"));
  } catch {
    return { success: false, message: "Could not read BnkLists directory" };
  }

  if (files.length === 0) {
    return { success: false, message: "No .txt input files found in BnkLists" };
  }

  log.info({ count: files.length }, "runTsdExport: processing input files");

  for (const filename of files) {
    log.info({ filename }, "runTsdExport: processing input file");
    const content = readFileSync(join(inPath, filename), "utf-8");
    const rawNames = content.split(/\s+/).filter((x) => x.length > 0);

    const bank = filename.replace(".txt", "");
    const freqCode = bank.split("_").pop()?.toUpperCase() ?? "M";

    const names = rawNames.map((n) => `${n.trim().toUpperCase()}.${freqCode}`);
    const outputFile = join(outPath, `${bank}.tsd`);

    log.info(
      { count: names.length, outputFile },
      "runTsdExport: exporting series",
    );
    await writeDataListTsd(names, outputFile);
    log.info({ outputFile }, "runTsdExport: completed export");
  }

  // 3. Sync output files back to NAS
  try {
    await execAsync(`rsync -r ${outPath}/ ${NAS_PATH}/udaman_tsd`);
    log.info("runTsdExport: copied output to NAS");
  } catch (e) {
    log.error(
      { error: e instanceof Error ? e.message : String(e) },
      "runTsdExport: could not copy output to NAS",
    );
  }

  log.info("runTsdExport: finished");
  return {
    success: true,
    message: `TSD export completed — ${files.length} files processed`,
  };
}
