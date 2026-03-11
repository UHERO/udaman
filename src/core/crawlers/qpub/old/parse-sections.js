/**
 * Section-Specific Parsing Functions
 *
 * Dedicated parsers for each section to handle county-specific differences
 * and ensure all fields are captured even if null for some counties.
 */

import { cleanText, parseLandArea } from "./parse-utils.js";

/**
 * Parse Owner Information Section
 *
 * Strategy:
 * 1. Look for detail table (gvwAllOwners) first - has multiple owners with full details
 * 2. Fall back to summary if detail table doesn't exist
 *
 * Fields captured:
 * - owner_name: All counties (✔️)
 * - owner_type: Honolulu, Maui, Hawaii (null for Kauai)
 * - owner_address: Maui, Hawaii, Kauai (null for Honolulu)
 *
 * @param {HTMLElement} section - The Owner Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed owner information
 */
export function parseOwnerInformation(section, islandCode) {
  const result = {};

  // Try to find the detail table first (inside divAllOwners)
  const detailTable =
    section.querySelector("#ctlBodyPane_ctl01_ctl01_gvwAllOwners") ||
    section.querySelector("#ctlBodyPane_ctl02_ctl01_gvwAllOwners") ||
    section.querySelector('table[id*="gvwAllOwners"]');

  if (detailTable) {
    // Parse the detail table - has multiple owners
    const owners = parseOwnerDetailTable(detailTable, islandCode);
    if (owners.length > 0) {
      result.all_owners = owners;
      return result;
    }
  }

  // Fall back to summary if no detail table
  const summaryOwners = parseOwnerSummary(section, islandCode);
  if (summaryOwners.length > 0) {
    result.all_owners = summaryOwners;
  }

  return result;
}

/**
 * Parse Owner Detail Table (gvwAllOwners)
 *
 * This table lists all owners with their type and address
 *
 * @param {HTMLElement} table - The owner detail table
 * @param {string} islandCode - Island code
 * @returns {Array} Array of owner objects
 */
function parseOwnerDetailTable(table, islandCode) {
  const owners = [];
  const rows = table.querySelectorAll("tbody tr");

  // Get column indices from header
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

  const nameIndex = headers.findIndex((h) => h.includes("owner name"));
  const typeIndex = headers.findIndex((h) => h.includes("owner type"));
  const addressIndex = headers.findIndex((h) => h.includes("owner address"));

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");

    if (cells.length > 0) {
      const owner = {
        owner_name: null,
        owner_type: null,
        owner_address: null,
      };

      // Extract owner name (usually in th)
      if (nameIndex >= 0 && cells[nameIndex]) {
        owner.owner_name = cleanText(cells[nameIndex].textContent) || null;
      }

      // Extract owner type (Honolulu, Maui, Hawaii have this; Kauai doesn't)
      if (typeIndex >= 0 && cells[typeIndex]) {
        owner.owner_type = cleanText(cells[typeIndex].textContent) || null;
      }

      // Extract owner address (Maui, Hawaii, Kauai have this; Honolulu doesn't)
      if (addressIndex >= 0 && cells[addressIndex]) {
        owner.owner_address =
          cleanText(cells[addressIndex].textContent) || null;
      }

      // Only add if we have at least a name
      if (owner.owner_name) {
        owners.push(owner);
      }
    }
  });

  return owners;
}

/**
 * Parse Owner Summary (from lblOtherNames span)
 *
 * Fallback when detail table doesn't exist
 * Format: "OWNER NAME   Owner Type<br>OWNER 2   Type 2"
 *
 * @param {HTMLElement} section - The owner information section
 * @param {string} islandCode - Island code
 * @returns {Array} Array of owner objects
 */
