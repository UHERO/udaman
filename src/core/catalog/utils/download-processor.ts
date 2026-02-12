/**
 * Download Processor — reads downloaded files (CSV, XLS, XLSX, TXT) from disk,
 * navigates to specific cells using row/col/date patterns, iterates through
 * dates at a given frequency, and returns a Map<string, number> of observations.
 *
 * Ports: Rails Downloaders::DownloadProcessor + CsvFileProcessor +
 *        XlsFileProcessor + TextFileProcessor + DatePatternProcessor +
 *        IntegerPatternProcessor + StringWithDatePatternProcessor
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import XLSX from "xlsx";

import DownloadCollection from "../collections/download-collection";
import { splitCSVRow } from "./data-file-reader";

// ─── Options type ────────────────────────────────────────────────────

export type DownloadOptions = Record<string, string | number | boolean>;

// ─── DatePatternProcessor ────────────────────────────────────────────

/**
 * Generates observation dates by advancing from a start date at a
 * given frequency. Supports reverse mode.
 *
 * Ports: Downloaders::DatePatternProcessor
 */
export class DatePatternProcessor {
  private startDateString: string;
  private frequency: string;
  private reverse: boolean;

  constructor(startDate: string, frequency: string, reverse: boolean) {
    this.startDateString = startDate;
    this.frequency = frequency;
    this.reverse = reverse;
  }

  compute(index: number): string {
    const effectiveIndex = this.reverse ? -index : index;
    return this.dateAtIndex(effectiveIndex);
  }

  private dateAtIndex(index: number): string {
    const first = new Date(this.startDateString + "T00:00:00");
    let result: Date;

    switch (this.frequency) {
      case "A":
        result = addMonths(first, 12 * index);
        break;
      case "S":
        result = addMonths(first, 6 * index);
        break;
      case "Q":
        result = addMonths(first, 3 * index);
        break;
      case "M":
        result = addMonths(first, index);
        break;
      case "W":
        result = addDays(first, 7 * index);
        break;
      case "D":
        result = addDays(first, index);
        break;
      case "WD":
        result = this.weekDateAtIndex(index, first);
        break;
      default:
        throw new Error(`DatePatternProcessor: unknown frequency '${this.frequency}'`);
    }

    return formatDate(result);
  }

  private weekDateAtIndex(index: number, firstDate: Date): Date {
    // cwday: Monday=1, Sunday=7
    const cwday = ((firstDate.getDay() + 6) % 7) + 1;
    let weekendsBetween: number;
    if (index >= 0) {
      weekendsBetween = Math.trunc((cwday + index - 1) / 5);
    } else {
      weekendsBetween = Math.trunc(((5 - cwday) * -1 + index) / 5);
    }
    return addDays(firstDate, index + weekendsBetween * 2);
  }

  computeIndexForDate(dateString: string): number {
    const startD = this.reverse
      ? new Date(dateString + "T00:00:00")
      : new Date(this.startDateString + "T00:00:00");
    const finishD = this.reverse
      ? new Date(this.startDateString + "T00:00:00")
      : new Date(dateString + "T00:00:00");

    const startMonth = startD.getMonth() + startD.getFullYear() * 12;
    const finishMonth = finishD.getMonth() + finishD.getFullYear() * 12;
    const diffMonths = finishMonth - startMonth;

    switch (this.frequency) {
      case "A": return Math.trunc(diffMonths / 12);
      case "S": return Math.trunc(diffMonths / 6);
      case "Q": return Math.trunc(diffMonths / 3);
      case "M": return diffMonths;
      case "W": return Math.trunc(daysBetween(startD, finishD) / 7);
      case "D": return daysBetween(startD, finishD);
      case "WD": {
        const diff = daysBetween(startD, finishD);
        const cwday = ((startD.getDay() + 6) % 7) + 1;
        const weekendsPassed = Math.round((diff + (cwday - 1)) / 7);
        return diff - 2 * weekendsPassed;
      }
      default:
        throw new Error(`DatePatternProcessor: unknown frequency '${this.frequency}'`);
    }
  }
}

