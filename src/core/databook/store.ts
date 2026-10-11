/**
 * The combined Data Book vintage file: every numeric cell of every edition
 * 2002→present, one row per (edition, cell), with the DATABOOK series it was
 * matched to (blank when unmatched — kept for review).
 *
 *   data-dir/databook/vintages.csv
 *
 * Udaman loads it oldest edition first (`history.ts`) with each edition's
 * points stamped at its release date, so revisions become vintages. The
 * `Series.load_from_databook "NAME"` loader eval reads the latest-vintage
 * value per date from here.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseCsv } from "@/core/crawlers/csv";
import { getDataDir } from "@/lib/data-dir";

export const VINTAGE_COLUMNS = [
  "vintage",
  "vintage_date",
  "table_num",
  "table_line",
  "panel",
  "row_path",
  "col_path",
  "period_label",
  "date",
  "value",
  "series",
  "match",
  "confidence",
  "cell_addr",
] as const;

export type MatchMethod =
  "manifest" | "value-overlap" | "label" | "manual" | "none";

export interface VintageRow {
  vintage: number;
  vintageDate: string;
  tableNum: string;
  /** Stable table-lineage id (the 2025 table number it descends from), "" if none. */
  tableLine: string;
  panel: string;
  rowPath: string[];
  colPath: string[];
  periodLabel: string;
  date: string;
  value: number;
  /** DATABOOK series name, "" when unmatched. */
  series: string;
  match: MatchMethod;
  confidence: number;
  cellAddr: string;
}

/** Path separator inside row_path / col_path cells. */
const PATH_SEP = " > ";

export function databookDir(): string {
  return join(getDataDir(), "databook");
}

export function vintagesPath(): string {
  return join(databookDir(), "vintages.csv");
}

/**
 * Release date used as the vintage stamp for edition `edition`: editions
 * come out around August of the following year (decision 2 in the plan).
 */
export function vintageDate(edition: number): string {
  return `${edition + 1}-08-01`;
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeVintages(rows: VintageRow[], path = vintagesPath()): void {
  const sorted = [...rows].sort(
    (a, b) =>
      a.vintage - b.vintage ||
      a.series.localeCompare(b.series) ||
      a.date.localeCompare(b.date),
  );
  const lines = [VINTAGE_COLUMNS.join(",")];
  for (const r of sorted) {
    lines.push(
      [
        r.vintage,
        r.vintageDate,
        r.tableNum,
        r.tableLine,
        r.panel,
        r.rowPath.join(PATH_SEP),
        r.colPath.join(PATH_SEP),
        r.periodLabel,
        r.date,
        r.value,
        r.series,
        r.match,
        r.confidence,
        r.cellAddr,
      ]
        .map(csvField)
        .join(","),
    );
  }
  writeFileSync(path, lines.join("\n") + "\n");
}

export function readVintages(path = vintagesPath()): VintageRow[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows.shift() ?? [];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const split = (s: string) => (s ? s.split(PATH_SEP) : []);
  return rows.map((r) => ({
    vintage: Number(r[idx.vintage]),
    vintageDate: r[idx.vintage_date],
    tableNum: r[idx.table_num],
    tableLine: r[idx.table_line],
    panel: r[idx.panel],
    rowPath: split(r[idx.row_path]),
    colPath: split(r[idx.col_path]),
    periodLabel: r[idx.period_label],
    date: r[idx.date],
    value: Number(r[idx.value]),
    series: r[idx.series],
    match: r[idx.match] as MatchMethod,
    confidence: Number(r[idx.confidence]),
    cellAddr: r[idx.cell_addr],
  }));
}

/** series → edition → date → value, matched rows only. */
export type VintageIndex = Map<string, Map<number, Map<string, number>>>;

export function indexVintages(rows: VintageRow[]): VintageIndex {
  const index: VintageIndex = new Map();
  for (const r of rows) {
    if (!r.series || !Number.isFinite(r.value)) continue;
    let byEdition = index.get(r.series);
    if (!byEdition) index.set(r.series, (byEdition = new Map()));
    let byDate = byEdition.get(r.vintage);
    if (!byDate) byEdition.set(r.vintage, (byDate = new Map()));
    byDate.set(r.date, r.value);
  }
  return index;
}

/**
 * Latest-vintage value per date: walk editions oldest → newest, letting
 * each overwrite the dates it prints. Dates a newer edition no longer
 * prints keep the value from the last edition that did.
 */
export function latestObserved(
  byEdition: Map<number, Map<string, number>> | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!byEdition) return out;
  for (const edition of [...byEdition.keys()].sort((a, b) => a - b)) {
    for (const [date, value] of byEdition.get(edition)!) out.set(date, value);
  }
  return out;
}

let cache: { path: string; mtimeMs: number; index: VintageIndex } | null = null;

/** Cached index of the vintage file (reloaded when the file changes). */
export function getVintageIndex(path = vintagesPath()): VintageIndex {
  if (!existsSync(path)) {
    throw new Error(`Data Book vintage file not found: ${path}`);
  }
  const { mtimeMs } = statSync(path);
  if (!cache || cache.path !== path || cache.mtimeMs !== mtimeMs) {
    cache = { path, mtimeMs, index: indexVintages(readVintages(path)) };
  }
  return cache.index;
}