function parseOwnerSummary(section, islandCode) {
  const owners = [];

  // Find the summary span
  const summarySpan = section.querySelector('span[id*="lblOtherNames"]');
  if (!summarySpan) return owners;

  // Get HTML to preserve <br> tags
  const html = summarySpan.innerHTML;

  // Remove the "Owner Names" label
  const content = html.replace(/<strong>Owner Names<\/strong><br>/i, "");

  // Split by <br> to get individual owner lines
  const lines = content
    .split("<br>")
    .map((line) => {
      // Remove any HTML tags
      return line.replace(/<[^>]*>/g, "").trim();
    })
    .filter((line) => line.length > 0);

  // Parse each line
  lines.forEach((line) => {
    // Format is usually: "OWNER NAME   Owner Type"
    // Split on multiple spaces (nbsp entities become spaces)
    const parts = line
      .split(/\s{2,}/)
      .map((p) => p.replace(/&nbsp;/g, " ").trim());

    if (parts.length > 0) {
      const owner = {
        owner_name: parts[0] || null,
        owner_type: parts.length > 1 ? parts[1] : null,
        owner_address: null, // Summary doesn't have addresses
      };

      if (owner.owner_name) {
        owners.push(owner);
      }
    }
  });

  return owners;
}

/**
 * Parse Parcel Information Section
 *
 * Strategy:
 * 1. Extract from two-column key-value table
 * 2. Normalize field names across counties (use Honolulu names as standard)
 * 3. Return all possible fields even if null
 *
 * Field mapping (county-specific names → standard name):
 * - "Parcel Number (TAX MAP KEY)" → parcel_number
 * - "Land Area" → land_area_approximate_sq_ft
 *
 * Fields captured:
 * - parcel_number: All counties
 * - location_address: All counties
 * - project_name: Maui, Hawaii, Kauai (null for Honolulu)
 * - legal_information: All counties
 * - property_class: Maui, Hawaii (null for Honolulu, Kauai)
 * - land_area_approximate_sq_ft: Honolulu, Maui, Hawaii (null for Kauai)
 * - land_area_acres: Maui, Hawaii, Kauai (null for Honolulu)
 * - neighborhood_code: Maui, Hawaii, Kauai (null for Honolulu)
 * - zoning: Maui, Hawaii, Kauai (null for Honolulu)
 * - parcel_note: Maui only
 * - damage: Maui only
 * - reentry_zone: Maui only
 * - zone_color: Maui only
 * - non_taxable_status: Kauai only
 * - living_units: Kauai only
 *
 * @param {HTMLElement} section - The Parcel Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed parcel information
 */
export function parseParcelInformation(section, islandCode) {
  const result = {
    parcel_number: null,
    location_address: null,
    project_name: null,
    legal_information: null,
    property_class: null,
    land_area_approximate_sq_ft: null,
    land_area_acres: null,
    neighborhood_code: null,
    zoning: null,
    parcel_note: null,
    damage: null,
    reentry_zone: null,
    zone_color: null,
    non_taxable_status: null,
    living_units: null,
  };

  // Find the two-column table
  const table = section.querySelector("table.tabular-data-two-column");
  if (!table) return result;

  // Extract all rows
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      // Get the key text and normalize it
      let key = cleanText(th.textContent).toLowerCase();

      // Remove trailing colon
      key = key.replace(/:$/, "");

      // Get the value
      let value = cleanText(td.textContent);
      if (!value) value = null;

      // Map county-specific field names to standard names
      if (key.includes("parcel number")) {
        result.parcel_number = value;
      } else if (key.includes("location address")) {
        result.location_address = value;
      } else if (key.includes("project name")) {
        result.project_name = value;
      } else if (key.includes("legal information")) {
        result.legal_information = value;
      } else if (
        key.includes("property class") ||
        key.includes("tax classification")
      ) {
        result.property_class = value;
      } else if (key.includes("land area") && key.includes("sq ft")) {
        const parsed = parseLandArea(value);
        result.land_area_approximate_sq_ft = parsed.value;
      } else if (key.includes("land area") && key.includes("acre")) {
        const parsed = parseLandArea(value);
        result.land_area_acres = parsed.value;
      } else if (key === "land area") {
        // Parse the value and detect unit
        const parsed = parseLandArea(value);
        if (parsed.unit === "acres") {
          result.land_area_acres = parsed.value;
        } else if (parsed.unit === "sqft") {
          result.land_area_approximate_sq_ft = parsed.value;
        } else {
          // No unit detected, default to sq ft (Honolulu typically uses sq ft)
          result.land_area_approximate_sq_ft = parsed.value;
        }
      } else if (key.includes("neighborhood code")) {
        result.neighborhood_code = value;
      } else if (key === "zoning") {
        result.zoning = value;
      } else if (key.includes("parcel note")) {
        result.parcel_note = value;
      } else if (key === "damage") {
        result.damage = value;
      } else if (key.includes("reentry zone")) {
        result.reentry_zone = value;
      } else if (key.includes("zone color")) {
        result.zone_color = value;
      } else if (key.includes("non taxable status")) {
        result.non_taxable_status = value;
      } else if (key.includes("living units")) {
        result.living_units = value;
      }
    }
  });

  // Convert between sq ft and acres if only one is provided
  // 1 acre = 43,560 sq ft
  const SQFT_PER_ACRE = 43560;

  if (result.land_area_approximate_sq_ft && !result.land_area_acres) {
    // Have sq ft, calculate acres
    const sqft = parseFloat(result.land_area_approximate_sq_ft);
    if (!isNaN(sqft) && sqft > 0) {
      result.land_area_acres = (sqft / SQFT_PER_ACRE).toFixed(4);
    }
  } else if (result.land_area_acres && !result.land_area_approximate_sq_ft) {
    // Have acres, calculate sq ft
    const acres = parseFloat(result.land_area_acres);
    if (!isNaN(acres) && acres > 0) {
      result.land_area_approximate_sq_ft = Math.round(
        acres * SQFT_PER_ACRE,
      ).toString();
    }
  }

  return result;
}

