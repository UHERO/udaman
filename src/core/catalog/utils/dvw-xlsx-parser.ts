import XLSX from "xlsx";

import {
  DVW_DATA_REQUIRED_COLUMNS,
  DVW_DIMENSION_REQUIRED_COLUMNS,
  DVW_DIMENSION_SHEETS,
  validateDvwData,
  type DvwDataRow,
  type DvwDimensionName,
  type DvwDimensionRow,
} from "./dvw-xlsx-validator";

export type DvwDimensionRowParsed = DvwDimensionRow & {
  /** Level value (from the 'level' column or L_<mod> columns) */
  level: number | null;
  /** Per-module level overrides from L_<mod> columns */
  dimLevels?: Record<string, number>;
  /** Per-module order overrides from O_<mod> columns */
  dimOrders?: Record<string, number>;
  /** Unit label (indicators sheet only) */
  unit?: string | null;
  /** Decimal places (indicators sheet only) */
  decimal?: number | null;
};

export type DvwParseResult = {
  dimensions: Record<DvwDimensionName, DvwDimensionRowParsed[]>;
  dataSheet: XLSX.WorkSheet;
};

// ─── Dense-mode helpers ──────────────────────────────────────────────

type DenseRow = (XLSX.CellObject | undefined)[];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseNumeric(val: unknown): number | string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? s : n;
}

function str(val: unknown): string | null {
  if (val == null || val === "") return null;
  return String(val).trim();
}

/** Extract the raw value from a dense-mode cell object. */
function cv(cell: XLSX.CellObject | undefined): unknown {
  if (cell == null) return null;
  return cell.v ?? null;
}

/** Read a cell value from a dense row by column index. */
function cellAt(row: DenseRow, idx: number | undefined): unknown {
  if (idx == null) return null;
  return cv(row[idx]);
}

/**
 * Get the `!data` dense array from a worksheet, asserting it exists
 * and has at least a header row + one data row.
 */
function getDenseData(sheet: XLSX.WorkSheet, sheetName: string): DenseRow[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: DenseRow[] | undefined = (sheet as any)["!data"];
  if (!data || data.length < 2) {
    throw new Error(`"${sheetName}" sheet has no data rows`);
  }
  return data;
}

/**
 * Build a normalized-header → column-index map from the first dense row.
 */
function buildHeaderMap(headerRow: DenseRow): Map<string, number> {
  const map = new Map<string, number>();
  for (let c = 0; c < headerRow.length; c++) {
    const val = cv(headerRow[c]);
    if (val != null) {
      map.set(normalizeHeader(String(val)), c);
    }
  }
  return map;
}

/**
 * Validate that all required columns exist in the header map.
 */
function validateHeaders(
  headers: Map<string, number>,
  sheetName: string,
  requiredColumns: string[],
): void {
  const missing = requiredColumns.filter((c) => !headers.has(c));
  if (missing.length > 0) {
    throw new Error(
      `"${sheetName}" sheet is missing required columns: ${missing.join(", ")}`,
    );
  }
}

// ─── Dimension sheet parsing ─────────────────────────────────────────

function parseDimensionSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): DvwDimensionRowParsed[] {
  const data = getDenseData(sheet, sheetName);
  const headers = buildHeaderMap(data[0]);
  validateHeaders(headers, sheetName, DVW_DIMENSION_REQUIRED_COLUMNS);

  // Pre-resolve fixed column indices
  const idIdx = headers.get("id")!;
  const namewIdx = headers.get("namew");
  const infoIdx = headers.get("info");
  const nametIdx = headers.get("namet");
  const moduleIdx = headers.get("module")!;
  const dataIdx = headers.get("data");
  const parentIdx = headers.get("parent");
  const levelIdx = headers.get("level");
  const unitIdx = headers.get("unit");
  const decimalIdx = headers.get("decimal");

  // Collect L_<mod> and O_<mod> column indices
  const lCols: { mod: string; idx: number }[] = [];
  const oCols: { mod: string; idx: number }[] = [];
  for (const [name, idx] of headers) {
    if (name.startsWith("l_")) lCols.push({ mod: name.slice(2), idx });
    if (name.startsWith("o_")) oCols.push({ mod: name.slice(2), idx });
  }

  const rows: DvwDimensionRowParsed[] = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const id = str(cellAt(row, idIdx));
    if (id == null) break; // blank row = end of data

    // Extract L_* and O_* per-module level/order overrides
    const dimLevels: Record<string, number> = {};
    const dimOrders: Record<string, number> = {};
    for (const { mod, idx } of lCols) {
      const n = parseNumeric(cellAt(row, idx));
      if (typeof n === "number") dimLevels[mod] = n;
    }
    for (const { mod, idx } of oCols) {
      const n = parseNumeric(cellAt(row, idx));
      if (typeof n === "number") dimOrders[mod] = n;
    }

    const levelRaw = parseNumeric(cellAt(row, levelIdx));
    const decRaw = parseNumeric(cellAt(row, decimalIdx));

    rows.push({
      id,
      namew: str(cellAt(row, namewIdx)),
      info: str(cellAt(row, infoIdx)),
      namet: str(cellAt(row, nametIdx)),
      module: str(cellAt(row, moduleIdx)) ?? "",
      data: str(cellAt(row, dataIdx)),
      parent: str(cellAt(row, parentIdx)),
      level: typeof levelRaw === "number" ? levelRaw : null,
      dimLevels: Object.keys(dimLevels).length > 0 ? dimLevels : undefined,
      dimOrders: Object.keys(dimOrders).length > 0 ? dimOrders : undefined,
      unit: str(cellAt(row, unitIdx)),
      decimal: typeof decRaw === "number" ? decRaw : null,
    });
  }

  return rows;
}

