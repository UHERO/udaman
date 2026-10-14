/**
 * The output file every downloader writes: a long CSV whose columns come
 * from the downloader's layout — `key,date,value,freq` by default, or the
 * source's own shape (DOTAX: `date,type,tax,source,area,amount,fiscal_year`).
 * Rows are sorted by (key, date) so identical data gives identical bytes
 * (change detection is a byte compare). Load statements go through the
 * downloader's load method, which looks rows up by key.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import type {
  DownloaderImpl,
  OutputLayout,
  OutputWrite,
  TidyRow,
} from "./types";

/** Joins key columns into TidyRow.key; never appears inside a key column. */
export const KEY_SEP = "|";

export const DEFAULT_LAYOUT: OutputLayout = {
  columns: ["key", "date", "value", "freq"],
  keyColumns: ["key"],
  valueColumn: "value",
  freqColumn: "freq",
};

function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Split one CSV line (RFC 4180 quoting). */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function compareRows(a: TidyRow, b: TidyRow): number {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

/**
 * Number → text, rounded to 15 significant digits so spreadsheet float
 * noise (49940438.00000001) prints the way the source shows it.
 */
function formatValue(v: number): string {
  return String(Number(v.toPrecision(15)));
}

export function serializeTidy(
  rows: TidyRow[],
  layout: OutputLayout = DEFAULT_LAYOUT,
): string {
  const sorted = [...rows].sort(compareRows);
  const lines = [layout.columns.join(",")];
  for (const r of sorted) {
    const parts = r.key.split(KEY_SEP);
    if (parts.length !== layout.keyColumns.length) {
      throw new Error(
        `output row key "${r.key}" does not have ${layout.keyColumns.length} part(s) (${layout.keyColumns.join(", ")})`,
      );
    }
    const cells = layout.columns.map((col) => {
      const k = layout.keyColumns.indexOf(col);
      if (k >= 0) return parts[k];
      if (col === "date") return r.date;
      if (col === layout.valueColumn) return formatValue(r.value);
      if (col === layout.freqColumn) return r.freq ?? "";
      return r.extra?.[col] ?? "";
    });
    lines.push(cells.map(csvField).join(","));
  }
  return lines.join("\n") + "\n";
}

/**
 * Rows of an output file. A file whose header lacks the layout's key, date
 * or value columns (written in an older layout) reads as empty.
 */
export function parseTidy(
  text: string,
  layout: OutputLayout = DEFAULT_LAYOUT,
): TidyRow[] {
  const lines = text.split(/\r?\n/);
  const header = splitLine(lines[0] ?? "");
  const at = (col: string) => header.indexOf(col);
  const keyIdx = layout.keyColumns.map(at);
  const dateIdx = at("date");
  const valueIdx = at(layout.valueColumn);
  const freqIdx = layout.freqColumn ? at(layout.freqColumn) : -1;
  if (keyIdx.some((i) => i < 0) || dateIdx < 0 || valueIdx < 0) return [];
  const extraCols = header.flatMap((col, i) =>
    keyIdx.includes(i) || i === dateIdx || i === valueIdx || i === freqIdx
      ? []
      : [[col, i] as const],
  );

  const rows: TidyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = splitLine(line);
    const key = keyIdx.map((k) => cells[k] ?? "").join(KEY_SEP);
    const date = cells[dateIdx];
    const value = cells[valueIdx];
    const v = Number(value);
    if (!key || !date || !value || !Number.isFinite(v)) continue;
    const row: TidyRow = { key, date, value: v };
    const freq = freqIdx >= 0 ? cells[freqIdx] : "";
    if (freq) row.freq = freq;
    if (extraCols.length) {
      row.extra = Object.fromEntries(
        extraCols.map(([col, k]) => [col, cells[k] ?? ""]),
      );
    }
    rows.push(row);
  }
  return rows;
}

/** Rows of `path`, or [] when the file does not exist yet. */
export function readTidyRows(
  path: string,
  layout: OutputLayout = DEFAULT_LAYOUT,
): TidyRow[] {
  if (!existsSync(path)) return [];
  return parseTidy(readFileSync(path, "utf8"), layout);
}

/** Apply an OutputWrite on top of the previous rows. */
export function applyWrite(prev: TidyRow[], write: OutputWrite): TidyRow[] {
  if (write.mode === "replace") return write.rows;
  const incomingKeys = new Set(write.rows.map((r) => r.key));
  const replaceFrom = write.replaceFrom ?? {};
  const kept = prev.filter((r) => {
    if (!incomingKeys.has(r.key)) return true;
    const from = replaceFrom[r.key];
    return from !== undefined && r.date < from;
  });
  return [...kept, ...write.rows];
}

/**
 * Write rows atomically (temp file + rename) so a reload never reads a
 * half-written file. Returns whether the bytes changed.
 */
export function writeTidy(
  path: string,
  rows: TidyRow[],
  layout: OutputLayout = DEFAULT_LAYOUT,
): boolean {
  const text = serializeTidy(rows, layout);
  const prev = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (prev === text) return false;
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
  return true;
}

// ─── Read cache ─────────────────────────────────────────────────────

type Indexed = {
  mtimeMs: number;
  size: number;
  byKey: Map<string, { data: Map<string, number>; freq: string | null }>;
};

/**
 * Parsed outputs keyed by path, invalidated by mtime+size. A reload of a
 * few hundred loaders against the same output parses the file once.
 */
const cache = new Map<string, Indexed>();
const CACHE_MAX = 16;

/**
 * The output at `path` indexed by the keys the downloader's load method
 * resolves to (impl.indexKey maps each row key; rows it rejects are left
 * out).
 */
export function readTidyIndex(
  path: string,
  impl: Pick<DownloaderImpl, "layout" | "indexKey">,
): Indexed["byKey"] {
  if (!existsSync(path)) return new Map();
  const st = statSync(path);
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
    return hit.byKey;
  }
  const byKey: Indexed["byKey"] = new Map();
  const indexKey = new Map<string, string | null>();
  for (const r of readTidyRows(path, impl.layout)) {
    let key = indexKey.get(r.key);
    if (key === undefined) {
      key = impl.indexKey ? impl.indexKey(r.key) : r.key;
      indexKey.set(r.key, key);
    }
    if (key === null) continue;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { data: new Map(), freq: r.freq ?? null };
      byKey.set(key, entry);
    }
    entry.data.set(r.date, r.value);
  }
  cache.delete(path);
  cache.set(path, { mtimeMs: st.mtimeMs, size: st.size, byKey });
  while (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value as string);
  }
  return byKey;
}