// ─── IntegerPatternProcessor ─────────────────────────────────────────

/**
 * Resolves row/column patterns to integer indices.
 *
 * Pattern types:
 *  - Literal integer: "5" → always 5
 *  - "increment:start:step" → start + step * index
 *  - "repeat:first:last[:step]" → cycles through range
 *  - "block:start:step:repeatCount" → stays at value for N observations
 *  - "header:col_or_row:search_main:header_name[:match_type]"
 *  - "header_range:col_or_row:search_main:search_start:search_end:header_name[:match_type]"
 *  - Excel column notation: "A"→1, "AA"→27, etc.
 *
 * Ports: Downloaders::IntegerPatternProcessor
 */
export class IntegerPatternProcessor {
  private pattern: string;

  constructor(pattern: string | number) {
    this.pattern = convertToNumericPattern(String(pattern));
  }

  /**
   * Compute the row or column number for a given observation index.
   * For "header" patterns, sheet2d and handle/sheet are needed to search headers.
   */
  compute(
    index: number,
    sheet2d?: string[][] | null,
    handle?: string,
    sheetName?: string | null,
  ): number {
    // Try parsing as a literal integer first
    const literal = parseInt(this.pattern, 10);
    if (!isNaN(literal) && String(literal) === this.pattern) {
      return literal;
    }

    const parts = this.pattern.split(":").map((w) => {
      const n = parseInt(w, 10);
      return isNaN(n) ? w : n;
    });

    const command = parts[0] as string;

    switch (command) {
      case "increment":
        return (parts[1] as number) + (parts[2] as number) * index;

      case "repeat": {
        // repeat:first:last[:step] — cycles through range
        const first = parts[1] as number;
        const last = parts[2] as number;
        const step = (parts[3] as number) ?? 1;
        const rangeSize = (last - first) / step + 1;
        return first + step * (index % rangeSize);
      }

      case "block": {
        // block:start:step:repeatCount — stays at same value for N observations
        const start = parts[1] as number;
        const step = parts[2] as number;
        const repeatCount = parts[3] as number;
        return start + step * Math.trunc(index / repeatCount);
      }

      case "header": {
        // header:col_or_row:search_main:header_name[:match_type]
        return this.findHeader({
          headerIn: (parts[1] as string) ?? "col",
          searchMain: (parts[2] as number) ?? 1,
          headerName: parts[3] as string,
          matchType: parts[4] as string | undefined,
          sheet2d: sheet2d ?? null,
          handle: handle ?? null,
          sheetName: sheetName ?? null,
        });
      }

      case "header_range": {
        // header_range:col_or_row:search_main:header_name:search_start:search_end[:match_type]
        // Same as "header" but with explicit search range bounds
        return this.findHeader({
          headerIn: (parts[1] as string) ?? "col",
          searchMain: (parts[2] as number) ?? 1,
          headerName: parts[3] as string,
          matchType: parts[6] as string | undefined,
          searchStart: parts[4] as number,
          searchEnd: parts[5] as number,
          sheet2d: sheet2d ?? null,
          handle: handle ?? null,
          sheetName: sheetName ?? null,
        });
      }

      default:
        throw new Error(`IntegerPatternProcessor: bad command word = ${command}`);
    }
  }

