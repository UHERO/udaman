/**
 * QPub File Load — Phase 3 of the rebuild pipeline.
 *
 * Reads JSONL table files written by the extract phase and streams
 * INSERT SQL through the `mariadb` CLI. This uses a single CLI
 * connection — no connection pool issues with SET FOREIGN_KEY_CHECKS=0.
 *
 * Tables are loaded in FK-safe order: properties first, then children.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";

import type { Logger } from "@/core/observability/logger";

import { TABLE_COLUMNS, DEFAULT_STAGING_DIR } from "./qpub-extract";
import { GENERIC_SECTION_MAP } from "./qpub-load";

// ─── SQL Escaping ───────────────────────────────────────────────────

type SqlValue = string | number | null;

function escapeSqlValue(v: SqlValue): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  // Escape backslashes, single quotes, and other special chars
  return "'" + String(v)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z") + "'";
}

function columnName(col: string): string {
  // Backtick-quote reserved words
  if (col === "usage") return "`usage`";
  return col;
}

// ─── INSERT Generation ──────────────────────────────────────────────

const INSERT_CHUNK = 2000;

/**
 * Generate INSERT SQL from JSONL rows.
 * Yields chunks of INSERT statements (each up to INSERT_CHUNK rows).
 */
function* generateInserts(
  table: string,
  columns: string[],
  rows: SqlValue[][],
  opts?: { onDuplicate?: string; insertIgnore?: boolean },
): Generator<string> {
  if (rows.length === 0) return;

  const colList = columns.map(columnName).join(", ");
  const prefix = opts?.insertIgnore
    ? `INSERT IGNORE INTO ${table} (${colList}) VALUES`
    : `INSERT INTO ${table} (${colList}) VALUES`;
  const suffix = opts?.onDuplicate ? ` ON DUPLICATE KEY UPDATE ${opts.onDuplicate}` : "";

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const valueParts = chunk.map((row) => {
      const vals = row.map(escapeSqlValue).join(",");
      return `(${vals})`;
    });
    yield `${prefix}\n${valueParts.join(",\n")}${suffix};\n`;
  }
}

// ─── Table Load Order ───────────────────────────────────────────────

/**
 * FK-safe table load order. Properties first (FK parent for everything),
 * condo stub properties second (INSERT IGNORE), then the rest.
 */
const LOAD_ORDER: string[] = [
  "properties",
  "condo_stub_properties",
  "condominium_projects",
  "condominium_units",
  "parcels",
  "owners",
  "assessments",
  "land_classifications",
  "residential_improvements",
  "commercial_improvements",
  "commercial_improvement_details",
  "sales",
  "permits",
  "current_tax_bills",
  "historical_tax_summary",
  "historical_tax_details",
  "historical_tax_payments",
  "historical_tax_credits",
];

// ─── ON DUPLICATE KEY UPDATE clauses ────────────────────────────────

const ON_DUPLICATE: Record<string, string> = {
  properties: [
    "parcel_number=VALUES(parcel_number)", "location_address=VALUES(location_address)",
    "address_other=VALUES(address_other)", "project_name=VALUES(project_name)",
    "legal_information=VALUES(legal_information)", "property_class=VALUES(property_class)",
    "land_area_sqft=VALUES(land_area_sqft)", "land_area_acres=VALUES(land_area_acres)",
    "neighborhood_code=VALUES(neighborhood_code)", "zoning=VALUES(zoning)",
    "parcel_note=VALUES(parcel_note)", "damage=VALUES(damage)",
    "reentry_zone=VALUES(reentry_zone)", "zone_color=VALUES(zone_color)",
    "non_taxable_status=VALUES(non_taxable_status)", "living_units=VALUES(living_units)",
    "map_url=VALUES(map_url)", "sketch_url=VALUES(sketch_url)",
    "updated_at=NOW()",
  ].join(", "),
  assessments: [
    "scraped_at=VALUES(scraped_at)", "property_class=VALUES(property_class)",
    "assessed_land_value=VALUES(assessed_land_value)",
    "assessed_building_value=VALUES(assessed_building_value)",
    "dedicated_use_value=VALUES(dedicated_use_value)",
    "land_exemption=VALUES(land_exemption)", "building_exemption=VALUES(building_exemption)",
    "net_taxable_land_value=VALUES(net_taxable_land_value)",
    "net_taxable_building_value=VALUES(net_taxable_building_value)",
    "total_property_assessed_value=VALUES(total_property_assessed_value)",
    "total_property_exemption=VALUES(total_property_exemption)",
    "total_net_taxable_value=VALUES(total_net_taxable_value)",
    "agricultural_land_value=VALUES(agricultural_land_value)",
    "market_land_value=VALUES(market_land_value)",
    "market_building_value=VALUES(market_building_value)",
    "total_market_value=VALUES(total_market_value)",
  ].join(", "),
  condominium_projects: "project_name=VALUES(project_name), unit_count=VALUES(unit_count)",
  condominium_units: "unit_number=VALUES(unit_number), owner_name=VALUES(owner_name)",
};

