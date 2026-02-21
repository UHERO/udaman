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
  dataRows: DbedtDataRow[];
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

/** Normalize a header string: trim, lowercase */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/**
 * Validate that a sheet contains all required columns (case-insensitive).
 * Extra columns are allowed. Throws if any required columns are missing.
 */
function validateSheetHeaders(
  rawRows: Record<string, unknown>[],
  sheetName: string,
  requiredColumns: string[],
): void {
  if (rawRows.length === 0) {
    throw new Error(`"${sheetName}" sheet has no data rows`);
  }

  const actualSet = new Set(Object.keys(rawRows[0]).map(normalizeHeader));
  const missing = requiredColumns.filter((c) => !actualSet.has(c));

  if (missing.length > 0) {
    throw new Error(
      `"${sheetName}" sheet is missing required columns: ${missing.join(", ")}`,
    );
  }
}

/** Try to parse a numeric value (integer or float), return original string on failure */
function parseNumeric(val: unknown): number | string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? s : n;
}

/**
 * Parse a DBEDT XLSX file containing "indicator" and "data" sheets.
 */
export function parseDbedtXlsx(fileBuffer: Buffer): DbedtParseResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

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
  const dataRows = parseDataSheet(workbook.Sheets[dataSheetName]);

  // Server-side validation safety net
  const validation = validateDbedtData(indicatorRows, dataRows);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(
      `Validation failed: ${first.sheet} sheet row ${first.row} — ${first.field}: ${first.message}` +
        (validation.errors.length > 1
          ? ` (and ${validation.errors.length - 1} more errors)`
          : ""),
    );
  }

  return { indicatorRows, dataRows };
}

function parseIndicatorSheet(sheet: XLSX.WorkSheet): DbedtMetaRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  validateSheetHeaders(rawRows, "indicator", INDICATOR_REQUIRED_COLUMNS);

  const rows: DbedtMetaRow[] = [];
  for (const raw of rawRows) {
    // Normalize keys
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const indId = parseNumeric(row["ind_id"]);
    if (indId == null || typeof indId === "string") break; // end of file

    const parentRaw = parseNumeric(row["parent_id"]);
    const orderRaw = parseNumeric(row["order"]);
    const decimalRaw = parseNumeric(row["decimal"]);

    rows.push({
      indId: indId as number,
      parentId: typeof parentRaw === "number" ? parentRaw : null,
      indicatorForTable: row["indicatorfortable"]
        ? String(row["indicatorfortable"]).trim()
        : null,
      indicator: row["indicator"] ? String(row["indicator"]).trim() : null,
      unit: row["unit"] ? String(row["unit"]).trim() : null,
      source: row["source"] ? String(row["source"]).trim() : null,
      order: typeof orderRaw === "number" ? orderRaw : null,
      decimal: typeof decimalRaw === "number" ? decimalRaw : null,
    });
  }

  return rows;
}

function parseDataSheet(sheet: XLSX.WorkSheet): DbedtDataRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  validateSheetHeaders(rawRows, "data", DATA_REQUIRED_COLUMNS);

  const rows: DbedtDataRow[] = [];
  for (const raw of rawRows) {
    // Normalize keys
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const indId = parseNumeric(row["ind_id"]);
    if (indId == null || typeof indId === "string") continue;

    const areaRaw = parseNumeric(row["area_id"]);
    const yearRaw = parseNumeric(row["year"]);
    const valueRaw = parseNumeric(row["value"]);

    rows.push({
      indId: indId as number,
      areaId: typeof areaRaw === "number" ? areaRaw : 0,
      frequency: row["frequency"] ? String(row["frequency"]).trim() : "A",
      year: typeof yearRaw === "number" ? yearRaw : 0,
      qm: row["qm"] ? String(row["qm"]).trim() : null,
      value: typeof valueRaw === "number" ? valueRaw : null,
    });
  }

  return rows;
}
