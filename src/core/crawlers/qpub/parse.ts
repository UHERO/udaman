/**
 * Property Data HTML Parser
 *
 * Extracts property tax assessment data from QPub HTML files.
 * Handles both residential and non-residential properties across different counties.
 * Full TS port of old/parse.js (CLI portions removed).
 */

import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";

import { getIslandCode } from "./config";
import { normalizeProperty } from "./normalize-property";
import { SECTION_KEY_ALIASES, SECTION_PARSERS } from "./parse-sections";
import {
  cleanText,
  hasNoParcelRecord,
  normalizeNumericValues,
} from "./parse-utils";

export interface ParsedProperty {
  tmk: string;
  status: string;
  parse_date: string;
  [sectionKey: string]: unknown;
}

/**
 * Determines the status of the HTML page
 */
function detectPageStatus(html: string, root: HTMLElement): string {
  const htmlLower = html.toLowerCase();

  if (htmlLower.includes("sorry, you have been blocked")) {
    return "blocked";
  }

  if (htmlLower.includes("recaptcha") && htmlLower.includes("we're sorry")) {
    return "captcha";
  }

  if (htmlLower.includes("<title>you are not authorized")) {
    return "unauthorized";
  }

  if (!root.querySelector("body") || html.length < 5000) {
    return "failed";
  }

  const hasCondoTable = root.querySelector('table[id*="gvwCondos"]');
  const hasResultsTable = root.querySelector(
    "table#ctlBodyPane_ctl00_ctl01_gvwParcelResults",
  );

  if (hasCondoTable || hasResultsTable) {
    return "condo_project";
  }

  // A page for a TMK the county has no record of still renders the report
  // shell and title, so nothing cheaper than the footer notice separates it.
  // Checked ahead of the Parcel Number row because the phantom page's Parcel
  // Information module comes back empty — no row, no label — which would
  // otherwise land it in "unknown" and hide it among genuine parse failures.
  if (hasNoParcelRecord(html)) {
    return "no_record";
  }

  // qPublic answers a TMK it can't resolve at all with the search page rather
  // than a report. Distinct from no_record: there is no parcel shell at all.
  if (html.includes("No results match your search criteria")) {
    return "no_results";
  }

  // Whitespace-collapsed: qPublic serves this label as "Parcel  Number" (two
  // spaces) on a minority of Oahu pages. Matching the raw text dropped 2,318
  // otherwise-complete profiles in the 2026-1 rebuild.
  const hasParcelNumber = root
    .querySelectorAll("strong")
    .some((tag) =>
      (tag.textContent ?? "").replace(/\s+/g, " ").includes("Parcel Number"),
    );

  return hasParcelNumber ? "success" : "unknown";
}

/**
 * Extracts data from a two-column table (key-value pairs)
 */
function extractTwoColumnTable(table: HTMLElement): Record<string, string> {
  const data: Record<string, string> = {};
  const rows = table.querySelectorAll("tr");

  rows.forEach((row) => {
    const th = row.querySelector("th");
    const td = row.querySelector("td");

    if (th && td) {
      let key = cleanText(th.textContent);
      key = key.replace(/:$/, "");

      const value = cleanText(td.textContent);

      const link = td.querySelector("a");
      const href = link ? link.getAttribute("href") : null;

      const img = td.querySelector("img");
      const imgSrc = img ? img.getAttribute("src") : null;

      const snakeCaseKey = key
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, "_");

      if (snakeCaseKey) {
        data[snakeCaseKey] = value;

        if (href) {
          data[snakeCaseKey + "_url"] = href.startsWith("http")
            ? href
            : "https://qpublic.schneidercorp.com" + href;
        }

        if (imgSrc) {
          data[snakeCaseKey + "_image_url"] = imgSrc.startsWith("http")
            ? imgSrc
            : "https://qpublic.schneidercorp.com" + imgSrc;
        }
      }
    }
  });

  return data;
}

/**
 * Check if a row is a detail/expansion row (contains nested tables)
 */
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

/**
 * Extract nested tables from a detail row
 */
function extractNestedTablesFromDetailRow(
  detailRow: HTMLElement,
): Record<string, Record<string, string>[]> {
  const nestedData: Record<string, Record<string, string>[]> = {};

  const containerDiv = detailRow.querySelector("td > div");
  if (!containerDiv) return nestedData;

  const labels = containerDiv.querySelectorAll("label");
  labels.forEach((label) => {
    const labelText = cleanText(label.textContent);

    let nextElement = label.nextElementSibling;
    while (nextElement) {
      if (nextElement.tagName === "DIV") {
        const nestedTable = nextElement.querySelector("table");
        if (nestedTable) {
          const tableData = extractNestedTable(nestedTable);

          const key = labelText
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "");

          if (key && tableData.length > 0) {
            nestedData[key] = tableData;
          }
          break;
        }
      }
      nextElement = nextElement.nextElementSibling;
    }
  });

  return nestedData;
}

/**
 * Extract a nested table (simple table without special features)
 */
