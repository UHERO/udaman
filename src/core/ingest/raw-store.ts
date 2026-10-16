/**
 * Content-addressed storage for raw artifacts:
 *   DATA_DIR/ingest/raw/<downloader handle>/<sha256[0:2]>/<sha256>.<ext>
 * The same bytes are written once per downloader, so retention is one file
 * per distinct hash. Writes are atomic (temp file + rename): a reader never
 * sees half a file.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { getDataDir } from "@/lib/data-dir";

export type PutResult = {
  /** Relative to the store root (= raw_artifacts.storage_path) */
  relPath: string;
  /** sha256 hex */
  hash: string;
  size: number;
};

export interface RawStore {
  /** Absolute path of a stored relative path. */
  absolute(relPath: string): string;
  put(
    downloaderHandle: string,
    bytes: Uint8Array,
    ext: string | null,
  ): PutResult;
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function rawRelPath(
  downloaderHandle: string,
  hash: string,
  ext: string | null,
): string {
  const suffix = ext ? `.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase()}` : "";
  return join(
    "ingest",
    "raw",
    downloaderHandle,
    hash.slice(0, 2),
    `${hash}${suffix}`,
  );
}

/** Write `data` to `path` atomically. */
export function writeAtomic(path: string, data: Uint8Array | string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(
    dirname(path),
    `.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  );
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/** A RawStore rooted at `root` (DATA_DIR by default). */
export function fileRawStore(root?: string): RawStore {
  const base = () => root ?? getDataDir();
  return {
    absolute(relPath) {
      return join(/*turbopackIgnore: true*/ base(), relPath);
    },
    put(downloaderHandle, bytes, ext) {
      const hash = sha256(bytes);
      const relPath = rawRelPath(downloaderHandle, hash, ext);
      const abs = join(/*turbopackIgnore: true*/ base(), relPath);
      // content-addressed: an existing file of the right size is these bytes
      if (!existsSync(abs) || statSync(abs).size !== bytes.byteLength) {
        writeAtomic(abs, bytes);
      }
      return { relPath, hash, size: bytes.byteLength };
    },
  };
}
