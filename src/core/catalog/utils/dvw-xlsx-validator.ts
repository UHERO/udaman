import type { ParseValidationError } from "@/components/uploads/types";

export type DvwDimensionRow = {
  id: string;
  namew: string | null;
  info: string | null;
  namet: string | null;
  module: string;
  data: string | null;
  parent: string | null;
};

export type DvwDataRow = {
  module: string;
  frequency: string;
  year: number;
  qm: string | null;
  value: number | null;
  group: string;
  market: string;
  destination: string;
  category: string;
  indicator: string;
};

export type DvwValidationSummary = {
  groupCount: number;
  marketCount: number;
  destinationCount: number;
  categoryCount: number;
  indicatorCount: number;
  dataRowCount: number;
  modules: string[];
  minYear: number | null;
  maxYear: number | null;
};

export type DvwValidationResult = {
  valid: boolean;
  errors: ParseValidationError[];
  summary: DvwValidationSummary;
};

/** The 5 dimension sheets in a DVW XLSX file */
export const DVW_DIMENSION_SHEETS = [
  "group",
  "market",
  "destination",
  "category",
  "indicator",
] as const;

export type DvwDimensionName = (typeof DVW_DIMENSION_SHEETS)[number];

/** Required columns for each dimension sheet (lowercase) */
export const DVW_DIMENSION_REQUIRED_COLUMNS = ["id", "module"];

/** Required columns for the data sheet (lowercase) */
export const DVW_DATA_REQUIRED_COLUMNS = [
  "module",
  "frequency",
  "year",
  "qm",
  "value",
  "group",
  "market",
  "destination",
  "category",
  "indicator",
];

const VALID_FREQUENCIES = ["A", "Q", "M"];

/**
 * Validate parsed DVW dimension and data rows.
 * Pure function — no Node or browser-specific APIs.
 */
export function validateDvwData(
  dimensions: Record<DvwDimensionName, DvwDimensionRow[]>,
  dataRows: DvwDataRow[],
): DvwValidationResult {
  const errors: ParseValidationError[] = [];

  // --- Dimension sheet validation ---
  for (const dim of DVW_DIMENSION_SHEETS) {
    const rows = dimensions[dim];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      if (!row.id || row.id.trim() === "") {
        errors.push({
          sheet: dim,
          row: rowNum,
          field: "id",
          message: "Missing id",
        });
      }

      if (!row.module || row.module.trim() === "") {
        errors.push({
          sheet: dim,
          row: rowNum,
          field: "module",
          message: "Missing module",
        });
      }
    }
  }

  // --- Data sheet validation ---
  let minYear: number | null = null;
  let maxYear: number | null = null;
  const modules = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    if (!row.module || row.module.trim() === "") {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "module",
        message: "Missing module",
      });
    } else {
      modules.add(row.module);
    }

    if (
      !row.frequency ||
      !VALID_FREQUENCIES.includes(row.frequency.toUpperCase())
    ) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "frequency",
        message: `frequency must be A, Q, or M, got "${row.frequency}"`,
      });
    }

    if (row.year == null || row.year === 0) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "year",
        message: "Missing or non-numeric year",
      });
    } else {
      if (minYear == null || row.year < minYear) minYear = row.year;
      if (maxYear == null || row.year > maxYear) maxYear = row.year;
    }

    if (row.value == null) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "value",
        message: "Missing or non-numeric value",
      });
    }

    // indicator is always required
    if (!row.indicator || row.indicator.trim() === "") {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "indicator",
        message: "Missing indicator",
      });
    }

    // group, market, destination, category are sparse — which are populated
    // depends on the module (e.g. TREND uses market+destination, CHAR uses
    // group, HOTEL uses category). At least one must be present.
    const hasDimRef =
      (row.group && row.group.trim() !== "") ||
      (row.market && row.market.trim() !== "") ||
      (row.destination && row.destination.trim() !== "") ||
      (row.category && row.category.trim() !== "");
    if (!hasDimRef) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "group/market/destination/category",
        message:
          "At least one dimension reference (group, market, destination, or category) is required",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      groupCount: dimensions.group.length,
      marketCount: dimensions.market.length,
      destinationCount: dimensions.destination.length,
      categoryCount: dimensions.category.length,
      indicatorCount: dimensions.indicator.length,
      dataRowCount: dataRows.length,
      modules: Array.from(modules).sort(),
      minYear,
      maxYear,
    },
  };
}
