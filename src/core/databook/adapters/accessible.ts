/**
 * Adapter for the 2025+ "accessible" Data Book workbooks
 * (`DB{YYYY}_section{NN}.xlsx`) → EditionIR.
 *
 * Each workbook has a table-of-contents sheet, a narrative sheet, and one
 * sheet per table named `NN.TT`. A table sheet is laid out top to bottom:
 *
 *   title         "Table 1.06-- RESIDENT POPULATION, BY COUNTY:  2010 TO 2025"
 *                 (may wrap onto following rows; titles are ALL CAPS)
 *   headnote      "[Based on place of usual residence …]" (0..n rows)
 *   header        ONE flattened row, the first with ≥2 non-empty cells
 *   data          rows; optional "… hierarchy" column of "Level N" cells;
 *                 stacked panels start at a row that repeats the header shape
 *   footer        "[a] …" footnotes, then "Source: …" (both may wrap)
 *
 * Each panel is planned separately (`planPanel`): long (period down col A
 * or a "Year" column), wide (periods in the header), snapshot (one period
 * from the panel header or the title), else unknown; tables that are mostly
 * text, rankings or name lists are "text". The table's layout is the one
 * covering most cells. One IRCell is emitted per numeric value; anything the
 * rules can't place goes to the table's `warnings` (counted, with examples)
 * for the coverage report rather than into the cells.
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";

import * as XLSX from "xlsx";

import type {
  EditionIR,
  IRCell,
  IRPanel,
  IRTable,
  ParsedPeriod,
  TableLayout,
} from "../ir";
import {
  extractUrl,
  normalizeLabel,
  parseTitle,
  snapshotPeriod,
  splitPeriod,
  type ParsedTitle,
  type PeriodContext,
} from "../labels";

export interface AccessibleSection {
  tables: IRTable[];
  cells: IRCell[];
  /** Section narrative paragraphs (→ category description). */
  narrative?: string;
}

type Raw = string | number | boolean | Date | null;

/** Share of period-column labels that must be periods for a "long" panel. */
const LONG_MIN = 0.8;
/** Share of value-column headers that must carry a period for "wide". */
const WIDE_MIN = 0.6;
/** Share of non-numeric, non-code strings in value columns that makes "text". */
const TEXT_MIN = 0.2;

// ─── Public entry points ────────────────────────────────────────────────

export function readAccessibleEdition(dir: string, edition: number): EditionIR {
  const out: EditionIR = { edition, tables: [], cells: [] };
  const files = new Set(readdirSync(dir));
  for (let section = 1; section <= 24; section++) {
    const name = sectionFileName(edition, section);
    if (!files.has(name))
      throw new Error(`databook: missing ${name} in ${dir}`);
    const { tables, cells } = readAccessibleSection(
      path.join(dir, name),
      edition,
      section,
    );
    out.tables.push(...tables);
    out.cells.push(...cells);
  }
  return out;
}

export function sectionFileName(edition: number, section: number): string {
  return `DB${edition}_section${String(section).padStart(2, "0")}.xlsx`;
}

export function readAccessibleSection(
  filePath: string,
  edition: number,
  section: number,
): AccessibleSection {
  // XLSX.read on a buffer: the ESM build of SheetJS has no fs for readFile.
  const wb = XLSX.read(readFileSync(filePath), {
    type: "buffer",
    cellDates: true,
    cellNF: true,
  });
  return readAccessibleWorkbook(wb, edition, section);
}

/** Core: everything after the file read, so tests can pass a built workbook. */
export function readAccessibleWorkbook(
  wb: XLSX.WorkBook,
  edition: number,
  section: number,
): AccessibleSection {
  const tables: IRTable[] = [];
  const cells: IRCell[] = [];
  let narrative: string | undefined;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (/narrative/i.test(name)) {
      narrative = readNarrative(sheet);
      continue;
    }
    if (!/^\d{1,2}\.\d{1,3}$/.test(name.trim())) continue; // table of contents
    const res = readAccessibleSheet(sheet, name.trim(), edition, section);
    tables.push(res.table);
    cells.push(...res.cells);
  }
  return { tables, cells, ...(narrative ? { narrative } : {}) };
}

// ─── Sheet structure ────────────────────────────────────────────────────