/**
 * Parse Assessment Information Section
 *
 * Strategy:
 * 1. Extract from multi-row table (current assessments)
 * 2. Normalize column names across counties
 * 3. Return array of assessment records (one per tax year/property class)
 *
 * Field mapping (county-specific names → standard name):
 * - "Year" → tax_year
 * - "Tax Class" → property_class
 * - "Assessed Land" → assessed_land_value
 * - "Building Value" → assessed_building_value
 * - "Total Assessed Value" → total_property_assessed_value
 * - "Total Exemption Value" → total_property_exemption
 * - "Total Taxable Value" → total_net_taxable_value
 *
 * Fields captured:
 * - tax_year: All counties
 * - property_class: All counties
 * - assessed_land_value: Honolulu, Maui, Hawaii (null for Kauai)
 * - market_land_value: Maui, Hawaii (null for Honolulu, Kauai)
 * - agricultural_land_value: Maui only
 * - dedicated_use_value: Honolulu, Hawaii, Kauai (null for Maui)
 * - land_exemption: Honolulu only
 * - net_taxable_land_value: Honolulu only
 * - assessed_building_value: Honolulu, Maui, Hawaii (null for Kauai)
 * - market_building_value: Hawaii only
 * - building_exemption: Honolulu only
 * - net_taxable_building_value: Honolulu only
 * - total_property_assessed_value: All counties
 * - total_property_exemption: All counties
 * - total_net_taxable_value: All counties
 * - total_market_value: Hawaii, Kauai (null for Honolulu, Maui)
 *
 * @param {HTMLElement} section - The Assessment Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed assessment information with current_assessments array
 */
export function parseAssessmentInformation(section, islandCode) {
  const result = {};

  // Find the current assessment table (not historical)
  // Look for gvValuation but NOT gvValuationHistorical
  const currentTable = section.querySelector(
    'table[id*="gvValuation"]:not([id*="Historical"])',
  );

  if (currentTable) {
    const assessments = parseAssessmentTable(currentTable, islandCode);
    if (assessments.length > 0) {
      result.current_assessments = assessments;
    }
  }

  // Find the historical assessment table
  const historicalTable = section.querySelector(
    'table[id*="gvValuationHistorical"]',
  );

  if (historicalTable) {
    const assessments = parseAssessmentTable(historicalTable, islandCode);
    if (assessments.length > 0) {
      result.historical_assessments = assessments;
    }
  }

  return result;
}

/**
 * Parse assessment table and normalize column names
 *
 * @param {HTMLElement} table - Assessment table element
 * @param {string} islandCode - Island code
 * @returns {Array} Array of assessment objects
 */
