/**
 * Section-Specific Parsing Functions
 *
 * Dedicated parsers for each section to handle county-specific differences
 * and ensure all fields are captured even if null for some counties.
 * Full TS port of old/parse-sections.js.
 */

import type { HTMLElement } from "node-html-parser";

import { cleanText, parseLandArea } from "./parse-utils";

// ─── Owner Information ─────────────────────────────────────────────

interface OwnerRecord {
  owner_name: string | null;
  owner_type: string | null;
  owner_address: string | null;
}

function parseOwnerDetailTable(
  table: HTMLElement,
  _islandCode: string,
): OwnerRecord[] {
  const owners: OwnerRecord[] = [];
  const rows = table.querySelectorAll("tbody tr");

  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

  const nameIndex = headers.findIndex((h) => h.includes("owner name"));
  const typeIndex = headers.findIndex((h) => h.includes("owner type"));
  const addressIndex = headers.findIndex((h) => h.includes("owner address"));

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");

    if (cells.length > 0) {
      const owner: OwnerRecord = {
        owner_name: null,
        owner_type: null,
        owner_address: null,
      };

      if (nameIndex >= 0 && cells[nameIndex]) {
        owner.owner_name = cleanText(cells[nameIndex].textContent) || null;
      }
      if (typeIndex >= 0 && cells[typeIndex]) {
        owner.owner_type = cleanText(cells[typeIndex].textContent) || null;
      }
      if (addressIndex >= 0 && cells[addressIndex]) {
        owner.owner_address =
          cleanText(cells[addressIndex].textContent) || null;
      }

      if (owner.owner_name) {
        owners.push(owner);
      }
    }
  });

  return owners;
}

function parseOwnerSummary(
  section: HTMLElement,
  _islandCode: string,
): OwnerRecord[] {
  const owners: OwnerRecord[] = [];

  const summarySpan = section.querySelector('span[id*="lblOtherNames"]');
  if (!summarySpan) return owners;

  const html = summarySpan.innerHTML;
  const content = html.replace(/<strong>Owner Names<\/strong><br>/i, "");

  const lines = content
    .split("<br>")
    .map((line) => line.replace(/<[^>]*>/g, "").trim())
    .filter((line) => line.length > 0);

  lines.forEach((line) => {
    const parts = line
      .split(/\s{2,}/)
      .map((p) => p.replace(/&nbsp;/g, " ").trim());

    if (parts.length > 0) {
      const owner: OwnerRecord = {
        owner_name: parts[0] || null,
        owner_type: parts.length > 1 ? parts[1] : null,
        owner_address: null,
      };

      if (owner.owner_name) {
        owners.push(owner);
      }
    }
  });

  return owners;
}

export function parseOwnerInformation(
  section: HTMLElement,
  islandCode: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const detailTable =
    section.querySelector("#ctlBodyPane_ctl01_ctl01_gvwAllOwners") ||
    section.querySelector("#ctlBodyPane_ctl02_ctl01_gvwAllOwners") ||
    section.querySelector('table[id*="gvwAllOwners"]');

  if (detailTable) {
    const owners = parseOwnerDetailTable(detailTable, islandCode);
    if (owners.length > 0) {
      result.all_owners = owners;
      return result;
    }
  }

  const summaryOwners = parseOwnerSummary(section, islandCode);
  if (summaryOwners.length > 0) {
    result.all_owners = summaryOwners;
  }

  return result;
}

// ─── Parcel Information ────────────────────────────────────────────

type ParcelInfo = {
  parcel_number: string | null;
  location_address: string | null;
  project_name: string | null;
  legal_information: string | null;
  property_class: string | null;
  land_area_approximate_sq_ft: number | string | null;
  land_area_acres: number | string | null;
  neighborhood_code: string | null;
  zoning: string | null;
  parcel_note: string | null;
  damage: string | null;
  reentry_zone: string | null;
  zone_color: string | null;
  non_taxable_status: string | null;
  living_units: string | null;
  [key: string]: unknown;
};

