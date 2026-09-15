import {
  DVW_DATA_REQUIRED_COLUMNS,
  DVW_DIMENSION_REQUIRED_COLUMNS,
  DVW_DIMENSION_SHEETS,
  validateDvwData,
  type DvwDataRow,
  type DvwDimensionName,
  type DvwDimensionRow,
} from "@catalog/utils/dvw-xlsx-validator";
import XLSX from "xlsx";
import type { WorkSheet } from "xlsx";

import type { ParseWorkerOutput } from "./types";

/**
 * Extended dimension row with fields needed by the server for loading.
 * Mirrors `DvwDimensionRowParsed` from `dvw-xlsx-parser.ts`.
 */
type DvwDimensionRowParsed = DvwDimensionRow & {
  level: number | null;
  dimLevels?: Record<string, number>;
  dimOrders?: Record<string, number>;
  unit?: string | null;
  decimal?: number | null;
};

// --- Helpers ---

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function validateSheetHeaders(
  sheet: WorkSheet,
  sheetName: string,
  requiredColumns: string[],
): void {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  if (rawRows.length === 0) {
    throw new Error(`"${sheetName}" sheet has no data rows`);
  }

  const actualSet = new Set(Object.keys(rawRows[0]).map(normalizeHeader));
  const missing = requiredColumns.filter((c) => !actualSet.has(c));

  if (missing.length > 0) {
    throw new Error(
      `This appears to be the wrong spreadsheet. "${sheetName}" sheet is missing required columns: ${missing.join(", ")}`,
    );
  }
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

function extractDimensionRows(sheet: WorkSheet): DvwDimensionRowParsed[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  // Build header set to detect L_* and O_* columns
  const headerKeys =
    rawRows.length > 0 ? Object.keys(rawRows[0]).map(normalizeHeader) : [];
  const lCols: string[] = []; // module names from L_<mod> columns
  const oCols: string[] = []; // module names from O_<mod> columns
  for (const key of headerKeys) {
    if (key.startsWith("l_")) lCols.push(key.slice(2));
    if (key.startsWith("o_")) oCols.push(key.slice(2));
  }

  const rows: DvwDimensionRowParsed[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const id = str(row["id"]);
    if (id == null) break; // blank row = end of data

    // Extract L_* per-module level overrides
    const dimLevels: Record<string, number> = {};
    for (const mod of lCols) {
      const n = parseNumeric(row[`l_${mod}`]);
      if (typeof n === "number") dimLevels[mod] = n;
    }

    // Extract O_* per-module order overrides
    const dimOrders: Record<string, number> = {};
    for (const mod of oCols) {
      const n = parseNumeric(row[`o_${mod}`]);
      if (typeof n === "number") dimOrders[mod] = n;
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

function extractDataRows(sheet: WorkSheet): DvwDataRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const rows: DvwDataRow[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const dvwModule = str(row["module"]);
    if (dvwModule == null) break; // blank row = end of data

    const valueRaw = parseNumeric(row["value"]);
    if (valueRaw == null) continue; // skip rows without value

    const yearRaw = parseNumeric(row["year"]);

    rows.push({
      module: dvwModule,
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

function toSummaryStats(result: ReturnType<typeof validateDvwData>): {
  summary: { label: string; value: string }[];
  footnote?: string;
} {
  const s = result.summary;
  const summary = [
    { label: "Indicators", value: String(s.indicatorCount) },
    { label: "Data Points", value: s.dataRowCount.toLocaleString() },
  ];
  const footnote =
    s.minYear != null && s.maxYear != null
      ? `Date range: ${s.minYear} – ${s.maxYear}`
      : undefined;
  return { summary, footnote };
}

// --- Worker entry point ---

self.onmessage = (e: MessageEvent<{ arrayBuffer: ArrayBuffer }>) => {
  try {
    const { arrayBuffer } = e.data;
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheetNames = workbook.SheetNames;
    const sheetMap = new Map(
      sheetNames.map((n) => [n.toLowerCase(), n] as const),
    );

    // Check all required sheets exist
    const allRequired = [...DVW_DIMENSION_SHEETS, "data"] as const;
    const missingSheets = allRequired.filter((s) => !sheetMap.has(s));
    if (missingSheets.length > 0) {
      self.postMessage({
        success: false,
        error: `This appears to be the wrong spreadsheet. Missing sheet${missingSheets.length > 1 ? "s" : ""}: ${missingSheets.join(", ")}. Found: ${sheetNames.join(", ")}`,
      } satisfies ParseWorkerOutput);
      return;
    }

    // Validate headers
    for (const dim of DVW_DIMENSION_SHEETS) {
      validateSheetHeaders(
        workbook.Sheets[sheetMap.get(dim)!],
        dim,
        DVW_DIMENSION_REQUIRED_COLUMNS,
      );
    }
    validateSheetHeaders(
      workbook.Sheets[sheetMap.get("data")!],
      "data",
      DVW_DATA_REQUIRED_COLUMNS,
    );

    // Extract rows (dimensions now include full parsed fields for server)
    const dimensions = {} as Record<DvwDimensionName, DvwDimensionRowParsed[]>;
    for (const dim of DVW_DIMENSION_SHEETS) {
      dimensions[dim] = extractDimensionRows(
        workbook.Sheets[sheetMap.get(dim)!],
      );
    }
    const dataRows = extractDataRows(workbook.Sheets[sheetMap.get("data")!]);

    // Validate using base DvwDimensionRow fields (validator doesn't need extended fields)
    const result = validateDvwData(dimensions, dataRows);
    const { summary, footnote } = toSummaryStats(result);

    if (result.valid) {
      self.postMessage({
        success: true,
        summary,
        footnote,
        metadata: { dimensions },
        dataRows,
      } satisfies ParseWorkerOutput);
    } else {
      self.postMessage({
        success: false,
        errors: result.errors,
        summary,
      } satisfies ParseWorkerOutput);
    }
  } catch (err) {
    self.postMessage({
      success: false,
      error: err instanceof Error ? err.message : "Failed to parse file",
    } satisfies ParseWorkerOutput);
  }
};