function parseAssessmentTable(table, islandCode) {
  const assessments = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return assessments;

  // Get column names from thead
  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) => {
    let text = cleanText(th.textContent).toLowerCase();
    return text;
  });

  // Map headers to standard field names
  // IMPORTANT: Check more specific conditions first!
  const columnMap = headers.map((header) => {
    if (header.includes("tax year") || header === "year") {
      return "tax_year";
    } else if (header.includes("tax class")) {
      return "property_class";
    } else if (header.includes("property class")) {
      return "property_class";
      // Land-related fields - check specific ones first
    } else if (
      header.includes("net taxable land") ||
      (header.includes("net") &&
        header.includes("taxable") &&
        header.includes("land"))
    ) {
      return "net_taxable_land_value";
    } else if (header.includes("land exemption")) {
      return "land_exemption";
    } else if (header.includes("market") && header.includes("land")) {
      return "market_land_value";
    } else if (header.includes("agricultural") && header.includes("land")) {
      return "agricultural_land_value";
    } else if (
      header.includes("assessed") &&
      header.includes("land") &&
      !header.includes("total")
    ) {
      return "assessed_land_value";
    } else if (header.includes("dedicated")) {
      return "dedicated_use_value";
      // Building-related fields - check specific ones first
    } else if (
      header.includes("net taxable building") ||
      (header.includes("net") &&
        header.includes("taxable") &&
        header.includes("building"))
    ) {
      return "net_taxable_building_value";
    } else if (header.includes("building exemption")) {
      return "building_exemption";
    } else if (header.includes("market") && header.includes("building")) {
      return "market_building_value";
    } else if (header.includes("assessed") && header.includes("building")) {
      return "assessed_building_value";
    } else if (
      header.includes("building value") &&
      !header.includes("market") &&
      !header.includes("net")
    ) {
      return "assessed_building_value";
      // Total fields
    } else if (header.includes("total") && header.includes("market")) {
      return "total_market_value";
    } else if (header.includes("total") && header.includes("assessed")) {
      return "total_property_assessed_value";
    } else if (header.includes("total") && header.includes("exemption")) {
      return "total_property_exemption";
    } else if (header.includes("total") && header.includes("net")) {
      return "total_net_taxable_value";
    } else if (header.includes("total") && header.includes("taxable")) {
      return "total_net_taxable_value";
    } else {
      return null; // Unknown column
    }
  });

  // Extract data rows
  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const assessment = {
      tax_year: null,
      property_class: null,
      assessed_land_value: null,
      market_land_value: null,
      agricultural_land_value: null,
      dedicated_use_value: null,
      land_exemption: null,
      net_taxable_land_value: null,
      assessed_building_value: null,
      market_building_value: null,
      building_exemption: null,
      net_taxable_building_value: null,
      total_property_assessed_value: null,
      total_property_exemption: null,
      total_net_taxable_value: null,
      total_market_value: null,
    };

    cells.forEach((cell, index) => {
      const fieldName = columnMap[index];
      if (fieldName) {
        let value = cleanText(cell.textContent);
        if (!value) value = null;
        assessment[fieldName] = value;
      }
    });

    // Only add if we have at least a tax year
    if (assessment.tax_year) {
      assessments.push(assessment);
    }
  });

  return assessments;
}

/**
 * Parse Sales Information Section (also called Conveyance Information in Kauai)
 *
 * Strategy:
 * 1. Extract from multi-row table (sales history)
 * 2. Normalize column names across counties
 * 3. Return array of sales records
 *
 * Field mapping (county-specific names → standard name):
 * - "Sale Date" → sale_date
 * - "Price" → sale_amount
 * - "Instrument Number" → instrument
 * - "Document Type" → instrument_description
 * - "Valid Sale or Other Reason" → valid_sale
 * - "Record Date" / "Date Recorded" → date_of_recording
 * - "Land Court #" / "Document Number" → land_court_document_number
 * - "Land Court Cert" → cert
 *
 * Fields captured:
 * - sale_date: All counties
 * - sale_amount: All counties
 * - instrument: All counties
 * - instrument_type: All counties
 * - instrument_description: All counties
 * - valid_sale: Honolulu, Maui (null for Hawaii, Kauai)
 * - date_of_recording: All counties
 * - land_court_document_number: All counties
 * - cert: All counties
 * - book_page: Kauai only
 * - conveyance_tax: Hawaii, Kauai (null for Honolulu, Maui)
 *
 * @param {HTMLElement} section - The Sales/Conveyance Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed sales information with sales array
 */