function extractNestedTable(table: HTMLElement): Record<string, string>[] {
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  const allRows = table.querySelectorAll("tr");
  let dataStartIndex = 0;

  for (let i = 0; i < allRows.length; i++) {
    const headerCells = allRows[i].querySelectorAll("th");
    if (headerCells.length > 0) {
      headerCells.forEach((cell) => {
        const headerText = cleanText(cell.textContent);
        const snakeCase = headerText
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        headers.push(snakeCase || `column_${headers.length}`);
      });
      dataStartIndex = i + 1;
      break;
    }
  }

  for (let i = dataStartIndex; i < allRows.length; i++) {
    const cells = allRows[i].querySelectorAll("td, th");
    const rowData: Record<string, string> = {};

    cells.forEach((cell, index) => {
      if (headers[index]) {
        rowData[headers[index]] = cleanText(cell.textContent);
      }
    });

    if (Object.keys(rowData).length > 0) {
      rows.push(rowData);
    }
  }

  return rows;
}

/**
 * Extracts data from a multi-row table (with headers and multiple data rows)
 * Handles nested/collapsible detail rows
 */
function extractMultiRowTable(table: HTMLElement): Record<string, unknown>[] {
  const headers: string[] = [];
  const rows: Record<string, unknown>[] = [];

  const thead = table.querySelector("thead");
  if (thead) {
    const headerRow = thead.querySelector("tr");
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll("th, td");
      headerCells.forEach((cell) => {
        const headerText = cleanText(cell.textContent);
        const snakeCase = headerText
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        headers.push(snakeCase || `column_${headers.length}`);
      });
    }
  }

  const tbody = table.querySelector("tbody");
  if (tbody) {
    const dataRows = tbody.querySelectorAll("tr");
    let lastMainRow: Record<string, unknown> | null = null;

    dataRows.forEach((row) => {
      if (isDetailRow(row)) {
        if (lastMainRow) {
          const nestedData = extractNestedTablesFromDetailRow(row);
          if (Object.keys(nestedData).length > 0) {
            Object.assign(lastMainRow, nestedData);
          }
        }
        return;
      }

      const cells = row.querySelectorAll("th, td");
      const rowData: Record<string, unknown> = {};

      cells.forEach((cell, index) => {
        if (headers[index]) {
          rowData[headers[index]] = cleanText(cell.textContent);

          const link = cell.querySelector("a");
          if (link) {
            const href = link.getAttribute("href");
            if (href) {
              rowData[headers[index] + "_url"] = href.startsWith("http")
                ? href
                : "https://qpublic.schneidercorp.com" + href;
            }
          }

          const img = cell.querySelector("img");
          if (img) {
            const imgSrc = img.getAttribute("src");
            if (imgSrc) {
              rowData[headers[index] + "_image_url"] = imgSrc.startsWith("http")
                ? imgSrc
                : "https://qpublic.schneidercorp.com" + imgSrc;
            }
          }
        }
      });

      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
        lastMainRow = rowData;
      }
    });
  }

  return rows;
}

/**
 * Determines if a table is a two-column key-value table
 */
function isTwoColumnTable(table: HTMLElement): boolean {
  return table.classList.contains("tabular-data-two-column");
}

/**
 * Determines if a table is a multi-row data table
 */
function isMultiRowTable(table: HTMLElement): boolean {
  const hasTheadTbody =
    table.querySelector("thead") && table.querySelector("tbody");
  const hasMultipleRows = table.querySelectorAll("tbody tr").length > 1;
  return !!hasTheadTbody || hasMultipleRows;
}

/**
 * Extracts section title from module header
 */
function getSectionTitle(section: HTMLElement): string | null {
  const header = section.querySelector(".module-header .title");
  if (header) {
    const title = cleanText(header.textContent);
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");
  }
  return null;
}

/**
 * Section keys that can hold a condo master's roster of units.
 *
 * The counties title the same table differently — Oahu and Hawaii use
 * "Condominium/Apartment Unit Information", Kauai uses "CPR/Condo/Apt Unit
 * Information" — and the title is what the section key is derived from. Code
 * that only knew the first name silently found zero units on every Kauai
 * master, despite the table being present and identically shaped.
 *
 * Maui publishes no unit roster on the master page at all, so no key here
 * will match one.
 */
export const CONDO_UNIT_SECTIONS = [
  "condominium_apartment_unit_information",
  "cpr_condo_apt_unit_information",
] as const;