  private findHeader(opts: {
    headerIn: string;
    searchMain: number;
    headerName: string;
    matchType?: string;
    searchStart?: number;
    searchEnd?: number;
    sheet2d: string[][] | null;
    handle: string | null;
    sheetName: string | null;
  }): number {
    if (!opts.headerName) throw new Error("Find header needs a header_name");
    if (!opts.sheet2d) throw new Error("Find header needs sheet data");

    const headerIn = opts.headerIn || "col";
    const matchType = normalizeMatchType(opts.matchType);
    const searchMain = opts.searchMain || 1;
    const sheet = opts.sheet2d;

    const searchStart = opts.searchStart ?? 1;
    const searchEnd = opts.searchEnd ?? (
      headerIn === "col"
        ? sheet.length
        : (sheet[0]?.length ?? 0)
    );

    for (let loc = searchStart; loc <= searchEnd; loc++) {
      let row: number, col: number;
      if (headerIn === "col") {
        row = loc;
        col = searchMain;
      } else {
        row = searchMain;
        col = loc;
      }

      const cellValue = String(sheet[row - 1]?.[col - 1] ?? "");

      // Check each alternative separated by [or]
      const alternatives = opts.headerName.split("[or]");
      for (const header of alternatives) {
        if (matchCell(cellValue, header.trim(), matchType)) {
          return loc;
        }
      }
    }

    throw new Error(
      `Cannot find header "${opts.headerName}" in handle ${opts.handle ?? "unknown"}`
    );
  }
}

// ─── StringDatePatternProcessor ──────────────────────────────────────

/**
 * Resolves date-sensitive strings. If the format string contains
 * strftime-style codes (%), substitutes with the actual date.
 *
 * Ports: Downloaders::StringWithDatePatternProcessor
 */
export class StringDatePatternProcessor {
  private format: string;

  constructor(format: string) {
    this.format = format;
  }

  get isDateSensitive(): boolean {
    return this.format.includes("%");
  }

  compute(dateString: string): string {
    if (!this.isDateSensitive) return this.format;

    const date = new Date(dateString + "T00:00:00");
    return strftime(this.format, date);
  }

  toString(): string {
    return this.format;
  }
}

// ─── Cell parsing ────────────────────────────────────────────────────

/** Known suppressed/missing data codes */
const SUPPRESSED_VALUES = new Set([
  "(D)",
  "(D) ",
  "(L)",
  "(L) ",
  "(N)",
  "(N) ",
  "(T)",
  "(T) ",
  "(NA)",
  " --- ",
  "---",
  "no data",
]);

/**
 * Parse a cell value to a number, null (suppressed), or "BREAK" (end of data).
 */
function parseCell(value: unknown): number | null | "BREAK" {
  if (value == null) return "BREAK";

  const str = String(value).trim();
  if (str === "") return "BREAK";

  // Check for suppression codes
  if (SUPPRESSED_VALUES.has(str) || SUPPRESSED_VALUES.has(String(value))) {
    return null;
  }

  // Try to parse as number (strip commas)
  const cleaned = str.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && isFinite(num)) return num;

  // Non-numeric, non-suppressed → break in data
  return "BREAK";
}

// ─── File reading functions ──────────────────────────────────────────

/** Read a CSV file and return a 2D string array */
function readCsvFile(filePath: string): string[][] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const data: string[][] = [];

  for (const line of lines) {
    const row = splitCSVRow(line);
    data.push(row);
  }

  return data;
}

/**
 * Read an XLS/XLSX file and return a 2D string array for a given sheet.
 *
 * Sheet resolution supports:
 *  - "sheet_num:N" — select by 1-based index
 *  - "sheet_name:M3" — select by month abbreviation from date
 *  - "Name1[or]Name2" — first match from alternatives
 *  - "SheetName" — case-insensitive exact match
 */
function readXlsFile(
  filePath: string,
  sheetSpec: string,
  date?: string | null,
): string[][] {
  // Use XLSX.read(buffer) instead of XLSX.readFile() — the latter's
  // built-in fs detection doesn't work in Bun's runtime.
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf);
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error(`No sheets found in file: ${filePath}`);
  }

  const resolvedName = resolveSheetName(sheetSpec, sheetNames, date);
  if (!resolvedName) {
    throw new Error(
      `No sheet matching "${sheetSpec}" found in file ${filePath} [sheets: ${sheetNames.join(", ")}]`
    );
  }

  const sheet = workbook.Sheets[resolvedName];
  // Convert to 2D array (header: 1 means row-based arrays, defval ensures empty cells)
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Ensure all values are strings
  return data.map((row) => row.map((cell) => String(cell ?? "")));
}

