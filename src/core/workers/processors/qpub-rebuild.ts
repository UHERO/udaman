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
import { localRawQuery, localInsertAndGetId, closeLocalConnection } from "@/lib/mysql/hhdb-local";

import { progressSummary } from "./qpub-pipeline";
import { getMaxTaxYear, errorMessage, TABLE_LOADERS } from "./qpub-load";
import {
  batchLoadAll,
  batchLoadTable,
  clearColumnCache,
  type BatchItem,
  type BatchResult,
  type DbConnection,
} from "./qpub-batch-load";
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

// ─── DB Connections ─────────────────────────────────────────────────

const LOCAL_DB: DbConnection = {
  query: localRawQuery,
  insertAndGetId: localInsertAndGetId,
};

// ─── File Collection ────────────────────────────────────────────────

/** Collect all HTML file paths into a tmk → filePath map */
function collectFiles(period?: string, island?: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  for (const filePath of listHtmlFiles(period, island)) {
    const tmk = tmkFromFilePath(filePath);
    fileMap.set(tmk, filePath);
  }
  return fileMap;
}

// ─── Parse Phase ────────────────────────────────────────────────────

/** Parse HTML, write JSON, return parsed data. Returns null if not parseable. */
function parseAndWriteJson(
  tmk: string,
  filePath: string,
): ParsedProperty | null {
  const html = readFileSync(filePath, "utf-8");
  const parsed = parsePropertyHTML(html, tmk);

  if (parsed.status !== "success" && parsed.status !== "condo_project") {
    return null;
  }

  // Write JSON to NAS (keeps JSON current with latest parse logic)
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

/**
 * Parse or read cached JSON. Skip re-parse when JSON is newer than HTML
 * unless forceParse is true.
 */
function parseOrReadCached(
  tmk: string,
  htmlPath: string,
  forceParse: boolean,
): ParsedProperty | null {
  if (!forceParse) {
    const jsonDir = getJsonPath(tmk);
    const jsonFile = path.join(jsonDir, `${tmk}.json`);

    if (existsSync(jsonFile)) {
      try {
        const jsonMtime = statSync(jsonFile).mtimeMs;
        const htmlMtime = statSync(htmlPath).mtimeMs;

        if (jsonMtime > htmlMtime) {
          // JSON is newer — read cached
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

/** Bulk-set load_status='pending' for all TMKs */
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

/** Batch-update succeeded TMKs */
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

/** Batch-update failed TMKs */
async function flushFailed(failures: Array<{ tmk: string; error: string }>): Promise<void> {
  for (const { tmk, error } of failures) {
    await rawQuery(
      `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
      [error.slice(0, 500), tmk],
    );
  }
}

// ─── FK/Unique Check Control ────────────────────────────────────────

async function disableChecks(db: DbConnection): Promise<void> {
  await db.query("SET FOREIGN_KEY_CHECKS=0", []);
  await db.query("SET UNIQUE_CHECKS=0", []);
}

async function enableChecks(db: DbConnection): Promise<void> {
  await db.query("SET FOREIGN_KEY_CHECKS=1", []);
  await db.query("SET UNIQUE_CHECKS=1", []);
}

// ─── Batch Processing ───────────────────────────────────────────────

/**
 * Parse a batch of TMKs and return BatchItems ready for loading.
 * Items that fail to parse are collected into the errors array.
 */
function parseBatch(
  tmks: string[],
  fileMap: Map<string, string>,
  forceParse: boolean,
): { items: BatchItem[]; parseErrors: Array<{ tmk: string; error: string }> } {
  const items: BatchItem[] = [];
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

// ─── Main Entry Points ──────────────────────────────────────────────

/**
 * Rebuild all tables using batch-major processing.
 * Loads into local DB first, then syncs to remote.
 */
export async function rebuildAll(opts: RebuildOptions = {}): Promise<string> {
  const { island, period, forceParse = false } = opts;

  log.info({ island, period, forceParse }, "Rebuild all (batch) started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());
  const total = tmks.length;

  if (total === 0) {
    log.info("Rebuild all: no files found");
    return "Rebuild all: no files found";
  }

  // Step 1: Prepare local database
  await prepareLocalDb(log);

  log.info({ total }, "Setting all TMKs to pending");
  await setAllPending(tmks);

  clearColumnCache();
  await disableChecks(LOCAL_DB);

  const startMs = Date.now();
  let done = 0;
  let failed = 0;
  const allParseErrors: Array<{ tmk: string; error: string }> = [];
  const allLoadErrors: Array<{ tmk: string; error: string }> = [];

  try {
    // Step 2: Load all batches into local DB
    for (let i = 0; i < tmks.length; i += BATCH_SIZE) {
      const batchTmks = tmks.slice(i, i + BATCH_SIZE);

      // Parse batch
      const { items, parseErrors } = parseBatch(batchTmks, fileMap, forceParse);
      allParseErrors.push(...parseErrors);

      // Load batch into LOCAL database
      let loadResult: BatchResult = { succeeded: 0, failed: 0, errors: [] };
      if (items.length > 0) {
        loadResult = await batchLoadAll(items, log, LOCAL_DB);
      }

      allLoadErrors.push(...loadResult.errors);

      done += items.length - loadResult.errors.length;
      failed += parseErrors.length + loadResult.errors.length;

      // Log progress
      log.info(
        progressSummary(done, failed, total, startMs),
        "Rebuild all: load progress",
      );
    }
  } finally {
    await enableChecks(LOCAL_DB);
    closeLocalConnection();
  }

  // Step 3: Sync local DB to remote
  log.info("Load phase complete, syncing to remote");
  await syncToRemote(log);

  // Step 4: Update scrape_status on remote
  const allErrors = [...allParseErrors, ...allLoadErrors];
  const failedTmks = new Set(allErrors.map((e) => e.tmk));
  const succeededTmks = tmks.filter((t) => !failedTmks.has(t));

  await flushSuccess(succeededTmks);
  if (allErrors.length > 0) {
    await flushFailed(allErrors);
  }

  const summary = `Rebuild all: ${succeededTmks.length} done, ${failedTmks.size} failed (${total} total)`;
  log.info(summary);
  return summary;
}

/**
 * Rebuild a single table using batch-major processing.
 * Loads into local DB first, then syncs the specific table(s) to remote.
 */
export async function rebuildTable(
  table: string,
  opts: RebuildOptions = {},
): Promise<string> {
  const { island, period, forceParse = false } = opts;

  // Validate table name
  if (!TABLE_LOADERS[table]) {
    const valid = Object.keys(TABLE_LOADERS).join(", ");
    throw new Error(`Unknown table "${table}". Valid tables: ${valid}`);
  }

  log.info({ table, island, period, forceParse }, "Rebuild table (batch) started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());
  const total = tmks.length;

  if (total === 0) {
    log.info({ table }, "Rebuild table: no files found");
    return `Rebuild ${table}: no files found`;
  }

  // Step 1: Prepare local database
  await prepareLocalDb(log);

  log.info({ total, table }, "Setting all TMKs to pending");
  await setAllPending(tmks);

  clearColumnCache();
  await disableChecks(LOCAL_DB);

  const startMs = Date.now();
  let done = 0;
  let failed = 0;
  let skipped = 0;
  const allParseErrors: Array<{ tmk: string; error: string }> = [];
  const allLoadErrors: Array<{ tmk: string; error: string }> = [];

  try {
    // Step 2: Load batches into local DB
    for (let i = 0; i < tmks.length; i += BATCH_SIZE) {
      const batchTmks = tmks.slice(i, i + BATCH_SIZE);

      // Parse batch
      const { items, parseErrors } = parseBatch(batchTmks, fileMap, forceParse);
      allParseErrors.push(...parseErrors);

      // For condominium table, only process condo_project pages
      const loadItems = table === "condominium"
        ? items.filter((item) => item.data.status === "condo_project")
        : items;
      const batchSkipped = items.length - loadItems.length;

      // Load batch for this specific table into LOCAL database
      // Properties are always loaded too (FK parent)
      let loadResult: BatchResult = { succeeded: 0, failed: 0, errors: [] };
      if (loadItems.length > 0) {
        // Load properties first for FK integrity
        await batchLoadTable("properties", loadItems, log, LOCAL_DB);
        loadResult = await batchLoadTable(table, loadItems, log, LOCAL_DB);
      }

      allLoadErrors.push(...loadResult.errors);

      done += loadResult.succeeded;
      skipped += batchSkipped;
      failed += parseErrors.length + loadResult.errors.length;

      // Log progress
      log.info(
        progressSummary(done + skipped, failed, total, startMs),
        `Rebuild ${table}: load progress`,
      );
    }
  } finally {
    await enableChecks(LOCAL_DB);
    closeLocalConnection();
  }

  // Step 3: Sync table(s) to remote
  log.info({ table }, "Load phase complete, syncing to remote");
  await syncTableToRemote(table, log);

  // Step 4: Update scrape_status on remote
  const allErrors = [...allParseErrors, ...allLoadErrors];
  const failedTmks = new Set(allErrors.map((e) => e.tmk));
  const succeededTmks = tmks.filter((t) => !failedTmks.has(t));

  await flushSuccess(succeededTmks);
  if (allErrors.length > 0) {
    await flushFailed(allErrors);
  }

  const summary = `Rebuild ${table}: ${done} done, ${skipped} skipped, ${failedTmks.size} failed (${total} total)`;
  log.info(summary);
  return summary;
}