export function parseParcelInformation(
  section: HTMLElement,
  _islandCode: string,
): ParcelInfo {
  const result: ParcelInfo = {
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

  const table = section.querySelector("table.tabular-data-two-column");
  if (!table) return result;

  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      let key = cleanText(th.textContent).toLowerCase();
      key = key.replace(/:$/, "");

      // Strip Kauai's "(Note: ...)" spans before extracting value
      const noteSpans = td.querySelectorAll(".important-note");
      noteSpans.forEach((span) => span.remove());

      let value: string | null = cleanText(td.textContent);
      if (!value) value = null;

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
        const parsed = parseLandArea(value);
        if (parsed.unit === "acres") {
          result.land_area_acres = parsed.value;
        } else if (parsed.unit === "sqft") {
          result.land_area_approximate_sq_ft = parsed.value;
        } else {
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

  return result;
}

// ─── Assessment Information ────────────────────────────────────────

interface AssessmentRecord {
  tax_year: string | null;
  property_class: string | null;
  assessed_land_value: string | null;
  market_land_value: string | null;
  agricultural_land_value: string | null;
  dedicated_use_value: string | null;
  land_exemption: string | null;
  net_taxable_land_value: string | null;
  assessed_building_value: string | null;
  market_building_value: string | null;
  building_exemption: string | null;
  net_taxable_building_value: string | null;
  total_property_assessed_value: string | null;
  total_property_exemption: string | null;
  total_net_taxable_value: string | null;
  total_market_value: string | null;
}

function parseAssessmentTable(
  table: HTMLElement,
  _islandCode: string,
): AssessmentRecord[] {
  const assessments: AssessmentRecord[] = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return assessments;

  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

  const columnMap = headers.map((header) => {
    if (header.includes("tax year") || header === "year") {
      return "tax_year";
    } else if (header.includes("tax class")) {
      return "property_class";
    } else if (header.includes("property class")) {
      return "property_class";
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
      return null;
    }
  });

  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const assessment: AssessmentRecord = {
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
        let value: string | null = cleanText(cell.textContent);
        if (!value) value = null;
        (assessment as unknown as Record<string, string | null>)[fieldName] =
          value;
      }
    });

    if (assessment.tax_year) {
      assessments.push(assessment);
    }
  });

  return assessments;
}

export function parseAssessmentInformation(
  section: HTMLElement,
  islandCode: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const currentTable = section.querySelector(
    'table[id*="gvValuation"]:not([id*="Historical"])',
  );
  if (currentTable) {
    const assessments = parseAssessmentTable(currentTable, islandCode);
    if (assessments.length > 0) {
      result.current_assessments = assessments;
    }
  }

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

// ─── Sales Information ─────────────────────────────────────────────

interface SaleRecord {
  sale_date: string | null;
  sale_amount: string | null;
  instrument: string | null;
  instrument_type: string | null;
  instrument_description: string | null;
  valid_sale: string | null;
  date_of_recording: string | null;
  land_court_document_number: string | null;
  cert: string | null;
  book_page: string | null;
  conveyance_tax: string | null;
}

function parseSalesTable(
  table: HTMLElement,
  _islandCode: string,
): SaleRecord[] {
  const sales: SaleRecord[] = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return sales;

  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

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
      return null;
    }
  });

  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) return;

    const sale: SaleRecord = {
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
        let value: string | null = cleanText(cell.textContent);
        if (!value) value = null;
        (sale as unknown as Record<string, string | null>)[fieldName] = value;
      }
    });

    if (sale.sale_date || sale.instrument) {
      sales.push(sale);
    }
  });

  return sales;
}

