/**
 * Parser for forecast report_table CSV files.
 *
 * CSV format (series in rows, dates in columns):
 *   id,label,2019-01-01,...,2030-10-01,disp_name
 *   E@HI,(lvl),663.74,...,662.88,"Total Farm & Nonfarm Jobs, State of Hawaii"
 *   E@HI,(%),0.13,...,0.77,"Total Farm & Nonfarm Jobs, State of Hawaii"
 *
 * Only rows with label === "(lvl)" are imported.
 */

import { parseCSVToRows } from "./client-data-file-reader";

export type ForecastRow = {
  baseName: string; // "E@HI" — from id column
  prefix: string; // "E"
  geo: string; // "HI"
  dispName: string; // "Total Farm & Nonfarm Jobs, State of Hawaii"
  data: Map<string, number>; // date → value (only date columns)
};

export type ForecastParseResult = {
  rows: ForecastRow[];
  dates: string[]; // sorted date strings found
  frequency: "A" | "Q"; // detected from date intervals
};

/** Serializable version for client-side preview (Maps → plain objects). */
export type ForecastPreview = {
  rows: Array<{
    baseName: string;
    prefix: string;
    geo: string;
    dispName: string;
    dataCount: number;
  }>;
  dates: string[];
  frequency: "A" | "Q";
  totalRowCount: number;
};

/**
 * Try to parse a header cell as a date.
 * Accepts: "2019-01-01" (ISO), "2019" (year-only → annual).
 */
function parseHeaderDate(cell: string): string | null {
  const trimmed = cell.trim();

  // ISO date: yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Year-only: 4-digit year → January 1
  if (/^\d{4}$/.test(trimmed)) {
    const y = parseInt(trimmed, 10);
    if (y >= 1900 && y <= 2200) return `${y}-01-01`;
  }

  return null;
}

/**
 * Detect frequency from sorted date strings.
 * 365+ days apart → annual, ~90 days → quarterly.
 */
function detectFrequency(dates: string[]): "A" | "Q" {
  if (dates.length < 2) return "Q"; // default

  const d0 = new Date(dates[0]);
  const d1 = new Date(dates[1]);
  const interval = Math.round(
    (d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24),
  );

  return interval >= 365 ? "A" : "Q";
}

/**
 * Parse a forecast report_table CSV.
 * Filters to (lvl) rows only.
 */
export function parseForecastCSV(text: string): ForecastParseResult {
  const rows2d = parseCSVToRows(text);
  if (rows2d.length < 2) {
    throw new Error("CSV file contains no data rows");
  }

  const header = rows2d[0];

  // Identify column indices
  // First column: "id", second: "label", last: "disp_name"
  // Everything in between that parses as a date is a date column
  const dateColumns: Array<{ index: number; date: string }> = [];
  for (let i = 0; i < header.length; i++) {
    const date = parseHeaderDate(header[i]);
    if (date) {
      dateColumns.push({ index: i, date });
    }
  }

  if (dateColumns.length === 0) {
    throw new Error("No date columns found in CSV header");
  }

  const dates = dateColumns.map((d) => d.date).sort();
  const frequency = detectFrequency(dates);

  // Find label column (typically index 1)
  const labelColIdx = header.findIndex(
    (h) => h.trim().toLowerCase() === "label",
  );
  if (labelColIdx === -1) {
    throw new Error('CSV header missing "label" column');
  }

  // disp_name is the last non-date column
  const lastColIdx = header.length - 1;

  const forecastRows: ForecastRow[] = [];

  for (let r = 1; r < rows2d.length; r++) {
    const row = rows2d[r];
    const label = row[labelColIdx]?.trim();

    // Only import level rows
    if (label !== "(lvl)") continue;

    const baseName = row[0]?.trim().toUpperCase();
    if (!baseName || !baseName.includes("@")) continue;

    const atIdx = baseName.indexOf("@");
    const prefix = baseName.slice(0, atIdx);
    const geo = baseName.slice(atIdx + 1);
    const dispName = row[lastColIdx]?.trim() ?? "";

    // Extract data from date columns
    const data = new Map<string, number>();
    for (const { index, date } of dateColumns) {
      const raw = row[index]?.trim();
      if (!raw || raw === "") continue;
      const cleaned = raw.replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        data.set(date, num);
      }
    }

    forecastRows.push({ baseName, prefix, geo, dispName, data });
  }

  return { rows: forecastRows, dates, frequency };
}

/**
 * Create a serializable preview for client-side display.
 */
export function createForecastPreview(
  result: ForecastParseResult,
): ForecastPreview {
  return {
    rows: result.rows.map((r) => ({
      baseName: r.baseName,
      prefix: r.prefix,
      geo: r.geo,
      dispName: r.dispName,
      dataCount: r.data.size,
    })),
    dates: result.dates,
    frequency: result.frequency,
    totalRowCount: result.rows.length,
  };
}
