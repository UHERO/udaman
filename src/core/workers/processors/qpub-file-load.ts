/**
 * QPub File Load — Phase 3 of the rebuild pipeline.
 *
 * Reads JSONL table files written by the extract phase and streams
 * INSERT SQL through the `mariadb` CLI. This uses a single CLI
 * connection — no connection pool issues with SET FOREIGN_KEY_CHECKS=0.
 *
 * SQL is streamed incrementally — we never hold more than one INSERT
 * chunk (~2000 rows) in memory at a time, handling tables with millions
 * of rows without issue.
 *
 * Tables are loaded in FK-safe order: properties first, then children.
 */

import { createReadStream, existsSync } from "fs";
import { createInterface } from "readline";
import path from "path";

import type { Logger } from "@/core/observability/logger";

import { TABLE_COLUMNS } from "./qpub-extract";

// ─── SQL Escaping ───────────────────────────────────────────────────

type SqlValue = string | number | null;

function escapeSqlValue(v: SqlValue): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z") + "'";
}

function columnName(col: string): string {
  if (col === "usage") return "`usage`";
  return col;
}

// ─── Streaming INSERT Writer ────────────────────────────────────────

const INSERT_CHUNK = 2000;

function buildInsert(
  table: string,
  columns: string[],
  rows: SqlValue[][],
  opts?: { onDuplicate?: string; insertIgnore?: boolean },
): string {
  const colList = columns.map(columnName).join(", ");
  const prefix = opts?.insertIgnore
    ? `INSERT IGNORE INTO ${table} (${colList}) VALUES`
    : `INSERT INTO ${table} (${colList}) VALUES`;
  const suffix = opts?.onDuplicate ? ` ON DUPLICATE KEY UPDATE ${opts.onDuplicate}` : "";

  const valueParts = rows.map((row) => {
    const vals = row.map(escapeSqlValue).join(",");
    return `(${vals})`;
  });

  return `${prefix}\n${valueParts.join(",\n")}${suffix};\n`;
}

// ─── SqlWriter — wraps mariadb stdin with error handling ────────────

/**
 * Wraps a mariadb CLI process. Captures stderr in the background so
 * that when the pipe breaks we can report the actual mariadb error,
 * not just "EPIPE".
 */
class SqlWriter {
  private proc: ReturnType<typeof Bun.spawn>;
  private stdin: ReturnType<typeof Bun.spawn>["stdin"] & { write: Function; end: Function };
  private stderrPromise: Promise<string>;
  private broken = false;
  private brokenError: string | null = null;