export function parseSalesInformation(
  section: HTMLElement,
  islandCode: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

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

// ─── Historical Tax Information ────────────────────────────────────

function isDetailRow(row: HTMLElement): boolean {
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

function extractTaxNestedTable(table: HTMLElement): {
  headers: string[];
  rows: Record<string, string | null>[];
  totals: Record<string, string | null> | null;
} | null {
  const headers: string[] = [];
  const rows: Record<string, string | null>[] = [];
  let totals: Record<string, string | null> | null = null;

  const allRows = table.querySelectorAll("tr");
  let dataStartIndex = 0;

  for (let i = 0; i < allRows.length; i++) {
    const headerCells = allRows[i].querySelectorAll("th");
    if (headerCells.length > 0) {
      headerCells.forEach((cell) => {
        const headerText = cleanText(cell.textContent).toLowerCase();
        headers.push(headerText);
      });
      dataStartIndex = i + 1;
      break;
    }
  }

  if (headers.length === 0) return null;

  for (let i = dataStartIndex; i < allRows.length; i++) {
    const cells = allRows[i].querySelectorAll("td, th");
    const rowData: Record<string, string | null> = {};

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
        totals = {};
        Object.keys(rowData).forEach((key) => {
          if (
            key !== "tax_period" &&
            key !== "period" &&
            key !== "description" &&
            key !== "payment_sequence" &&
            key !== "effective_date"
          ) {
            totals![`total_${key}`] = rowData[key];
          }
        });
      } else {
        rows.push(rowData);
      }
    }
  }

  return { headers, rows, totals };
}

function extractTaxNestedTables(
  detailRow: HTMLElement,
): Record<string, unknown> {
  const nestedData: Record<string, unknown> = {};

  const containerDiv = detailRow.querySelector("td > div");
  if (!containerDiv) return nestedData;

  const tables = containerDiv.querySelectorAll("table");

  tables.forEach((table) => {
    const tableData = extractTaxNestedTable(table);

    if (tableData && tableData.rows.length > 0) {
      const firstHeader = tableData.headers[0] || "";
      const secondHeader = tableData.headers[1] || "";
      const headerCount = tableData.headers.length;

      if (
        firstHeader.includes("payment sequence") ||
        secondHeader.includes("effective date")
      ) {
        nestedData.tax_payments = tableData.rows;
        if (tableData.totals) nestedData.tax_payments_totals = tableData.totals;
      } else if (
        headerCount <= 3 &&
        tableData.headers.some((h) => h === "amount")
      ) {
        nestedData.tax_credits = tableData.rows;
        if (tableData.totals) nestedData.tax_credits_totals = tableData.totals;
      } else if (
        (firstHeader.includes("tax period") || firstHeader === "period") &&
        secondHeader.includes("description")
      ) {
        nestedData.tax_details = tableData.rows;
        if (tableData.totals) nestedData.tax_details_totals = tableData.totals;
      }
    }
  });

  return nestedData;
}

function parseHistoricalTaxTable(
  table: HTMLElement,
  _islandCode: string,
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  if (!thead || !tbody) return records;

  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

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
    ? Array.from(tbody.childNodes).filter(
        (child) => (child as HTMLElement).tagName === "TR",
      )
    : Array.from(tbody.querySelectorAll(":scope > tr"));
  let i = 0;

  while (i < allRows.length) {
    const row = allRows[i] as HTMLElement;

    if (isDetailRow(row)) {
      if (records.length > 0) {
        const nestedData = extractTaxNestedTables(row);
        Object.assign(records[records.length - 1], nestedData);
      }
      i++;
      continue;
    }

    const cells = row.querySelectorAll("th, td");
    if (cells.length === 0) {
      i++;
      continue;
    }

    const taxRecord: Record<string, unknown> = {
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
        let value: string | null = cleanText(cell.textContent);
        if (!value) value = null;
        taxRecord[fieldName] = value;
      }
    });

    if (taxRecord.year) {
      records.push(taxRecord);
    }

    i++;
  }

  return records;
}