export function parseSalesInformation(section, islandCode) {
  const result = {};

  // Find the sales table (can be gvSales or similar)
  const salesTable =
    section.querySelector('table[id*="Sales"]') ||
    section.querySelector('table[id*="Conveyance"]') ||
    section.querySelector("table.tabular-data");

  if (salesTable) {
    const sales = parseSalesTable(salesTable, islandCode);
    if (sales.length > 0) {
      result.sales = sales;
    }
  }

  return result;
}

/**
 * Parse sales table and normalize column names
 *
 * @param {HTMLElement} table - Sales table element
 * @param {string} islandCode - Island code
 * @returns {Array} Array of sale objects
 */
function parseSalesTable(table, islandCode) {
  const sales = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return sales;

  // Get column names from thead
  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) => {
    let text = cleanText(th.textContent).toLowerCase();
    return text;
  });

  // Map headers to standard field names
  const columnMap = headers.map((header) => {
    if (header.includes("sales date") || header === "sale date") {
      return "sale_date";
    } else if (header.includes("sale amount") || header === "price") {
      return "sale_amount";
    } else if (
      header.includes("instrument number") ||
      header === "instrument #"
    ) {
      return "instrument";
    } else if (header === "instrument") {
      return "instrument";
    } else if (header.includes("instrument type")) {
      return "instrument_type";
    } else if (
      header.includes("instrument description") ||
      header.includes("document type")
    ) {
      return "instrument_description";
    } else if (header.includes("valid sale")) {
      return "valid_sale";
    } else if (
      header.includes("date of recording") ||
      header.includes("record date") ||
      header.includes("date recorded")
    ) {
      return "date_of_recording";
    } else if (
      header.includes("land court document number") ||
      header.includes("land court #") ||
      header === "document number"
    ) {
      return "land_court_document_number";
    } else if (
      header.includes("cert #") ||
      header.includes("land court cert") ||
      header === "cert"
    ) {
      return "cert";
    } else if (header.includes("book") && header.includes("page")) {
      return "book_page";
    } else if (header.includes("conveyance tax")) {
      return "conveyance_tax";
    } else {
      return null; // Unknown column
    }
  });

  // Extract data rows
  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const sale = {
      sale_date: null,
      sale_amount: null,
      instrument: null,
      instrument_type: null,
      instrument_description: null,
      valid_sale: null,
      date_of_recording: null,
      land_court_document_number: null,
      cert: null,
      book_page: null,
      conveyance_tax: null,
    };

    cells.forEach((cell, index) => {
      const fieldName = columnMap[index];
      if (fieldName) {
        let value = cleanText(cell.textContent);
        if (!value) value = null;
        sale[fieldName] = value;
      }
    });

    // Only add if we have at least a sale date or instrument
    if (sale.sale_date || sale.instrument) {
      sales.push(sale);
    }
  });

  return sales;
}

/**
 * Parse Historical Tax Information Section
 *
 * This section has a complex structure with nested tables:
 * - Main table: Summary per tax year (historical_tax_summary)
 * - Nested tables per year:
 *   - Tax Details: breakdown by tax period
 *   - Tax Payments: payment records
 *   - Tax Credits: credit records
 *
 * Each nested table has a "Totals" row that should be extracted as separate fields.
 *
 * @param {HTMLElement} section - The Historical Tax Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed tax information with tax_summary array
 */
export function parseHistoricalTaxInformation(section, islandCode) {
  const result = {};

  // Find the main tax summary table (look for gvwHistoricalTax specifically)
  const taxTable =
    section.querySelector('table[id*="gvwHistoricalTax"]') ||
    section.querySelector('table[id*="Tax"]:not([id*="_gvw"])') ||
    section.querySelector("table.tabular-data");

  if (!taxTable) return result;

  const summaryRecords = parseHistoricalTaxTable(taxTable, islandCode);
  if (summaryRecords.length > 0) {
    result.tax_summary = summaryRecords;
  }

  return result;
}

