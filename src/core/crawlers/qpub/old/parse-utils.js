/**
 * Parsing Utility Functions
 *
 * Shared utilities used across different section parsers
 */

/**
 * Cleans and normalizes text content
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/&nbsp;/g, " ") // Replace HTML entities
    .trim();
}

/**
 * Checks if a table is a two-column key-value table
 * @param {HTMLElement} table - Table element to check
 * @returns {boolean} True if two-column table
 */
export function isTwoColumnTable(table) {
  const rows = table.querySelectorAll("tr");
  if (rows.length === 0) return false;

  // Check if most rows have a th and td (key-value structure)
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
 * @param {HTMLElement} table - Table element to check
 * @returns {boolean} True if multi-row table
 */
export function isMultiRowTable(table) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  // Has thead and tbody = likely a data table
  if (thead && tbody) {
    const dataRows = tbody.querySelectorAll("tr");
    return dataRows.length > 0;
  }

  return false;
}

/**
 * Extracts data from a two-column key-value table
 * @param {HTMLElement} table - Table element
 * @returns {Object} Key-value pairs
 */
export function extractTwoColumnTable(table) {
  const data = {};
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      // Extract key from th (remove <strong> tags)
      let key = cleanText(th.textContent);
      // Remove ":" at the end if present
      key = key.replace(/:$/, "");

      // Convert to snake_case
      key = key.toLowerCase().replace(/\s+/g, "_");

      // Extract value from td
      // Check for links first
      const link = td.querySelector("a");
      let value = link ? link.getAttribute("href") : cleanText(td.textContent);

      data[key] = value;
    }
  });

  return data;
}

/**
 * Extracts data from a multi-row table
 * @param {HTMLElement} table - Table element
 * @returns {Array} Array of row objects
 */
export function extractMultiRowTable(table) {
  const rows = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return rows;

  // Get column names from thead
  const headers = Array.from(thead.querySelectorAll("th")).map((th) => {
    let text = cleanText(th.textContent);
    // Convert to snake_case
    return text
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "");
  });

  // Extract data from tbody rows
  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const rowData = {};
    cells.forEach((cell, index) => {
      if (index < headers.length && headers[index]) {
        // Check for links
        const link = cell.querySelector("a");
        let value = link
          ? link.getAttribute("href")
          : cleanText(cell.textContent);
        rowData[headers[index]] = value;
      }
    });

    // Only add row if it has data
    if (Object.keys(rowData).length > 0) {
      rows.push(rowData);
    }
  });

  return rows;
}

/**
 * Parse dollar value to numeric type
 * @param {string|number} value - Value to parse
 * @param {boolean} asInteger - If true, return integer (assessed values). If false, return decimal (tax payments)
 * @returns {number|null} Parsed numeric value
 */
export function parseDollarValue(value, asInteger = false) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return asInteger ? Math.round(value) : value;
  }

  const str = String(value).trim();
  if (str === "") return null;

  // Check for negative values in parentheses: ($120.50)
  const isNegative = str.startsWith("(") && str.endsWith(")");

  // Remove $, commas, parentheses
  let cleaned = str.replace(/[$,()]/g, "");

  let num = Number(cleaned);
  if (isNaN(num)) return null;

  // Apply negative if in parentheses
  if (isNegative) {
    num = -Math.abs(num);
  }

  // Round to integer if asInteger is true (for assessed values)
  return asInteger ? Math.round(num) : num;
}

/**
 * Check if a field name represents an assessed value (stored as integer)
 */
export function isAssessedValueField(fieldName) {
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
    "value",
  ];
  return assessedValuePatterns.some(
    (pattern) =>
      lowerFieldName === pattern || lowerFieldName.endsWith("_" + pattern),
  );
}

/**
 * Check if a field name represents a tax/payment value (stored as decimal)
 */
export function isTaxPaymentField(fieldName) {
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
 * Extracts numeric value and determines if it's square feet or acres
 * @param {string} value - Raw land area value (e.g., "986 Square Feet", "1247 Acres", "42.202")
 * @returns {Object} { value: number|null, unit: 'sqft'|'acres'|null }
 */
export function parseLandArea(value) {
  if (!value || value === null || value === undefined) {
    return { value: null, unit: null };
  }

  const str = String(value).trim();
  if (str === "") return { value: null, unit: null };

  // Detect unit from text
  const lowerStr = str.toLowerCase();
  let unit = null;

  if (lowerStr.includes("acre")) {
    unit = "acres";
  } else if (
    lowerStr.includes("sq") ||
    lowerStr.includes("square feet") ||
    lowerStr.includes("square ft")
  ) {
    unit = "sqft";
  }

  // Extract numeric value (handles numbers with commas like "1,234.56")
  const numMatch = str.match(/[\d,]+\.?\d*/);
  if (numMatch) {
    const numStr = numMatch[0].replace(/,/g, "");
    const numValue = parseFloat(numStr);
    return { value: numValue, unit };
  }

  // If no number found but we detected a unit, return the original value
  return { value: str, unit };
}

/**
 * Normalize numeric values in an object recursively
 */
export function normalizeNumericValues(obj) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeNumericValues(item));
  }

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      normalized[key] = normalizeNumericValues(value);
    } else if (isAssessedValueField(key)) {
      normalized[key] = parseDollarValue(value, true);
    } else if (isTaxPaymentField(key)) {
      normalized[key] = parseDollarValue(value, false);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}
