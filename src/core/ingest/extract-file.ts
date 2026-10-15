/**
 * The extract file: declared dimension columns, then date and value, one
 * row per observation, sorted by dimensions then date so the same data
 * always gives the same bytes.
 *
 *   type,tax,source,area,date,value
 *   fuels,State Tax,Aviation fuel,Kauai,2025-07-01,41203.17
 *
 * Stored at DATA_DIR/ingest/extracts/<extractor handle>/<run id>.csv and
 * referenced by extraction_runs.output_path. Periods a series has no value
 * for, and why (blank / absent / failed), go next to it in
 * <run id>.missing.csv: dimensions, date, reason, detail.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { csvField, formatNumber, splitCsvLine } from "./csv";
import { sha256, writeAtomic } from "./raw-store";
import type { ExtractRow, MissingPeriod, MissingReason } from "./types";

/** Joins dimension values into a series key; never appears in a label. */
export const SERIES_SEP = "\u001f";

export function extractRelPath(extractorHandle: string, runId: number): string {
  return join("ingest", "extracts", extractorHandle, `${runId}.csv`);
}

/** The missing-periods file that goes with an extract file. */
export function missingPathFor(extractPath: string): string {
  return extractPath.replace(/\.csv$/, ".missing.csv");
}

export function serializeMissing(
  dims: readonly string[],
  missing: readonly MissingPeriod[],
): string {
  const keyed = missing.map((m) => ({ k: seriesKey(dims, m.dims), m }));
  keyed.sort((a, b) =>
    a.k !== b.k ? (a.k < b.k ? -1 : 1) : a.m.date < b.m.date ? -1 : 1,
  );
  const lines = [[...dims, "date", "reason", "detail"].map(csvField).join(",")];
  for (const { m } of keyed) {
    lines.push(
      [
        ...dims.map((d) => csvField(m.dims[d] ?? "")),
        m.date,
        m.reason,
        csvField(m.detail ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** Missing periods of an extract, [] when it has no missing file. */
export function readMissing(extractAbsPath: string): MissingPeriod[] {
  const path = missingPathFor(extractAbsPath);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "");
  const dims = header.slice(0, -3);
  const out: MissingPeriod[] = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const c = splitCsvLine(line);
    const n = dims.length;
    out.push({
      dims: Object.fromEntries(dims.map((d, i) => [d, c[i] ?? ""])),
      date: c[n],
      reason: c[n + 1] as MissingReason,
      ...(c[n + 2] ? { detail: c[n + 2] } : {}),
    });
  }
  return out;
}

export function seriesKey(
  dims: readonly string[],
  values: Record<string, string>,
): string {
  return dims.map((d) => values[d] ?? "").join(SERIES_SEP);
}

export function serializeExtract(
  dims: readonly string[],
  rows: readonly ExtractRow[],
): string {
  const keyed = rows.map((r) => ({ k: seriesKey(dims, r.dims), r }));
  keyed.sort((a, b) =>
    a.k !== b.k
      ? a.k < b.k
        ? -1
        : 1
      : a.r.date < b.r.date
        ? -1
        : a.r.date > b.r.date
          ? 1
          : 0,
  );
  const lines = [[...dims, "date", "value"].map(csvField).join(",")];
  for (const { r } of keyed) {
    lines.push(
      [
        ...dims.map((d) => csvField(r.dims[d] ?? "")),
        r.date,
        formatNumber(r.value),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export type WrittenExtract = {
  hash: string;
  rowCount: number;
  seriesCount: number;
};

/** Write an extract (and its missing periods, if any) atomically. */
export function writeExtract(
  absPath: string,
  dims: readonly string[],
  rows: readonly ExtractRow[],
  missing: readonly MissingPeriod[] = [],
): WrittenExtract {
  const text = serializeExtract(dims, rows);
  if (missing.length) {
    writeAtomic(missingPathFor(absPath), serializeMissing(dims, missing));
  }
  writeAtomic(absPath, text);
  return {
    hash: sha256(text),
    rowCount: rows.length,
    seriesCount: new Set(rows.map((r) => seriesKey(dims, r.dims))).size,
  };
}

export type ParsedExtract = { dims: string[]; rows: ExtractRow[] };

export function parseExtract(text: string): ParsedExtract {
  const lines = text.split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "");
  const n = header.length;
  if (n < 2 || header[n - 2] !== "date" || header[n - 1] !== "value") {
    throw new Error(
      `not an extract file: header must end with date,value (got ${header.join(",")})`,
    );
  }
  const dims = header.slice(0, n - 2);
  const rows: ExtractRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = splitCsvLine(lines[i]);
    rows.push({
      dims: Object.fromEntries(dims.map((d, j) => [d, cells[j] ?? ""])),
      date: cells[n - 2],
      value: Number(cells[n - 1]),
    });
  }
  return { dims, rows };
}

export function readExtract(absPath: string): ParsedExtract {
  return parseExtract(readFileSync(absPath, "utf8"));
}

// ─── Indexed read (cached by path + mtime + size) ──────────────────

export type ExtractSeries = {
  dims: Record<string, string>;
  /** date → value, ascending */
  data: Map<string, number>;
};

export type ExtractIndex = {
  dims: string[];
  series: Map<string, ExtractSeries>;
};

export function indexExtract(parsed: ParsedExtract): ExtractIndex {
  const series = new Map<string, ExtractSeries>();
  for (const r of parsed.rows) {
    const k = seriesKey(parsed.dims, r.dims);
    let s = series.get(k);
    if (!s) {
      s = { dims: r.dims, data: new Map() };
      series.set(k, s);
    }
    s.data.set(r.date, r.value);
  }
  return { dims: parsed.dims, series };
}

type Cached = { mtimeMs: number; size: number; index: ExtractIndex };
const cache = new Map<string, Cached>();
const CACHE_MAX = 8;

/** Index of an extract file, re-read only when the file changes. */
export function readExtractIndex(absPath: string): ExtractIndex | null {
  if (!existsSync(absPath)) return null;
  const st = statSync(absPath);
  const hit = cache.get(absPath);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
    cache.delete(absPath);
    cache.set(absPath, hit);
    return hit.index;
  }
  const index = indexExtract(readExtract(absPath));
  cache.set(absPath, { mtimeMs: st.mtimeMs, size: st.size, index });
  while (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value as string);
  }
  return index;
}