/**
 * Parse a DVW XLSX file containing dimension sheets and a "data" sheet.
 * Uses dense mode to reduce memory for large worksheets.
 * Data sheet is NOT parsed eagerly — use `streamDataRows()` to iterate.
 */
export function parseDvwXlsx(fileBuffer: Buffer): DvwParseResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", dense: true });

  const sheetNames = workbook.SheetNames;
  const sheetMap = new Map(
    sheetNames.map((n) => [n.toLowerCase(), n] as const),
  );

  // Verify required sheets
  const allRequired = [...DVW_DIMENSION_SHEETS, "data"] as const;
  const missingSheets = allRequired.filter((s) => !sheetMap.has(s));
  if (missingSheets.length > 0) {
    throw new Error(
      `XLSX file missing sheet${missingSheets.length > 1 ? "s" : ""}: ${missingSheets.join(", ")}. Found: ${sheetNames.join(", ")}`,
    );
  }

  // Parse dimension sheets (small — fine to materialize fully)
  const dimensions = {} as Record<DvwDimensionName, DvwDimensionRowParsed[]>;
  for (const dim of DVW_DIMENSION_SHEETS) {
    dimensions[dim] = parseDimensionSheet(
      workbook.Sheets[sheetMap.get(dim)!],
      dim,
    );
  }

  // Validate dimension sheets only (data rows validated inline during streaming)
  const dimValidation = validateDvwData(dimensions, []);
  if (!dimValidation.valid) {
    const first = dimValidation.errors[0];
    throw new Error(
      `Validation failed: ${first.sheet} sheet row ${first.row} — ${first.field}: ${first.message}` +
        (dimValidation.errors.length > 1
          ? ` (and ${dimValidation.errors.length - 1} more errors)`
          : ""),
    );
  }

  // Return raw data sheet reference — caller uses streamDataRows() to iterate
  const dataSheet = workbook.Sheets[sheetMap.get("data")!];

  return { dimensions, dataSheet };
}

/**
 * Generator that yields DvwDataRow objects from a dense-mode DVW data worksheet.
 * Reads cell values directly from the `!data` array — no intermediate
 * `sheet_to_json` materialisation, so memory stays flat for large sheets.
 */
export function* streamDataRows(sheet: XLSX.WorkSheet): Generator<DvwDataRow> {
  const data = getDenseData(sheet, "data");
  const headers = buildHeaderMap(data[0]);
  validateHeaders(headers, "data", DVW_DATA_REQUIRED_COLUMNS);

  // Pre-resolve column indices once for O(1) per-row access
  const moduleIdx = headers.get("module")!;
  const frequencyIdx = headers.get("frequency")!;
  const yearIdx = headers.get("year")!;
  const qmIdx = headers.get("qm")!;
  const valueIdx = headers.get("value")!;
  const groupIdx = headers.get("group")!;
  const marketIdx = headers.get("market")!;
  const destinationIdx = headers.get("destination")!;
  const categoryIdx = headers.get("category")!;
  const indicatorIdx = headers.get("indicator")!;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue; // sparse row

    const module = str(cv(row[moduleIdx]));
    if (module == null) break; // blank row = end of data

    const valueRaw = parseNumeric(cv(row[valueIdx]));
    if (valueRaw == null) continue; // skip rows without value

    const yearRaw = parseNumeric(cv(row[yearIdx]));

    yield {
      module,
      frequency: str(cv(row[frequencyIdx])) ?? "A",
      year: typeof yearRaw === "number" ? yearRaw : 0,
      qm: str(cv(row[qmIdx])),
      value: typeof valueRaw === "number" ? valueRaw : null,
      group: str(cv(row[groupIdx])) ?? "",
      market: str(cv(row[marketIdx])) ?? "",
      destination: str(cv(row[destinationIdx])) ?? "",
      category: str(cv(row[categoryIdx])) ?? "",
      indicator: str(cv(row[indicatorIdx])) ?? "",
    };
  }
}