/** Resolve a sheet specification to an actual sheet name */
function resolveSheetName(
  spec: string,
  sheetNames: string[],
  date?: string | null,
): string | null {
  const parts = spec.split(":");

  // sheet_num:N — 1-based index
  if (parts[0] === "sheet_num") {
    const idx = parseInt(parts[1], 10) - 1;
    return sheetNames[idx] ?? null;
  }

  // sheet_name:M3 — month abbreviation (JAN, FEB, etc.)
  if (parts[0] === "sheet_name" && parts[1]?.toUpperCase() === "M3") {
    if (!date) return sheetNames[0] ?? null;
    const d = new Date(date + "T00:00:00");
    const monthName = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const idx = sheetNames.findIndex((s) => s.trim().toUpperCase() === monthName);
    return idx >= 0 ? sheetNames[idx] : null;
  }

  // [or] alternatives — first case-insensitive match
  if (/\[or\]/i.test(spec)) {
    const alternatives = spec.split(/\[or\]/i).map((s) => s.trim().toLowerCase());
    const idx = sheetNames.findIndex((s) =>
      alternatives.includes(s.trim().toLowerCase())
    );
    return idx >= 0 ? sheetNames[idx] : null;
  }

  // Explicit name — case-insensitive match
  const idx = sheetNames.findIndex(
    (s) => spec.toLowerCase() === s.trim().toLowerCase()
  );
  return idx >= 0 ? sheetNames[idx] : null;
}

/** Read a text file and return an array of lines */
function readTextFile(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  return content.split(/\r?\n/);
}

// ─── Text file processing ────────────────────────────────────────────

function processTextFile(
  lines: string[],
  options: DownloadOptions,
): Map<string, number> {
  const data = new Map<string, number>();
  const remaining = [...lines];

  if (options.rows_to_skip != null) {
    // Basic text mode: skip N rows, then parse with custom delimiter
    let rowsSkipped = 0;
    while (Number(options.rows_to_skip) > rowsSkipped) {
      remaining.shift();
      rowsSkipped++;
    }
    const delimiter = String(options.delimiter ?? " ");
    const dateCol = Number(options.date_col ?? 0);
    const valueCol = Number(options.value_col ?? 1);
    return parseQueuedTextLines(remaining, delimiter, dateCol, valueCol);
  }

  // Standard text mode: skip until "DATE" line, then parse space-delimited
  while (remaining.length > 0) {
    const line = remaining.shift()!;
    if (line.startsWith("DATE")) break;
  }
  return parseQueuedTextLines(remaining, " ", 0, 1);
}

function parseQueuedTextLines(
  lines: string[],
  delimiter: string,
  dateCol: number,
  valueCol: number,
): Map<string, number> {
  const data = new Map<string, number>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(delimiter).filter((p) => p !== "");
    const dateStr = parts[dateCol];
    if (!dateStr) break;

    const parsed = tryParseDate(dateStr);
    if (!parsed) break;

    const value = parseFloat(parts[valueCol]);
    if (isNaN(value)) break;

    data.set(parsed, value);
  }
  return data;
}

// ─── DownloadProcessor (main orchestrator) ───────────────────────────

/**
 * Processes downloaded files to extract time series data.
 *
 * Ports: Downloaders::DownloadProcessor + CsvFileProcessor + XlsFileProcessor
 */
class DownloadProcessor {
  /**
   * Main entry point: given a download handle and options, read the file,
   * iterate observations, and return a date→value map.
   */
  static async getData(
    handle: string,
    options: DownloadOptions,
  ): Promise<Map<string, number>> {
    const fileType = String(options.file_type ?? "");
    if (!fileType) {
      throw new Error("File type must be specified when using DownloadProcessor");
    }
    if (!["txt", "csv", "xls", "xlsx"].includes(fileType)) {
      throw new Error(`Not a valid file type option: ${fileType}`);
    }

    const isDateSensitiveHandle = handle.includes("%");

    if (fileType === "txt") {
      // Text files are never date-sensitive in this way — resolve path upfront
      const filePath = handle === ":manual"
        ? resolveManualPath(options)
        : await resolveHandlePath(handle);
      const lines = readTextFile(filePath);
      return processTextFile(lines, options);
    }

    // CSV or XLS/XLSX — spreadsheet processing
    // For non-date-sensitive handles, resolve path once upfront.
    // For date-sensitive handles, path is resolved per-iteration inside the loop.
    const initialPath = isDateSensitiveHandle
      ? null
      : handle === ":manual"
        ? resolveManualPath(options)
        : await resolveHandlePath(handle);

    return this.getDataSpreadsheet(handle, initialPath, fileType, options);
  }

