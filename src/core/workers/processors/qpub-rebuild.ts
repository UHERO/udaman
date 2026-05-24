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

import { TABLE_LOADERS, processLoad } from "./qpub-load";
import { runPipeline } from "./qpub-pipeline";

const log = createLogger("qpub-rebuild");

export type RebuildOptions = {
  /** Filter by island code ('1','2','3','4') */
  island?: string;
  /** NAS period dir (e.g., '2026-1'). Default: all available periods */
  period?: string;
};

/** Collect all HTML file paths into a list and build a tmk → filePath map */
function collectFiles(
  period?: string,
  island?: string,
): Map<string, string> {
  const fileMap = new Map<string, string>();
  for (const filePath of listHtmlFiles(period, island)) {
    const tmk = tmkFromFilePath(filePath);
    fileMap.set(tmk, filePath);
  }
  return fileMap;
}

/** Parse HTML, write JSON, return parsed data. Returns null if not parseable. */
function parseAndWriteJson(
  tmk: string,
  filePath: string,
): ReturnType<typeof parsePropertyHTML> | null {
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
 * Rebuild a single table by re-parsing all HTML files on NAS and loading
 * only the specified table. Writes JSON as a side effect so it stays current.
 */
export async function rebuildTable(
  table: string,
  opts: RebuildOptions = {},
): Promise<string> {
  const { island, period } = opts;

  const loader = TABLE_LOADERS[table];
  if (!loader) {
    const valid = Object.keys(TABLE_LOADERS).join(", ");
    throw new Error(`Unknown table "${table}". Valid tables: ${valid}`);
  }

  log.info({ table, island, period }, "Rebuild table started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());

  const result = await runPipeline({
    label: `Rebuild ${table}`,
    tmks,
    processFn: async (tmk) => {
      const filePath = fileMap.get(tmk)!;
      const parsed = parseAndWriteJson(tmk, filePath);

      if (!parsed) return "skipped";

      // For the condominium loader, only process condo_project pages
      if (table === "condominium" && parsed.status !== "condo_project") {
        return "skipped";
      }

      const fileMtime = getFileMtime(filePath);
      await loader(tmk, parsed, fileMtime);
      return "done";
    },
    log,
  });

  const summary = `Rebuild ${table}: ${result.done} done, ${result.skipped} skipped, ${result.failed} failed (${result.total} total)`;
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
  const { island, period } = opts;

  log.info({ island, period }, "Rebuild all started");

  const fileMap = collectFiles(period, island);
  const tmks = Array.from(fileMap.keys());

  const result = await runPipeline({
    label: "Rebuild all",
    tmks,
    processFn: async (tmk) => {
      const filePath = fileMap.get(tmk)!;
      const parsed = parseAndWriteJson(tmk, filePath);

      if (!parsed) return "skipped";

      // Load all tables via processLoad (reads JSON back, loads in FK order)
      await processLoad(
        { tmk },
        (msg) => log.debug(msg),
        { skipStatusUpdate: true },
      );
      return "done";
    },
    log,
  });

  const summary = `Rebuild all: ${result.done} done, ${result.skipped} skipped, ${result.failed} failed (${result.total} total)`;
  log.info(summary);
  return summary;
}
