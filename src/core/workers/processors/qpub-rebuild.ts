/**
 * QPub Rebuild — 3-Phase Pipeline
 *
 * Phase 1: Parse — HTML → JSON files (per property, cached on NAS)
 * Phase 2: Extract — JSON → flat JSONL files (one per DB table)
 * Phase 3: Load — Stream INSERT SQL through mariadb CLI into local DB
 * Sync: Dump local DB → pipe to remote
 *
 * Each phase can be run independently via CLI, or all together via
 * rebuild-all / rebuild-table.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

import {
  getJsonPath,
  listHtmlFiles,
  tmkFromFilePath,
  getFileMtime,
} from "@/core/crawlers/qpub/config";
import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { getMaxTaxYear, errorMessage, TABLE_LOADERS } from "./qpub-load";
import {
  type ExtractItem,
  extractBatch,
  initStagingDir,
  resetIdCounters,
  DEFAULT_STAGING_DIR,
} from "./qpub-extract";
import { loadFromFiles, loadTableFromFiles } from "./qpub-file-load";
import { prepareLocalDb, syncToRemote, syncTableToRemote } from "./qpub-db-sync";

const log = createLogger("qpub-rebuild");

// ─── Types ──────────────────────────────────────────────────────────

export type RebuildOptions = {
  /** Filter by island code ('1','2','3','4') */
  island?: string;
  /** NAS period dir (e.g., '2026-1'). Default: all available periods */
  period?: string;
  /** Force re-parse even when JSON is newer than HTML */
  forceParse?: boolean;
};

// ─── Constants ──────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const STATUS_CHUNK_SIZE = 1000;

// ─── Local DB Config ────────────────────────────────────────────────

const LOCAL_DB_HOST = process.env.HH_LOCAL_DB_HOST ?? "localhost";
const LOCAL_DB_PORT = process.env.HH_LOCAL_DB_PORT ?? "3306";
const LOCAL_DB_USER = process.env.HH_LOCAL_DB_USER ?? "root";
const LOCAL_DB_PSWD = process.env.HH_LOCAL_DB_PSWD ?? "";
const LOCAL_DB_NAME = process.env.HH_LOCAL_DB_NAME ?? "hawaii_housing_rebuild";

function localAuthArgs(): string[] {
  const args = [`--host=${LOCAL_DB_HOST}`, `--port=${LOCAL_DB_PORT}`, `--user=${LOCAL_DB_USER}`];
  if (LOCAL_DB_PSWD) args.push(`--password=${LOCAL_DB_PSWD}`);
  return args;
}

// ─── File Collection ────────────────────────────────────────────────

function collectFiles(period?: string, island?: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  for (const filePath of listHtmlFiles(period, island)) {
    const tmk = tmkFromFilePath(filePath);
    fileMap.set(tmk, filePath);
  }
  return fileMap;
}

// ─── Parse Helpers ──────────────────────────────────────────────────

function parseAndWriteJson(tmk: string, filePath: string): ParsedProperty | null {
  const html = readFileSync(filePath, "utf-8");
  const parsed = parsePropertyHTML(html, tmk);

  if (parsed.status !== "success" && parsed.status !== "condo_project") {
    return null;
  }

  const jsonDir = getJsonPath(tmk);
  if (!existsSync(jsonDir)) {
    mkdirSync(jsonDir, { recursive: true });
  }
  writeFileSync(
    path.join(jsonDir, `${tmk}.json`),
    JSON.stringify(parsed, null, 2),
  );

  return parsed;
}

function parseOrReadCached(tmk: string, htmlPath: string, forceParse: boolean): ParsedProperty | null {
  if (!forceParse) {
    const jsonDir = getJsonPath(tmk);
    const jsonFile = path.join(jsonDir, `${tmk}.json`);

    if (existsSync(jsonFile)) {
      try {
        const jsonMtime = statSync(jsonFile).mtimeMs;
        const htmlMtime = statSync(htmlPath).mtimeMs;

        if (jsonMtime > htmlMtime) {
          const data = JSON.parse(readFileSync(jsonFile, "utf-8")) as ParsedProperty;
          if (data.status === "success" || data.status === "condo_project") {
            return data;
          }
        }
      } catch {
        // Fall through to parse
      }
    }
  }

  return parseAndWriteJson(tmk, htmlPath);
}