  private static async getDataSpreadsheet(
    handle: string,
    initialPath: string | null,
    fileType: string,
    options: DownloadOptions,
  ): Promise<Map<string, number>> {
    // Validate required options
    validateSpreadsheetOptions(fileType, options);

    // Create processors
    const handleProcessor = new StringDatePatternProcessor(handle);
    const rowProcessor = new IntegerPatternProcessor(options.row as string | number);
    const colProcessor = new IntegerPatternProcessor(options.col as string | number);
    const sheetProcessor = options.sheet
      ? new StringDatePatternProcessor(String(options.sheet))
      : null;
    const pathProcessor = options.path
      ? new StringDatePatternProcessor(String(options.path))
      : null;

    // For start_date read from file, we need a concrete file path.
    // For date-sensitive handles without start_date, we need the first matching
    // download to read the date from. The start_date option should always be
    // provided in the eval for date-sensitive handles, so initialPath is only
    // needed for readDateFromFile when handle is NOT date-sensitive.
    const dateInfo = parseDateOptions(initialPath, fileType, options);

    const dateProcessor = new DatePatternProcessor(
      dateInfo.start,
      String(options.frequency),
      dateInfo.rev,
    );

    // Download resolution cache: resolved handle → file path
    const downloadPathCache = new Map<string, string>();
    // File data cache: file path + sheet → 2D array
    const fileCache = new Map<string, string[][]>();

    const data = new Map<string, number>();
    let index = 0;
    const MAX_ITERATIONS = 100_000;

    while (index < MAX_ITERATIONS) {
      const date = dateProcessor.compute(index);

      // Resolve potentially date-sensitive handle/sheet/path
      const currentHandle = handleProcessor.compute(date);
      const currentSheet = sheetProcessor?.compute(date) ?? null;

      // Resolve file path: either from the upfront resolution or per-handle lookup
      let currentPath: string;
      if (pathProcessor) {
        currentPath = resolveFullPath(pathProcessor.compute(date));
      } else if (initialPath && !handleProcessor.isDateSensitive) {
        currentPath = initialPath;
      } else {
        // Date-sensitive handle: resolve handle → Download → file path
        try {
          currentPath = await resolveHandlePathCached(
            currentHandle, downloadPathCache,
          );
        } catch (e) {
          // Handle not found in DB — for date-sensitive handles this means
          // we've iterated past all available downloads → stop.
          if (handleProcessor.isDateSensitive) {
            break;
          }
          throw e;
        }
      }

      // Load the sheet data, resolve row/col, and read cell.
      // For date-sensitive handles, file/header errors skip that
      // iteration (the file may be missing or reformatted) — matching
      // the Rails behavior where date-sensitive misses are non-fatal.
      let sheet2d: string[][];
      try {
        sheet2d = getCachedSheet(
          fileCache, currentPath, fileType, currentSheet, date,
        );
      } catch (e) {
        if (handleProcessor.isDateSensitive) {
          console.warn(
            `[DownloadProcessor] skipping ${currentHandle} (${date}): ${(e as Error).message}`
          );
          index++;
          continue;
        }
        throw e;
      }

      let value: number | null | "BREAK";
      try {
        // Resolve row and column
        const row = rowProcessor.compute(index, sheet2d, currentHandle, currentSheet);
        const col = colProcessor.compute(index, sheet2d, currentHandle, currentSheet);

        // Read and parse cell
        const rawValue = sheet2d[row - 1]?.[col - 1];
        value = parseCell(rawValue);
      } catch (e) {
        if (handleProcessor.isDateSensitive) {
          console.warn(
            `[DownloadProcessor] skipping ${currentHandle} (${date}): ${(e as Error).message}`
          );
          index++;
          continue;
        }
        throw e;
      }

      if (value === "BREAK") {
        // For date-sensitive handles, a break just skips this file
        if (handleProcessor.isDateSensitive) {
          index++;
          continue;
        }
        break;
      }

      if (value !== null) {
        data.set(date, value);
      }

      // Check end_date option
      if (options.end_date && date === String(options.end_date)) {
        break;
      }

      index++;
    }

    if (data.size === 0) {
      throw new Error(
        `No data found for handle "${handle}" (file_type=${fileType}, ` +
        `frequency=${options.frequency}, start_date=${options.start_date ?? "from file"})`
      );
    }

    return data;
  }
}

