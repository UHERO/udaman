import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DbedtUploadCollection,
  DvwUploadCollection,
} from "@catalog/collections/universe-upload-collection";

import { createLogger } from "@/core/observability/logger";
import { getDataDir } from "@/lib/data-dir";

import type { DbedtMetaRow } from "../utils/dbedt-xlsx-parser";
import type { DvwDimensionRowParsed } from "../utils/dvw-xlsx-parser";
import type { DvwDimensionName } from "../utils/dvw-xlsx-validator";
import type { UploadConfig } from "./universe-upload";

/** Persisted DVW init payload — written by the API route, read by the worker. */
export type DvwStagedMeta = {
  filename: string;
  dimensions: Record<DvwDimensionName, DvwDimensionRowParsed[]>;
};

/** Persisted DBEDT init payload — written by the API route, read by the worker. */
export type DbedtStagedMeta = {
  filename: string;
  indicatorRows: DbedtMetaRow[];
};

const log = createLogger("upload-session-store");

/**
 * On-disk staging for streamed uploads.
 *
 * The web process only *receives* an upload: the init payload (metadata
 * rows) and each data chunk are written as JSON files under
 * `DATA_DIR/<fileSubdir>/staging/<uploadId>/`. All database work happens
 * later in the BullMQ `critical` worker, which reads these files back.
 *
 * Keeping the session on disk (plus the upload row in the DB) means a web
 * restart between chunks or before the worker picks the job up does not
 * lose the upload, and the web process never holds row data in memory.
 *
 * Layout:
 *   meta.json          — { filename, createdAt, ...init payload }
 *   chunk-00000.json   — DataRow[] (one file per client chunk)
 */

const META_FILE = "meta.json";
const CHUNK_PREFIX = "chunk-";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Periodically mark DB records stuck in "processing" as failed. */
setInterval(() => {
  DbedtUploadCollection.failStaleUploads().catch((e) =>
    log.error({ err: e }, "DBEDT stale upload cleanup failed"),
  );
  DvwUploadCollection.failStaleUploads().catch((e) =>
    log.error({ err: e }, "DVW stale upload cleanup failed"),
  );
}, CLEANUP_INTERVAL_MS);

export function stagingDir(config: UploadConfig, uploadId: number): string {
  return join(getDataDir(), config.fileSubdir, "staging", String(uploadId));
}

export async function stagingExists(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, META_FILE))).isFile();
  } catch {
    return false;
  }
}

/** Create the staging directory and persist the init payload. */
export async function createStagedUpload<Meta extends object>(
  config: UploadConfig,
  uploadId: number,
  meta: Meta,
): Promise<string> {
  const dir = stagingDir(config, uploadId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, META_FILE),
    JSON.stringify({ ...meta, createdAt: new Date().toISOString() }),
  );
  return dir;
}

/** Persist one client chunk. Returns the number of chunk files on disk. */
export async function appendStagedChunk(
  dir: string,
  chunkIndex: number,
  rows: unknown[],
): Promise<number> {
  const name = `${CHUNK_PREFIX}${String(chunkIndex).padStart(5, "0")}.json`;
  await writeFile(join(dir, name), JSON.stringify(rows));
  return (await listChunkFiles(dir)).length;
}

export async function readStagedMeta<Meta>(dir: string): Promise<Meta> {
  const raw = await readFile(join(dir, META_FILE), "utf8");
  return JSON.parse(raw) as Meta;
}

async function listChunkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries
    .filter((f) => f.startsWith(CHUNK_PREFIX) && f.endsWith(".json"))
    .sort();
}

/** Total row count across all staged chunks (reads each file). */
export async function countStagedRows(dir: string): Promise<number> {
  let n = 0;
  for await (const rows of iterStagedChunks<unknown>(dir)) n += rows.length;
  return n;
}

/**
 * Yield each staged chunk (in chunk-index order) as an array of rows.
 * Only one chunk is held in memory at a time.
 */
export async function* iterStagedChunks<Row>(
  dir: string,
): AsyncGenerator<Row[]> {
  for (const file of await listChunkFiles(dir)) {
    const raw = await readFile(join(dir, file), "utf8");
    yield JSON.parse(raw) as Row[];
  }
}

/** Materialise every staged row into one array. */
export async function readAllStagedRows<Row>(dir: string): Promise<Row[]> {
  const out: Row[] = [];
  for await (const rows of iterStagedChunks<Row>(dir)) out.push(...rows);
  return out;
}

export async function removeStagedUpload(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
