/**
 * Parsing Utility Functions
 *
 * Shared utilities used across different section parsers.
 * Full TS port of old/parse-utils.js.
 */

import type { HTMLElement } from "node-html-parser";

/**
 * Cleans and normalizes text content
 */
export function cleanText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Checks if a table is a two-column key-value table
 */
export function isTwoColumnTable(table: HTMLElement): boolean {
  const rows = table.querySelectorAll("tr");
  if (rows.length === 0) return false;

  let kvCount = 0;
  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");
    if (th && td) kvCount++;
  });

  return kvCount > 0 && kvCount / rows.length > 0.5;
}

/**
 * Checks if a table is a multi-row data table
 */
export function isMultiRowTable(table: HTMLElement): boolean {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (thead && tbody) {
    const dataRows = tbody.querySelectorAll("tr");
    return dataRows.length > 0;
  }

  return false;
}

/**
 * Extracts data from a two-column key-value table
 */
export function extractTwoColumnTable(
  table: HTMLElement,
): Record<string, string> {
  const data: Record<string, string> = {};
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      let key = cleanText(th.textContent);
      key = key.replace(/:$/, "");
      key = key.toLowerCase().replace(/\s+/g, "_");

      const link = td.querySelector("a");
      const value = link
        ? (link.getAttribute("href") ?? cleanText(td.textContent))
        : cleanText(td.textContent);

      data[key] = value;
    }
  });

  return data;
}

/**
 * Extracts data from a multi-row table
 */
export function extractMultiRowTable(
  table: HTMLElement,
): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return rows;

  const headers = Array.from(thead.querySelectorAll("th")).map((th) => {
    const text = cleanText(th.textContent);
    return text
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "");
  });

  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const rowData: Record<string, string> = {};
    cells.forEach((cell, index) => {
      if (index < headers.length && headers[index]) {
        const link = cell.querySelector("a");
        const value = link
          ? (link.getAttribute("href") ?? cleanText(cell.textContent))
          : cleanText(cell.textContent);
        rowData[headers[index]] = value;
      }
    });

    if (Object.keys(rowData).length > 0) {
      rows.push(rowData);
    }
  });

  return rows;
}

/**
 * Parse dollar value to numeric type
 */
export function parseDollarValue(
  value: string | number | null | undefined,
  asInteger = false,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return asInteger ? Math.round(value) : value;
  }

  const str = String(value).trim();
  if (str === "") return null;

  const isNegative = str.startsWith("(") && str.endsWith(")");

  const cleaned = str.replace(/[$,()]/g, "");

  let num = Number(cleaned);
  if (isNaN(num)) return null;

  if (isNegative) {
    num = -Math.abs(num);
  }

  return asInteger ? Math.round(num) : num;
}

/**
 * Check if a field name represents an assessed value (stored as integer)
 */
export function isAssessedValueField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  const assessedValuePatterns = [
    "assessed_land_value",
    "assessed_building_value",
    "assessed_value",
    "dedicated_use_value",
    "land_exemption",
    "building_exemption",
    "net_taxable_land_value",
    "net_taxable_building_value",
    "total_property_assessed_value",
    "total_property_exemption",
    "total_net_taxable_value",
    "agricultural_land_value",
    "agricultural_value",
    "market_land_value",
    "market_building_value",
    "total_market_value",
    "sale_amount",
    "final_value",
    "tax_payer_opinion_of_value",
    "tax_payer_opinion_of_exemptions",
    "permit_amount",
    "building_value",
  ];

  // Fields ending in "_value" that are NOT dollar amounts
  if (lowerFieldName === "appeal_type_value") {
    return false;
  }

  return (
    lowerFieldName === "value" ||
    assessedValuePatterns.some(
      (pattern) =>
        lowerFieldName === pattern || lowerFieldName.endsWith("_" + pattern),
    )
  );
}

/**
 * Check if a field name represents a tax/payment value (stored as decimal)
 */
export function isTaxPaymentField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();

  const exclusions = ["tax_period", "tax_class", "tax_year"];
  if (exclusions.some((excl) => lowerFieldName.includes(excl))) {
    return false;
  }

  const taxPaymentPatterns = [
    "penalty",
    "interest",
    "payment",
    "credit",
    "amount_due",
    "net_tax",
    "conveyance_tax",
    "tax",
    "taxes_",
    "other",
  ];
  return taxPaymentPatterns.some((pattern) => lowerFieldName.includes(pattern));
}

/**
 * Parse land area value and detect unit type
 */
export function parseLandArea(value: string | null | undefined): {
  value: number | string | null;
  unit: "sqft" | "acres" | null;
} {
  if (!value || value === null || value === undefined) {
    return { value: null, unit: null };
  }

  const str = String(value).trim();
  if (str === "") return { value: null, unit: null };

  const lowerStr = str.toLowerCase();
  let unit: "sqft" | "acres" | null = null;

  if (lowerStr.includes("acre")) {
    unit = "acres";
  } else if (
    lowerStr.includes("sq") ||
    lowerStr.includes("square feet") ||
    lowerStr.includes("square ft")
  ) {
    unit = "sqft";
  }

  const numMatch = str.match(/[\d,]+\.?\d*/);
  if (numMatch) {
    const numStr = numMatch[0].replace(/,/g, "");
    const numValue = parseFloat(numStr);
    return { value: numValue, unit };
  }

  return { value: str, unit };
}

/**
 * Normalize numeric values in an object recursively
 */
export function normalizeNumericValues<T>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeNumericValues(item)) as T;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      normalized[key] = normalizeNumericValues(value);
    } else if (isAssessedValueField(key)) {
      normalized[key] = parseDollarValue(value as string | number | null, true);
    } else if (isTaxPaymentField(key)) {
      normalized[key] = parseDollarValue(
        value as string | number | null,
        false,
      );
    } else {
      normalized[key] = value;
    }
  }
  return normalized as T;
}
