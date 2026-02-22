import type { DbedtDataRow, DbedtMetaRow } from "./dbedt-xlsx-parser";

export type ValidationError = {
  sheet: "indicator" | "data";
  row: number;
  field: string;
  message: string;
};

export type ValidationSummary = {
  indicatorCount: number;
  categoryCount: number;
  measurementCount: number;
  dataRowCount: number;
  areaIds: number[];
  minYear: number | null;
  maxYear: number | null;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  summary: ValidationSummary;
};

const VALID_AREA_IDS = [1, 2, 3, 4, 5];
const VALID_FREQUENCIES = ["A", "Q", "M"];

/**
 * Validate parsed DBEDT indicator and data rows.
 * Pure function — no Node or browser-specific APIs.
 */
export function validateDbedtData(
  indicatorRows: DbedtMetaRow[],
  dataRows: DbedtDataRow[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const indIds = new Set<number>();
  let categoryCount = 0;
  let measurementCount = 0;

  // --- Indicator sheet validation ---
  for (let i = 0; i < indicatorRows.length; i++) {
    const row = indicatorRows[i];
    const rowNum = i + 2; // +2 for 1-indexed + header row

    if (row.indId == null || typeof row.indId !== "number") {
      errors.push({
        sheet: "indicator",
        row: rowNum,
        field: "ind_id",
        message: "Missing or non-numeric ind_id",
      });
      continue;
    }

    indIds.add(row.indId);

    if (!row.indicator || row.indicator.trim() === "") {
      errors.push({
        sheet: "indicator",
        row: rowNum,
        field: "indicator",
        message: "Missing indicator name",
      });
    }

    if (!row.indicatorForTable || row.indicatorForTable.trim() === "") {
      errors.push({
        sheet: "indicator",
        row: rowNum,
        field: "indicatorForTable",
        message: "Missing indicatorForTable",
      });
    }

    const isMeasurement = row.unit != null && row.unit.trim() !== "";

    if (isMeasurement) {
      measurementCount++;
      if (row.order == null) {
        errors.push({
          sheet: "indicator",
          row: rowNum,
          field: "order",
          message: "Measurement row missing order",
        });
      }
      if (row.decimal == null) {
        errors.push({
          sheet: "indicator",
          row: rowNum,
          field: "decimal",
          message: "Measurement row missing decimal",
        });
      }
    } else {
      categoryCount++;
      if (row.order == null) {
        errors.push({
          sheet: "indicator",
          row: rowNum,
          field: "order",
          message: "Category row missing order",
        });
      }
    }

    if (row.parentId != null && !indIds.has(row.parentId)) {
      errors.push({
        sheet: "indicator",
        row: rowNum,
        field: "parent_id",
        message: `parent_id ${row.parentId} references unknown ind_id (must appear earlier in the sheet)`,
      });
    }
  }

  // --- Data sheet validation ---
  let minYear: number | null = null;
  let maxYear: number | null = null;
  const areaIds = new Set<number>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    if (row.indId == null || typeof row.indId !== "number") {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "ind_id",
        message: "Missing or non-numeric ind_id",
      });
      continue;
    }

    if (!indIds.has(row.indId)) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "ind_id",
        message: `ind_id ${row.indId} not found in indicator sheet`,
      });
    }

    if (row.year == null || typeof row.year !== "number" || row.year === 0) {
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

    if (
      row.areaId == null ||
      typeof row.areaId !== "number" ||
      !VALID_AREA_IDS.includes(row.areaId)
    ) {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "area_id",
        message: `area_id must be 1-5, got ${row.areaId}`,
      });
    } else {
      areaIds.add(row.areaId);
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

    if (row.value == null || typeof row.value !== "number") {
      errors.push({
        sheet: "data",
        row: rowNum,
        field: "value",
        message: "Missing or non-numeric value",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      indicatorCount: indicatorRows.length,
      categoryCount,
      measurementCount,
      dataRowCount: dataRows.length,
      areaIds: Array.from(areaIds).sort(),
      minYear,
      maxYear,
    },
  };
}