export function parseHistoricalTaxInformation(
  section: HTMLElement,
  islandCode: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

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

// ─── Land Information ──────────────────────────────────────────────

export function parseLandInformation(
  section: HTMLElement,
  _islandCode: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    land_classifications: [] as Record<string, string | null>[],
  };

  const table = section.querySelector("table.tabular-data");
  if (!table) return result;

  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    if (cells.length >= 3) {
      const classification: Record<string, string | null> = {
        land_classification: cleanText(cells[0].textContent),
        square_footage: cleanText(cells[1].textContent),
        acreage: cleanText(cells[2].textContent),
        agricultural_use_indicator:
          cells.length >= 4 ? cleanText(cells[3].textContent) : null,
      };

      if (classification.land_classification) {
        (result.land_classifications as Record<string, string | null>[]).push(
          classification,
        );
      }
    }
  });

  return result;
}

// ─── Residential Improvement Information ───────────────────────────

function makeEmptyBuilding(): Record<string, string | null> {
  return {
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
    condo_name: null,
    condo_unit_number: null,
    condo_floor_number: null,
    condo_type: null,
    condo_view: null,
    condo_style: null,
    floor_level: null,
    parking_spaces: null,
  };
}

function extractBuildingFields(
  container: HTMLElement,
  building: Record<string, string | null>,
): void {
  const tables = container.querySelectorAll("table.tabular-data-two-column");
  for (const table of tables) {
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
      const th = row.querySelector("th");
      const tds = row.querySelectorAll("td");

      // Two HTML patterns across counties:
      //   Oahu:          <th>Label</th><td>Value</td>
      //   Hawaii/Maui:   <td><strong>Label</strong></td><td>Value</td>
      let key: string | null = null;
      let value: string | null = null;

      if (th && tds.length >= 1) {
        key = cleanText(th.textContent).toLowerCase().replace(/:$/, "");
        value = cleanText(tds[0].textContent) || null;
      } else if (tds.length >= 2) {
        key = cleanText(tds[0].textContent).toLowerCase().replace(/:$/, "");
        value = cleanText(tds[1].textContent) || null;
      }

      if (key) {
        if (key.includes("building number") || key === "building #") {
          building.building_number = value;
        } else if (key === "occupancy") {
          building.occupancy = value;
        } else if (key === "framing" || key === "construction type") {
          building.framing = value;
        } else if (key.includes("year built") && !key.includes("eff")) {
          building.year_built = value;
        } else if (
          key.includes("eff year built") ||
          key.includes("effective year")
        ) {
          building.eff_year_built = value;
        } else if (key === "living area" || key === "square feet") {
          building.living_area = value;
        } else if (key === "bedrooms") {
          building.bedrooms = value;
        } else if (key === "full bath" || key === "full baths") {
          building.full_bath = value;
        } else if (key === "half bath" || key === "half baths") {
          building.half_bath = value;
        } else if (key.includes("bedrooms") && key.includes("bath")) {
          if (value && value.includes("/")) {
            const parts = value.split("/").map((p) => p.trim());
            if (parts.length >= 3) {
              building.bedrooms = parts[0] || null;
              building.full_bath = parts[1] || null;
              building.half_bath = parts[2] || null;
            }
          }
        } else if (key === "percent complete") {
          building.percent_complete = value;
        } else if (key === "heating/cooling" || key.includes("heating")) {
          building.heating_cooling = value;
        } else if (key === "exterior wall") {
          building.exterior_wall = value;
        } else if (key === "roof material") {
          building.roof_material = value;
        } else if (key === "fireplace") {
          building.fireplace = value;
        } else if (key === "grade") {
          building.grade = value;
        } else if (key === "building value") {
          building.building_value = value;
        } else if (key === "total room count" || key.includes("total room")) {
          building.total_room_count = value;
        }
      }
    });
  }
}