/**
 * Parse historical tax table with nested tables
 *
 * @param {HTMLElement} table - Tax table element
 * @param {string} islandCode - Island code
 * @returns {Array} Array of tax summary objects with nested data
 */
function parseHistoricalTaxTable(table, islandCode) {
  const records = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return records;

  // Get column names from thead
  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

  // Map headers to field names
  const columnMap = headers.map((header) => {
    if (header.includes("year")) return "year";
    if (header.includes("tax") && !header.includes("total")) return "tax";
    if (header.includes("payment") || header.includes("credit"))
      return "payments_and_credits";
    if (header.includes("penalty")) return "penalty";
    if (header.includes("interest")) return "interest";
    if (header.includes("other")) return "other";
    if (header.includes("amount due")) return "amount_due";
    return null;
  });

  // Process rows - only direct children to avoid nested table rows
  const allRows = tbody.childNodes
    ? Array.from(tbody.childNodes).filter((child) => child.tagName === "TR")
    : Array.from(tbody.querySelectorAll(":scope > tr"));
  let i = 0;

  while (i < allRows.length) {
    const row = allRows[i];

    // Check if this is a detail row (nested tables)
    if (isDetailRow(row)) {
      // This is a detail row, it should be attached to the previous main row
      if (records.length > 0) {
        const nestedData = extractTaxNestedTables(row);
        Object.assign(records[records.length - 1], nestedData);
      }
      i++;
      continue;
    }

    // This is a main data row
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) {
      i++;
      continue;
    }

    const taxRecord = {
      year: null,
      tax: null,
      payments_and_credits: null,
      penalty: null,
      interest: null,
      other: null,
      amount_due: null,
    };

    cells.forEach((cell, index) => {
      const fieldName = columnMap[index];
      if (fieldName) {
        let value = cleanText(cell.textContent);
        if (!value) value = null;
        taxRecord[fieldName] = value;
      }
    });

    // Only add if we have a year
    if (taxRecord.year) {
      records.push(taxRecord);
    }

    i++;
  }

  return records;
}

/**
 * Extract nested tables from a tax detail row
 * These include: tax_details, tax_payments, tax_credits
 *
 * @param {HTMLElement} detailRow - The detail row element
 * @returns {Object} Object with nested table data
 */
function extractTaxNestedTables(detailRow) {
  const nestedData = {};

  // Find the div container
  const containerDiv = detailRow.querySelector("td > div");
  if (!containerDiv) return nestedData;

  // Look for all tables in the container
  const tables = containerDiv.querySelectorAll("table");

  tables.forEach((table) => {
    // Try to identify the table type by looking at preceding label or header content
    const tableData = extractTaxNestedTable(table);

    if (tableData && tableData.rows.length > 0) {
      // Determine table type from headers
      const firstHeader = tableData.headers[0] || "";
      const secondHeader = tableData.headers[1] || "";
      const headerCount = tableData.headers.length;

      if (
        firstHeader.includes("payment sequence") ||
        secondHeader.includes("effective date")
      ) {
        // Tax Payments table
        nestedData.tax_payments = tableData.rows;
        if (tableData.totals) nestedData.tax_payments_totals = tableData.totals;
      } else if (
        headerCount <= 3 &&
        tableData.headers.some((h) => h === "amount")
      ) {
        // Tax Credits table (has only 3 columns: Period, Description, Amount)
        nestedData.tax_credits = tableData.rows;
        if (tableData.totals) nestedData.tax_credits_totals = tableData.totals;
      } else if (
        (firstHeader.includes("tax period") || firstHeader === "period") &&
        secondHeader.includes("description")
      ) {
        // Tax Details table (has Tax Period, Description, Tax, Payments/Credits, etc.)
        nestedData.tax_details = tableData.rows;
        if (tableData.totals) nestedData.tax_details_totals = tableData.totals;
      }
    }
  });

  return nestedData;
}

/**
 * Extract a nested tax table, separating the totals row
 *
 * @param {HTMLElement} table - Table element
 * @returns {Object} Object with headers, rows, and totals
 */
