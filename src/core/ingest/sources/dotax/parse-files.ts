/**
 * The DOTAX report files a parse reads: every stored current-page file and
 * every report inside every stored archive zip, one per (report, month)
 * picked the way dotax.R's inventory did.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";

import { hstToInstant } from "@catalog/utils/time";
import XLSX from "xlsx";

import { getDataDir } from "@/lib/data-dir";

import type { ParseInput } from "../../types";
import { parseDotaxKey } from "./artifact-keys";
import type { ReportType } from "./parse-reports";

/**
 * Report type from a file name, or null for anything not parsed
 * (summaries, PDFs, retired reports, docs). The leading date prefix (MM,
 * YYMM or YYYYMM) is dropped first; DOTAX's one-off misspellings are
 * covered.
 */
export function reportType(fileName: string): ReportType | null {
  const lower = fileName.toLowerCase();
  if (!/\.xlsx?$/.test(lower)) return null;
  const stem = lower
    .replace(/(\.xlsx?)+$/, "")
    .replace(/^\d{2,6}/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(cal|cy|fis|fy|is)/.test(stem)) return null;
  if (/^(liab|lab)[-_ ]*(by|b)?[-_ ]*(d)?[-_ ]*ge([-_ ]|$)|^ge liab/.test(stem))
    return "liab_ge";
  if (
    /^(liab|lab)[-_ ]*(by|b)?[-_ ]*(d)?[-_ ]*tat([-_ ]|$)|^tat liab/.test(stem)
  )
    return "liab_tat";
  if (/^liqtob/.test(stem)) return "liqtob";
  if (/^liq([-_ ]|$)/.test(stem)) return "liq";
  if (/^tob([-_ ]|$)/.test(stem)) return "tob";
  if (/^(fuels?|fules|f-coll|f-fuel)([-_ ]|$)/.test(stem)) return "fuels";
  if (/^ge([-_ ]|$)|^ge tax & base/.test(stem)) return "ge";
  if (/^(collec|collall|coll)([-_ ]|$)/.test(stem)) return "collec";
  return null;
}

/** Revision rank from a file name: plain 0, _rev 1, _revN N, _corr 99. */
export function revRank(fileName: string): number {
  const stem = fileName.toLowerCase().replace(/(\.xlsx?)+$/, "");
  if (stem.includes("corr")) return 99;
  const n = stem.match(/_rev(\d+)/);
  if (n) return Number(n[1]);
  if (stem.includes("_rev")) return 1;
  return 0;
}

export type InventoryFile = {
  type: ReportType;
  month: string;
  file: string;
  path: string;
  /** Groups files from one zip / one URL */
  source: string;
  /** Epoch ms; newest wins */
  fileDate: number;
};

/**
 * One file per (type, month): the source with the newest file date wins,
 * then the highest revision marker, then the newest file.
 */
export function pickPerMonth(files: InventoryFile[]): InventoryFile[] {
  const sourceDate = new Map<string, number>();
  for (const f of files) {
    const k = `${f.type}\r${f.month}\r${f.source}`;
    sourceDate.set(k, Math.max(sourceDate.get(k) ?? -Infinity, f.fileDate));
  }
  const best = new Map<string, InventoryFile>();
  const score = (f: InventoryFile) =>
    [
      sourceDate.get(`${f.type}\r${f.month}\r${f.source}`) ?? 0,
      revRank(f.file),
      f.fileDate,
    ] as const;
  for (const f of files) {
    const k = `${f.type}\r${f.month}`;
    const cur = best.get(k);
    if (!cur) {
      best.set(k, f);
      continue;
    }
    const a = score(f);
    const b = score(cur);
    if (
      a[0] > b[0] ||
      (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
    ) {
      best.set(k, f);
    }
  }
  return [...best.values()].sort((x, y) =>
    x.type === y.type
      ? x.month.localeCompare(y.month)
      : x.type.localeCompare(y.type),
  );
}

type ZipEntry = { name: string; path: string; date: number };

/**
 * Unpack a stored zip into DATA_DIR/ingest/cache/zip/<content hash>/ (a
 * derived cache: same bytes, same files) and list its non-empty entries.
 * Entry paths are confined to that directory.
 */
export function unpackZip(zipPath: string, contentHash: string): ZipEntry[] {
  const dir = join(
    /*turbopackIgnore: true*/ getDataDir(),
    "ingest",
    "cache",
    "zip",
    contentHash,
  );
  const marker = join(dir, ".unpacked");
  const fresh = existsSync(marker);
  const z = XLSX.CFB.read(readFileSync(zipPath), { type: "buffer" });
  const out: ZipEntry[] = [];
  for (let i = 0; i < z.FileIndex.length; i++) {
    const e = z.FileIndex[i] as {
      type: number;
      size: number;
      mt?: Date;
      content?: Uint8Array;
    };
    const full: string = z.FullPaths[i];
    if (e.type !== 2 || !e.size || full.endsWith("/")) continue;
    const rel = full.replace(/^Root Entry\//, "");
    if (rel === "Sh33tJ5" || !rel) continue; // CFB's placeholder entry
    const safe = normalize(rel);
    if (safe.startsWith("..") || safe.startsWith(sep)) continue;
    const path = join(dir, safe);
    if (!fresh && e.content) {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, Buffer.from(e.content));
    }
    out.push({
      name: safe.split(sep).pop() ?? safe,
      path,
      date: e.mt ? e.mt.getTime() : 0,
    });
  }
  if (!fresh) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, "");
  }
  return out;
}

/** When a stored file was published: Last-Modified, else first fetched. */
function publishedAt(input: ParseInput): number {
  const lm = input.artifact.metadata.lastModified;
  if (typeof lm === "string") {
    const t = new Date(lm).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return hstToInstant(input.artifact.fetchedAt).getTime();
}

/** Report files (one per stored XLSX, one per zip entry), with display names. */
export function inventory(inputs: readonly ParseInput[]): {
  files: InventoryFile[];
  names: Map<string, string>;
  skipped: string[];
} {
  const files: InventoryFile[] = [];
  const names = new Map<string, string>();
  const skipped: string[] = [];
  for (const input of inputs) {
    const key = parseDotaxKey(input.artifact.artifactKey);
    if (!key) {
      skipped.push(input.artifact.artifactKey);
      continue;
    }
    const file = input.artifact.originalName ?? key.file;
    const source = `${input.downloaderHandle}:${input.artifact.artifactKey}`;
    if (/\.zip$/i.test(file)) {
      for (const e of unpackZip(input.path, input.artifact.contentHash)) {
        const type = reportType(e.name);
        if (!type) continue;
        files.push({
          type,
          month: key.month,
          file: e.name,
          path: e.path,
          source,
          fileDate: e.date,
        });
        names.set(e.path, `${file}/${e.name}`);
      }
      continue;
    }
    const type = reportType(file);
    if (!type) {
      skipped.push(input.artifact.artifactKey);
      continue;
    }
    files.push({
      type,
      month: key.month,
      file,
      path: input.path,
      source,
      fileDate: publishedAt(input),
    });
    names.set(input.path, `${key.month}/${file}`);
  }
  return { files, names, skipped };
}
