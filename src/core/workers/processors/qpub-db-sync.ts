/**
 * QPub Database Sync — local DB preparation and remote sync.
 *
 * Rebuild loads data into a local MariaDB (hawaii_housing_rebuild),
 * then pipes a dump directly to the remote production database.
 */

import path from "path";
import type { Logger } from "@/core/observability/logger";
import { errorMessage } from "./qpub-load";

// ─── Paths ───────────────────────────────────────────────────────

const SCHEMA_PATH = path.resolve("src/lib/hhdb/hhdb-schema.sql");
const FREQ_TABLES_PATH = path.resolve("src/lib/hhdb/hhdb-freq-tables.sql");

// ─── Local DB config ─────────────────────────────────────────────

const LOCAL_DB_HOST = process.env.HH_LOCAL_DB_HOST ?? "localhost";
const LOCAL_DB_PORT = process.env.HH_LOCAL_DB_PORT ?? "3306";
const LOCAL_DB_USER = process.env.HH_LOCAL_DB_USER ?? "root";
const LOCAL_DB_PSWD = process.env.HH_LOCAL_DB_PSWD ?? "";
const LOCAL_DB_NAME = process.env.HH_LOCAL_DB_NAME ?? "hawaii_housing_rebuild";

// ─── Remote DB config ────────────────────────────────────────────

const REMOTE_DB_HOST = process.env.HH_DB_HOST ?? "localhost";
const REMOTE_DB_PORT = process.env.HH_DB_PORT ?? "3306";
const REMOTE_DB_USER = process.env.HH_DB_USER ?? "root";
const REMOTE_DB_PSWD = process.env.HH_DB_PSWD ?? "";
const REMOTE_DB_NAME = process.env.HH_DB_NAME ?? "hawaii_housing_database";

// ─── Table groups for single-table sync ──────────────────────────

/** Tables with FK children that must be dumped together */
const TABLE_GROUPS: Record<string, string[]> = {
  commercial_improvements: ["commercial_improvements", "commercial_improvement_details"],
  historical_tax: [
    "historical_tax_summary",
    "historical_tax_details",
    "historical_tax_payments",
    "historical_tax_credits",
  ],
  condominium: ["condominium_projects", "condominium_units"],
};

/** Resolve a logical table name to the actual DB tables to dump */
function resolveDumpTables(table: string): string[] {
  if (TABLE_GROUPS[table]) return TABLE_GROUPS[table];
  return [table];
}

// ─── Helpers ─────────────────────────────────────────────────────

function localAuthArgs(): string[] {
  const args = [`--host=${LOCAL_DB_HOST}`, `--port=${LOCAL_DB_PORT}`, `--user=${LOCAL_DB_USER}`];
  if (LOCAL_DB_PSWD) args.push(`--password=${LOCAL_DB_PSWD}`);
  return args;
}

function remoteAuthArgs(): string[] {
  const args = [`--host=${REMOTE_DB_HOST}`, `--port=${REMOTE_DB_PORT}`, `--user=${REMOTE_DB_USER}`];
  if (REMOTE_DB_PSWD) args.push(`--password=${REMOTE_DB_PSWD}`);
  return args;
}

async function runSpawn(cmd: string[], opts?: { stdin?: string }): Promise<void> {
  const proc = Bun.spawn(cmd, {
    stdin: opts?.stdin ? new Blob([opts.stdin]) : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Command failed (exit ${exitCode}): ${cmd.join(" ")}\n${stderr}`);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Create (or recreate) the local rebuild database and apply the schema.
 * This gives a clean slate for every rebuild.
 */
export async function prepareLocalDb(log: Logger): Promise<void> {
  log.info("Preparing local rebuild database");

  // Create database
  await runSpawn([
    "mariadb",
    ...localAuthArgs(),
    "-e",
    `DROP DATABASE IF EXISTS ${LOCAL_DB_NAME}; CREATE DATABASE ${LOCAL_DB_NAME}`,
  ]);

  // Apply schema
  const schema = await Bun.file(SCHEMA_PATH).text();
  await runSpawn(["mariadb", ...localAuthArgs(), LOCAL_DB_NAME], { stdin: schema });

  log.info("Local rebuild database ready");
}

/**
 * Dump all rebuilt tables from local DB and pipe directly into remote DB.
 * Remote-only tables (scrape_status, tg_transactions, freq_*) are untouched.
 */
export async function syncToRemote(log: Logger): Promise<void> {
  log.info("Syncing local rebuild database to remote");

  // Dump from local, pipe into remote — no intermediate file
  const dumpProc = Bun.spawn(
    [
      "mariadb-dump",
      ...localAuthArgs(),
      "--single-transaction",
      "--quick",
      "--skip-lock-tables",
      "--no-create-db",
      LOCAL_DB_NAME,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const importProc = Bun.spawn(
    ["mariadb", ...remoteAuthArgs(), REMOTE_DB_NAME],
    { stdin: dumpProc.stdout, stdout: "pipe", stderr: "pipe" },
  );

  // Wait for both to finish
  const [dumpExit, importExit] = await Promise.all([dumpProc.exited, importProc.exited]);

  if (dumpExit !== 0) {
    const stderr = await new Response(dumpProc.stderr).text();
    throw new Error(`mariadb-dump failed (exit ${dumpExit}): ${stderr}`);
  }

  if (importExit !== 0) {
    const stderr = await new Response(importProc.stderr).text();
    throw new Error(`mariadb import failed (exit ${importExit}): ${stderr}`);
  }

  log.info("Dump + import complete, regenerating frequency tables on remote");

  // Re-run frequency tables on remote
  const freqSql = await Bun.file(FREQ_TABLES_PATH).text();
  await runSpawn(["mariadb", ...remoteAuthArgs(), REMOTE_DB_NAME], { stdin: freqSql });

  log.info("Sync to remote complete");
}

/**
 * Dump specific table(s) from local DB and pipe into remote.
 * Tables with FK children (commercial_improvements, historical_tax, condominium)
 * dump the parent + children together. Properties is always included.
 */
export async function syncTableToRemote(table: string, log: Logger): Promise<void> {
  const tables = resolveDumpTables(table);

  // Always include properties (FK parent for everything)
  if (!tables.includes("properties")) {
    tables.unshift("properties");
  }

  log.info({ tables }, "Syncing tables to remote");

  const dumpProc = Bun.spawn(
    [
      "mariadb-dump",
      ...localAuthArgs(),
      "--single-transaction",
      "--quick",
      "--skip-lock-tables",
      "--no-create-db",
      LOCAL_DB_NAME,
      "--tables",
      ...tables,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const importProc = Bun.spawn(
    ["mariadb", ...remoteAuthArgs(), REMOTE_DB_NAME],
    { stdin: dumpProc.stdout, stdout: "pipe", stderr: "pipe" },
  );

  const [dumpExit, importExit] = await Promise.all([dumpProc.exited, importProc.exited]);

  if (dumpExit !== 0) {
    const stderr = await new Response(dumpProc.stderr).text();
    throw new Error(`mariadb-dump failed (exit ${dumpExit}): ${stderr}`);
  }

  if (importExit !== 0) {
    const stderr = await new Response(importProc.stderr).text();
    throw new Error(`mariadb import failed (exit ${importExit}): ${stderr}`);
  }

  log.info("Table sync complete, regenerating frequency tables on remote");

  // Re-run frequency tables on remote
  const freqSql = await Bun.file(FREQ_TABLES_PATH).text();
  await runSpawn(["mariadb", ...remoteAuthArgs(), REMOTE_DB_NAME], { stdin: freqSql });

  log.info({ tables }, "Table sync to remote complete");
}