  constructor(args: string[]) {
    this.proc = Bun.spawn(args, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    // Cast stdin — we know it's a FileSink because we passed stdin: "pipe"
    this.stdin = this.proc.stdin as any;
    // Start reading stderr immediately in background
    this.stderrPromise = new Response(this.proc.stderr as ReadableStream).text();
  }

  /** Write SQL to mariadb stdin. Silently stops if pipe is already broken. */
  async write(sql: string): Promise<void> {
    if (this.broken) return;
    try {
      const result = this.stdin.write(sql);
      // Bun's FileSink.write() returns Promise on backpressure — must await
      // to catch EPIPE when mariadb exits mid-stream
      if (result instanceof Promise) {
        await result;
      }
    } catch (e) {
      this.broken = true;
      this.brokenError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Returns true if the pipe broke during writes. */
  get isBroken(): boolean {
    return this.broken;
  }

  /**
   * Close stdin and wait for mariadb to exit.
   * Throws with the actual mariadb error message if it failed.
   */
  async finish(): Promise<void> {
    if (!this.broken) {
      try {
        this.stdin.end();
      } catch {
        this.broken = true;
      }
    }

    const exitCode = await this.proc.exited;
    const stderr = (await this.stderrPromise).trim();

    if (exitCode !== 0 || this.broken) {
      const detail = stderr || this.brokenError || "unknown error";
      throw new Error(`mariadb failed (exit ${exitCode}): ${detail}`);
    }
  }
}

// ─── Streaming File Loaders ─────────────────────────────────────────

/**
 * Stream a JSONL file through the writer, sending INSERT chunks as we go.
 * Reads line-by-line so memory stays constant regardless of file size.
 * Stops early if the pipe breaks.
 */
async function streamJsonlFile(
  filePath: string,
  table: string,
  columns: string[],
  writer: SqlWriter,
  log: Logger,
  opts?: { onDuplicate?: string; insertIgnore?: boolean },
): Promise<number> {
  if (!existsSync(filePath) || writer.isBroken) return 0;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let buffer: SqlValue[][] = [];
  let totalRows = 0;

  for await (const line of rl) {
    if (!line || writer.isBroken) continue;
    buffer.push(JSON.parse(line) as SqlValue[]);

    if (buffer.length >= INSERT_CHUNK) {
      await writer.write(buildInsert(table, columns, buffer, opts));
      totalRows += buffer.length;
      buffer = [];
    }
  }

  if (buffer.length > 0 && !writer.isBroken) {
    await writer.write(buildInsert(table, columns, buffer, opts));
    totalRows += buffer.length;
  }

  if (totalRows > 0) {
    log.info(
      { table, rows: totalRows },
      `Loaded ${table}: ${totalRows.toLocaleString()} rows`,
    );
  }

  return totalRows;
}

// ─── Table Load Order ───────────────────────────────────────────────

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
  "yard_improvements",
  "residential_additions",
  "agricultural_assessments",
  "accessory_structures",
  "appeals",
  "dedications",
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

// ─── Main Load Function ─────────────────────────────────────────────

/**
 * Load all extracted table files into the local database via mariadb CLI.
 * Streams SQL incrementally — constant memory regardless of table size.
 */
export async function loadFromFiles(
  stagingDir: string,
  localAuthArgs: string[],
  dbName: string,
  log: Logger,
): Promise<void> {
  const writer = new SqlWriter(["mariadb", ...localAuthArgs, dbName]);

  // Disable strict mode so any remaining oversized scraped values truncate instead of aborting
  await writer.write("SET SESSION sql_mode='';\n");
  await writer.write("SET FOREIGN_KEY_CHECKS=0;\n");
  await writer.write("SET UNIQUE_CHECKS=0;\n");
  await writer.write("SET autocommit=0;\n");

  let totalRows = 0;

  for (const table of LOAD_ORDER) {
    if (writer.isBroken) break;

    const filePath = path.join(stagingDir, `${table}.jsonl`);
    const isStubProperties = table === "condo_stub_properties";
    const actualTable = isStubProperties ? "properties" : table;
    const columns = isStubProperties
      ? TABLE_COLUMNS.condo_stub_properties
      : TABLE_COLUMNS[table];

    if (!columns) {
      log.warn({ table }, `No column definition for table ${table}, skipping`);
      continue;
    }

    const onDuplicate = ON_DUPLICATE[actualTable];
    const rows = await streamJsonlFile(filePath, actualTable, columns, writer, log, {
      onDuplicate,
      insertIgnore: isStubProperties,
    });

    totalRows += rows;

    if (rows > 0 && !writer.isBroken) {
      await writer.write("COMMIT;\nSET autocommit=0;\n");
    }
  }

  if (!writer.isBroken) {
    await writer.write("COMMIT;\n");
    await writer.write("SET FOREIGN_KEY_CHECKS=1;\n");
    await writer.write("SET UNIQUE_CHECKS=1;\n");
  }

  log.info({ totalRows }, `Streamed ${totalRows.toLocaleString()} total rows to mariadb CLI`);

  // finish() closes stdin, waits for exit, and throws with stderr on failure
  await writer.finish();

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
  const writer = new SqlWriter(["mariadb", ...localAuthArgs, dbName]);

  // Disable strict mode so any remaining oversized scraped values truncate instead of aborting
  await writer.write("SET SESSION sql_mode='';\n");
  await writer.write("SET FOREIGN_KEY_CHECKS=0;\n");
  await writer.write("SET UNIQUE_CHECKS=0;\n");
  await writer.write("SET autocommit=0;\n");

  // Always load properties first (FK parent)
  const propFile = path.join(stagingDir, "properties.jsonl");
  const propRows = await streamJsonlFile(
    propFile, "properties", TABLE_COLUMNS.properties, writer, log,
    { onDuplicate: ON_DUPLICATE.properties },
  );
  if (propRows > 0 && !writer.isBroken) {
    await writer.write("COMMIT;\nSET autocommit=0;\n");
  }

  // Load condo stub properties if doing condominium table
  if (table === "condominium" && !writer.isBroken) {
    const stubFile = path.join(stagingDir, "condo_stub_properties.jsonl");
    const stubRows = await streamJsonlFile(
      stubFile, "properties", TABLE_COLUMNS.condo_stub_properties, writer, log,
      { insertIgnore: true },
    );
    if (stubRows > 0 && !writer.isBroken) {
      await writer.write("COMMIT;\nSET autocommit=0;\n");
    }
  }

  const tableFiles = resolveTableFiles(table);

  for (const tf of tableFiles) {
    if (writer.isBroken) break;

    const filePath = path.join(stagingDir, `${tf}.jsonl`);
    const columns = TABLE_COLUMNS[tf];
    if (!columns) continue;
    const onDuplicate = ON_DUPLICATE[tf];
    const rows = await streamJsonlFile(filePath, tf, columns, writer, log, { onDuplicate });

    if (rows > 0 && !writer.isBroken) {
      await writer.write("COMMIT;\nSET autocommit=0;\n");
    }
  }

  if (!writer.isBroken) {
    await writer.write("COMMIT;\n");
    await writer.write("SET FOREIGN_KEY_CHECKS=1;\n");
    await writer.write("SET UNIQUE_CHECKS=1;\n");
  }

  await writer.finish();

  log.info({ table }, `Load of ${table} into local database complete`);
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveTableFiles(table: string): string[] {
  switch (table) {
    case "commercial_improvements":
      return ["commercial_improvements", "commercial_improvement_details"];
    case "historical_tax":
      return ["historical_tax_summary", "historical_tax_details", "historical_tax_payments", "historical_tax_credits"];
    case "condominium":
      return ["condominium_projects", "condominium_units"];
    default:
      return [table];
  }
}
