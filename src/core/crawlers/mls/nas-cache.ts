import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "fs/promises";
import path from "path";

import { findScrapesRoot } from "../nas-path";
import type { ListQuery } from "./types";

/**
 * Raw-HTML cache for the MLS scrapers.
 *
 *   {root}/{site}/list/{YYYY-MM-DD}/{island}/{statusSet}/p{0001}.html
 *   {root}/{site}/detail/{mls[0:6]}/{mls}/{YYYY-MM-DD}.html
 *
 * List pages are per run date — pagination drifts, so a page is never reused
 * across days. Detail pages are dated snapshots; the latest date is current
 * and older ones are the audit trail. Dates are HST calendar dates
 * (`hstToday()` from catalog/utils/time, or any explicit YYYY-MM-DD).
 *
 * Files are always read whole. They are ~40-55KB; there is no head-read path
 * here on purpose.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SNAPSHOT_RE = /^\d{4}-\d{2}-\d{2}\.html$/;
/** One path component: no separators, no dot-prefixed names, no "..". */
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Cache root. MLS_NAS_PATH overrides (dev and tests point it at a local dir);
 * otherwise `<scrapes root>/mls`. Read on every call so a test can set the
 * variable after this module is imported.
 */
export function mlsCacheRoot(): string {
  const override = process.env.MLS_NAS_PATH?.trim();
  if (override) return override;
  return path.join(findScrapesRoot(), "mls");
}

function checkName(kind: string, value: string): string {
  if (typeof value !== "string" || !NAME_RE.test(value)) {
    throw new Error(`mls cache: invalid ${kind} "${value}"`);
  }
  return value;
}

function checkDate(date: string): string {
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new Error(`mls cache: date must be YYYY-MM-DD, got "${date}"`);
  }
  return date;
}

function detailDir(site: string, mlsNumber: string): string {
  checkName("site", site);
  checkName("MLS number", mlsNumber);
  return path.join(
    mlsCacheRoot(),
    site,
    "detail",
    mlsNumber.slice(0, 6),
    mlsNumber,
  );
}

export function listPagePath(
  site: string,
  runDate: string,
  q: ListQuery,
): string {
  if (!Number.isInteger(q.page) || q.page < 1) {
    throw new Error(
      `mls cache: page must be a positive integer, got ${q.page}`,
    );
  }
  return path.join(
    mlsCacheRoot(),
    checkName("site", site),
    "list",
    checkDate(runDate),
    checkName("island", q.island),
    checkName("statusSet", q.statusSet),
    `p${String(q.page).padStart(4, "0")}.html`,
  );
}

export function detailPath(
  site: string,
  mlsNumber: string,
  date: string,
): string {
  return path.join(detailDir(site, mlsNumber), `${checkDate(date)}.html`);
}

/** readdir that treats a missing directory as empty. */
async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw e;
  }
}

async function latestSnapshotIn(dir: string): Promise<string | null> {
  let latest: string | null = null;
  for (const name of await safeReaddir(dir)) {
    // ISO dates: lexicographic order is chronological order.
    if (SNAPSHOT_RE.test(name) && (latest === null || name > latest)) {
      latest = name;
    }
  }
  return latest === null ? null : path.join(dir, latest);
}

/** Newest snapshot for a listing, or null when it has never been cached. */
export async function latestDetailPath(
  site: string,
  mlsNumber: string,
): Promise<string | null> {
  return latestSnapshotIn(detailDir(site, mlsNumber));
}

/** Whole-file read. Null when the file does not exist. */
export async function readHtml(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return null;
    throw e;
  }
}

let tmpCounter = 0;

/**
 * mkdir -p, write to a temp name in the same directory, then rename — rename
 * is atomic within a directory, so a crash leaves either the old file, no
 * file, or a stray dot-tmp (which no reader here matches), never a truncated
 * .html that a later run would trust as a cache hit.
 */
export async function writeHtml(filePath: string, html: string): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${tmpCounter++}.tmp`,
  );
  try {
    await writeFile(tmp, html, "utf8");
    await rename(tmp, filePath);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/**
 * Every cached listing for a site with the path of its LATEST snapshot, in
 * MLS-number order. Lazy — one shard directory is listed at a time.
 */
export async function* iterateCachedDetails(
  site: string,
): AsyncGenerator<{ mlsNumber: string; path: string }> {
  const base = path.join(mlsCacheRoot(), checkName("site", site), "detail");
  for (const shard of (await safeReaddir(base)).sort()) {
    if (!NAME_RE.test(shard)) continue;
    const shardDir = path.join(base, shard);
    for (const mlsNumber of (await safeReaddir(shardDir)).sort()) {
      if (!NAME_RE.test(mlsNumber)) continue;
      const latest = await latestSnapshotIn(path.join(shardDir, mlsNumber));
      if (latest !== null) yield { mlsNumber, path: latest };
    }
  }
}