// ─── File Reading ───────────────────────────────────────────────────

/**
 * Read a JSONL file and return parsed rows.
 * For generic sections, the first line is a column header.
 */
function readJsonlFile(filePath: string): SqlValue[][] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line) as SqlValue[]);
}

// ─── Main Load Function ─────────────────────────────────────────────

/**
 * Load all extracted table files into the local database via mariadb CLI.
 * Uses a single connection with FK_CHECKS=0 throughout.
 */
export async function loadFromFiles(
  stagingDir: string,
  localAuthArgs: string[],
  dbName: string,
  log: Logger,
): Promise<void> {
  // Build all SQL into a single stream piped to mariadb CLI
  const sqlParts: string[] = [];

  sqlParts.push("SET FOREIGN_KEY_CHECKS=0;\n");
  sqlParts.push("SET UNIQUE_CHECKS=0;\n");
  sqlParts.push("SET autocommit=0;\n");

  let totalRows = 0;

  // Load standard tables in order
  for (const table of LOAD_ORDER) {
    const filePath = path.join(stagingDir, `${table}.jsonl`);
    const rows = readJsonlFile(filePath);
    if (rows.length === 0) continue;

    // Determine columns
    let columns: string[];
    if (table === "condo_stub_properties") {
      columns = TABLE_COLUMNS.condo_stub_properties;
    } else {
      columns = TABLE_COLUMNS[table];
    }

    if (!columns) {
      log.warn({ table }, `No column definition for table ${table}, skipping`);
      continue;
    }

    // Determine insert strategy
    const isStubProperties = table === "condo_stub_properties";
    const actualTable = isStubProperties ? "properties" : table;
    const onDuplicate = ON_DUPLICATE[actualTable];

    for (const sql of generateInserts(actualTable, columns, rows, {
      onDuplicate,
      insertIgnore: isStubProperties,
    })) {
      sqlParts.push(sql);
    }

    totalRows += rows.length;
    log.info({ table: actualTable, rows: rows.length }, `Prepared ${actualTable}: ${rows.length.toLocaleString()} rows`);
  }

  // Load generic section tables
  for (const [, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    const filePath = path.join(stagingDir, `${tableName}.jsonl`);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) continue;

    const lines = content.split("\n");
    if (lines.length < 2) continue; // Need at least header + 1 row

    // First line is column names
    const columns = JSON.parse(lines[0]) as string[];
    const rows = lines.slice(1).map((line) => JSON.parse(line) as SqlValue[]);

    if (rows.length === 0) continue;

    for (const sql of generateInserts(tableName, columns, rows)) {
      sqlParts.push(sql);
    }

    totalRows += rows.length;
    log.info({ table: tableName, rows: rows.length }, `Prepared ${tableName}: ${rows.length.toLocaleString()} rows`);
  }

  sqlParts.push("COMMIT;\n");
  sqlParts.push("SET FOREIGN_KEY_CHECKS=1;\n");
  sqlParts.push("SET UNIQUE_CHECKS=1;\n");

  log.info({ totalRows }, `Streaming ${totalRows.toLocaleString()} total rows to mariadb CLI`);

  // Pipe all SQL through mariadb CLI
  const allSql = sqlParts.join("");
  const proc = Bun.spawn(
    ["mariadb", ...localAuthArgs, dbName],
    { stdin: new Blob([allSql]), stdout: "pipe", stderr: "pipe" },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`mariadb load failed (exit ${exitCode}): ${stderr}`);
  }

  log.info("Load into local database complete");
}

