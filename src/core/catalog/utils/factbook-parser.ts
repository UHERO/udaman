import { readFile } from "node:fs/promises";
import path from "node:path";

import { splitCSVRow } from "./client-data-file-reader";

/**
 * Parser for the Hawaii Housing Factbook pipe-separated data file.
 *
 * File layout (header + N rows):
 *   zip|zipname|year|<measurement_col_1>|<measurement_col_2>|...
 *
 * The first three columns are dimensions. The remaining columns each become a
 * measurement (and per-(measurement, geography) annual series).
 *
 * Geographies:
 *   - zips beginning with "150" are county codes (geotype = 'county')
 *   - other zips are real ZIP codes (geotype = 'zipcode')
 *
 * Note: pipe (|) is the only field separator and the file does not quote
 * fields, so a naive split is sufficient.
 */

export type FactbookHeader = {
  /** Original (raw) column names from the header line, in order. */
  rawColumns: string[];
  /** Sanitized column names (uppercase, non-[A-Z0-9_] → _). Same order as raw. */
  sanitizedColumns: string[];
  /** Index of zip column. */
  zipIdx: number;
  /** Index of zipname column. */
  zipnameIdx: number;
  /** Index of year column. */
  yearIdx: number;
  /**
   * Indices (into rawColumns) of measurement columns — i.e. all columns that
   * are NOT zip, zipname, or year.
   */
  measurementIndices: number[];
};

export type FactbookRow = {
  zip: string;
  zipname: string;
  year: number;
  /** Sanitized column name → numeric value (or null if blank/non-numeric). */
  values: Record<string, number | null>;
};

export type FactbookPreview = {
  filePath: string;
  headerCount: number;
  measurementCount: number;
  rowCount: number;
  yearMin: number | null;
  yearMax: number | null;
  uniqueGeoCount: number;
  zipcodeCount: number;
  countyCount: number;
  /** First N sanitized column names (for UI display). */
  sampleColumns: string[];
};

const DIMENSION_COLS = new Set(["zip", "zipname", "year"]);

/**
 * Sanitize a header into a measurement prefix:
 *   - uppercase
 *   - replace any character not in [A-Z0-9_] with `_`
 *   - collapse runs of `_`
 *   - trim leading/trailing `_`
 *
 * Examples:
 *   "age>85"     → "AGE_85"
 *   "B25074_001" → "B25074_001"
 *   "medhhinc"   → "MEDHHINC"
 *   "rent burd"  → "RENT_BURD"
 */
export function sanitizePrefix(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Determine geotype from a zip code string.
 * 150-prefix codes are county aggregates; everything else is a real zipcode.
 */
export function geotypeForZip(zip: string): "county" | "zipcode" {
  return zip.startsWith("150") ? "county" : "zipcode";
}

/** Resolve the on-disk path of factbooktablelong.txt from DATA_DIR. */
export function getFactbookFilePath(): string {
  const dir = process.env.DATA_DIR;
  if (!dir) {
    throw new Error("DATA_DIR env var is not set");
  }
  return path.join(dir, "factbook", "factbooktablelong.txt");
}

/** Resolve the on-disk path of the supplemental CSV from DATA_DIR. */
export function getFactbookCsvPath(): string {
  const dir = process.env.DATA_DIR;
  if (!dir) {
    throw new Error("DATA_DIR env var is not set");
  }
  return path.join(dir, "factbook", "factbooktablelong-2026.csv");
}

/**
 * Parse the header line of a factbook file. Throws if the required dimension
 * columns (zip, zipname, year) are missing.
 */
export function parseFactbookHeader(headerLine: string): FactbookHeader {
  const rawColumns = headerLine.split("|").map((c) => c.trim());
  const sanitizedColumns = rawColumns.map(sanitizePrefix);

  const zipIdx = rawColumns.indexOf("zip");
  const zipnameIdx = rawColumns.indexOf("zipname");
  const yearIdx = rawColumns.indexOf("year");

  if (zipIdx < 0) throw new Error("Factbook header missing 'zip' column");
  if (zipnameIdx < 0)
    throw new Error("Factbook header missing 'zipname' column");
  if (yearIdx < 0) throw new Error("Factbook header missing 'year' column");

  const measurementIndices: number[] = [];
  for (let i = 0; i < rawColumns.length; i++) {
    if (!DIMENSION_COLS.has(rawColumns[i])) {
      measurementIndices.push(i);
    }
  }

  return {
    rawColumns,
    sanitizedColumns,
    zipIdx,
    zipnameIdx,
    yearIdx,
    measurementIndices,
  };
}

/**
 * Parse a single (non-header) row line into a FactbookRow. Returns null if the
 * row is blank or its zip/year cannot be parsed (we silently skip those).
 */
export function parseFactbookRow(
  line: string,
  header: FactbookHeader,
): FactbookRow | null {
  if (!line || !line.trim()) return null;
  const fields = line.split("|");

  const zip = (fields[header.zipIdx] ?? "").trim();
  const zipname = (fields[header.zipnameIdx] ?? "").trim();
  const yearStr = (fields[header.yearIdx] ?? "").trim();

  if (!zip || !yearStr) return null;
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year)) return null;

  const values: Record<string, number | null> = {};
  for (const idx of header.measurementIndices) {
    const sanitized = header.sanitizedColumns[idx];
    const raw = fields[idx];
    if (raw == null || raw === "") {
      values[sanitized] = null;
      continue;
    }
    const trimmed = raw.trim();
    if (
      trimmed === "" ||
      trimmed.toUpperCase() === "NA" ||
      trimmed === "NULL"
    ) {
      values[sanitized] = null;
      continue;
    }
    const n = Number(trimmed);
    values[sanitized] = Number.isFinite(n) ? n : null;
  }

  return { zip, zipname, year, values };
}

