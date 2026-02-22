import XLSX from "xlsx";

import { validateDbedtData } from "./dbedt-xlsx-validator";

export type DbedtMetaRow = {
  indId: number;
  parentId: number | null;
  indicatorForTable: string | null;
  indicator: string | null;
  unit: string | null;
  source: string | null;
  order: number | null;
  decimal: number | null;
};

export type DbedtDataRow = {
  indId: number;
  areaId: number;
  frequency: string;
  year: number;
  qm: string | null;
  value: number | null;
};

export type DbedtParseResult = {
  indicatorRows: DbedtMetaRow[];
  dataSheet: XLSX.WorkSheet;
};

const INDICATOR_REQUIRED_COLUMNS = [
  "ind_id",
  "parent_id",
  "indicatorfortable",
  "indicator",
  "unit",
  "source",
  "order",
  "level",
  "decimal",
];

const DATA_REQUIRED_COLUMNS = [
  "ind_id",
  "area_id",
  "frequency",
  "year",
  "qm",
  "value",
];

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

function getDenseData(sheet: XLSX.WorkSheet, sheetName: string): DenseRow[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: DenseRow[] | undefined = (sheet as any)["!data"];
  if (!data || data.length < 2) {
    throw new Error(`"${sheetName}" sheet has no data rows`);
  }
  return data;
}

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

/**
 * Parse a DBEDT XLSX file containing "indicator" and "data" sheets.
 * Uses dense mode to reduce memory for the large data sheet.
 * Data sheet is NOT parsed eagerly — use `streamDbedtDataRows()` to iterate.
 */
export function parseDbedtXlsx(fileBuffer: Buffer): DbedtParseResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", dense: true });

  // Find sheets case-insensitively
  const sheetNames = workbook.SheetNames;
  const indicatorSheetName = sheetNames.find(
    (n) => n.toLowerCase() === "indicator",
  );
  const dataSheetName = sheetNames.find((n) => n.toLowerCase() === "data");

  if (!indicatorSheetName) {
    throw new Error(
      `XLSX file missing "indicator" sheet. Found: ${sheetNames.join(", ")}`,
    );
  }
  if (!dataSheetName) {
    throw new Error(
      `XLSX file missing "data" sheet. Found: ${sheetNames.join(", ")}`,
    );
  }

  const indicatorRows = parseIndicatorSheet(
    workbook.Sheets[indicatorSheetName],
  );

  // Validate indicators only (data rows validated inline during streaming)
  const indicatorValidation = validateDbedtData(indicatorRows, []);
  if (!indicatorValidation.valid) {
    const first = indicatorValidation.errors[0];
    throw new Error(
      `Validation failed: ${first.sheet} sheet row ${first.row} — ${first.field}: ${first.message}` +
        (indicatorValidation.errors.length > 1
          ? ` (and ${indicatorValidation.errors.length - 1} more errors)`
          : ""),
    );
  }

  const dataSheet = workbook.Sheets[dataSheetName];

  return { indicatorRows, dataSheet };
}

// ─── Indicator sheet parsing ─────────────────────────────────────────

function parseIndicatorSheet(sheet: XLSX.WorkSheet): DbedtMetaRow[] {
  const data = getDenseData(sheet, "indicator");
  const headers = buildHeaderMap(data[0]);
  validateHeaders(headers, "indicator", INDICATOR_REQUIRED_COLUMNS);

  const indIdIdx = headers.get("ind_id")!;
  const parentIdIdx = headers.get("parent_id")!;
  const indicatorForTableIdx = headers.get("indicatorfortable")!;
  const indicatorIdx = headers.get("indicator")!;
  const unitIdx = headers.get("unit")!;
  const sourceIdx = headers.get("source")!;
  const orderIdx = headers.get("order")!;
  const decimalIdx = headers.get("decimal")!;

  const rows: DbedtMetaRow[] = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const indId = parseNumeric(cv(row[indIdIdx]));
    if (indId == null || typeof indId === "string") break; // end of file

    const parentRaw = parseNumeric(cv(row[parentIdIdx]));
    const orderRaw = parseNumeric(cv(row[orderIdx]));
    const decimalRaw = parseNumeric(cv(row[decimalIdx]));

    rows.push({
      indId: indId as number,
      parentId: typeof parentRaw === "number" ? parentRaw : null,
      indicatorForTable: str(cellAt(row, indicatorForTableIdx)),
      indicator: str(cellAt(row, indicatorIdx)),
      unit: str(cellAt(row, unitIdx)),
      source: str(cellAt(row, sourceIdx)),
      order: typeof orderRaw === "number" ? orderRaw : null,
      decimal: typeof decimalRaw === "number" ? decimalRaw : null,
    });
  }

  return rows;
}

// ─── Data sheet streaming ────────────────────────────────────────────

/**
 * Generator that yields DbedtDataRow objects from a dense-mode data worksheet.
 * Reads cell values directly from `!data` — no `sheet_to_json` materialisation.
 */
export function* streamDbedtDataRows(
  sheet: XLSX.WorkSheet,
): Generator<DbedtDataRow> {
  const data = getDenseData(sheet, "data");
  const headers = buildHeaderMap(data[0]);
  validateHeaders(headers, "data", DATA_REQUIRED_COLUMNS);

  const indIdIdx = headers.get("ind_id")!;
  const areaIdIdx = headers.get("area_id")!;
  const frequencyIdx = headers.get("frequency")!;
  const yearIdx = headers.get("year")!;
  const qmIdx = headers.get("qm")!;
  const valueIdx = headers.get("value")!;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const indId = parseNumeric(cv(row[indIdIdx]));
    if (indId == null || typeof indId === "string") continue;

    const areaRaw = parseNumeric(cv(row[areaIdIdx]));
    const yearRaw = parseNumeric(cv(row[yearIdx]));
    const valueRaw = parseNumeric(cv(row[valueIdx]));

    yield {
      indId: indId as number,
      areaId: typeof areaRaw === "number" ? areaRaw : 0,
      frequency: str(cv(row[frequencyIdx])) ?? "A",
      year: typeof yearRaw === "number" ? yearRaw : 0,
      qm: str(cv(row[qmIdx])),
      value: typeof valueRaw === "number" ? valueRaw : null,
    };
  }
}
