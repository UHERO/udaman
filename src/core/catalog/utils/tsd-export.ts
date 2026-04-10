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

const DATA_DIR = process.env.DATA_DIR ?? "/mnt/data";
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
  date: string; // DATE_FORMAT produces a string — avoids UTC→local timezone shift
  value: number;
}

/** Fetch current data points for a list of series names */
async function fetchSeriesData(
  names: string[],
): Promise<Map<string, TsdSeriesInput>> {
  if (names.length === 0) return new Map();

  const placeholders = names.map(() => "?").join(",");
  const rows = await rawQuery<SeriesDataRow>(
    `SELECT s.name, xs.frequency,
            DATE_FORMAT(dp.date, '%Y-%m-%d') AS date, dp.value
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
    // row.date is already a "YYYY-MM-DD" string from DATE_FORMAT — use directly
    entry.data.set(row.date, row.value);
  }

  return result;
}

/** Write a TSD file for a list of series names. Returns counts for logging. */
async function writeDataListTsd(
  names: string[],
  outputPath: string,
): Promise<{ written: number; skipped: number }> {
  const seriesData = await fetchSeriesData(names);
  let output = "";
  let written = 0;
  let skipped = 0;
  for (const name of names) {
    const entry = seriesData.get(name);
    if (!entry || entry.data.size === 0) {
      skipped++;
      continue;
    }
    output += seriesToTsd(entry);
    written++;
  }
  writeFileSync(outputPath, output);
  return { written, skipped };
}

/** Run the full TSD export pipeline */
export async function runTsdExport(): Promise<{
  success: boolean;
  message: string;
}> {
  const startTime = Date.now();
  const outPath = join(DATA_DIR, "udaman_tsd");
  const inPath = join(DATA_DIR, "BnkLists");

  log.info(
    { outPath, inPath, startedAt: new Date().toISOString() },
    "runTsdExport: starting",
  );

  // Ensure directories exist
  if (!existsSync(outPath)) mkdirSync(outPath, { recursive: true });
  if (!existsSync(inPath)) mkdirSync(inPath, { recursive: true });

  // 1. Sync input files from NAS
  try {
    const { stdout } = await execAsync(
      `rsync -rv --del ${NAS_PATH}/BnkLists/ ${inPath}`,
    );
    log.info({ rsyncOutput: stdout.trim() }, "runTsdExport: synced BnkLists from NAS");
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

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const filename of files) {
    const fileStart = Date.now();
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
    const { written, skipped } = await writeDataListTsd(names, outputFile);
    totalWritten += written;
    totalSkipped += skipped;
    log.info(
      { outputFile, written, skipped, durationMs: Date.now() - fileStart },
      "runTsdExport: completed file export",
    );
  }

  // 3. Sync output files back to NAS
  let nasSynced = false;
  try {
    const { stdout } = await execAsync(
      `rsync -rv ${outPath}/ ${NAS_PATH}/udaman_tsd`,
    );
    nasSynced = true;
    log.info({ rsyncOutput: stdout.trim() }, "runTsdExport: copied output to NAS");
  } catch (e) {
    log.error(
      { error: e instanceof Error ? e.message : String(e) },
      "runTsdExport: could not copy output to NAS",
    );
  }

  const durationMs = Date.now() - startTime;
  log.info(
    {
      files: files.length,
      totalWritten,
      totalSkipped,
      nasSynced,
      durationMs,
      finishedAt: new Date().toISOString(),
    },
    "runTsdExport: finished",
  );

  return {
    success: true,
    message: `TSD export completed — ${files.length} files, ${totalWritten} series written, ${totalSkipped} skipped (${(durationMs / 1000).toFixed(1)}s)`,
  };
}
