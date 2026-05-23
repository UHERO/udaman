import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import {
  getFileMtime,
  getJsonPath,
  listHtmlFiles,
  tmkFromFilePath,
} from "@/core/crawlers/qpub/config";
import { parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { createLogger } from "@/core/observability/logger";

import { TABLE_LOADERS, errorMessage, processLoad } from "./qpub-load";

const log = createLogger("qpub-rebuild");

export type RebuildProgress = {
  processed: number;
  loaded: number;
  skipped: number;
  errors: number;
};

export type RebuildOptions = {
  /** Filter by island code ('1','2','3','4') */
  island?: string;
  /** NAS period dir (e.g., '2026-1'). Default: all available periods */
  period?: string;
  /** Progress log interval (default: 500) */
  batchSize?: number;
};

/**
 * Rebuild a single table by re-parsing all HTML files on NAS and loading
 * only the specified table. Writes JSON as a side effect so it stays current.
 */
export async function rebuildTable(
  table: string,
  opts: RebuildOptions = {},
): Promise<string> {
  const { island, period, batchSize = 500 } = opts;

  const loader = TABLE_LOADERS[table];
  if (!loader) {
    const valid = Object.keys(TABLE_LOADERS).join(", ");
    throw new Error(`Unknown table "${table}". Valid tables: ${valid}`);
  }

  log.info({ table, island, period }, "Rebuild table started");

  const progress: RebuildProgress = { processed: 0, loaded: 0, skipped: 0, errors: 0 };

  for (const filePath of listHtmlFiles(period, island)) {
    progress.processed++;

    try {
      const tmk = tmkFromFilePath(filePath);
      const html = readFileSync(filePath, "utf-8");
      const parsed = parsePropertyHTML(html, tmk);

      // Skip non-success and non-condo_project pages
      if (parsed.status !== "success" && parsed.status !== "condo_project") {
        progress.skipped++;
        continue;
      }

      // For the condominium loader, only process condo_project pages
      if (table === "condominium" && parsed.status !== "condo_project") {
        progress.skipped++;
        continue;
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

      const fileMtime = getFileMtime(filePath);
      await loader(tmk, parsed, fileMtime);
      progress.loaded++;
    } catch (e) {
      progress.errors++;
      log.error({ file: filePath, error: errorMessage(e) }, "Rebuild error");
    }

    if (progress.processed % batchSize === 0) {
      log.info(progress, "Rebuild progress");
    }
  }

  const summary = `Rebuild ${table}: ${progress.processed} processed, ${progress.loaded} loaded, ${progress.skipped} skipped, ${progress.errors} errors`;
  log.info(summary);
  return summary;
}

/**
 * Rebuild all tables by re-parsing all HTML files on NAS and loading
 * every section. Equivalent to a full database repopulation.
 */
export async function rebuildAll(
  opts: RebuildOptions = {},
): Promise<string> {
  const { island, period, batchSize = 500 } = opts;

  log.info({ island, period }, "Rebuild all started");

  const progress: RebuildProgress = { processed: 0, loaded: 0, skipped: 0, errors: 0 };

  for (const filePath of listHtmlFiles(period, island)) {
    progress.processed++;

    try {
      const tmk = tmkFromFilePath(filePath);
      const html = readFileSync(filePath, "utf-8");
      const parsed = parsePropertyHTML(html, tmk);

      if (parsed.status !== "success" && parsed.status !== "condo_project") {
        progress.skipped++;
        continue;
      }

      // Write JSON
      const jsonDir = getJsonPath(tmk);
      if (!existsSync(jsonDir)) {
        mkdirSync(jsonDir, { recursive: true });
      }
      writeFileSync(
        path.join(jsonDir, `${tmk}.json`),
        JSON.stringify(parsed, null, 2),
      );

      // Load all tables via processLoad (reads JSON back, loads in FK order)
      const fileMtime = getFileMtime(filePath);
      await processLoad(
        { tmk },
        (msg) => log.debug(msg),
      );
      progress.loaded++;
    } catch (e) {
      progress.errors++;
      log.error({ file: filePath, error: errorMessage(e) }, "Rebuild error");
    }

    if (progress.processed % batchSize === 0) {
      log.info(progress, "Rebuild progress");
    }
  }

  const summary = `Rebuild all: ${progress.processed} processed, ${progress.loaded} loaded, ${progress.skipped} skipped, ${progress.errors} errors`;
  log.info(summary);
  return summary;
}