/** The unit rows from a parsed condo master, whichever section holds them. */
export function condoUnitRows(
  parsed: ParsedProperty,
): Record<string, unknown>[] {
  for (const key of CONDO_UNIT_SECTIONS) {
    const section = parsed[key] as
      | { table_data?: unknown[] }
      | undefined
      | null;
    const rows = section?.table_data;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

/**
 * Main parsing function - extracts all data from the HTML
 */
export function parsePropertyHTML(html: string, tmk: string): ParsedProperty {
  const root = parse(html);
  const status = detectPageStatus(html, root);

  const result: ParsedProperty = {
    tmk,
    status,
    parse_date: new Date().toISOString(),
  };

  if (status !== "success" && status !== "condo_project") {
    return result;
  }

  const sections = root.querySelectorAll('section[id^="ctlBodyPane_"]');
  const islandCode = getIslandCode(tmk);

  sections.forEach((section) => {
    const rawTitle = getSectionTitle(section);
    if (!rawTitle) return;
    // Remap county-specific titles (e.g. Kauai's "Historical Payment
    // Information") to the canonical section key consumers read.
    const sectionTitle = SECTION_KEY_ALIASES[rawTitle] ?? rawTitle;

    const sectionData: Record<string, unknown> = {};

    if (SECTION_PARSERS[sectionTitle]) {
      const parsedData = SECTION_PARSERS[sectionTitle](section, islandCode);
      Object.assign(sectionData, parsedData);

      if (Object.keys(sectionData).length > 0) {
        result[sectionTitle] = sectionData;
      }
      return;
    }

    const tables = section.querySelectorAll("table");

    tables.forEach((table) => {
      if (
        table.getAttribute("role") === "presentation" &&
        !table.classList.contains("tabular-data-two-column") &&
        !table.classList.contains("tabular-data")
      ) {
        return;
      }

      if (isTwoColumnTable(table)) {
        const kvData = extractTwoColumnTable(table);
        Object.assign(sectionData, kvData);
      } else if (isMultiRowTable(table)) {
        // A section's sub-table is named from the table's HTML id, not from
        // the section it sits in. That is deliberate for sales: some counties
        // head the same table "Conveyance Information", and loadSales() reads
        // `.sales` off either section because both ids contain "Sales".
        //
        // It also means the name can collide. qPublic renders Maui's Accessory
        // Information with a control called grdSales, so those rows arrive
        // under `sales` rather than `table_data` despite having nothing to do
        // with sales. Measured across 301 pages, "Sales" is the only branch
        // that collides ("AllOwners" and "Valuation" never appeared outside
        // their own sections), and consumers should reach for rows via
        // sectionRows() rather than assuming `table_data`.
        const tableId = table.id || "table";
        let tableName = "data";

        if (tableId.includes("Valuation")) {
          tableName = tableId.includes("Historical")
            ? "historical_assessments"
            : "current_assessments";
        } else if (tableId.includes("AllOwners")) {
          tableName = "all_owners";
        } else if (tableId.includes("Sales")) {
          tableName = "sales";
        } else {
          tableName = "table_data";
        }

        const tableData = extractMultiRowTable(table);
        if (tableData.length > 0) {
          sectionData[tableName] = tableData;
        }
      }
    });

    // Special handling for Map section - extract image URL
    if (sectionTitle === "map" || sectionTitle === "maps") {
      const mapImg = section.querySelector('img[id*="Map"]');
      if (mapImg) {
        const src = mapImg.getAttribute("src");
        // A page saved before the map JS settles still carries the spinner
        // placeholder (src="/images/ajax-loader-small.gif") — that is not a
        // map URL, so treat it as absent.
        if (src && !src.includes("ajax-loader")) {
          sectionData.map_url = src.startsWith("http")
            ? src
            : "https://qpublic.schneidercorp.com" + src;
        }
      }
    }

    // Special handling for Sketch section
    if (sectionTitle === "sketch" || sectionTitle === "sketches") {
      const sketchImg = section.querySelector('img[id*="Sketch"]');
      if (sketchImg) {
        const src = sketchImg.getAttribute("src");
        if (src) {
          sectionData.sketch_url = src;
        }
      }
    }

    // Special handling for the condo master's unit roster — under either of
    // the county-specific section titles.
    if (
      (CONDO_UNIT_SECTIONS as readonly string[]).includes(sectionTitle) &&
      sectionData.table_data
    ) {
      (sectionData.table_data as Record<string, unknown>[]).forEach((row) => {
        if (row.parcel_number_url) {
          row.qpub_link = row.parcel_number_url;
          delete row.parcel_number_url;
        }
      });
    }

    if (Object.keys(sectionData).length > 0) {
      result[sectionTitle] = sectionData;
    }
  });

  // Merge Maui's "Untitled Section" into parcel_information
  if (result.untitled_section && result.parcel_information) {
    for (const [key, value] of Object.entries(
      result.untitled_section as Record<string, unknown>,
    )) {
      if (value !== null && value !== undefined) {
        (result.parcel_information as Record<string, unknown>)[key] = value;
      }
    }
    delete result.untitled_section;
  } else if (result.untitled_section && !result.parcel_information) {
    result.parcel_information = result.untitled_section;
    delete result.untitled_section;
  }

  // Truncate condo master property_class to first sentence
  if (status === "condo_project" && result.parcel_information) {
    const parcel = result.parcel_information as Record<string, unknown>;
    const pc = parcel.property_class;
    if (typeof pc === "string" && pc.includes("Condo Master")) {
      parcel.property_class = "This is a Condo Master.";
    }
  }

  // Cross-section normalization (area derivation, field moves, etc.)
  normalizeProperty(result);

  return normalizeNumericValues(result);
}