export function parseResidentialImprovementInformation(
  section: HTMLElement,
  _islandCode: string,
): Record<string, unknown> {
  const buildings: Record<string, string | null>[] = [];

  // Each building lives in its own .block-row div.
  // Single-building properties have one block-row; multi-building have many.
  const blockRows = section.querySelectorAll(".block-row");
  const containers = blockRows.length > 0 ? Array.from(blockRows) : [section];

  for (const container of containers) {
    const building = makeEmptyBuilding();
    extractBuildingFields(container, building);

    // Only include if at least one field was populated
    if (Object.values(building).some((v) => v !== null)) {
      buildings.push(building);
    }
  }

  // Parse condo detail table — sits outside the .block-row divs but still
  // within the section.  Two known formats:
  //   Oahu:  "Condo Style", "Floor Level", "Condo View", "# Parking Spaces"
  //   Maui:  "Condo Name", "Unit Number", "Floor Number", "Condo Type", "Condo View"
  // Fields are attached to the first building record.
  const condoTable =
    section.querySelector('table[id*="dgCondo"]') ??
    section.querySelector("table.tabular-data:not(.tabular-data-two-column)");

  if (condoTable && buildings.length > 0) {
    const thead = condoTable.querySelector("thead");
    if (thead) {
      const headers = Array.from(thead.querySelectorAll("th")).map((th) =>
        cleanText(th.textContent).toLowerCase(),
      );

      const isCondo = headers.some(
        (h) =>
          h.includes("condo") ||
          h.includes("parking") ||
          h.includes("floor level"),
      );

      if (isCondo) {
        const columnMap = headers.map((h) => {
          if (h.includes("condo style")) return "condo_style";
          if (h === "floor level") return "floor_level";
          if (h.includes("parking")) return "parking_spaces";
          if (h.includes("condo name")) return "condo_name";
          if (h.includes("unit number")) return "condo_unit_number";
          if (h.includes("floor number")) return "condo_floor_number";
          if (h.includes("condo type")) return "condo_type";
          if (h.includes("condo view")) return "condo_view";
          return null;
        });

        const dataRow = condoTable.querySelector("tbody tr");
        if (dataRow) {
          const cells = dataRow.querySelectorAll("th, td");
          cells.forEach((cell, index) => {
            const fieldName = columnMap[index];
            if (fieldName) {
              const value = cleanText(cell.textContent) || null;
              buildings[0][fieldName] = value;
            }
          });
        }
      }
    }
  }

  return { buildings };
}

// ─── Commercial Improvement Information ─────────────────────────────

interface CommercialBuilding {
  building_number: string | null;
  building_card: string | null;
  property_class: string | null;
  improvement_name: string | null;
  structure_type: string | null;
  units: string | null;
  identical_units: string | null;
  year_built: string | null;
  effective_year_built: string | null;
  gross_building_description: string | null;
  building_type: string | null;
  building_square_footage: string | null;
  percent_complete: string | null;
  value: string | null;
  floor_details: Record<string, string | null>[];
}

function makeEmptyCommercialBuilding(): CommercialBuilding {
  return {
    building_number: null,
    building_card: null,
    property_class: null,
    improvement_name: null,
    structure_type: null,
    units: null,
    identical_units: null,
    year_built: null,
    effective_year_built: null,
    gross_building_description: null,
    building_type: null,
    building_square_footage: null,
    percent_complete: null,
    value: null,
    floor_details: [],
  };
}

