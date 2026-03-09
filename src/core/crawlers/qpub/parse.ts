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
import { SECTION_PARSERS } from "./parse-sections";
import { cleanText, normalizeNumericValues } from "./parse-utils";

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

  const strongTags = root.querySelectorAll("strong");
  const hasParcelNumber = Array.from(strongTags).some(
    (tag) => tag.textContent && tag.textContent.includes("Parcel Number"),
  );

  if (hasParcelNumber) {
    return "success";
  }

  return "unknown";
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

      let value = cleanText(td.textContent);

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
    const sectionTitle = getSectionTitle(section);
    if (!sectionTitle) return;

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
        if (src) {
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

    // Special handling for Condominium/Apartment Unit Information section
    if (
      sectionTitle === "condominium_apartment_unit_information" &&
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

  return normalizeNumericValues(result);
}
