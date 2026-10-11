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
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

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

/** Row → CSV line (no newline). */
function vintageLine(r: VintageRow): string {
  return [
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
    .join(",");
}

/**
 * Streams the vintage file to disk one batch (edition) at a time, so the
 * matcher never holds all ~1.7M rows in memory. Writes to a temp file and
 * renames on close, so readers never see a half-written file.
 */
export class VintageWriter {
  private fd: number;
  private tmp: string;
  rows = 0;

  constructor(private path = vintagesPath()) {
    this.tmp = `${path}.tmp`;
    this.fd = openSync(this.tmp, "w");
    writeSync(this.fd, VINTAGE_COLUMNS.join(",") + "\n");
  }

  write(rows: VintageRow[]): void {
    const sorted = [...rows].sort(
      (a, b) =>
        a.vintage - b.vintage ||
        a.series.localeCompare(b.series) ||
        a.date.localeCompare(b.date),
    );
    // Chunked so one huge edition doesn't become one huge string.
    for (let i = 0; i < sorted.length; i += 20_000) {
      writeSync(
        this.fd,
        sorted
          .slice(i, i + 20_000)
          .map(vintageLine)
          .join("\n") + "\n",
      );
    }
    this.rows += rows.length;
  }

  close(): void {
    closeSync(this.fd);
    renameSync(this.tmp, this.path);
  }
}

export function writeVintages(rows: VintageRow[], path = vintagesPath()): void {
  const w = new VintageWriter(path);
  w.write(rows);
  w.close();
}

/** One CSV line → fields (quoted fields may contain commas and ""). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

/**
 * Stream the vintage file line by line (4 MB reads), calling `fn` with the
 * parsed fields. Labels are whitespace-normalized when written, so no field
 * spans lines. Memory stays flat regardless of file size.
 */
export function forEachVintageLine(
  fn: (fields: string[], col: Record<string, number>) => void,
  path = vintagesPath(),
): void {
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(4 * 1024 * 1024);
  const decoder = new TextDecoder("utf-8");
  let carry = "";
  let col: Record<string, number> | null = null;
  try {
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      const chunk =
        n > 0
          ? decoder.decode(buf.subarray(0, n), { stream: true })
          : decoder.decode();
      const text = carry + chunk;
      const lines = text.split("\n");
      carry = n > 0 ? (lines.pop() ?? "") : "";
      for (const line of lines) {
        if (!line) continue;
        const fields = parseCsvLine(
          line.endsWith("\r") ? line.slice(0, -1) : line,
        );
        if (!col) {
          col = Object.fromEntries(fields.map((h, i) => [h, i]));
          continue;
        }
        fn(fields, col);
      }
      if (n <= 0) break;
    }
  } finally {
    closeSync(fd);
  }
}

/** Full rows (for review tooling and tests; avoid on the whole file). */
export function readVintages(path = vintagesPath()): VintageRow[] {
  const out: VintageRow[] = [];
  const split = (s: string) => (s ? s.split(PATH_SEP) : []);
  forEachVintageLine((r, idx) => {
    out.push({
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
    });
  }, path);
  return out;
}

/** series → edition → date → value, matched rows only. */
export type VintageIndex = Map<string, Map<number, Map<string, number>>>;

export function addToIndex(
  index: VintageIndex,
  series: string,
  vintage: number,
  date: string,
  value: number,
): void {
  if (!series || !Number.isFinite(value)) return;
  let byEdition = index.get(series);
  if (!byEdition) index.set(series, (byEdition = new Map()));
  let byDate = byEdition.get(vintage);
  if (!byDate) byEdition.set(vintage, (byDate = new Map()));
  byDate.set(date, value);
}

export function indexVintages(
  rows: VintageRow[],
  index: VintageIndex = new Map(),
): VintageIndex {
  for (const r of rows) addToIndex(index, r.series, r.vintage, r.date, r.value);
  return index;
}

/** Build the index straight from the file, keeping only matched rows' four fields. */
export function indexVintageFile(path = vintagesPath()): VintageIndex {
  const index: VintageIndex = new Map();
  forEachVintageLine((f, c) => {
    const series = f[c.series];
    if (series)
      addToIndex(
        index,
        series,
        Number(f[c.vintage]),
        f[c.date],
        Number(f[c.value]),
      );
  }, path);
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
    cache = { path, mtimeMs, index: indexVintageFile(path) };
  }
  return cache.index;
}

// ─── Latest values for the loader ───────────────────────────────────

export function latestPath(): string {
  return join(databookDir(), "latest.json");
}

/**
 * series → [[date, value], …] of latest-vintage values. Written by `match`
 * next to the vintage file; it is all `Series.load_from_databook` needs,
 * so app/worker processes never load the full vintage index (~0.5 GB).
 */
export function writeLatest(index: VintageIndex, path = latestPath()): void {
  const out: Record<string, Array<[string, number]>> = {};
  for (const [series, byEdition] of index) {
    out[series] = [...latestObserved(byEdition)].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }
  writeFileSync(`${path}.tmp`, JSON.stringify(out));
  renameSync(`${path}.tmp`, path);
}

let latestCache: {
  path: string;
  mtimeMs: number;
  data: Record<string, Array<[string, number]>>;
} | null = null;

/** Latest-vintage values for one series (cached; reloaded when the file changes). */
export function latestFor(
  series: string,
  path = latestPath(),
): Map<string, number> {
  if (!existsSync(path)) {
    throw new Error(
      `Data Book latest-values file not found: ${path} (run match)`,
    );
  }
  const { mtimeMs } = statSync(path);
  if (
    !latestCache ||
    latestCache.path !== path ||
    latestCache.mtimeMs !== mtimeMs
  ) {
    latestCache = {
      path,
      mtimeMs,
      data: JSON.parse(readFileSync(path, "utf8")),
    };
  }
  return new Map(latestCache.data[series] ?? []);
}