// ─── Helper: resolve file paths ──────────────────────────────────────

/** Resolve a single exact handle to its file path via the downloads table. */
async function resolveHandlePath(handle: string): Promise<string> {
  const download = await DownloadCollection.getByHandle(handle);
  return download.effectivePath();
}

/**
 * Resolve a handle to its file path, caching results so repeated lookups
 * for the same resolved handle (e.g., "2024@hiwi.org") don't re-query.
 */
async function resolveHandlePathCached(
  handle: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(handle);
  if (cached) return cached;

  const path = await resolveHandlePath(handle);
  cache.set(handle, path);
  return path;
}

function resolveManualPath(options: DownloadOptions): string {
  if (!options.path) {
    throw new Error("File path must be specified for manual download processing");
  }
  const dataDir = process.env.DATA_DIR ?? "./data";
  return join(dataDir, String(options.path));
}

function resolveFullPath(relativePath: string): string {
  const dataDir = process.env.DATA_DIR ?? "./data";
  return join(dataDir, relativePath);
}

// ─── Helper: validate spreadsheet options ────────────────────────────

function validateSpreadsheetOptions(fileType: string, options: DownloadOptions): void {
  const missing: string[] = [];

  if (options.start_date == null && (options.start_row == null || options.start_col == null)) {
    missing.push("start date information");
  }
  if (options.row == null) missing.push("row specification");
  if (options.col == null) missing.push("column specification");
  if (options.frequency == null) missing.push("frequency specification");
  if ((fileType === "xls" || fileType === "xlsx") && options.sheet == null) {
    missing.push("sheet specification");
  }

  if (missing.length > 0) {
    throw new Error(
      `Incomplete Download Processor specification — missing: ${missing.join(", ")}`
    );
  }
}

// ─── Helper: parse date options ──────────────────────────────────────

function parseDateOptions(
  filePath: string | null,
  fileType: string,
  options: DownloadOptions,
): { start: string; rev: boolean } {
  let startDate: string;

  if (options.start_date) {
    startDate = String(options.start_date);
  } else {
    // Read start date from file at start_row, start_col
    if (!filePath) {
      throw new Error(
        "start_date option is required for date-sensitive download handles"
      );
    }
    startDate = readDateFromFile(
      filePath, fileType, options,
      Number(options.start_row),
      Number(options.start_col),
    );
  }

  // Adjust for frequency (normalize to first of period)
  startDate = adjustForFrequency(startDate, String(options.frequency));

  return {
    start: startDate,
    rev: Boolean(options.rev),
  };
}

function readDateFromFile(
  filePath: string,
  fileType: string,
  options: DownloadOptions,
  startRow: number,
  startCol: number,
): string {
  let cellValue: string;

  if (fileType === "csv") {
    const csvData = readCsvFile(filePath);
    cellValue = csvData[startRow - 1]?.[startCol - 1] ?? "";
  } else {
    // XLS/XLSX
    const sheet = String(options.sheet ?? "");
    const data = readXlsFile(filePath, sheet);
    cellValue = data[startRow - 1]?.[startCol - 1] ?? "";
  }

  // Try as a "YYYY.MM" style date
  if (cellValue.includes(".")) {
    const parts = cellValue.split(".");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month)) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // Try standard date parsing
  const parsed = tryParseDate(cellValue);
  if (parsed) return parsed;

  throw new Error(`Cannot parse start date from cell value: "${cellValue}"`);
}