/** Raw grid plus access to the underlying cell (for number formats). */
class Grid {
  readonly rows: Raw[][];
  constructor(
    readonly sheet: XLSX.WorkSheet,
    readonly name: string,
  ) {
    this.rows = XLSX.utils.sheet_to_json<Raw[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    // Dates come back as JS Dates, which (a) SheetJS also produces — as
    // Invalid Date — for STRING cells that carry a date number format
    // ("1985:  June 30" with format d-mmm), and (b) are local-midnight, so
    // their calendar day depends on the TZ. Labels are what we want anyway:
    // use the string value, or the displayed text of a real date cell.
    this.rows.forEach((row, r) =>
      row?.forEach((v, c) => {
        if (!(v instanceof Date)) return;
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        row[c] =
          cell?.t === "s"
            ? String(cell.v)
            : (cell?.w ??
              (isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)));
      }),
    );
  }
  get(r: number, c: number): Raw {
    return this.rows[r]?.[c] ?? null;
  }
  fmt(r: number, c: number): string | undefined {
    const z = this.sheet[XLSX.utils.encode_cell({ r, c })]?.z;
    return typeof z === "string" && z !== "General" ? z : undefined;
  }
  addr(r: number, c: number): string {
    return `${this.name}!${XLSX.utils.encode_cell({ r, c })}`;
  }
  /** Indices of the non-empty cells in row r. */
  filled(r: number): number[] {
    const out: number[] = [];
    (this.rows[r] ?? []).forEach((v, c) => {
      if (!isBlank(v)) out.push(c);
    });
    return out;
  }
}

function isBlank(v: Raw | undefined): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function text(v: Raw): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

interface Layout {
  titleRows: number[];
  headnoteRows: number[];
  headerRow: number;
  /** Rows between the header and the footer (may include panel headers). */
  bodyRows: number[];
  footerRows: number[];
}

const FOOTNOTE_START = /^\s*(?:\[([a-z0-9]{1,2})\]|(\d{1,2})\/)\s+/i;
const SOURCE_START = /^\s*sources?\s*:/i;

/** Mostly-uppercase text: how a wrapped title row differs from a headnote. */
function looksLikeTitle(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.8;
}

function locate(g: Grid): Layout | null {
  const n = g.rows.length;
  const headerRow = g.rows.findIndex(
    (_, r) => r > 0 && g.filled(r).length >= 2,
  );
  if (headerRow < 0) return null;

  const titleRows = [0];
  const headnoteRows: number[] = [];
  for (let r = 1; r < headerRow; r++) {
    const s = text(g.get(r, g.filled(r)[0] ?? 0)).trim();
    if (!s) continue;
    if (
      headnoteRows.length === 0 &&
      titleRows[titleRows.length - 1] === r - 1 &&
      !s.startsWith("[") &&
      looksLikeTitle(s)
    )
      titleRows.push(r);
    else headnoteRows.push(r);
  }

  // The footer starts at the first row (after at least one data row) that
  // has only col A filled: footnotes "[a] …", "Source: …", and the odd legend
  // line ("NA  Not available.", "1/ …") all look like that.
  const bodyRows: number[] = [];
  let r = headerRow + 1;
  for (; r < n; r++) {
    const f = g.filled(r);
    if (f.length === 0) continue;
    const a = text(g.get(r, 0));
    const colAOnly = f.length === 1 && f[0] === 0;
    if (
      colAOnly &&
      (bodyRows.length > 0 || FOOTNOTE_START.test(a) || SOURCE_START.test(a))
    )
      break;
    bodyRows.push(r);
  }
  const footerRows: number[] = [];
  for (; r < n; r++) if (g.filled(r).length) footerRows.push(r);
  return { titleRows, headnoteRows, headerRow, bodyRows, footerRows };
}

/**
 * Join wrapped text lines. DBEDT leaves a trailing space where it broke
 * between words and none where it broke inside one ("(CO-" / "EST2024").
 */
function joinLines(lines: string[]): string {
  let out = "";
  for (const raw of lines) {
    const line = raw.replace(/\r/g, "");
    if (!out) out = line;
    else if (/[\s-]$/.test(out) || /^\s/.test(line)) out += line;
    else out += " " + line;
  }
  return out.replace(/\s+/g, " ").trim();
}

interface Footer {
  footnotes: Record<string, string>;
  source: string;
}

function readFooter(g: Grid, rows: number[]): Footer {
  const footnotes: Record<string, string> = {};
  const source: string[] = [];
  let cur: string[] | null = null;
  let curKey: string | null = null;
  const flush = () => {
    if (curKey && cur) footnotes[curKey] = joinLines(cur);
    cur = null;
    curKey = null;
  };
  let inSource = false;
  for (const r of rows) {
    const line = g
      .filled(r)
      .map((c) => text(g.get(r, c)))
      .join(" ");
    const fm = line.match(FOOTNOTE_START);
    if (fm) {
      flush();
      inSource = false;
      curKey = (fm[1] ?? fm[2]).toLowerCase();
      cur = [line.slice(fm[0].length)];
    } else if (SOURCE_START.test(line)) {
      flush();
      inSource = true;
      source.push(line.trim());
    } else if (inSource) source.push(line);
    else if (cur) cur.push(line);
    else {
      // Legend lines before any footnote ("NA  Not available.").
      curKey = "note";
      cur = footnotes.note ? [footnotes.note, line] : [line];
    }
  }
  flush();
  return { footnotes, source: joinLines(source) };
}