function extractCommercialBuildingFields(
  container: HTMLElement,
  building: CommercialBuilding,
): void {
  const tables = container.querySelectorAll("table.tabular-data-two-column");
  for (const table of tables) {
    const rows = table.querySelectorAll("tr");

    rows.forEach((row) => {
      const th = row.querySelector("th");
      const tds = row.querySelectorAll("td");

      let key: string | null = null;
      let value: string | null = null;

      if (th && tds.length >= 1) {
        key = cleanText(th.textContent).toLowerCase().replace(/:$/, "");
        value = cleanText(tds[0].textContent) || null;
      } else if (tds.length >= 2) {
        key = cleanText(tds[0].textContent).toLowerCase().replace(/:$/, "");
        value = cleanText(tds[1].textContent) || null;
      }

      if (key) {
        if (key.includes("building number") || key === "building #") {
          building.building_number = value;
        } else if (key === "building card") {
          building.building_card = value;
        } else if (key.includes("property class")) {
          building.property_class = value;
        } else if (key === "improvement name") {
          building.improvement_name = value;
        } else if (key === "structure type") {
          building.structure_type = value;
        } else if (key === "units") {
          building.units = value;
        } else if (key === "identical units") {
          building.identical_units = value;
        } else if (key.includes("year built") && !key.includes("eff")) {
          building.year_built = value;
        } else if (
          key.includes("eff year built") ||
          key.includes("effective year")
        ) {
          building.effective_year_built = value;
        } else if (key.includes("gross building")) {
          building.gross_building_description = value;
        } else if (key === "building type") {
          building.building_type = value;
        } else if (key.includes("building square footage")) {
          building.building_square_footage = value;
        } else if (key === "% complete" || key === "percent complete") {
          building.percent_complete = value;
        } else if (key === "value") {
          building.value = value;
        }
      }
    });
  }
}

function parseFloorDetailTable(
  table: HTMLElement,
): Record<string, string | null>[] {
  const details: Record<string, string | null>[] = [];
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  if (!thead || !tbody) return details;

  const headerCells = thead.querySelectorAll("th");
  const headers = Array.from(headerCells).map((th) =>
    cleanText(th.textContent).toLowerCase(),
  );

  const columnMap = headers.map((header) => {
    if (header === "card") return "card";
    if (header === "section") return "section";
    if (header.includes("floor")) return "floor";
    if (header === "area") return "area";
    if (header === "perimeter") return "perimeter";
    if (header === "usage" || header === "occupancy") return "usage";
    if (header.includes("wall height")) return "wall_height";
    if (header.includes("exterior wall")) return "exterior_wall";
    if (header === "rank") return "rank";
    if (header.includes("building class")) return "building_class";
    return null;
  });

  const dataRows = tbody.querySelectorAll("tr");
  dataRows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    const detail: Record<string, string | null> = {};

    cells.forEach((cell, index) => {
      const fieldName = columnMap[index];
      if (fieldName) {
        const val = cleanText(cell.textContent);
        detail[fieldName] = val || null;
      }
    });

    if (Object.values(detail).some((v) => v !== null)) {
      details.push(detail);
    }
  });

  return details;
}

export function parseCommercialImprovementInformation(
  section: HTMLElement,
  _islandCode: string,
): Record<string, unknown> {
  const buildings: CommercialBuilding[] = [];

  const blockRows = section.querySelectorAll(".block-row");
  // Floor detail tables appear as siblings after each block-row, one per building
  const floorTables = section.querySelectorAll('table[id*="dgFloorDetails"]');

  for (let i = 0; i < blockRows.length; i++) {
    const building = makeEmptyCommercialBuilding();
    extractCommercialBuildingFields(blockRows[i], building);

    // Pair with corresponding floor detail table by position
    if (i < floorTables.length) {
      building.floor_details = parseFloorDetailTable(floorTables[i]);
    }

    if (
      building.building_number !== null ||
      building.building_type !== null ||
      building.structure_type !== null
    ) {
      buildings.push(building);
    }
  }

  return { buildings };
}

// ─── Section Parser Map ────────────────────────────────────────────

export type SectionParser = (
  section: HTMLElement,
  islandCode: string,
) => Record<string, unknown>;

export const SECTION_PARSERS: Record<string, SectionParser> = {
  parcel_information: parseParcelInformation,
  untitled_section: parseParcelInformation,
  owner_information: parseOwnerInformation,
  assessment_information: parseAssessmentInformation,
  sales_information: parseSalesInformation,
  conveyance_information: parseSalesInformation,
  historical_tax_information: parseHistoricalTaxInformation,
  land_information: parseLandInformation,
  residential_improvement_information: parseResidentialImprovementInformation,
  improvement_information: parseResidentialImprovementInformation,
  commercial_improvement_information: parseCommercialImprovementInformation,
};