// ─── Status Helpers (always on remote) ──────────────────────────────

async function setAllPending(tmks: string[]): Promise<void> {
  for (let i = 0; i < tmks.length; i += STATUS_CHUNK_SIZE) {
    const batch = tmks.slice(i, i + STATUS_CHUNK_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    await rawQuery(
      `UPDATE scrape_status SET load_status='pending', error=NULL WHERE tmk IN (${placeholders})`,
      batch,
    );
  }
}

async function flushSuccess(tmks: string[]): Promise<void> {
  if (tmks.length === 0) return;
  for (let i = 0; i < tmks.length; i += STATUS_CHUNK_SIZE) {
    const batch = tmks.slice(i, i + STATUS_CHUNK_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    await rawQuery(
      `UPDATE scrape_status SET load_status='success', loaded_at=NOW(), error=NULL WHERE tmk IN (${placeholders})`,
      batch,
    );
  }
}

async function flushFailed(failures: Array<{ tmk: string; error: string }>): Promise<void> {
  for (const { tmk, error } of failures) {
    await rawQuery(
      `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
      [error.slice(0, 500), tmk],
    );
  }
}

// ─── Batch Parse + Extract ──────────────────────────────────────────

function parseBatchToItems(
  tmks: string[],
  fileMap: Map<string, string>,
  forceParse: boolean,
): { items: ExtractItem[]; parseErrors: Array<{ tmk: string; error: string }> } {
  const items: ExtractItem[] = [];
  const parseErrors: Array<{ tmk: string; error: string }> = [];

  for (const tmk of tmks) {
    const filePath = fileMap.get(tmk)!;
    try {
      const parsed = parseOrReadCached(tmk, filePath, forceParse);
      if (!parsed) {
        parseErrors.push({ tmk, error: "Parse returned non-success status" });
        continue;
      }

      const scrapedAt = getFileMtime(filePath);
      const observedYear = getMaxTaxYear(parsed);
      items.push({ tmk, data: parsed, scrapedAt, observedYear });
    } catch (e) {
      parseErrors.push({ tmk, error: errorMessage(e) });
    }
  }

  return { items, parseErrors };
}

// ─── Individual Phase Functions ─────────────────────────────────────

/**
 * Phase 1+2: Parse HTML → JSON, then extract JSON → JSONL table files.
 * Returns the list of errors encountered during parsing.
 */
export async function runParseAndExtract(opts: RebuildOptions = {}): Promise<string> {
  const { island, period, forceParse = false } = opts;

  log.info({ island, period, forceParse }, "Parse+Extract started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());
  const total = tmks.length;

  if (total === 0) {
    log.info("Parse+Extract: no files found");
    return "Parse+Extract: no files found";
  }

  const startMs = Date.now();
  const allErrors: Array<{ tmk: string; error: string }> = [];

  await prepareLocalDb(log);

  const stagingDir = DEFAULT_STAGING_DIR;
  initStagingDir(stagingDir);
  resetIdCounters();

  const totalBatches = Math.ceil(tmks.length / BATCH_SIZE);

  for (let i = 0; i < tmks.length; i += BATCH_SIZE) {
    const batchTmks = tmks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { items, parseErrors } = parseBatchToItems(batchTmks, fileMap, forceParse);
    allErrors.push(...parseErrors);

    if (items.length > 0) {
      extractBatch(items, stagingDir);
    }

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      const processed = Math.min(i + BATCH_SIZE, total);
      const pct = ((processed / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      log.info(
        { batch: `${batchNum}/${totalBatches}`, processed, total, pct: `${pct}%`, elapsed: `${elapsed}s` },
        `Parse+Extract: batch ${batchNum}/${totalBatches} — ${processed.toLocaleString()}/${total.toLocaleString()} (${pct}%, ${elapsed}s)`,
      );
    }
  }

  // Write errors file and log summary breakdown
  if (allErrors.length > 0) {
    const errorsFile = path.join(stagingDir, "errors.jsonl");
    const lines = allErrors.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(errorsFile, lines);

    const counts: Record<string, number> = {};
    for (const { error } of allErrors) {
      counts[error] = (counts[error] ?? 0) + 1;
    }
    log.info({ errorBreakdown: counts }, `Parse errors: ${allErrors.length} total`);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const errorCount = allErrors.length;
  const summary = `Parse+Extract: ${total - errorCount} extracted, ${errorCount} errors (${total} total, ${elapsed}s). Files at ${stagingDir}`;
  log.info(summary);
  return summary;
}

/**
 * Phase 3: Load extracted JSONL files into local database via mariadb CLI.
 * Assumes parse+extract has already been run and files exist in staging dir.
 */
export async function runLoad(opts: { table?: string } = {}): Promise<string> {
  const stagingDir = DEFAULT_STAGING_DIR;

  if (!existsSync(stagingDir)) {
    throw new Error(`Staging directory ${stagingDir} does not exist. Run parse+extract first.`);
  }

  // Prepare local DB (clean slate)
  await prepareLocalDb(log);

  const startMs = Date.now();

  if (opts.table) {
    log.info({ table: opts.table }, "Loading single table from extracted files");
    await loadTableFromFiles(opts.table, stagingDir, localAuthArgs(), LOCAL_DB_NAME, log);
  } else {
    log.info("Loading all tables from extracted files");
    await loadFromFiles(stagingDir, localAuthArgs(), LOCAL_DB_NAME, log);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary = `Load: complete (${elapsed}s). Data in local DB ${LOCAL_DB_NAME}`;
  log.info(summary);
  return summary;
}

/**
 * Sync: Dump local database to remote, then update scrape_status.
 */
export async function runSync(opts: { table?: string; island?: string; period?: string } = {}): Promise<string> {
  const startMs = Date.now();

  if (opts.table) {
    log.info({ table: opts.table }, "Syncing table to remote");
    await syncTableToRemote(opts.table, log);
  } else {
    log.info("Syncing all tables to remote");
    await syncToRemote(log);
  }

  // Update scrape_status — mark all matching TMKs as success
  // (errors were already tracked during parse+extract)
  const fileMap = collectFiles(opts.period, opts.island);
  const tmks = Array.from(fileMap.keys());

  if (tmks.length > 0) {
    await flushSuccess(tmks);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary = `Sync: complete (${elapsed}s). ${tmks.length} TMKs marked as success`;
  log.info(summary);
  return summary;
}

// ─── Combined Entry Points ──────────────────────────────────────────

/**
 * Rebuild all tables using the full 3-phase pipeline.
 */
export async function rebuildAll(opts: RebuildOptions = {}): Promise<string> {
  const { island, period, forceParse = false } = opts;

  log.info({ island, period, forceParse }, "Rebuild all (pipeline) started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());
  const total = tmks.length;

  if (total === 0) {
    log.info("Rebuild all: no files found");
    return "Rebuild all: no files found";
  }

  const startMs = Date.now();
  const allErrors: Array<{ tmk: string; error: string }> = [];

  // Phase 0: Prepare local DB and staging directory
  await prepareLocalDb(log);

  log.info({ total }, "Setting all TMKs to pending");
  await setAllPending(tmks);

  const stagingDir = DEFAULT_STAGING_DIR;
  initStagingDir(stagingDir);
  resetIdCounters();

  const totalBatches = Math.ceil(tmks.length / BATCH_SIZE);

  // Phase 1+2: Parse and Extract
  log.info({ total, batchSize: BATCH_SIZE, totalBatches }, "Phase 1+2: Parse + Extract");

  for (let i = 0; i < tmks.length; i += BATCH_SIZE) {
    const batchTmks = tmks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { items, parseErrors } = parseBatchToItems(batchTmks, fileMap, forceParse);
    allErrors.push(...parseErrors);

    if (items.length > 0) {
      extractBatch(items, stagingDir);
    }

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      const processed = Math.min(i + BATCH_SIZE, total);
      const pct = ((processed / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      log.info(
        { batch: `${batchNum}/${totalBatches}`, processed, total, pct: `${pct}%`, elapsed: `${elapsed}s` },
        `Parse+Extract: batch ${batchNum}/${totalBatches} — ${processed.toLocaleString()}/${total.toLocaleString()} (${pct}%, ${elapsed}s)`,
      );
    }
  }

  const parseElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  log.info({ elapsed: `${parseElapsed}s`, errors: allErrors.length }, "Phase 1+2 complete");

  // Phase 3: Load into local DB via mariadb CLI
  log.info("Phase 3: Loading extracted files into local database");
  const loadStartMs = Date.now();

  await loadFromFiles(stagingDir, localAuthArgs(), LOCAL_DB_NAME, log);

  const loadElapsed = ((Date.now() - loadStartMs) / 1000).toFixed(1);
  log.info({ elapsed: `${loadElapsed}s` }, "Phase 3 complete");

  // Sync: Dump local → remote
  log.info("Syncing local database to remote");
  await syncToRemote(log);

  // Update scrape_status on remote
  const failedTmks = new Set(allErrors.map((e) => e.tmk));
  const succeededTmks = tmks.filter((t) => !failedTmks.has(t));

  await flushSuccess(succeededTmks);
  if (allErrors.length > 0) {
    await flushFailed(allErrors);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary = `Rebuild all: ${succeededTmks.length} done, ${failedTmks.size} failed (${total} total, ${elapsed}s)`;
  log.info(summary);
  return summary;
}

/**
 * Rebuild a single table using the full 3-phase pipeline.
 */
export async function rebuildTable(
  table: string,
  opts: RebuildOptions = {},
): Promise<string> {
  const { island, period, forceParse = false } = opts;

  if (!TABLE_LOADERS[table]) {
    const valid = Object.keys(TABLE_LOADERS).join(", ");
    throw new Error(`Unknown table "${table}". Valid tables: ${valid}`);
  }

  log.info({ table, island, period, forceParse }, "Rebuild table (pipeline) started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());
  const total = tmks.length;

  if (total === 0) {
    log.info({ table }, "Rebuild table: no files found");
    return `Rebuild ${table}: no files found`;
  }

  const startMs = Date.now();
  const allErrors: Array<{ tmk: string; error: string }> = [];

  await prepareLocalDb(log);

  log.info({ total, table }, "Setting all TMKs to pending");
  await setAllPending(tmks);

  const stagingDir = DEFAULT_STAGING_DIR;
  initStagingDir(stagingDir);
  resetIdCounters();

  const totalBatches = Math.ceil(tmks.length / BATCH_SIZE);

  // Phase 1+2: Parse and Extract
  log.info({ total, table, batchSize: BATCH_SIZE, totalBatches }, "Phase 1+2: Parse + Extract");

  for (let i = 0; i < tmks.length; i += BATCH_SIZE) {
    const batchTmks = tmks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { items, parseErrors } = parseBatchToItems(batchTmks, fileMap, forceParse);
    allErrors.push(...parseErrors);

    const extractItems = table === "condominium"
      ? items.filter((item) => item.data.status === "condo_project")
      : items;

    if (extractItems.length > 0) {
      extractBatch(extractItems, stagingDir);
    }

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      const processed = Math.min(i + BATCH_SIZE, total);
      const pct = ((processed / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      log.info(
        { table, batch: `${batchNum}/${totalBatches}`, processed, total, pct: `${pct}%`, elapsed: `${elapsed}s` },
        `Parse+Extract ${table}: batch ${batchNum}/${totalBatches} — ${processed.toLocaleString()}/${total.toLocaleString()} (${pct}%, ${elapsed}s)`,
      );
    }
  }

  const parseElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  log.info({ table, elapsed: `${parseElapsed}s`, errors: allErrors.length }, "Phase 1+2 complete");

  // Phase 3: Load into local DB
  log.info({ table }, "Phase 3: Loading extracted files into local database");
  const loadStartMs = Date.now();

  await loadTableFromFiles(table, stagingDir, localAuthArgs(), LOCAL_DB_NAME, log);

  const loadElapsed = ((Date.now() - loadStartMs) / 1000).toFixed(1);
  log.info({ table, elapsed: `${loadElapsed}s` }, "Phase 3 complete");

  // Sync
  log.info({ table }, "Syncing table to remote");
  await syncTableToRemote(table, log);

  // Update scrape_status
  const failedTmks = new Set(allErrors.map((e) => e.tmk));
  const succeededTmks = tmks.filter((t) => !failedTmks.has(t));

  await flushSuccess(succeededTmks);
  if (allErrors.length > 0) {
    await flushFailed(allErrors);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary = `Rebuild ${table}: ${succeededTmks.length} done, ${failedTmks.size} failed (${total} total, ${elapsed}s)`;
  log.info(summary);
  return summary;
}