function readNarrative(sheet: XLSX.WorkSheet): string | undefined {
  const rows = XLSX.utils.sheet_to_json<Raw[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const paras = rows
    .map((r) =>
      text(r?.[0] ?? null)
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s && !/^section\s+\d+\s*:/i.test(s));
  return paras.length ? paras.join("\n\n") : undefined;
}

// ─── Values ─────────────────────────────────────────────────────────────

// (NA) (D) (X) (Z) (S) …, dashes, asterisks, "<10", "NA", "N/A".
const SUPPRESSION =
  /^(?:\([A-Z]{1,2}\)|[-–—]{1,3}|\*{1,3}|\.{1,3}|NA|N\/A|n\.a\.|X|Z|D|<\s*\d+(?:\.\d+)?)$/i;
const NUMERIC_STRING =
  /^\(?-?\$?\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$|^-?\$\s*\d+(?:\.\d+)?$/;
const FMT_MARKER = /"\s*\[([a-z0-9]{1,2})\]\s*"/gi;

type Value =
  | { kind: "number"; value: number; markers: string[]; fromString: boolean }
  | { kind: "none"; markers: string[] } // blank, suppression code, bare marker
  | { kind: "text" };

function readValue(v: Raw, numFmt?: string): Value {
  const fmtMarkers = numFmt
    ? [...numFmt.matchAll(FMT_MARKER)].map((m) => m[1].toLowerCase())
    : [];
  if (typeof v === "number" && Number.isFinite(v))
    return { kind: "number", value: v, markers: fmtMarkers, fromString: false };
  if (v == null || typeof v !== "string")
    return v == null ? { kind: "none", markers: [] } : { kind: "text" };
  const { text: s, markers } = normalizeLabel(v);
  const all = [...fmtMarkers, ...markers];
  if (!s || SUPPRESSION.test(s)) return { kind: "none", markers: all };
  if (NUMERIC_STRING.test(s)) {
    const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
    const n = Number(s.replace(/[()$,\s-]/g, ""));
    if (Number.isFinite(n))
      return {
        kind: "number",
        value: neg ? -n : n,
        markers: all,
        fromString: true,
      };
  }
  return { kind: "text" };
}

// ─── Panels ─────────────────────────────────────────────────────────────

interface Column {
  col: number;
  raw: Raw;
  label: string;
  markers: string[];
}

interface Panel {
  index: number;
  label: string;
  /** Sheet row of the panel's header. */
  headRow: number;
  /** Col-A text of that row ("Date [a]", "County: 2024"). */
  head: Raw;
  /** Filled header columns other than col A and hierarchy columns. */
  columns: Column[];
  rows: number[];
}

function headerColumns(g: Grid, r: number, skip: Set<number>): Column[] {
  return g
    .filled(r)
    .filter((c) => c > 0 && !skip.has(c))
    .map((c) => {
      const raw = g.get(r, c);
      const { text: label, markers } = normalizeLabel(text(raw));
      return { col: c, raw, label, markers };
    });
}

/**
 * A body row that repeats the header shape: no numbers, ≥2 non-code strings
 * in value columns, and either mostly non-numeric text or the same labels as
 * the current header (01.05 repeats its "1970", "1980" … string headers).
 */
function isPanelHeader(
  g: Grid,
  r: number,
  skip: Set<number>,
  cur: Panel,
): boolean {
  const vals = g
    .filled(r)
    .filter((c) => c > 0 && !skip.has(c))
    .map((c) => g.get(r, c));
  if (!vals.length || vals.some((v) => typeof v === "number")) return false;
  const strs = vals.filter(
    (v): v is string => typeof v === "string" && readValue(v).kind === "text",
  );
  if (strs.length < vals.length * 0.8) return false;
  // One-value-column tables (01.33 "Race | Race alone" … "Race | Race alone
  // or in combination") only count when col A repeats too.
  if (strs.length < 2)
    return (
      strs.length === 1 &&
      cur.columns.length === 1 &&
      normalizeLabel(text(g.get(r, 0))).text.toLowerCase() ===
        normalizeLabel(text(cur.head)).text.toLowerCase()
    );
  const known = new Set(cur.columns.map((c) => c.label.toLowerCase()));
  const same = strs.filter((s) =>
    known.has(normalizeLabel(s).text.toLowerCase()),
  );
  // Same labels as the header, or a header-like row of non-year text. (In
  // text tables every all-text row looks like this; they emit nothing.)
  return (
    same.length >= strs.length / 2 ||
    strs.every((s) => !/^\d{4}$/.test(s.trim()))
  );
}

function splitPanels(g: Grid, lay: Layout, skip: Set<number>): Panel[] {
  const first: Panel = {
    index: 0,
    label: normalizeLabel(text(g.get(lay.headerRow, 0))).text,
    headRow: lay.headerRow,
    head: g.get(lay.headerRow, 0),
    columns: headerColumns(g, lay.headerRow, skip),
    rows: [],
  };
  const panels = [first];
  let cur = first;
  // A new panel needs data under it: in name lists every row is all text.
  const numeric = (r: number | undefined) =>
    r != null &&
    g
      .filled(r)
      .some((c) => c > 0 && !skip.has(c) && typeof g.get(r, c) === "number");
  for (const [i, r] of lay.bodyRows.entries()) {
    if (numeric(lay.bodyRows[i + 1]) && isPanelHeader(g, r, skip, cur)) {
      cur = {
        index: panels.length,
        label: normalizeLabel(text(g.get(r, 0))).text,
        headRow: r,
        head: g.get(r, 0),
        columns: headerColumns(g, r, skip),
        rows: [],
      };
      panels.push(cur);
    } else cur.rows.push(r);
  }
  // A single-panel table's panel is unlabeled; its header's col-A text
  // ("Date", "Age group") names the row dimension, not a panel.
  if (panels.length === 1) first.label = "";
  return panels;
}

/**
 * "… hierarchy" columns hold `Level N` and are structure, not data. Found by
 * header ("Age group hierarchy", also the misspelt "hierachy") or by content
 * (05.05 "Level Column", 22.07 "Subject level").
 */
function hierarchyColumns(g: Grid, lay: Layout): number[] {
  return g.filled(lay.headerRow).filter((c) => {
    if (c === 0) return false;
    if (/hier\w*chy\s*$/i.test(text(g.get(lay.headerRow, c)))) return true;
    const vals = lay.bodyRows
      .map((r) => g.get(r, c))
      .filter((v) => !isBlank(v));
    return (
      vals.length > 0 &&
      vals.filter((v) => /^level\s*\d+$/i.test(text(v).trim())).length >=
        vals.length * 0.8
    );
  });
}

// ─── Classification ─────────────────────────────────────────────────────

/** How one panel's cells are read. */
interface Plan {
  panel: Panel;
  layout: TableLayout;
  /** Column holding the period, for long panels (col A, or a "Year" column). */
  periodCol: number | null;
  /** Row-label columns, outermost first (col A unless it's the period). */
  dimCols: number[];
  hierCol: number | null;
  /** The dim column whose labels the hierarchy levels nest. */
  hierTarget: number | null;
  values: Column[];
  /** Non-leading text columns, skipped. */
  textCols: Column[];
  /** Single period for snapshot panels and period-less wide columns. */
  period: ParsedPeriod | null;
}

const PERIOD_HEADER = /\b(year|date|period|month|quarter|fiscal)\b/i;

function columnCells(g: Grid, p: Panel, c: number): Raw[] {
  return p.rows.map((r) => g.get(r, c)).filter((v) => !isBlank(v));
}

/** Col A, or a later column headed "Year"/"Date", whose cells are ≥80% periods. */
function findPeriodCol(g: Grid, p: Panel, ctx: PeriodContext): number | null {
  const candidates = [
    0,
    ...p.columns
      .slice(0, 3)
      .filter((c) => PERIOD_HEADER.test(c.label))
      .map((c) => c.col),
  ];
  for (const c of candidates) {
    const vals = columnCells(g, p, c);
    // splitPeriod, not parsePeriod: composite labels ("2022, including
    // gov't", "2010 total") are periods with a dimension residue.
    const periods = vals.filter((v) => splitPeriod(v, ctx) != null);
    if (vals.length && periods.length / vals.length >= LONG_MIN) return c;
  }
  return null;
}

function isTextColumn(g: Grid, p: Panel, c: number): boolean {
  const vals = columnCells(g, p, c);
  return (
    vals.length > 0 &&
    vals.filter((v) => readValue(v).kind === "text").length >= vals.length * 0.8
  );
}

/** Two or more distinct years: "Change between 2010 and 2020", "1990-2000 (%)". */
function multiYear(label: string): boolean {
  return new Set(label.match(/\b(?:1[7-9]|20)\d{2}\b/g) ?? []).size >= 2;
}

function usablePeriod(p: ParsedPeriod | null | undefined): ParsedPeriod | null {
  return p && p.date && p.basis !== "interval" && p.basis !== "unknown"
    ? p
    : null;
}

function planPanel(
  g: Grid,
  p: Panel,
  hierCols: number[],
  ctx: PeriodContext,
  titleSnapshot: ParsedPeriod | null,
): Plan {
  const periodCol = findPeriodCol(g, p, ctx);
  const dimCols = periodCol === 0 ? [] : [0];
  // Leading text columns are row dimensions too: 07.02 "Year | Point of
  // origin | …", 05.06 "Year | Island | …".
  let values = p.columns.filter((c) => c.col !== periodCol);
  while (values.length && isTextColumn(g, p, values[0].col)) {
    dimCols.push(values[0].col);
    values = values.slice(1);
  }
  // Later text columns ("Tax rate per cigarette", "Longest bridge:
  // location") are notes beside the data: drop them, keep the numbers.
  const textCols = values.filter((c) => isTextColumn(g, p, c.col));
  values = values.filter((c) => !textCols.includes(c));

  const hierCol = hierCols[0] ?? null;
  let hierTarget: number | null = null;
  if (hierCol != null && dimCols.length) {
    // "Age group hierarchy" nests the "Age group" column; else the nearest
    // dim column to its left.
    const key = (c: number) =>
      normalizeLabel(text(g.get(p.headRow, c)))
        .text.replace(/\s*hier\w*chy$/i, "")
        .toLowerCase();
    hierTarget =
      dimCols.find((c) => key(c) === key(hierCol)) ??
      [...dimCols].reverse().find((c) => c < hierCol) ??
      dimCols[0];
  }

  const period =
    usablePeriod(splitPeriod(p.head, ctx)?.period) ?? titleSnapshot;
  const plan: Plan = {
    panel: p,
    layout: "unknown",
    periodCol,
    dimCols,
    hierCol,
    hierTarget,
    values,
    textCols,
    period,
  };
  if (!values.length) return plan;
  if (periodCol != null) plan.layout = "long";
  else {
    const periodHeaders = values.filter(
      (c) => splitPeriod(c.raw, ctx) != null || multiYear(c.label),
    );
    if (periodHeaders.length / values.length >= WIDE_MIN) plan.layout = "wide";
    else if (period) plan.layout = "snapshot";
  }
  return plan;
}

/** Share of non-numeric, non-code strings among the panels' value cells. */
function textShare(g: Grid, plans: Plan[]): number {
  let n = 0;
  let txt = 0;
  for (const pl of plans)
    for (const r of pl.panel.rows)
      for (const c of pl.values) {
        const v = g.get(r, c.col);
        if (isBlank(v)) continue;
        n++;
        if (readValue(v).kind === "text") txt++;
      }
  return n ? txt / n : 0;
}

/**
 * Rankings and name lists: col A counts 1, 2, 3 … beside a text column
 * ("Rank | State | Value", "Top 25 water users"), or text columns outnumber
 * the value columns (earthquakes, tallest structures).
 */
function isListing(g: Grid, plans: Plan[]): boolean {
  return plans.some((pl) => {
    if (!pl.panel.rows.length) return false;
    const extraDims = pl.dimCols.filter((c) => c !== 0).length;
    if (extraDims + pl.textCols.length >= Math.max(1, pl.values.length))
      return true;
    if (!extraDims) return false;
    const ranks = pl.panel.rows
      .map((r) => g.get(r, 0))
      .filter((v) => !isBlank(v))
      .map((v) => Number(text(v).replace(/[^\d.]/g, "")));
    const ascending = ranks.filter((n, i) => i > 0 && n >= ranks[i - 1]);
    return (
      ranks.length >= 5 &&
      ranks.every((n) => Number.isInteger(n) && n > 0 && n <= 1000) &&
      ascending.length >= (ranks.length - 1) * 0.8
    );
  });
}

// ─── Emission ───────────────────────────────────────────────────────────

/** Running stack of row labels by hierarchy level. */
class RowPath {
  private stack: string[] = [];
  push(label: string, level: number): string[] {
    this.stack.length = Math.max(0, level - 1);
    while (this.stack.length < level - 1) this.stack.push("");
    this.stack.push(label);
    return this.stack.filter(Boolean);
  }
}

function hierarchyLevel(v: Raw): number | null {
  const m = text(v).match(/level\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

class Warnings {
  private counts = new Map<string, number>();
  private examples = new Map<string, string[]>();
  add(kind: string, example?: string) {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
    if (example) {
      const ex = this.examples.get(kind) ?? [];
      if (ex.length < 3 && !ex.includes(example)) ex.push(example);
      this.examples.set(kind, ex);
    }
  }
  /** "kind: detail (n; e.g. …)" — the text before ":" groups the report. */
  list(): string[] {
    return [...this.counts].map(([k, n]) => {
      const ex = this.examples.get(k);
      return `${k} (${n}${ex?.length ? `; e.g. ${ex.join(" | ")}` : ""})`;
    });
  }
}

interface Emit {
  g: Grid;
  tableNum: string;
  ctx: PeriodContext;
  warn: Warnings;
  cells: IRCell[];
}

function pushCell(
  e: Emit,
  r: number,
  c: number,
  panel: number,
  rowPath: string[],
  colPath: string[],
  period: ParsedPeriod,
  markers: string[],
) {
  const numFmt = e.g.fmt(r, c);
  const v = readValue(e.g.get(r, c), numFmt);
  if (v.kind !== "number") return;
  if (v.fromString)
    e.warn.add("numeric-string: value parsed from text", e.g.addr(r, c));
  if (period.basis === "interval") {
    e.warn.add("interval: skipped interval period", period.label);
    return;
  }
  if (!period.date) {
    e.warn.add(
      "no-period: skipped cell without a usable period",
      e.g.addr(r, c),
    );
    return;
  }
  e.cells.push({
    tableNum: e.tableNum,
    panel,
    rowPath,
    colPath,
    period,
    value: v.value,
    cellAddr: e.g.addr(r, c),
    ...(numFmt ? { numFmt } : {}),
    markers: [...new Set([...markers, ...v.markers])],
  });
}

function hasNumber(e: Emit, r: number, cols: Column[]): boolean {
  return cols.some((c) => readValue(e.g.get(r, c.col)).kind === "number");
}

/** Row label path from the dim columns (hierarchy-aware) + its markers. */
function rowLabels(
  e: Emit,
  pl: Plan,
  r: number,
  stack: RowPath,
): { path: string[]; markers: string[] } {
  const path: string[] = [];
  const markers: string[] = [];
  for (const d of pl.dimCols) {
    const n = normalizeLabel(text(e.g.get(r, d)));
    markers.push(...n.markers);
    const level =
      d === pl.hierTarget && pl.hierCol != null
        ? hierarchyLevel(e.g.get(r, pl.hierCol))
        : null;
    if (level != null) path.push(...stack.push(n.text, level));
    else if (n.text) path.push(n.text);
  }
  return { path, markers };
}

function emitLong(e: Emit, pl: Plan) {
  const stack = new RowPath();
  let lastPeriod: Raw = null;
  for (const r of pl.panel.rows) {
    const { path, markers } = rowLabels(e, pl, r, stack);
    // Continuation rows under a "Year" column leave it blank: fill down.
    const cell: Raw = e.g.get(r, pl.periodCol!);
    const raw: Raw = isBlank(cell) ? lastPeriod : cell;
    lastPeriod = raw;
    const sp = raw == null ? null : splitPeriod(raw, e.ctx);
    if (!sp) {
      if (hasNumber(e, r, pl.values))
        e.warn.add(
          "long-nonperiod-row: skipped row whose label is not a period",
          text(raw),
        );
      continue;
    }
    const rowPath = sp.residue ? [...path, sp.residue] : path;
    const pMarkers = normalizeLabel(text(raw)).markers;
    for (const c of pl.values)
      pushCell(
        e,
        r,
        c.col,
        pl.panel.index,
        rowPath,
        c.label ? [c.label] : [],
        sp.period,
        [...markers, ...pMarkers, ...c.markers],
      );
  }
}

type ColInfo =
  | { period: ParsedPeriod; colPath: string[] }
  | { skip: "interval" | "no-period" };

/** Append " (2)", " (3)" … to the last element of a repeated path. */
function disambiguate(
  path: string[],
  seen: Map<string, number>,
  scope = "",
): string[] {
  const k = JSON.stringify([scope, ...path]);
  const n = (seen.get(k) ?? 0) + 1;
  seen.set(k, n);
  if (n === 1) return path;
  return path.length
    ? [...path.slice(0, -1), `${path[path.length - 1]} (${n})`]
    : [`(${n})`];
}

/** Wide and snapshot panels: rows are dims; the period comes per column. */
function emitGrid(e: Emit, pl: Plan) {
  const colSeen = new Map<string, number>();
  const cols = pl.values.map((c): [Column, ColInfo] => {
    let info: ColInfo;
    const sp = pl.layout === "wide" ? splitPeriod(c.raw, e.ctx) : null;
    if (sp)
      info = { period: sp.period, colPath: sp.residue ? [sp.residue] : [] };
    else if (pl.layout === "wide" && multiYear(c.label))
      info = { skip: "interval" };
    else if (pl.period)
      info = { period: pl.period, colPath: c.label ? [c.label] : [] };
    else info = { skip: "no-period" };
    if ("colPath" in info) {
      const path = disambiguate(info.colPath, colSeen, info.period.date ?? "");
      if (path !== info.colPath)
        e.warn.add("repeated-column-label: suffixed with (n)", c.label);
      info.colPath = path;
    }
    return [c, info];
  });

  const stack = new RowPath();
  const rowSeen = new Map<string, number>();
  for (const r of pl.panel.rows) {
    const { path, markers } = rowLabels(e, pl, r, stack);
    if (!hasNumber(e, r, pl.values)) {
      disambiguate(path, rowSeen); // label-only rows still claim their path
      continue;
    }
    if (!path.length)
      e.warn.add("unlabeled-row: numeric row without a label", e.g.addr(r, 0));
    const rowPath = disambiguate(path, rowSeen);
    if (rowPath !== path)
      e.warn.add("repeated-row-label: suffixed with (n)", rowPath.join(" > "));
    for (const [c, info] of cols) {
      if ("skip" in info) {
        if (readValue(e.g.get(r, c.col)).kind === "number")
          e.warn.add(
            info.skip === "interval"
              ? "interval: skipped interval column"
              : "no-period: column has no period and neither panel nor title names one",
            c.label,
          );
        continue;
      }
      pushCell(
        e,
        r,
        c.col,
        pl.panel.index,
        rowPath,
        info.colPath,
        info.period,
        [...markers, ...c.markers],
      );
    }
  }
}

/**
 * Pick the one cell to keep among cells sharing (panel, rowPath, colPath,
 * date), or null to drop them all. "2010: April 1" and "2010: July 1" both
 * date to 2010; the calendar / July 1 label is the regular estimate and
 * April 1 the census base. Same rule as the legacy adapter, so both
 * editions resolve the same rows.
 */
function pickDuplicate(g: IRCell[]): IRCell | null {
  if (
    new Set(g.map((c) => c.value)).size === 1 &&
    new Set(g.map((c) => c.period.label)).size === 1
  )
    return g[0]; // repeated identical cell
  const only = (xs: IRCell[]) => (xs.length === 1 ? xs[0] : null);
  const point = (c: IRCell) => c.period.point ?? "";
  return (
    only(g.filter((c) => c.period.basis === "calendar")) ??
    only(g.filter((c) => /^jul/i.test(point(c)))) ??
    (g.length === 2
      ? only(g.filter((c) => !/^apr\w*\.?\s*1$/i.test(point(c))))
      : null)
  );
}

function dedupe(cells: IRCell[], warn: Warnings): IRCell[] {
  const groups = new Map<string, IRCell[]>();
  for (const c of cells) {
    const k = JSON.stringify([c.panel, c.rowPath, c.colPath, c.period.date]);
    const g = groups.get(k);
    if (g) g.push(c);
    else groups.set(k, [c]);
  }
  const keep = new Set<IRCell>();
  for (const g of groups.values()) {
    if (g.length === 1) {
      keep.add(g[0]);
      continue;
    }
    const winner = pickDuplicate(g);
    if (winner) {
      keep.add(winner);
      for (const c of g)
        if (c.period.label !== winner.period.label)
          warn.add(
            "duplicate-period: dropped cell sharing a date",
            `kept "${winner.period.label}", dropped "${c.period.label}"`,
          );
    } else
      warn.add(
        "duplicate-period-unresolved: dropped all cells sharing a date",
        `${[...g[0].rowPath, ...g[0].colPath].join(" > ")} @ ${g.map((c) => c.period.label).join(" / ")}`,
      );
  }
  return cells.filter((c) => keep.has(c));
}

// ─── Table ──────────────────────────────────────────────────────────────

export function readAccessibleSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  edition: number,
  section: number,
): { table: IRTable; cells: IRCell[] } {
  const g = new Grid(sheet, sheetName);
  const warn = new Warnings();
  const table: IRTable = {
    edition,
    section,
    tableNum: sheetName,
    sheet: sheetName,
    title: "",
    titlePeriod: "",
    headnote: "",
    footnotes: {},
    source: "",
    sourceUrl: null,
    layout: "unknown",
    panels: [],
    warnings: [],
  };

  const lay = locate(g);
  if (!lay) {
    table.title = parseTitle(g.get(0, 0)).title;
    table.warnings.push("no-header: no row with two or more filled cells");
    return { table, cells: [] };
  }

  const pt = parseTitle(joinLines(lay.titleRows.map((r) => text(g.get(r, 0)))));
  if (pt.tableNum) {
    table.tableNum = pt.tableNum;
    if (pt.tableNum !== sheetName)
      warn.add("table-number: title disagrees with sheet name", pt.tableNum);
  } else warn.add("no-title: row 1 is not a 'Table N.NN--' title");
  table.title = pt.title;
  table.titlePeriod = pt.period;
  table.headnote = joinLines(
    lay.headnoteRows.map((r) =>
      g
        .filled(r)
        .map((c) => text(g.get(r, c)))
        .join(" "),
    ),
  );
  const footer = readFooter(g, lay.footerRows);
  table.footnotes = footer.footnotes;
  table.source = footer.source;
  table.sourceUrl = extractUrl(footer.source);
  if (!footer.source) warn.add("no-source: no 'Source:' line");

  const hierCols = hierarchyColumns(g, lay);
  const panels = splitPanels(g, lay, new Set(hierCols));
  table.panels = panels.map((p): IRPanel => ({
    index: p.index,
    label: p.label,
    headers: {
      // Column A's header ("Age", "ZIP code") names the row labels; naming
      // uses it for rows labelled only by a number.
      0: [normalizeLabel(text(g.get(lay.headerRow, 0))).text].filter(Boolean),
      ...Object.fromEntries(
        p.columns.map((c) => [c.col, c.label ? [c.label] : []]),
      ),
    },
  }));

  // Spans like "2019-2020" need context to tell fiscal / school / ACS apart;
  // the source line is where "American Community Survey 5-Year" usually is.
  const ctx: PeriodContext = {
    text: [
      table.title,
      table.titlePeriod,
      table.headnote,
      ...g.filled(lay.headerRow).map((c) => text(g.get(lay.headerRow, c))),
      table.source,
    ].join(" "),
  };
  const titleSnapshot = titleSnapshotPeriod(pt, ctx);
  const plans = panels.map((p) =>
    planPanel(g, p, hierCols, ctx, titleSnapshot),
  );

  const e: Emit = { g, tableNum: table.tableNum, ctx, warn, cells: [] };
  if (textShare(g, plans) > TEXT_MIN || isListing(g, plans))
    table.layout = "text";
  else {
    table.layout = dominantLayout(plans);
    for (const pl of plans) {
      for (const c of pl.textCols)
        warn.add("text-column: skipped non-numeric column", c.label);
      if (pl.layout === "long") emitLong(e, pl);
      else if (pl.layout === "wide" || pl.layout === "snapshot")
        emitGrid(e, pl);
      else if (pl.panel.rows.some((r) => hasNumber(e, r, pl.values)))
        warn.add(
          "unknown-layout: no period axis and neither panel nor title names a single period",
          pl.panel.label || undefined,
        );
    }
    const kinds = new Set(
      plans.filter((p) => p.panel.rows.length).map((p) => p.layout),
    );
    if (kinds.size > 1)
      warn.add(`mixed-layout: panels are ${[...kinds].join(" + ")}`);
  }

  const cells = dedupe(e.cells, warn);
  table.warnings = warn.list();
  return { table, cells };
}

/**
 * The single period a title names. Beyond `snapshotPeriod`, accept one year
 * token inside a qualifier ("ANNUAL AVERAGE, 2025", "TAX YEAR 2022", "2025
 * 4TH QUARTER", "CIRCA 2010") and, for titles with no ":" period part, one
 * token in the title text ("… FOR SCHOOL YEAR 2025-2026", "… DURING 2022").
 */
function titleSnapshotPeriod(
  pt: ParsedTitle,
  ctx: PeriodContext,
): ParsedPeriod | null {
  const direct = snapshotPeriod(pt.period, ctx);
  if (direct) return direct;
  if (/\bto\b|\band\b/i.test(pt.period)) return null;
  return usablePeriod(splitPeriod(pt.period || pt.title, ctx)?.period);
}

/** The layout covering the most value cells (panels may differ: 18.17). */
function dominantLayout(plans: Plan[]): TableLayout {
  const weight = new Map<TableLayout, number>();
  for (const pl of plans)
    weight.set(
      pl.layout,
      (weight.get(pl.layout) ?? 0) + pl.panel.rows.length * pl.values.length,
    );
  let best: TableLayout = "unknown";
  let max = 0;
  for (const [k, w] of weight)
    if (w > max) {
      best = k;
      max = w;
    }
  return best;
}