function extractTaxNestedTable(table) {
  const headers = [];
  const rows = [];
  let totals = null;

  // Find header row
  const allRows = table.querySelectorAll("tr");
  let dataStartIndex = 0;

  for (let i = 0; i < allRows.length; i++) {
    const headerCells = allRows[i].querySelectorAll("th");
    if (headerCells.length > 0) {
      headerCells.forEach((cell) => {
        let headerText = cleanText(cell.textContent).toLowerCase();
        headers.push(headerText);
      });
      dataStartIndex = i + 1;
      break;
    }
  }

  if (headers.length === 0) return null;

  // Extract data rows
  for (let i = dataStartIndex; i < allRows.length; i++) {
    const cells = allRows[i].querySelectorAll("td, th");
    const rowData = {};

    // Check if this is a totals row
    const firstCellText = cleanText(cells[0]?.textContent || "").toLowerCase();
    const isTotalsRow = firstCellText.includes("total");

    cells.forEach((cell, index) => {
      if (headers[index]) {
        const value = cleanText(cell.textContent);
        const fieldName = headers[index]
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_");
        rowData[fieldName] = value || null;
      }
    });

    if (Object.keys(rowData).length > 0) {
      if (isTotalsRow) {
        // Store as totals with prefixed field names
        totals = {};
        Object.keys(rowData).forEach((key) => {
          if (
            key !== "tax_period" &&
            key !== "period" &&
            key !== "description" &&
            key !== "payment_sequence" &&
            key !== "effective_date"
          ) {
            totals[`total_${key}`] = rowData[key];
          }
        });
      } else {
        rows.push(rowData);
      }
    }
  }

  return { headers, rows, totals };
}

/**
 * Check if a row is a detail/expansion row (contains nested tables)
 * This is the same function used in parse.js but duplicated here for the section parser
 */
function isDetailRow(row) {
  const cells = row.querySelectorAll("td");
  if (cells.length === 0) return false;

  for (const cell of cells) {
    const colspan = cell.getAttribute("colspan");
    if (colspan && (colspan === "100%" || parseInt(colspan) > 5)) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Land Information Section
 *
 * Extracts land classification data from the Land Information table.
 * - Fields: Land Classification, Square Footage, Acreage, Agricultural Use Indicator
 * - Present mainly in Honolulu (Island 1)
 * - Can have multiple rows (multiple land classifications per property)
 *
 * @param {HTMLElement} section - The Land Information section element
 * @param {string} islandCode - Island code
 * @returns {Object} Object with land_classifications array
 */
export function parseLandInformation(section, islandCode) {
  const result = {
    land_classifications: [],
  };

  // Find the land information table
  const table = section.querySelector("table.tabular-data");
  if (!table) return result;

  // Get all data rows (skip header)
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length >= 3) {
      const classification = {
        land_classification: cleanText(cells[0].textContent),
        square_footage: cleanText(cells[1].textContent),
        acreage: cleanText(cells[2].textContent),
        agricultural_use_indicator:
          cells.length >= 4 ? cleanText(cells[3].textContent) : null,
      };

      // Only add if we have a land classification
      if (classification.land_classification) {
        result.land_classifications.push(classification);
      }
    }
  });

  return result;
}

/**
 * Parse Residential Improvement Information Section
 * (also called "Improvement Information" on Maui and Kauai)
 *
 * Strategy:
 * 1. Extract from two-column key-value table
 * 2. Normalize field names across counties (use Honolulu names as standard)
 * 3. Handle Maui's combined "Bedrooms/Full Bath/Half Bath" field (e.g., "3/1/0")
 * 4. Return all possible fields even if null
 *
 * Field mapping:
 * - Honolulu baseline: Building Number, Occupancy, Framing, Year Built, Eff Year Built, Living Area, Bedrooms, Full Bath, Half Bath
 * - Maui variations: Construction Type (→framing), Bedrooms/Full Bath/Half Bath (split to 3 fields), Percent Complete, Heating/Cooling, Building Value
 * - Hawaii variations: Square Feet (→living_area), Full Baths (→full_bath), Half Baths (→half_bath), Exterior Wall, Roof Material, Fireplace, Grade, Total Room Count
 * - Kauai variations: Percent Complete
 *
 * @param {HTMLElement} section - The Residential/Improvement Information section element
 * @param {string} islandCode - Island code (1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai)
 * @returns {Object} Parsed residential improvement information
 */
