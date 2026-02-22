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
  dataRows: DvwDataRow[];
};

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

function parseDimensionSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
): DvwDimensionRowParsed[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  validateSheetHeaders(rawRows, sheetName, DVW_DIMENSION_REQUIRED_COLUMNS);

  const rows: DvwDimensionRowParsed[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const id = str(row["id"]);
    if (id == null) break; // blank row = end of data

    // Extract L_* and O_* columns for per-module level/order overrides
    const dimLevels: Record<string, number> = {};
    const dimOrders: Record<string, number> = {};
    for (const [key, val] of Object.entries(row)) {
      if (key.startsWith("l_") && val != null) {
        const n = parseNumeric(val);
        if (typeof n === "number") dimLevels[key.slice(2)] = n;
      }
      if (key.startsWith("o_") && val != null) {
        const n = parseNumeric(val);
        if (typeof n === "number") dimOrders[key.slice(2)] = n;
      }
    }

    const levelRaw = parseNumeric(row["level"]);
    const decRaw = parseNumeric(row["decimal"]);

    rows.push({
      id,
      namew: str(row["namew"]),
      info: str(row["info"]),
      namet: str(row["namet"]),
      module: str(row["module"]) ?? "",
      data: str(row["data"]),
      parent: str(row["parent"]),
      level: typeof levelRaw === "number" ? levelRaw : null,
      dimLevels: Object.keys(dimLevels).length > 0 ? dimLevels : undefined,
      dimOrders: Object.keys(dimOrders).length > 0 ? dimOrders : undefined,
      unit: str(row["unit"]),
      decimal: typeof decRaw === "number" ? decRaw : null,
    });
  }

  return rows;
}

function parseDataSheet(sheet: XLSX.WorkSheet): DvwDataRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  validateSheetHeaders(rawRows, "data", DVW_DATA_REQUIRED_COLUMNS);

  const rows: DvwDataRow[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const module = str(row["module"]);
    if (module == null) break; // blank row = end of data

    const valueRaw = parseNumeric(row["value"]);
    if (valueRaw == null) continue; // skip rows without value

    const yearRaw = parseNumeric(row["year"]);

    rows.push({
      module,
      frequency: str(row["frequency"]) ?? "A",
      year: typeof yearRaw === "number" ? yearRaw : 0,
      qm: str(row["qm"]),
      value: typeof valueRaw === "number" ? valueRaw : null,
      group: str(row["group"]) ?? "",
      market: str(row["market"]) ?? "",
      destination: str(row["destination"]) ?? "",
      category: str(row["category"]) ?? "",
      indicator: str(row["indicator"]) ?? "",
    });
  }

  return rows;
}

/**
 * Parse a DVW XLSX file containing dimension sheets and a "data" sheet.
 */
export function parseDvwXlsx(fileBuffer: Buffer): DvwParseResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

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

  // Parse dimension sheets
  const dimensions = {} as Record<DvwDimensionName, DvwDimensionRowParsed[]>;
  for (const dim of DVW_DIMENSION_SHEETS) {
    dimensions[dim] = parseDimensionSheet(
      workbook.Sheets[sheetMap.get(dim)!],
      dim,
    );
  }

  // Parse data sheet
  const dataRows = parseDataSheet(workbook.Sheets[sheetMap.get("data")!]);

  // Server-side validation safety net
  const validation = validateDvwData(dimensions, dataRows);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(
      `Validation failed: ${first.sheet} sheet row ${first.row} — ${first.field}: ${first.message}` +
        (validation.errors.length > 1
          ? ` (and ${validation.errors.length - 1} more errors)`
          : ""),
    );
  }

  return { dimensions, dataRows };
}
