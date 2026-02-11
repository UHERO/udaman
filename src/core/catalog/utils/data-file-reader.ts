import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

/**
 * Server-only utility for reading time series data from files.
 * Ports the Rails UpdateCsv + UpdateCore classes.
 *
 * Supports CSV files with:
 *   - Series names in columns (dates in rows) — "columns" layout
 *   - Series names in rows (dates in columns) — "rows" layout
 *
 * Date column auto-detected, frequency inferred from date intervals.
 */

type HeaderLayout = "columns" | "rows";

class DataFileReader {
  private data: string[][];
  private _headers: Map<string, number> | null = null;
  private _dates: Map<string, number> | null = null;
  private _headerLayout: HeaderLayout | null = null;
  private _frequency: string | null = null;

  constructor(data: string[][]) {
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error("File contains no data rows");
    }
    this.data = data;
  }

  /** Read a CSV file from DATA_DIR and return a DataFileReader */
  static fromFile(path: string): DataFileReader {
    const dataDir = process.env.DATA_DIR ?? "./data";
    const fullPath = join(dataDir, path.trim());
    const ext = extname(fullPath).toLowerCase();

    if (ext !== ".csv") {
      throw new Error(
        `Unsupported file format: ${ext}. Only CSV is currently supported.`
      );
    }

    const content = readFileSync(fullPath, "utf-8");
    return DataFileReader.fromCSV(content);
  }

  /** Parse CSV text into a DataFileReader */
  static fromCSV(text: string): DataFileReader {
    const lines = text.split(/\r?\n/);
    const data: string[][] = [];

    for (const line of lines) {
      const row = splitCSVRow(line);
      // Skip blank rows
      if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
        continue;
      }
      data.push(row);
    }

    return new DataFileReader(data);
  }

  // ─── Cell access (1-indexed like Rails) ────────────────────────────

  private cell(row: number, col: number): string | null {
    const val = this.data[row - 1]?.[col - 1] ?? null;
    if (val === null || val === undefined) return null;
    return val.trim();
  }

  private cellAsNumber(row: number, col: number): number | null {
    const raw = this.cell(row, col);
    if (raw === null || raw === "") return null;
    const cleaned = raw.replace(/,/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private get lastRow(): number {
    return this.data.length;
  }

  private get lastColumn(): number {
    return this.data[0]?.length ?? 0;
  }

  // ─── Header detection ─────────────────────────────────────────────

  get headerLayout(): HeaderLayout {
    if (this._headerLayout) return this._headerLayout;
    if (this.columnsHaveSeries()) {
      this._headerLayout = "columns";
    } else if (this.rowsHaveSeries()) {
      this._headerLayout = "rows";
    } else {
      throw new Error("Unable to determine series header location");
    }
    return this._headerLayout;
  }

  /** Check if column headers contain series names (have @ sign) */
  private columnsHaveSeries(): boolean {
    for (let col = 2; col <= this.lastColumn; col++) {
      const header = this.cell(1, col);
      if (header === "Year Month") continue;
      if (header && typeof header === "string" && !header.includes("@")) {
        return false;
      }
    }
    return true;
  }

  /** Check if row headers contain series names (have @ sign) */
  private rowsHaveSeries(): boolean {
    for (let row = 2; row <= this.lastRow; row++) {
      const header = this.cell(row, 1);
      if (header && typeof header === "string" && !header.includes("@")) {
        return false;
      }
    }
    return true;
  }

  // ─── Headers map: series_name → column/row index ──────────────────

  get headers(): Map<string, number> {
    if (this._headers) return this._headers;
    this._headers = new Map();

    if (this.headerLayout === "columns") {
      for (let col = 2; col <= this.lastColumn; col++) {
        const raw = this.cell(1, col);
        if (!raw || typeof raw !== "string" || !raw.includes("@")) continue;
        this._headers.set(raw.toUpperCase(), col);
      }
    } else {
      for (let row = 2; row <= this.lastRow; row++) {
        const raw = this.cell(row, 1);
        if (!raw || typeof raw !== "string" || !raw.includes("@")) continue;
        this._headers.set(raw.toUpperCase(), row);
      }
    }

    return this._headers;
  }

  // ─── Dates map: date_string → row/column index ────────────────────

  get dates(): Map<string, number> {
    if (this._dates) return this._dates;
    this._dates = new Map();

    if (this.headerLayout === "columns") {
      const dateCol = this.cell(1, 2) === "Year Month" ? 2 : 1;
      for (let row = 2; row <= this.lastRow; row++) {
        const date = this.cellToDate(row, dateCol);
        if (date) this._dates.set(date, row);
      }
    } else {
      for (let col = 2; col <= this.lastColumn; col++) {
        const date = this.cellToDate(1, col);
        if (date) this._dates.set(date, col);
      }
    }

    return this._dates;
  }

  // ─── Frequency detection ──────────────────────────────────────────

  get frequency(): string {
    if (this._frequency) return this._frequency;

    const sortedDates = [...this.dates.keys()].sort();
    if (sortedDates.length < 2) {
      throw new Error("Not enough dates to determine frequency");
    }

    const d0 = new Date(sortedDates[0]);
    const d1 = new Date(sortedDates[1]);
    const interval = Math.round(
      (d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (interval >= 365 && interval <= 366) this._frequency = "year";
    else if (interval >= 168 && interval <= 183) this._frequency = "semi";
    else if (interval >= 84 && interval <= 93) this._frequency = "quarter";
    else if (interval >= 28 && interval <= 31) this._frequency = "month";
    else if (interval === 7) this._frequency = "week";
    else if (interval === 1) this._frequency = "day";
    else
      throw new Error(
        `Cannot compute frequency: date interval of ${interval} days`
      );

    return this._frequency;
  }

  // ─── Series extraction ────────────────────────────────────────────

  /**
   * Extract date→value pairs for a named series.
   * Returns a Map<string, number> where keys are yyyy-mm-dd date strings.
   */
  series(seriesName: string): Map<string, number> {
    const name = seriesName.toUpperCase();

    // If the file headers don't include frequency but the series name does,
    // try matching without frequency suffix
    let key = name;
    if (!this.headers.has(key)) {
      const withoutFreq = name.split(".")[0];
      if (
        withoutFreq !== name &&
        this.headers.keys().next().value?.split(".").length === 1
      ) {
        key = withoutFreq;
      }
    }

    const index = this.headers.get(key);
    if (index === undefined) {
      throw new Error(
        `Cannot find series name "${seriesName}" in file headers: [${[...this.headers.keys()].join(", ")}]`
      );
    }

    const result = new Map<string, number>();

    if (this.headerLayout === "columns") {
      for (const [date, row] of this.dates) {
        const value = this.cellAsNumber(row, index);
        if (value !== null) {
          result.set(date, value);
        }
      }
    } else {
      for (const [date, col] of this.dates) {
        const value = this.cellAsNumber(index, col);
        if (value !== null) {
          result.set(date, value);
        }
      }
    }

    return result;
  }

  // ─── Date parsing ─────────────────────────────────────────────────

  private static readonly METADATA_HEADERS = new Set([
    "LineCode",
    "LineTitle",
    "Industry Code",
    "Industry",
    "Definitions",
    "UNIT",
    "Year Month",
    "Value",
  ]);

  private cellToDate(row: number, col: number): string | null {
    const raw = this.cell(row, col);
    if (!raw) return null;
    if (DataFileReader.METADATA_HEADERS.has(raw)) return null;

    // Try as number first (year, year.quarter, YYYYMM)
    const num = parseFloat(raw.replace(/,/g, ""));
    if (!isNaN(num)) {
      return DataFileReader.numericToDate(num);
    }

    // Semi-annual: "S01 2024", "S02 2024"
    const semiMatch = raw.match(/^S0([12])\s+(\d{4})$/);
    if (semiMatch) {
      const month = semiMatch[1] === "1" ? "01" : "07";
      return `${semiMatch[2]}-${month}-01`;
    }

    // Quarter spec: "2024Q1", "2024-Q2", "2024.Q3", "2024/Q4"
    const qMatch = raw.match(/(\d{4})[-./\s]?Q0?([1-4])/i);
    if (qMatch) {
      const quarterStarts = ["01", "04", "07", "10"];
      return `${qMatch[1]}-${quarterStarts[parseInt(qMatch[2]) - 1]}-01`;
    }

    // Standard date string: yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    // mm/dd/yyyy
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, m, d, y] = slashMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Fallback: Date constructor
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }

    return null;
  }

  /** Convert a numeric cell value to a date string */
  private static numericToDate(num: number): string | null {
    // Year-only: 1900-2100 with no fractional part (or .0)
    if (num > 1900 && num < 2100) {
      const intPart = Math.floor(num);
      const frac = Math.round((num - intPart) * 10) / 10;

      if (frac === 0 || frac === 0.1) return `${intPart}-01-01`;
      if (frac === 0.2) return `${intPart}-04-01`; // Q2
      if (frac === 0.3) return `${intPart}-07-01`; // Q3
      if (frac === 0.4) return `${intPart}-10-01`; // Q4
    }

    // YYYYMM format: e.g. 202401
    if (num > 9999 && num < 999999) {
      const s = String(Math.floor(num));
      const year = s.slice(0, 4);
      const month = s.slice(4, 6);
      return `${year}-${month}-01`;
    }

    return null;
  }
}

// ─── CSV Parsing Helper ──────────────────────────────────────────────

/** Split a CSV row respecting quoted fields */
function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default DataFileReader;