export function parseResidentialImprovementInformation(section, islandCode) {
  const result = {
    building_number: null,
    occupancy: null,
    framing: null,
    year_built: null,
    eff_year_built: null,
    living_area: null,
    bedrooms: null,
    full_bath: null,
    half_bath: null,
    percent_complete: null,
    heating_cooling: null,
    exterior_wall: null,
    roof_material: null,
    fireplace: null,
    grade: null,
    building_value: null,
    total_room_count: null,
  };

  // Find the two-column table
  const table = section.querySelector("table.tabular-data-two-column");
  if (!table) return result;

  // Extract all rows
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      // Get the key text and normalize it
      let key = cleanText(th.textContent).toLowerCase();

      // Remove trailing colon
      key = key.replace(/:$/, "");

      // Get the value
      let value = cleanText(td.textContent);
      if (!value) value = null;

      // Map county-specific field names to standard names
      if (key.includes("building number") || key === "building #") {
        result.building_number = value;
      } else if (key === "occupancy") {
        result.occupancy = value;
      } else if (key === "framing" || key === "construction type") {
        // Honolulu/Hawaii: "Framing", Maui: "Construction Type"
        result.framing = value;
      } else if (key.includes("year built") && !key.includes("eff")) {
        result.year_built = value;
      } else if (
        key.includes("eff year built") ||
        key.includes("effective year")
      ) {
        result.eff_year_built = value;
      } else if (key === "living area" || key === "square feet") {
        // Honolulu/Maui/Kauai: "Living Area", Hawaii: "Square Feet"
        result.living_area = value;
      } else if (key === "bedrooms") {
        result.bedrooms = value;
      } else if (key === "full bath" || key === "full baths") {
        // Honolulu/Kauai: "Full Bath", Hawaii: "Full Baths"
        result.full_bath = value;
      } else if (key === "half bath" || key === "half baths") {
        // Honolulu/Kauai: "Half Bath", Hawaii: "Half Baths"
        result.half_bath = value;
      } else if (key.includes("bedrooms") && key.includes("bath")) {
        // Maui special: "Bedrooms/Full Bath/Half Bath" format: "3/1/0"
        if (value && value.includes("/")) {
          const parts = value.split("/").map((p) => p.trim());
          if (parts.length >= 3) {
            result.bedrooms = parts[0] || null;
            result.full_bath = parts[1] || null;
            result.half_bath = parts[2] || null;
          }
        }
      } else if (key === "percent complete") {
        // Maui/Kauai: "100%" → keep as "100" for VARCHAR storage
        result.percent_complete = value;
      } else if (key === "heating/cooling" || key.includes("heating")) {
        result.heating_cooling = value;
      } else if (key === "exterior wall") {
        result.exterior_wall = value;
      } else if (key === "roof material") {
        result.roof_material = value;
      } else if (key === "fireplace") {
        result.fireplace = value;
      } else if (key === "grade") {
        result.grade = value;
      } else if (key === "building value") {
        // Maui: "$50,600" → store as-is for VARCHAR, will be cleaned during import
        result.building_value = value;
      } else if (key === "total room count" || key.includes("total room")) {
        result.total_room_count = value;
      }
    }
  });

  return result;
}

// Export all section parsers
export const SECTION_PARSERS = {
  parcel_information: parseParcelInformation,
  untitled_section: parseParcelInformation, // Maui uses this for damage/reentry zone fields
  owner_information: parseOwnerInformation,
  assessment_information: parseAssessmentInformation,
  sales_information: parseSalesInformation,
  conveyance_information: parseSalesInformation, // Kauai uses this name
  historical_tax_information: parseHistoricalTaxInformation,
  land_information: parseLandInformation,
  residential_improvement_information: parseResidentialImprovementInformation, // Honolulu, Hawaii
  improvement_information: parseResidentialImprovementInformation, // Maui, Kauai
  // Add more section parsers as needed
};
