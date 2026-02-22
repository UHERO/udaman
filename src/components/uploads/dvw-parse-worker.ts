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

function extractDimensionRows(sheet: WorkSheet): DvwDimensionRow[] {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const rows: DvwDimensionRow[] = [];
  for (const raw of rawRows) {
    const row: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      row[normalizeHeader(key)] = val;
    }

    const id = str(row["id"]);
    if (id == null) break; // blank row = end of data

    rows.push({
      id,
      namew: str(row["namew"]),
      info: str(row["info"]),
      namet: str(row["namet"]),
      module: str(row["module"]) ?? "",
      data: str(row["data"]),
      parent: str(row["parent"]),
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

    // Extract rows
    const dimensions = {} as Record<DvwDimensionName, DvwDimensionRow[]>;
    for (const dim of DVW_DIMENSION_SHEETS) {
      dimensions[dim] = extractDimensionRows(
        workbook.Sheets[sheetMap.get(dim)!],
      );
    }
    const dataRows = extractDataRows(workbook.Sheets[sheetMap.get("data")!]);

    const result = validateDvwData(dimensions, dataRows);
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