/**
 * Read the entire factbook file and return parsed header + rows.
 *
 * The file is small enough (~3K rows × 157 cols) that fully buffering it is
 * fine; we walk it twice during the upload (once for metadata discovery, once
 * for data point insertion) and the in-memory cost is negligible compared to
 * the round-trip cost of re-reading from disk.
 */
export async function readFactbookFile(filePath: string): Promise<{
  header: FactbookHeader;
  rows: FactbookRow[];
}> {
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error(`Factbook file is empty: ${filePath}`);
  }

  const header = parseFactbookHeader(lines[0]);
  const rows: FactbookRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseFactbookRow(lines[i], header);
    if (row) rows.push(row);
  }
  return { header, rows };
}

/**
 * Cheap preview of the factbook file for the upload UI. Reads the file once
 * and produces summary stats without retaining all parsed rows.
 */
export async function previewFactbook(
  filePath?: string,
): Promise<FactbookPreview> {
  const resolved = filePath ?? getFactbookFilePath();
  const { header, rows } = await readFactbookFile(resolved);

  let yearMin: number | null = null;
  let yearMax: number | null = null;
  const uniqueZips = new Set<string>();
  let zipcodeCount = 0;
  let countyCount = 0;

  for (const row of rows) {
    if (yearMin == null || row.year < yearMin) yearMin = row.year;
    if (yearMax == null || row.year > yearMax) yearMax = row.year;
    if (!uniqueZips.has(row.zip)) {
      uniqueZips.add(row.zip);
      if (geotypeForZip(row.zip) === "county") countyCount++;
      else zipcodeCount++;
    }
  }

  return {
    filePath: resolved,
    headerCount: header.rawColumns.length,
    measurementCount: header.measurementIndices.length,
    rowCount: rows.length,
    yearMin,
    yearMax,
    uniqueGeoCount: uniqueZips.size,
    zipcodeCount,
    countyCount,
    sampleColumns: header.measurementIndices
      .slice(0, 12)
      .map((i) => header.sanitizedColumns[i]),
  };
}

// ─── CSV supplement ──────────────────────────────────────────────────

const CSV_DIMENSION_COLS = new Set(["year", "zip", "zipname", "county"]);

/**
 * Read the supplemental factbook CSV file (comma-separated).
 *
 * Returns the same FactbookRow[] structure as readFactbookFile so the caller
 * can merge data from both sources into a single cache.
 *
 * If the file doesn't exist, returns an empty array (graceful degradation).
 */
export async function readFactbookCsv(
  filePath: string,
): Promise<FactbookRow[]> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    // File may not exist yet — that's fine, return empty
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const rawColumns = splitCSVRow(lines[0]).map((c) => c.trim());
  const sanitizedColumns = rawColumns.map(sanitizePrefix);

  const zipIdx = rawColumns.indexOf("zip");
  const yearIdx = rawColumns.indexOf("year");
  if (zipIdx < 0 || yearIdx < 0) return [];

  const zipnameIdx = rawColumns.indexOf("zipname");

  // Measurement columns = everything that isn't a dimension
  const measurementIndices: number[] = [];
  for (let i = 0; i < rawColumns.length; i++) {
    if (!CSV_DIMENSION_COLS.has(rawColumns[i])) {
      measurementIndices.push(i);
    }
  }

  const rows: FactbookRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const fields = splitCSVRow(line);
    const zip = (fields[zipIdx] ?? "").trim();
    const yearStr = (fields[yearIdx] ?? "").trim();
    if (!zip || !yearStr) continue;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;

    const zipname = zipnameIdx >= 0 ? (fields[zipnameIdx] ?? "").trim() : "";

    const values: Record<string, number | null> = {};
    for (const idx of measurementIndices) {
      const sanitized = sanitizedColumns[idx];
      const raw = fields[idx];
      if (raw == null || raw === "") {
        values[sanitized] = null;
        continue;
      }
      const trimmed = raw.trim();
      if (
        trimmed === "" ||
        trimmed.toUpperCase() === "NA" ||
        trimmed === "NULL"
      ) {
        values[sanitized] = null;
        continue;
      }
      const n = Number(trimmed);
      values[sanitized] = Number.isFinite(n) ? n : null;
    }

    rows.push({ zip, zipname, year, values });
  }
  return rows;
}