/**
 * Load a single table (and its children) from extracted files.
 */
export async function loadTableFromFiles(
  table: string,
  stagingDir: string,
  localAuthArgs: string[],
  dbName: string,
  log: Logger,
): Promise<void> {
  const sqlParts: string[] = [];

  sqlParts.push("SET FOREIGN_KEY_CHECKS=0;\n");
  sqlParts.push("SET UNIQUE_CHECKS=0;\n");
  sqlParts.push("SET autocommit=0;\n");

  // Always load properties first (FK parent)
  const propFile = path.join(stagingDir, "properties.jsonl");
  const propRows = readJsonlFile(propFile);
  if (propRows.length > 0) {
    for (const sql of generateInserts("properties", TABLE_COLUMNS.properties, propRows, {
      onDuplicate: ON_DUPLICATE.properties,
    })) {
      sqlParts.push(sql);
    }
    log.info({ rows: propRows.length }, `Prepared properties: ${propRows.length.toLocaleString()} rows`);
  }

  // Load condo stub properties if doing condominium table
  if (table === "condominium") {
    const stubFile = path.join(stagingDir, "condo_stub_properties.jsonl");
    const stubRows = readJsonlFile(stubFile);
    if (stubRows.length > 0) {
      for (const sql of generateInserts("properties", TABLE_COLUMNS.condo_stub_properties, stubRows, {
        insertIgnore: true,
      })) {
        sqlParts.push(sql);
      }
    }
  }

  // Determine which files to load for this table
  const tableFiles = resolveTableFiles(table);

  for (const tf of tableFiles) {
    const filePath = path.join(stagingDir, `${tf}.jsonl`);

    // Check if this is a generic section with header line
    const isGeneric = Object.values(GENERIC_SECTION_MAP).includes(tf);

    if (isGeneric) {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, "utf-8").trim();
      if (!content) continue;
      const lines = content.split("\n");
      if (lines.length < 2) continue;
      const columns = JSON.parse(lines[0]) as string[];
      const rows = lines.slice(1).map((line) => JSON.parse(line) as SqlValue[]);
      if (rows.length === 0) continue;
      for (const sql of generateInserts(tf, columns, rows)) {
        sqlParts.push(sql);
      }
      log.info({ table: tf, rows: rows.length }, `Prepared ${tf}: ${rows.length.toLocaleString()} rows`);
    } else {
      const rows = readJsonlFile(filePath);
      if (rows.length === 0) continue;
      const columns = TABLE_COLUMNS[tf];
      if (!columns) continue;
      const onDuplicate = ON_DUPLICATE[tf];
      for (const sql of generateInserts(tf, columns, rows, { onDuplicate })) {
        sqlParts.push(sql);
      }
      log.info({ table: tf, rows: rows.length }, `Prepared ${tf}: ${rows.length.toLocaleString()} rows`);
    }
  }

  sqlParts.push("COMMIT;\n");
  sqlParts.push("SET FOREIGN_KEY_CHECKS=1;\n");
  sqlParts.push("SET UNIQUE_CHECKS=1;\n");

  const allSql = sqlParts.join("");
  const proc = Bun.spawn(
    ["mariadb", ...localAuthArgs, dbName],
    { stdin: new Blob([allSql]), stdout: "pipe", stderr: "pipe" },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`mariadb load failed (exit ${exitCode}): ${stderr}`);
  }

  log.info({ table }, `Load of ${table} into local database complete`);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Resolve a logical table name to the JSONL file names to load */
function resolveTableFiles(table: string): string[] {
  switch (table) {
    case "commercial_improvements":
      return ["commercial_improvements", "commercial_improvement_details"];
    case "historical_tax":
      return ["historical_tax_summary", "historical_tax_details", "historical_tax_payments", "historical_tax_credits"];
    case "condominium":
      return ["condominium_projects", "condominium_units"];
    default: {
      // Check if it's a generic section
      const genericEntry = Object.entries(GENERIC_SECTION_MAP).find(([, t]) => t === table);
      if (genericEntry) return [genericEntry[1]];
      return [table];
    }
  }
}
