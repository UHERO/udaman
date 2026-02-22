import type {
  DbedtDataRow,
  DbedtMetaRow,
} from "@catalog/utils/dbedt-xlsx-parser";
import { validateDbedtData } from "@catalog/utils/dbedt-xlsx-validator";
import XLSX from "xlsx";
import type { WorkSheet } from "xlsx";

import type { ParseWorkerOutput } from "./types";

// --- Expected columns per sheet (lowercase) ---

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

// --- Helpers ---

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/**
 * Validate that a sheet contains all required columns (case-insensitive).
 * Extra columns are allowed. Throws if any required columns are missing.
 */
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

function extractIndicatorRows(sheet: WorkSheet): DbedtMetaRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const rows: DbedtMetaRow[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const indId = parseNumeric(row["ind_id"]);
    if (indId == null || typeof indId === "string") break;

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

function extractDataRows(sheet: WorkSheet): DbedtDataRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const rows: DbedtDataRow[] = [];
  for (const raw of rawRows) {
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

// --- Helper: convert validation result to generic summary stats ---

function toSummaryStats(result: ReturnType<typeof validateDbedtData>): {
  summary: { label: string; value: string }[];
  footnote?: string;
} {
  const s = result.summary;
  const summary = [
    { label: "Categories", value: String(s.categoryCount) },
    { label: "Measurements", value: String(s.measurementCount) },
    { label: "Data Points", value: s.dataRowCount.toLocaleString() },
    {
      label: `Area${s.areaIds.length !== 1 ? "s" : ""} (${s.areaIds.join(", ")})`,
      value: String(s.areaIds.length),
    },
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
    const indicatorSheetName = sheetNames.find(
      (n) => n.toLowerCase() === "indicator",
    );
    const dataSheetName = sheetNames.find((n) => n.toLowerCase() === "data");

    if (!indicatorSheetName) {
      self.postMessage({
        success: false,
        error: `Missing "indicator" sheet. Found: ${sheetNames.join(", ")}`,
      } satisfies ParseWorkerOutput);
      return;
    }
    if (!dataSheetName) {
      self.postMessage({
        success: false,
        error: `Missing "data" sheet. Found: ${sheetNames.join(", ")}`,
      } satisfies ParseWorkerOutput);
      return;
    }

    validateSheetHeaders(
      workbook.Sheets[indicatorSheetName],
      "indicator",
      INDICATOR_REQUIRED_COLUMNS,
    );
    validateSheetHeaders(
      workbook.Sheets[dataSheetName],
      "data",
      DATA_REQUIRED_COLUMNS,
    );

    const indicatorRows = extractIndicatorRows(
      workbook.Sheets[indicatorSheetName],
    );
    const dataRows = extractDataRows(workbook.Sheets[dataSheetName]);

    const result = validateDbedtData(indicatorRows, dataRows);
    const { summary, footnote } = toSummaryStats(result);

    if (result.valid) {
      self.postMessage({
        success: true,
        summary,
        footnote,
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