function adjustForFrequency(dateString: string, frequency: string): string {
  if (frequency === "M") {
    const parts = dateString.split("-");
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}-01`;
    }
  }
  return dateString;
}

// ─── Helper: file caching ────────────────────────────────────────────

function getCachedSheet(
  cache: Map<string, string[][]>,
  filePath: string,
  fileType: string,
  sheetSpec: string | null,
  date: string | null,
): string[][] {
  const cacheKey = `${filePath}|${sheetSpec ?? ""}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let sheet2d: string[][];
  if (fileType === "csv") {
    sheet2d = readCsvFile(filePath);
  } else {
    sheet2d = readXlsFile(filePath, sheetSpec ?? "sheet_num:1", date);
  }

  cache.set(cacheKey, sheet2d);
  return sheet2d;
}

// ─── Helper: header matching ─────────────────────────────────────────

type MatchType = "equal" | "prefix" | "substring" | "trim_elipsis";

function normalizeMatchType(raw?: string): MatchType {
  if (!raw) return "equal";
  const normalized = raw.toLowerCase().replace(/-/g, "_");
  switch (normalized) {
    case "hiwi": return "equal";
    case "no_okina": return "equal";
    case "prefix": return "prefix";
    case "prefix_no_okina": return "prefix";
    case "sub": return "substring";
    case "sub_no_okina": return "substring";
    case "trim_elipsis": return "trim_elipsis";
    default: return "equal";
  }
}

function matchCell(cellValue: string, header: string, matchType: MatchType): boolean {
  if (typeof cellValue !== "string") return false;

  let val = cellValue;
  // For exact match, strip parenthetical suffixes: "Hawaii(1)" → "Hawaii"
  if (matchType === "equal" && val !== "") {
    const parenIdx = val.indexOf("(");
    if (parenIdx > 0) val = val.substring(0, parenIdx);
  }

  const valNormalized = val.trim().toLowerCase();
  const headerNormalized = header.trim().toLowerCase();

  switch (matchType) {
    case "equal":
      return valNormalized === headerNormalized;
    case "prefix":
      return valNormalized.startsWith(headerNormalized);
    case "substring":
      return valNormalized.includes(headerNormalized);
    case "trim_elipsis":
      return valNormalized === headerNormalized;
    default:
      return valNormalized === headerNormalized;
  }
}

// ─── Helper: Excel column notation ───────────────────────────────────

function excelColumnToNumber(column: string): number {
  let result = 0;
  for (const char of column.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - "A".charCodeAt(0) + 1);
  }
  return result;
}

function convertToNumericPattern(pattern: string): string {
  // Already numeric or a complex pattern
  if (/^(\d+|increment:|repeat:|block:|header)/.test(pattern)) return pattern;

  // Excel column notation: A-Z, AA-ZZ, etc.
  if (/^[A-Z]+$/i.test(pattern)) {
    return String(excelColumnToNumber(pattern));
  }

  return pattern;
}

// ─── Helper: strftime ────────────────────────────────────────────────

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function strftime(format: string, date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  return format
    .replace(/%Y/g, String(y))
    .replace(/%y/g, String(y).slice(-2))
    .replace(/%m/g, String(m).padStart(2, "0"))
    .replace(/%d/g, String(d).padStart(2, "0"))
    .replace(/%b/g, MONTH_ABBREVS[date.getMonth()])
    .replace(/%B/g, date.toLocaleString("en-US", { month: "long" }))
    .replace(/%^b/g, MONTH_ABBREVS[date.getMonth()].toUpperCase());
}

// ─── Helper: date math ───────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tryParseDate(str: string): string | null {
  if (!str || !str.trim()) return null;

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();

  // mm/dd/yyyy
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return formatDate(d);
  }

  return null;
}

export default DownloadProcessor;
