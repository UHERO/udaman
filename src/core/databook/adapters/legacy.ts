/**
 * Legacy Data Book adapter: 2002–2024 print-layout `.xls` editions → IR.
 *
 * The legacy sheets are laid out for print, not for machines, so structure
 * has to be inferred (docs/2026-10-10-databook-universe-plan.md §1.2):
 *
 *   1      Table 1.06-- RESIDENT POPULATION, BY COUNTIES:  1980 TO 2002   ← title (may wrap)
 *   3-6    [Based on place of usual residence … ]                        ← headnote
 *   8      Date | | State total 1/ | City and County of Honolulu | …      ← header block
 *                                                                          (band rows above leaves)
 *   10     1980: | April 1 | 964691 | …                                   ← data region
 *   11           | July 1  | 968500 | …                                   (split date, blank spacers,
 *   40     1/  Population estimates after …                               indentation hierarchy, wrapped
 *   44     Source:  U.S. Bureau of the Census …                            labels, year panels)
 *
 * The pipeline per sheet is:
 *   1. locate title / headnote / header block / data region / footer
 *   2. turn data-region rows into logical rows (wrapped labels joined,
 *      continuation pages dropped, mid-sheet header blocks recognized)
 *   3. classify the layout (same rules as the 2025 accessible adapter)
 *   4. walk the rows, tracking panels and the indentation stack, and emit
 *      one IRCell per numeric value.
 *
 * Heuristics are deliberately conservative: anything ambiguous lands in the
 * table's `warnings` so the coverage report surfaces it, and per-table
 * overrides (plan §2.1) cover what the heuristics miss.
 */

import { readFileSync } from "fs";
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
  parsePeriod,
  parseTitle,
  snapshotPeriod,
  splitPeriod,
  type PeriodContext,
  type SplitPeriod,
} from "../labels";

export interface LegacySectionIR {
  tables: IRTable[];
  cells: IRCell[];
  /** Text of the section's Narrative sheet, when it has one. */
  narrative?: string;
}

type Raw = unknown;
type Grid = Raw[][];

// ─── Cell classification ────────────────────────────────────────────────

/**
 * Suppression / "no data" codes: (NA) (D) (X) (Z) (S) NA, Census size-range
 * letters "(C)" / "G", dashes, asterisks, dots, ellipses and footnote-only
 * cells like "(2/)". Bare multi-letter words ("PV", "MSW") are not codes —
 * they show up as header text.
 */
const CODE_RE =
  /^(?:\((?:[A-Za-z]{1,2}|N\/A|NM|NR|\*)\)|NA|N\/A|n\.a\.|[A-Z]|[-\u2013\u2014.*\u2026]+|\(\d{1,2}\/\)|\d{1,2}\/|x)$/;
const NUMERIC_STR_RE = /^\(?-?\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?\)?$/;

interface ValueCell {
  kind: "num" | "code" | "text";
  num?: number;
  text?: string;
  markers: string[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Cell text; date cells (header "April 1, 2010") as "Month D, YYYY". */
function str(v: Raw): string {
  if (v == null) return "";
  if (v instanceof Date) {
    // SheetJS builds dates at local midnight; read local parts.
    if (isNaN(v.getTime())) return "";
    return `${MONTH_NAMES[v.getMonth()]} ${v.getDate()}, ${v.getFullYear()}`;
  }
  return String(v);
}

function isBlank(v: Raw): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** Classify one value-area cell. Returns null for blank cells. */
function valueCell(v: Raw): ValueCell | null {
  if (isBlank(v)) return null;
  if (typeof v === "number")
    return Number.isFinite(v) ? { kind: "num", num: v, markers: [] } : null;
  if (typeof v === "boolean" || v instanceof Date)
    return { kind: "text", text: str(v), markers: [] };
  const s = String(v).trim();
  if (CODE_RE.test(s)) return { kind: "code", markers: [] };
  // "12,345 1/" — numeric string with a trailing footnote marker.
  const { text, markers } = normalizeLabel(s);
  const t = text.replace(/\s+/g, "");
  if (NUMERIC_STR_RE.test(t) && !/^\(.*\)$/.test(t)) {
    const n = Number(t.replace(/[,$%()]/g, ""));
    if (Number.isFinite(n)) return { kind: "num", num: n, markers };
  }
  if (CODE_RE.test(text)) return { kind: "code", markers };
  return { kind: "text", text: s, markers };
}

function isYearNum(v: Raw): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1700 && v <= 2100;
}

/** Leading-space indentation of a print label (tabs count as 4). */
function indentOf(v: Raw): number {
  if (typeof v !== "string") return 0;
  const m = v.match(/^[ \u00a0\t]*/);
  return m ? m[0].replace(/\t/g, "    ").length : 0;
}

// ─── Row-shape predicates ───────────────────────────────────────────────

const FOOTNOTE_RE = /^\s*(\d{1,2})\/\s+(.*)$/s;
const SOURCE_RE = /^\s*Sources?\s*:\s*(.*)$/is;
const NOTE_RE = /^\s*Notes?\s*:\s*(.*)$/is;
/** Symbol legends printed above the footnotes: "NA  Not available." */
const LEGEND_RE = /^\s*(\(?[A-Z]{1,3}\)?|[-–—*.]{1,3}|\(\*\))\s{2,}([A-Z].*)$/s;
const CONTINUED_RE = /^\s*continued\b/i;
const TITLE_RE = /^\s*Table\s+\d{1,2}\.\d{1,3}\s*-/i;
const CON_RE = /-+\s*Con\.?\s*$/i;
/** "-- Con." / "-- continued" on headers repeated on a continuation page. */
const CON_SUFFIX = /\s*-+\s*(?:con\.?|continued)\s*$/i;

/** Text of the row's cells joined (for footer lines that spill into B…). */
function rowText(row: Raw[] | undefined): string {
  if (!row) return "";
  return row
    .filter((v) => !isBlank(v))
    .map(str)
    .join(" ");
}

function onlyColA(row: Raw[] | undefined): boolean {
  if (!row) return false;
  return row.every((v, j) => j === 0 || isBlank(v)) && !isBlank(row[0]);
}

function hasNumberBeyondA(row: Raw[] | undefined): boolean {
  if (!row) return false;
  for (let j = 1; j < row.length; j++) {
    if (valueCell(row[j])?.kind === "num") return true;
  }
  return false;
}

/**
 * A row of column years ("1990 | 2000 | 2010") — a header, not data. At
 * least two distinct year numbers, strictly monotonic, and no other numbers.
 */
function isYearHeaderRow(row: Raw[] | undefined): boolean {
  if (!row) return false;
  const nums: number[] = [];
  for (let j = 1; j < row.length; j++) {
    const c = valueCell(row[j]);
    if (c?.kind !== "num") continue;
    if (!isYearNum(row[j]) && !(c.num != null && isYearNum(c.num)))
      return false;
    nums.push(c.num!);
  }
  if (nums.length < 2 || new Set(nums).size < 2) return false;
  const up = nums.every((n, i) => i === 0 || n >= nums[i - 1]);
  const down = nums.every((n, i) => i === 0 || n <= nums[i - 1]);
  if (up || down) return true;
  // The same years repeated under each band: 2022 2023 | 2022 2023 (07.24).
  const runs: number[][] = [[nums[0]]];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > nums[i - 1]) runs[runs.length - 1].push(nums[i]);
    else runs.push([nums[i]]);
  }
  const first = runs[0].join(",");
  return (
    runs.length > 1 &&
    runs[0].length > 1 &&
    runs.every((r, i) => r.join(",") === first || i === runs.length - 1)
  );
}

/**
 * A header of ordinal column numbers ("Size of family unit" over 1 2 3 … 8,
 * 13.30): at least 3 numbers counting up by one from 0 or 1.
 */
function isOrdinalHeaderRow(row: Raw[] | undefined): boolean {
  if (!row) return false;
  const nums: number[] = [];
  for (let j = 1; j < row.length; j++) {
    if (typeof row[j] === "number") nums.push(row[j] as number);
  }
  return (
    nums.length >= 3 &&
    (nums[0] === 0 || nums[0] === 1) &&
    nums.every((n, i) => n === nums[0] + i)
  );
}

function isHeaderNumbers(row: Raw[] | undefined): boolean {
  return isYearHeaderRow(row) || isOrdinalHeaderRow(row);
}

/** Footer start: footnote, Source:, Note:, or a symbol legend — text only. */
function isFooterStart(row: Raw[] | undefined): boolean {
  if (!row || isBlank(row[0]) || typeof row[0] !== "string") return false;
  if (hasNumberBeyondA(row)) return false;
  const a = row[0];
  return (
    FOOTNOTE_RE.test(a) ||
    SOURCE_RE.test(a) ||
    NOTE_RE.test(a) ||
    LEGEND_RE.test(a)
  );
}

// ─── Label continuation heuristics ──────────────────────────────────────

const CONNECTORS = new Set([
  "and",
  "or",
  "of",
  "the",
  "for",
  "in",
  "to",
  "by",
  "with",
  "from",
  "at",
  "on",
  "per",
  "a",
  "an",
  "including",
  "excluding",
  "except",
  "than",
  "nor",
  "&",
]);

/** Text that can't end a label: trailing comma/hyphen/connector, open paren. */
function endsIncomplete(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[,\-&/(]$/.test(t)) return true;
  const open = (t.match(/\(/g) ?? []).length;
  const close = (t.match(/\)/g) ?? []).length;
  if (open > close) return true;
  const last = t.split(/\s+/).pop()!.toLowerCase();
  return CONNECTORS.has(last);
}

/** Text that can't start a label: lowercase, "(", "&", "-". */
function startsContinuation(text: string): boolean {
  const t = text.trim();
  return /^[a-z(&]/.test(t) || /^-\s*\w/.test(t);
}

// ─── Header blocks ──────────────────────────────────────────────────────

interface HeaderInfo {
  /** Normalized header path per 0-based column. */
  paths: Record<number, string[]>;
  markers: Record<number, string[]>;
  /** All header text, for period context. */
  text: string;
  /** Column A header text ("Date", "Year", "Subject and year"). */
  stub: string;
}

type MergeIndex = Map<string, XLSX.Range>;

function mergeIndex(sheet: XLSX.WorkSheet): MergeIndex {
  const idx: MergeIndex = new Map();
  for (const m of sheet["!merges"] ?? []) idx.set(`${m.s.r},${m.s.c}`, m);
  return idx;
}

/**
 * Build column header paths from a block of header rows.
 *
 * Every row but the last can hold BANDS: a label that spans several leaf
 * columns. A band spans its merge range when there is one, else it is filled
 * rightward until the next non-empty cell in the same row (or the last value
 * column) — the print layout puts the band text in its first column and
 * leaves the rest empty. A one-column "band" is really a header label
 * wrapped onto two rows, as is a band whose text visibly continues on the
 * next row ("City and" / "County"), and those are concatenated instead.
 *
 * Each column's path is outermost first: bands, then the leaf text.
 */
function buildHeaders(
  grid: Grid,
  rowIdxs: number[],
  valueCols: number[],
  merges: MergeIndex,
  /** Columns a band never spans across (block "Year" columns, 12.49). */
  barriers: number[] = [],
): HeaderInfo {
  const paths: Record<number, string[]> = {};
  const markers: Record<number, string[]> = {};
  const texts: string[] = [];
  const lastCol = valueCols.length ? valueCols[valueCols.length - 1] : 0;
  const isValueCol = new Set(valueCols);

  // per column: list of { text, band: originKey | null }
  const parts = new Map<number, { text: string; band: string | null }[]>();
  for (const c of valueCols) parts.set(c, []);

  rowIdxs.forEach((r, k) => {
    const row = grid[r] ?? [];
    const last = k === rowIdxs.length - 1;
    const filled: number[] = [];
    for (let c = 1; c < Math.max(row.length, lastCol + 1); c++) {
      if (!isBlank(row[c])) filled.push(c);
    }
    for (let i = 0; i < filled.length; i++) {
      const c = filled[i];
      const text = str(row[c]).replace(CON_SUFFIX, "");
      texts.push(text);
      const m = merges.get(`${r},${c}`);
      let end = c;
      if (m && m.e.c > c) end = m.e.c;
      else if (!last) {
        end = i + 1 < filled.length ? filled[i + 1] - 1 : lastCol;
        const stop = barriers.find((b) => b > c && b <= end);
        if (stop != null) end = stop - 1;
      }
      const below = rowIdxs[k + 1] != null ? grid[rowIdxs[k + 1]]?.[c] : null;
      const wraps =
        !m &&
        !isBlank(below) &&
        (endsIncomplete(normalizeLabel(text).text) ||
          startsContinuation(str(below)));
      const band = end > c && !wraps ? `${r},${c},${end}` : null;
      for (let cc = c; cc <= (band ? end : c); cc++) {
        if (!isValueCol.has(cc)) continue;
        parts.get(cc)!.push({ text, band });
      }
    }
  });

  for (const c of valueCols) {
    const elems: string[] = [];
    const ms: string[] = [];
    let buf = "";
    let prevBand: string | null = null;
    const flush = () => {
      // "establish-     ments": a print line break inside a word.
      const n = normalizeLabel(buf.replace(/([a-z])-\s+([a-z])/g, "$1$2"));
      if (n.text) elems.push(n.text);
      ms.push(...n.markers);
      buf = "";
    };
    for (const p of parts.get(c)!) {
      if (p.band) {
        // A band's own wrapped second line has the same column span.
        const span = p.band.split(",").slice(1).join(",");
        if (prevBand && prevBand.split(",").slice(1).join(",") === span) {
          buf += " " + p.text;
        } else {
          flush();
          buf = p.text;
        }
        prevBand = p.band;
        continue;
      }
      if (prevBand) {
        flush();
        prevBand = null;
      }
      buf += (buf ? " " : "") + p.text;
    }
    flush();
    paths[c] = elems;
    markers[c] = [...new Set(ms)];
  }

  const stub = rowIdxs
    .map((r) => str(grid[r]?.[0]))
    .filter((s) => s.trim())
    .join(" ");
  return {
    paths,
    markers,
    text: [stub, ...texts].join(" "),
    stub: normalizeLabel(stub).text,
  };
}

// ─── Logical rows ───────────────────────────────────────────────────────

type RowKind = "blank" | "label" | "data" | "header";

interface LRow {
  r: number; // sheet row of the values (last physical row for wrapped labels)
  kind: RowKind;
  rawLabel: Raw;
  label: string;
  markers: string[];
  indent: number;
  /** Text of label columns other than A (e.g. a "Unit" column, split-date B). */
  extra: string[];
  values: Map<number, ValueCell>;
  /** Header row on a continuation page ("Continued on next page."). */
  afterCont?: boolean;
}

// ─── Table parsing ──────────────────────────────────────────────────────

interface TableResult {
  table: IRTable;
  cells: IRCell[];
}

interface Footer {
  footnotes: Record<string, string>;
  source: string;
}

function parseFooter(grid: Grid, from: number): Footer {
  const footnotes: Record<string, string> = {};
  const sourceParts: string[] = [];
  let cur: { key: string } | { source: true } | null = null;
  for (let r = from; r < grid.length; r++) {
    const text = rowText(grid[r]).trim();
    if (!text) continue;
    let m: RegExpMatchArray | null;
    if ((m = text.match(SOURCE_RE))) {
      cur = { source: true };
      sourceParts.push(m[1]);
    } else if (cur && "source" in cur) {
      sourceParts.push(text);
    } else if ((m = text.match(FOOTNOTE_RE))) {
      cur = { key: m[1] };
      footnotes[m[1]] = m[2].trim();
    } else if ((m = text.match(NOTE_RE))) {
      cur = { key: "note" };
      footnotes.note = m[1].trim();
    } else if ((m = text.match(LEGEND_RE))) {
      const key = m[1].replace(/[()]/g, "") || m[1];
      cur = { key };
      footnotes[key] = m[2].trim();
    } else if (CONTINUED_RE.test(text) || TITLE_RE.test(text)) {
      continue;
    } else if (cur && "key" in cur) {
      footnotes[cur.key] = `${footnotes[cur.key]} ${text}`.trim();
    }
  }
  for (const k of Object.keys(footnotes))
    footnotes[k] = footnotes[k].replace(/\s+/g, " ").trim();
  return {
    footnotes,
    source: sourceParts.join(" ").replace(/\s+/g, " ").trim(),
  };
}

const MONTH_START =
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{1,2})?\s*$/i;

function yearPart(v: Raw): number | null {
  if (isYearNum(v)) return v;
  const m = str(v).match(/^\s*(\d{4})\s*:?\s*$/);
  return m && isYearNum(+m[1]) ? +m[1] : null;
}

function parseLegacyTable(
  sheetName: string,
  sheet: XLSX.WorkSheet,
  grid: Grid,
  titleRow: number,
  edition: number,
  section: number,
): TableResult | null {
  const warnings: string[] = [];
  const merges = mergeIndex(sheet);

  // 1. Title, possibly wrapped over up to 3 rows.
  let titleText = str(grid[titleRow]?.[0]);
  let r = titleRow + 1;
  const hasPeriod = (t: string) => /:\s*[^:]*\d{4}[^:]*$/.test(t);
  while (
    r < titleRow + 3 &&
    !hasPeriod(titleText) &&
    onlyColA(grid[r]) &&
    !str(grid[r][0]).trim().startsWith("[")
  ) {
    titleText += " " + str(grid[r][0]);
    r++;
  }
  const pt = parseTitle(titleText);
  if (!pt.tableNum) return null;

  // 2. Headnote "[ … ]".
  const skipBlank = () => {
    while (r < grid.length && (grid[r] ?? []).every(isBlank)) r++;
  };
  skipBlank();
  let headnote = "";
  if (onlyColA(grid[r]) && str(grid[r][0]).trim().startsWith("[")) {
    const lines: string[] = [];
    // Ends at "]"; a headnote that never closes (18.04) ends at the first
    // blank row or the first row with cells beyond col A.
    for (let k = 0; k < 15 && r < grid.length; k++, r++) {
      if (k > 0 && !onlyColA(grid[r])) break;
      const t = rowText(grid[r]);
      lines.push(t);
      if (t.includes("]")) {
        r++;
        break;
      }
    }
    headnote = lines
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\[\s*|\s*\]$/g, "");
  }
  skipBlank();
  const bodyStart = r;

  // 3. Footer: first footnote / Source / legend row after the body starts.
  let end = grid.length;
  for (let i = bodyStart; i < grid.length; i++) {
    if (isFooterStart(grid[i])) {
      end = i;
      break;
    }
  }
  const footer = parseFooter(grid, end);
  let afterFooterNums = 0;
  for (let i = end; i < grid.length; i++) {
    if (hasNumberBeyondA(grid[i])) afterFooterNums++;
  }
  if (afterFooterNums > 0)
    warnings.push(`${afterFooterNums} numeric rows after the footer start`);

  // 4. First data row: first row with a number beyond col A that isn't a
  //    row of column years.
  let firstData = -1;
  for (let i = bodyStart; i < end; i++) {
    if (hasNumberBeyondA(grid[i]) && !isHeaderNumbers(grid[i])) {
      firstData = i;
      break;
    }
  }

  // Header block: rows in [bodyStart, firstData) with content beyond col A.
  // Col-A-only rows after the last such row belong to the data region.
  const headerEnd = firstData < 0 ? end : firstData;
  let lastHeader = -1;
  for (let i = bodyStart; i < headerEnd; i++) {
    const row = grid[i] ?? [];
    if (row.some((v, j) => j > 0 && !isBlank(v))) lastHeader = i;
  }
  const headerRows: number[] = [];
  for (let i = bodyStart; i <= lastHeader; i++) {
    if (!(grid[i] ?? []).every(isBlank)) headerRows.push(i);
  }
  const dataStart = lastHeader >= 0 ? lastHeader + 1 : bodyStart;

  // 5. Columns. Width = widest row in header + data region.
  let width = 0;
  for (let i = bodyStart; i < end; i++)
    width = Math.max(width, (grid[i] ?? []).length);

  // Data rows (provisional): a number beyond col A.
  const provData: number[] = [];
  for (let i = dataStart; i < end; i++) {
    if (hasNumberBeyondA(grid[i]) && !isHeaderNumbers(grid[i]))
      provData.push(i);
  }

  // Split date: col B holds "April 1" / "July 1" on most data rows.
  let splitDate = false;
  if (provData.length) {
    let monthB = 0;
    for (const i of provData)
      if (MONTH_START.test(normalizeLabel(grid[i][1]).text)) monthB++;
    splitDate = monthB / provData.length >= 0.5;
  }

  // Leading text columns (B, C, … before the first numeric column) that
  // hold labels on most data rows: a "Unit" column, a name column.
  const labelCols: number[] = [];
  for (let c = 1; c < width; c++) {
    if (splitDate && c === 1) {
      labelCols.push(c);
      continue;
    }
    let text = 0;
    let nonEmpty = 0;
    for (const i of provData) {
      const vc = valueCell(grid[i][c]);
      if (!vc) continue;
      nonEmpty++;
      if (vc.kind === "text") text++;
    }
    if (nonEmpty > 0 && text / nonEmpty >= 0.6 && text >= 2) labelCols.push(c);
    else break;
  }
  const isLabelCol = new Set(labelCols);

  const allValueCols: number[] = [];
  for (let c = 1; c < width; c++) {
    if (isLabelCol.has(c)) continue;
    let used = headerRows.some((i) => !isBlank(grid[i]?.[c]));
    if (!used) {
      for (const i of provData) {
        if (valueCell(grid[i][c])) {
          used = true;
          break;
        }
      }
    }
    if (used) allValueCols.push(c);
  }

  // Side-by-side blocks, "Year | Total | Army … | Year | Total | Army …"
  // (10.01): a later column headed Year/Date whose cells are periods dates
  // the value columns to its right. It is not a value column itself.
  const blockPeriodCols: number[] = [];
  for (const c of allValueCols) {
    const head = headerRows
      .map((i) => normalizeLabel(grid[i]?.[c]).text)
      .join(" ")
      .trim();
    if (!/^(year|date|period)\b/i.test(head)) continue;
    const vals = provData.map((i) => grid[i][c]).filter((v) => !isBlank(v));
    const periodish = vals.filter(
      (v) => yearPart(v) != null || parsePeriod(v).basis !== "unknown",
    );
    if (vals.length && periodish.length / vals.length >= 0.8)
      blockPeriodCols.push(c);
  }
  const valueCols = allValueCols.filter((c) => !blockPeriodCols.includes(c));

  const header0 = buildHeaders(
    grid,
    headerRows,
    valueCols,
    merges,
    blockPeriodCols,
  );
  // Spans like "2019-2023" need context to tell fiscal / school / ACS
  // apart; the source line is where "American Community Survey" usually is.
  const ctxText = [
    pt.title,
    pt.period,
    headnote,
    header0.text,
    footer.source,
  ].join(" ");
  const ctx: PeriodContext = { text: ctxText };

  // 6. Logical rows.
  const lrows: LRow[] = [];
  let inContinuation = false;
  for (let i = dataStart; i < end; i++) {
    const row = grid[i] ?? [];
    const a = row[0];
    const aText = str(a);
    if (row.every(isBlank)) {
      lrows.push(blankRow(i));
      continue;
    }
    // "Continued on next page." → repeated title (… -- Con.) → repeated header.
    if (onlyColA(row) && CONTINUED_RE.test(aText)) {
      inContinuation = true;
      continue;
    }
    // The title repeated at the top of a continuation page, with or without
    // a "Continued" line (13.41): skip it and its wrapped lines up to the
    // "-- Con." line.
    if (onlyColA(row) && TITLE_RE.test(aText)) {
      inContinuation = true;
      for (let k = i; k < Math.min(i + 3, end); k++) {
        if (!onlyColA(grid[k])) break;
        if (CON_RE.test(str(grid[k][0]))) {
          i = k;
          break;
        }
      }
      continue;
    }
    if (onlyColA(row) && CON_RE.test(aText)) continue;

    const values = new Map<number, ValueCell>();
    let nums = 0;
    let codes = 0;
    let texts = 0;
    for (const c of valueCols) {
      const vc = valueCell(row[c]);
      if (!vc) continue;
      values.set(c, vc);
      if (vc.kind === "num") nums++;
      else if (vc.kind === "code") codes++;
      else texts++;
    }
    const extra = labelCols
      .map((c) => normalizeLabel(row[c]).text)
      .filter((_, k) => !(splitDate && labelCols[k] === 1));
    const norm = normalizeLabel(a);
    const base = {
      r: i,
      rawLabel: a,
      label: norm.text,
      markers: norm.markers,
      indent: indentOf(a),
      extra,
      values,
    };
    let kind: RowKind;
    // (Inside the data region, ordinal numbers only count as a header with
    // an empty col A — "1 2 3" is otherwise plausible data.)
    const numHeader =
      isYearHeaderRow(row) || (isOrdinalHeaderRow(row) && isBlank(a));
    if (numHeader || (nums === 0 && texts >= 2 && texts > codes)) {
      kind = "header";
    } else if (nums > 0 || codes > 0) {
      kind = "data";
    } else if (texts === 1 && !norm.text) {
      // A lone caption beyond col A ("Median income in constant (2020)
      // dollars" over the second half of 13.19) starts a panel; a stray
      // "Continued" note does not.
      const t = [...values.values()].find((v) => v.kind === "text")!.text!;
      kind = CONTINUED_RE.test(t) ? "blank" : "header";
    } else {
      kind = norm.text || extra.some(Boolean) ? "label" : "blank";
    }
    const afterCont = kind === "header" && inContinuation;
    if (kind !== "header" && kind !== "blank") inContinuation = false;
    lrows.push({ ...base, kind, ...(afterCont ? { afterCont } : {}) });
  }

  joinWrappedLabels(lrows);

  // 7. Periods and layout (same thresholds as the 2025 adapter).
  const periods = assignPeriods(lrows, grid, splitDate, ctx);
  const dataRows = lrows.filter((x) => x.kind === "data");
  const ownRows = dataRows.filter((x) => periods.get(x)?.own).length;
  const periodRows = dataRows.filter((x) => {
    const p = periods.get(x);
    return p?.own || p?.group;
  }).length;
  // "rows": every data row names its own period (01.06, 02.02);
  // "groups": period-labelled blocks of dimension rows (12.05, 07.02).
  const longMode: LongMode = ownRows >= periodRows * 0.5 ? "rows" : "groups";

  const allHeaders: HeaderInfo[] = [header0];
  for (let i = 0; i < lrows.length; i++) {
    if (lrows[i].kind !== "header") continue;
    const block = headerBlock(lrows, i);
    if (captionOf(grid, block.rows) != null) {
      i = block.next - 1;
      continue;
    }
    const h = buildHeaders(
      grid,
      block.rows,
      valueCols,
      merges,
      blockPeriodCols,
    );
    if (!(block.afterCont && sameHeaders(h, header0))) allHeaders.push(h);
    i = block.next - 1;
  }
  let headerCols = 0;
  let headerPeriodCols = 0;
  for (const h of allHeaders)
    for (const c of valueCols) {
      const p = h.paths[c] ?? [];
      if (!p.length) continue;
      headerCols++;
      if (splitPeriod(p.join(", "), ctx) || multiYear(p.join(" ")))
        headerPeriodCols++;
    }
  const titleSnap = titleSnapshotPeriod(pt.title, pt.period, ctx);
  const stubPeriod = usablePeriod(splitPeriod(header0.stub, ctx)?.period);
  const hasGroups = dataRows.some((x) => periods.get(x)?.group);

  let layout: TableLayout;
  if (
    textShare(dataRows) > TEXT_MIN ||
    isListing(dataRows, labelCols, valueCols)
  )
    layout = "text";
  else if (dataRows.length && periodRows / dataRows.length >= LONG_MIN)
    layout = "long";
  else if (headerCols && headerPeriodCols / headerCols >= WIDE_MIN)
    layout = "wide";
  else if (titleSnap || stubPeriod || hasGroups) layout = "snapshot";
  else layout = "unknown";
  if (layout === "unknown" && dataRows.length)
    warnings.push("layout unknown: no period in rows, header or title");

  // 8. Emit.
  const counters: Counters = {
    interval: 0,
    noPeriod: 0,
    nonPeriodRows: 0,
    repeated: 0,
  };
  const cells: IRCell[] = [];
  const panels: IRPanel[] = [];
  if (layout !== "text" && layout !== "unknown") {
    emitCells({
      lrows,
      sheet,
      sheetName,
      tableNum: pt.tableNum,
      layout,
      longMode,
      header0,
      valueCols,
      blockPeriodCols,
      grid,
      merges,
      ctx,
      titleSnap,
      periods,
      cells,
      panels,
      counters,
    });
  } else {
    panels.push({ index: 0, label: "", headers: header0.paths });
  }
  if (counters.interval)
    warnings.push(`${counters.interval} interval-period cells skipped`);
  if (counters.noPeriod)
    warnings.push(`${counters.noPeriod} cells skipped: no period`);
  if (counters.nonPeriodRows)
    warnings.push(
      `${counters.nonPeriodRows} rows skipped in a long table: label is not a period`,
    );
  if (counters.repeated)
    warnings.push(`${counters.repeated} repeated row labels suffixed with (n)`);

  const deduped = dedupeCells(cells, warnings);

  const table: IRTable = {
    edition,
    section,
    tableNum: pt.tableNum,
    sheet: sheetName,
    title: pt.title,
    titlePeriod: pt.period,
    headnote,
    footnotes: footer.footnotes,
    source: footer.source,
    sourceUrl: extractUrl(footer.source),
    layout,
    panels,
    warnings,
  };
  return { table, cells: deduped };
}

function blankRow(i: number): LRow {
  return {
    r: i,
    kind: "blank",
    rawLabel: null,
    label: "",
    markers: [],
    indent: 0,
    extra: [],
    values: new Map(),
  };
}

function nextNonBlank(lrows: LRow[], i: number): number {
  for (let k = i + 1; k < lrows.length; k++)
    if (lrows[k].kind !== "blank") return k;
  return -1;
}

/**
 * Join labels the print layout wrapped onto two or more rows. For a
 * label-only row L followed directly (no blank row) by row N:
 *  - N starts lowercase / "(" / "&", or L ends with a comma, hyphen, open
 *    paren or connector word ("… and", "… of") → one label;
 *  - N is indented deeper than L but the row after N (M) comes back to L's
 *    indent or less → N was a hanging-indent continuation ("American Indian
 *    and Alaska" / "   Native" / "Asian"), not L's first child. A parent
 *    group ("One race" / "   White" / "   Black …") keeps its children at
 *    the deeper indent, so M is deeper than L.
 * A label-only row right after a data row continues that row's label when
 * it starts lowercase or the data row's label ends incomplete.
 */
function joinWrappedLabels(lrows: LRow[]): void {
  for (let i = 0; i < lrows.length - 1; i++) {
    const L = lrows[i];
    const N = lrows[i + 1];
    if (!L.label || !N.label) continue;
    if (L.kind === "label" && (N.kind === "label" || N.kind === "data")) {
      if (/^\d{4}:?$/.test(L.label) || typeof L.rawLabel === "number") continue;
      let join = startsContinuation(N.label) || endsIncomplete(L.label);
      if (!join && N.indent > L.indent && N.kind === "data") {
        // Only a directly adjacent M counts: a parent with one child followed
        // by the parent's sibling would otherwise look identical.
        const M = lrows[i + 2];
        join =
          M != null &&
          M.kind !== "blank" &&
          M.indent <= L.indent &&
          !/:$/.test(str(L.rawLabel).trim());
      }
      if (!join) continue;
      mergeInto(N, L);
      // keep the joined row at L's indent so the hierarchy is unchanged
      N.indent = L.indent;
      lrows.splice(i, 1);
      i = Math.max(i - 2, -1); // re-examine: a label may wrap over 3+ rows
    } else if (L.kind === "data" && N.kind === "label") {
      if (!(startsContinuation(N.label) || endsIncomplete(L.label))) continue;
      const joined = normalizeLabel(
        `${str(L.rawLabel)} ${str(N.rawLabel).trim()}`,
      );
      L.rawLabel = `${str(L.rawLabel)} ${str(N.rawLabel).trim()}`;
      L.label = joined.text;
      L.markers = [...new Set([...L.markers, ...joined.markers])];
      lrows.splice(i + 1, 1);
      i--; // allow a third line
    }
  }
}

function mergeInto(N: LRow, L: LRow): void {
  const joined = normalizeLabel(`${str(L.rawLabel)} ${str(N.rawLabel).trim()}`);
  N.rawLabel = `${str(L.rawLabel)} ${str(N.rawLabel).trim()}`;
  N.label = joined.text;
  N.markers = [...new Set([...L.markers, ...joined.markers])];
}

// ─── Periods ────────────────────────────────────────────────────────────

const LONG_MIN = 0.8;
const WIDE_MIN = 0.6;
const TEXT_MIN = 0.2;

type LongMode = "rows" | "groups";

/** A period-labelled block: "2011", "2022 Total, including gov't". */
interface Group {
  period: ParsedPeriod;
  /** Label text besides the period, appended to member rows' rowPath. */
  residue: string;
}

interface RowPeriod {
  own: SplitPeriod | null;
  group: Group | null;
}

/** A label that starts with its period: "2017, total", "FY 2019 …", "July 1, 2010". */
const STARTS_WITH_PERIOD =
  /^(?:\d{4}\b|fy\b|fiscal|fall\b|spring\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d)/i;

function usablePeriod(p: ParsedPeriod | null | undefined): ParsedPeriod | null {
  return p && p.date && p.basis !== "interval" && p.basis !== "unknown"
    ? p
    : null;
}

/** Two or more distinct years: "Change, 2010-2020", "1990 to 2000 (%)". */
function multiYear(label: string): boolean {
  return new Set(label.match(/\b(?:1[7-9]|20)\d{2}\b/g) ?? []).size >= 2;
}

/**
 * Each data row's own period (its label, or the split-date pair) and the
 * period of the block it sits in. A block starts at a label-only row that
 * begins with a period ("2011", "2011:", "2022 Total, excluding gov't") or
 * at a data row whose label begins with a period and has more text ("2017,
 * total" heading "Domestic" / "International"). Plain year rows don't start
 * blocks — a trailing "Average" row in a long table must not inherit one.
 */
function assignPeriods(
  lrows: LRow[],
  grid: Grid,
  splitDate: boolean,
  ctx: PeriodContext,
): Map<LRow, RowPeriod> {
  const out = new Map<LRow, RowPeriod>();
  let yearFill: number | null = null;
  let group: Group | null = null;
  for (const x of lrows) {
    if (x.kind === "header") {
      group = null;
      yearFill = null;
      continue;
    }
    if (x.kind !== "data" && x.kind !== "label") continue;
    if (splitDate) {
      // A blank col A continues the year above; any other text ends it
      // ("July 1, 2020 to July 1, 2024" / "Change, number" in 21.20).
      const y = yearPart(x.rawLabel);
      if (y != null) yearFill = y;
      else if (x.label) yearFill = null;
      if (x.kind !== "data") continue;
      let own: SplitPeriod | null;
      if (yearFill == null) own = splitPeriod(x.label, ctx);
      else {
        const point = str(grid[x.r][1]).trim();
        const p = parsePeriod(`${yearFill}:${point ? " " + point : ""}`, ctx);
        own = p.basis === "unknown" ? null : { period: p, residue: "" };
      }
      out.set(x, { own, group: null });
      continue;
    }
    const raw = typeof x.rawLabel === "number" ? x.rawLabel : x.label;
    const sp = raw === "" ? null : splitPeriod(raw, ctx);
    const leads = typeof raw === "number" || STARTS_WITH_PERIOD.test(x.label);
    if (x.kind === "label") {
      if (sp && leads && x.extra.every((e) => !e))
        group = { period: sp.period, residue: sp.residue };
      continue;
    }
    out.set(x, { own: sp, group });
    if (sp?.residue && leads) group = { period: sp.period, residue: "" };
  }
  return out;
}

/** Is this label-only row a period block head (see assignPeriods)? */
function isGroupHead(x: LRow, ctx: PeriodContext): boolean {
  if (x.kind !== "label" || x.extra.some(Boolean)) return false;
  if (isYearNum(x.rawLabel)) return true;
  return STARTS_WITH_PERIOD.test(x.label) && splitPeriod(x.label, ctx) != null;
}

/**
 * Share of non-numeric, non-code strings among the value cells of data rows.
 * Unlike the 2025 adapter, leading label columns ("Unit": number / acres /
 * dollars in 19.01) don't count: legacy sheets use them for units far more
 * often than for names; name lists are caught by `isListing` instead.
 */
function textShare(dataRows: LRow[]): number {
  let t = 0;
  let n = 0;
  for (const x of dataRows) {
    for (const v of x.values.values()) {
      n++;
      if (v.kind === "text") t++;
    }
  }
  return n ? t / n : 0;
}

/** Rankings and listings: as many text columns as value columns, or ranks in A. */
function isListing(
  dataRows: LRow[],
  labelCols: number[],
  valueCols: number[],
): boolean {
  if (!dataRows.length || !labelCols.length) return false;
  if (labelCols.length >= Math.max(1, valueCols.length)) return true;
  const ranks = dataRows
    .map((x) => str(x.rawLabel).trim())
    .filter(Boolean)
    .map((s) => Number(s.replace(/[^\d.]/g, "")));
  const ascending = ranks.filter((n, i) => i > 0 && n >= ranks[i - 1]);
  return (
    ranks.length >= 5 &&
    ranks.every((n) => Number.isInteger(n) && n > 0 && n <= 1000) &&
    ascending.length >= (ranks.length - 1) * 0.8
  );
}

/**
 * The single period a title names. Beyond `snapshotPeriod`, accept one
 * period token inside a qualifier ("ANNUAL AVERAGE, 2024", "TAX YEAR 2022",
 * "2024 4TH QUARTER") and, for titles with no ":" period part, one token in
 * the title text. Mirrors the 2025 adapter.
 */
function titleSnapshotPeriod(
  title: string,
  titlePeriod: string,
  ctx: PeriodContext,
): ParsedPeriod | null {
  const direct = snapshotPeriod(titlePeriod, ctx);
  if (direct) return direct;
  if (/\bto\b|\band\b/i.test(titlePeriod)) return null;
  return usablePeriod(splitPeriod(titlePeriod || title, ctx)?.period);
}

// ─── Emission ───────────────────────────────────────────────────────────

interface Counters {
  interval: number;
  noPeriod: number;
  nonPeriodRows: number;
  repeated: number;
}

interface EmitArgs {
  lrows: LRow[];
  grid: Grid;
  sheet: XLSX.WorkSheet;
  sheetName: string;
  tableNum: string;
  layout: TableLayout;
  longMode: LongMode;
  header0: HeaderInfo;
  valueCols: number[];
  blockPeriodCols: number[];
  merges: MergeIndex;
  ctx: PeriodContext;
  titleSnap: ParsedPeriod | null;
  periods: Map<LRow, RowPeriod>;
  cells: IRCell[];
  panels: IRPanel[];
  counters: Counters;
}

/** The block period column governing value column c (nearest to its left). */
function blockPeriodCol(cols: number[], c: number): number | null {
  let best: number | null = null;
  for (const pc of cols) if (pc < c) best = pc;
  return best;
}

interface ColSpec {
  path: string[];
  markers: string[];
  period: ParsedPeriod | null;
  /** Wide: header spans several years ("1990 - 2000", "Change 2010-2020"). */
  interval: boolean;
}

/**
 * Per-column spec under a header. In wide tables the period is split off
 * the joined path ("April 1, 2020" band + "Both sexes" leaf → period
 * April 1, 2020; colPath ["Both sexes"]): the one path element holding the
 * period token is replaced by its residue, empty elements dropped.
 */
function colSpecs(
  h: HeaderInfo,
  valueCols: number[],
  layout: TableLayout,
  ctx: PeriodContext,
): Map<number, ColSpec> {
  const out = new Map<number, ColSpec>();
  for (const c of valueCols) {
    const path = h.paths[c] ?? [];
    const markers = h.markers[c] ?? [];
    const base = { path, markers, period: null, interval: false };
    if (layout !== "wide" || !path.length) {
      out.set(c, base);
      continue;
    }
    const sp = splitPeriod(path.join(", "), ctx);
    if (!sp) {
      out.set(c, { ...base, interval: multiYear(path.join(" ")) });
      continue;
    }
    const newPath: string[] = [];
    let removed = false;
    for (const e of path) {
      if (!removed) {
        const es = splitPeriod(e, ctx);
        if (es && es.period.label === sp.period.label) {
          removed = true;
          if (es.residue) newPath.push(es.residue);
          continue;
        }
      }
      newPath.push(e);
    }
    out.set(c, {
      ...base,
      path: removed ? newPath : sp.residue ? [sp.residue] : [],
      period: sp.period,
    });
  }
  return out;
}

/**
 * Print formats pad with escaped spaces for alignment (`#,##0\ \ \ `);
 * strip them so formats compare equal across cells and editions.
 */
function cleanNumFmt(z: unknown): string | undefined {
  if (typeof z !== "string" || z === "General") return undefined;
  const t = z.replace(/(?:\\ |_\)|\s)+$/g, "").trim();
  return t || undefined;
}

interface StackEntry {
  indent: number;
  label: string;
  markers: string[];
  /**
   * Headings whose rows sit at the heading's own indent:
   *  - "block": rows follow directly ("Farms by size:", "In percent"); the
   *    heading ends at the next blank row.
   *  - "section": a blank row follows the heading ("Real personal income …"
   *    over 51 states in 13.11); it lasts until the next heading at its
   *    indent or less. In wide tables a section names the measure, so it
   *    goes to colPath, as in 2025's "Real SPI 2018" header.
   */
  sticky: "none" | "block" | "section";
}

/** Append " (2)", " (3)" … to the last element of a repeated path (as the 2025 adapter). */
function disambiguate(
  path: string[],
  seen: Map<string, number>,
  scope: string,
): string[] {
  const k = JSON.stringify([scope, ...path]);
  const n = (seen.get(k) ?? 0) + 1;
  seen.set(k, n);
  if (n === 1) return path;
  return path.length
    ? [...path.slice(0, -1), `${path[path.length - 1]} (${n})`]
    : [`(${n})`];
}

/**
 * Walk the logical rows, tracking panels and the indentation stack, and
 * emit cells. Panels start at mid-sheet header blocks, and — in long tables
 * whose rows carry their own periods — at label-only rows ("Live births",
 * "Deaths"), which is how legacy sheets stack what 2025 splits into panels.
 * Period blocks ("2011", "2012") do not start panels: the period is not part
 * of a series' identity, so 2011 and 2012 "White" are one series.
 */
function emitCells(a: EmitArgs): void {
  const { lrows, layout, ctx, cells, panels, counters } = a;
  const groupsMode = layout !== "long" || a.longMode === "groups";
  let specs = colSpecs(a.header0, a.valueCols, layout, ctx);
  let headers = a.header0;
  let panelPeriod = usablePeriod(splitPeriod(headers.stub, ctx)?.period);
  let panel: IRPanel = { index: 0, label: "", headers: headers.paths };
  panels.push(panel);
  let panelCells = 0;
  let stack: StackEntry[] = [];
  let prevRowPath: string[] | null = null;
  let rowSeen = new Map<string, number>();
  const measureOf = new Map<IRCell, string[]>();

  let panelMarkers: string[] = [];
  const newPanel = (label: string, h: HeaderInfo, markers: string[] = []) => {
    if (panelCells === 0) {
      // nothing emitted yet: (re)label the current panel instead
      panel.label = panel.label ? `${panel.label}, ${label}` : label;
      panel.headers = h.paths;
      panelMarkers = [...panelMarkers, ...markers];
    } else {
      panel = { index: panels.length, label, headers: h.paths };
      panels.push(panel);
      panelCells = 0;
      panelMarkers = markers;
    }
    if (h !== headers) {
      headers = h;
      specs = colSpecs(h, a.valueCols, layout, ctx);
      panelPeriod = usablePeriod(splitPeriod(h.stub, ctx)?.period);
    }
    stack = [];
    prevRowPath = null;
    rowSeen = new Map();
  };

  let i = 0;
  while (i < lrows.length) {
    const x = lrows[i];
    if (x.kind === "blank") {
      stack = stack.filter((s) => s.sticky !== "block");
      i++;
      continue;
    }
    if (x.kind === "header") {
      const block = headerBlock(lrows, i);
      i = block.next;
      const caption = captionOf(a.grid, block.rows);
      if (caption != null) {
        newPanel(caption, recaption(headers, caption));
        continue;
      }
      const h = buildHeaders(
        a.grid,
        block.rows,
        a.valueCols,
        a.merges,
        a.blockPeriodCols,
      );
      // The header repeated on a continuation page is not a new panel.
      if (block.afterCont && sameHeaders(h, headers)) continue;
      newPanel(block.label || h.stub, h);
      continue;
    }
    if (x.kind === "label") {
      if (isGroupHead(x, ctx)) {
        stack = [];
      } else if (!groupsMode) {
        newPanel(x.label, headers, x.markers);
      } else {
        stack = stack.filter((s) => s.indent < x.indent);
        const n = nextNonBlank(lrows, i);
        const sticky: StackEntry["sticky"] =
          n < 0 || lrows[n].indent !== x.indent || lrows[n].kind !== "data"
            ? "none"
            : n === i + 1
              ? "block"
              : "section";
        stack.push({
          indent: x.indent,
          label: x.label,
          markers: x.markers,
          sticky,
        });
        if (groupsMode)
          disambiguate(
            [...stack.map((s) => s.label)],
            rowSeen,
            a.periods.get(x)?.group?.period.label ?? "",
          );
      }
      i++;
      continue;
    }

    // ── data row ──
    const rp = a.periods.get(x) ?? { own: null, group: null };
    const extra = x.extra.filter(Boolean);
    const rowMarkers = [...x.markers];
    let rowPath: string[];
    let measure: string[] = [];
    let period: ParsedPeriod | null = null;

    if (!groupsMode) {
      if (!rp.own && !a.blockPeriodCols.length) {
        if ([...x.values.values()].some((v) => v.kind === "num"))
          counters.nonPeriodRows++;
        i++;
        continue;
      }
      period = rp.own?.period ?? null;
      rowPath = [...extra, ...(rp.own?.residue ? [rp.own.residue] : [])];
    } else {
      stack = stack.filter(
        (s) =>
          s.indent < x.indent || (s.indent === x.indent && s.sticky !== "none"),
      );
      measure =
        layout === "wide"
          ? stack
              .filter((s) => s.sticky === "section" && s.label)
              .map((s) => s.label)
          : [];
      const parents = stack.filter(
        (s) => !(layout === "wide" && s.sticky === "section"),
      );
      // In a long table, a row that heads its block ("2017, total") is
      // labelled by its residue; other rows by their own label.
      const ownHead = layout === "long" && rp.own != null;
      const label = ownHead ? rp.own!.residue : x.label;
      let path: string[];
      if (!x.label && extra.length && prevRowPath) {
        // "Total cropland | Farms" / "  | Acres": label filled down
        path = [...prevRowPath.slice(0, -extra.length), ...extra];
      } else {
        path = [
          ...parents.map((s) => s.label).filter(Boolean),
          ...(label ? [label] : []),
          ...extra,
        ];
      }
      prevRowPath = path;
      for (const s of stack) rowMarkers.push(...s.markers);
      // A data row is also a parent for deeper-indented rows that follow
      // ("Total" / "  Under 5 years"), like 2025's Level 1 / Level 2.
      if (label)
        stack.push({
          indent: x.indent,
          label,
          markers: x.markers,
          sticky: "none",
        });
      if (layout === "long") {
        period = ownHead ? rp.own!.period : (rp.group?.period ?? null);
        if (!ownHead && rp.group?.residue) path = [...path, rp.group.residue];
      } else {
        period = rp.group?.period ?? panelPeriod ?? a.titleSnap;
      }
      rowPath = disambiguate(
        path,
        rowSeen,
        `${period?.label ?? ""}|${measure.join(" > ")}`,
      );
      if (rowPath !== path) counters.repeated++;
      if (layout === "long" && !period) {
        counters.nonPeriodRows++;
        i++;
        continue;
      }
    }

    for (const c of a.valueCols) {
      const v = x.values.get(c);
      if (!v || v.kind !== "num") continue;
      const spec = specs.get(c)!;
      let p = period;
      const pc = blockPeriodCol(a.blockPeriodCols, c);
      if (layout === "long" && pc != null)
        p = splitPeriod(a.grid[x.r][pc], ctx)?.period ?? null;
      if (layout === "wide") {
        if (spec.interval) {
          counters.interval++;
          continue;
        }
        p = spec.period ?? period;
      }
      if (!p || p.basis === "unknown") {
        counters.noPeriod++;
        continue;
      }
      if (p.basis === "interval" || !p.date) {
        counters.interval++;
        continue;
      }
      const addr = XLSX.utils.encode_cell({ r: x.r, c });
      const z = cleanNumFmt(a.sheet[addr]?.z);
      const cell: IRCell = {
        tableNum: a.tableNum,
        panel: panel.index,
        rowPath,
        colPath: [...measure, ...spec.path],
        period: p,
        value: v.num!,
        cellAddr: `${a.sheetName}!${addr}`,
        ...(z ? { numFmt: z } : {}),
        markers: [
          ...new Set([
            ...panelMarkers,
            ...rowMarkers,
            ...spec.markers,
            ...v.markers,
          ]),
        ],
      };
      cells.push(cell);
      if (measure.length) measureOf.set(cell, measure);
      panelCells++;
    }
    i++;
  }
  placeSections(measureOf);
  // A single-panel table's panel is unlabeled (as in the 2025 adapter).
  if (panels.length === 1) panels[0].label = "";
}

/**
 * Section headings in a wide table were provisionally put first in colPath.
 * They stay there only when they are measures: two or more sections that
 * repeat the same rows ("Real personal income" / "Real per capita personal
 * income" over the same states in 13.11; "Both sexes" / "Male" / "Female"
 * in 12.01). Otherwise ("Oahu" / "Maui" over different survey sites in
 * 18.18, or a lone stub heading) they are row groups and move to the front
 * of rowPath.
 */
function placeSections(measureOf: Map<IRCell, string[]>): void {
  if (!measureOf.size) return;
  const rowsBy = new Map<string, Set<string>>();
  for (const [c, m] of measureOf) {
    const k = JSON.stringify([c.panel, m]);
    if (!rowsBy.has(k)) rowsBy.set(k, new Set());
    rowsBy.get(k)!.add(JSON.stringify(c.rowPath));
  }
  const sets = [...rowsBy.values()];
  const repeats =
    sets.length >= 2 &&
    sets.every((rows, i) => {
      const others = new Set(sets.flatMap((o, j) => (j === i ? [] : [...o])));
      const shared = [...rows].filter((r) => others.has(r)).length;
      return shared >= rows.size * 0.5;
    });
  if (repeats) return;
  for (const [c, m] of measureOf) {
    c.colPath = c.colPath.slice(m.length);
    c.rowPath = [...m, ...c.rowPath];
  }
}

// ─── Duplicate periods ──────────────────────────────────────────────────

/**
 * Pick the one cell to keep among cells sharing (panel, rowPath, colPath,
 * date), or null to drop them all. "1990: April 1" (census base) and "1990:
 * July 1" (estimate) both date to 1990: keep the calendar-basis cell, else
 * July 1, else the non-April-1 one of a pair. Identical repeats keep the
 * first. Same rule as the 2025 adapter.
 */
function pickDuplicate(g: IRCell[]): IRCell | null {
  if (
    new Set(g.map((c) => c.value)).size === 1 &&
    new Set(g.map((c) => c.period.label)).size === 1
  )
    return g[0];
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

function dedupeCells(cells: IRCell[], warnings: string[]): IRCell[] {
  const groups = new Map<string, IRCell[]>();
  for (const c of cells) {
    const k = JSON.stringify([c.panel, c.rowPath, c.colPath, c.period.date]);
    const g = groups.get(k);
    if (g) g.push(c);
    else groups.set(k, [c]);
  }
  const keep = new Set<IRCell>();
  let dropped = 0;
  let unresolved = 0;
  for (const g of groups.values()) {
    if (g.length === 1) {
      keep.add(g[0]);
      continue;
    }
    const winner = pickDuplicate(g);
    if (winner) {
      keep.add(winner);
      dropped += g.filter((c) => c.period.label !== winner.period.label).length;
    } else unresolved += g.length;
  }
  if (dropped)
    warnings.push(
      `${dropped} duplicate-period cells dropped (kept July 1 / calendar)`,
    );
  if (unresolved)
    warnings.push(`${unresolved} cells dropped: unresolved duplicate periods`);
  return cells.filter((c) => keep.has(c));
}

/**
 * The header block starting at lrows[i]: consecutive header rows, allowing
 * blank rows between them. `next` is the index after the block.
 */
function headerBlock(
  lrows: LRow[],
  i: number,
): { rows: number[]; label: string; afterCont: boolean; next: number } {
  const rows: number[] = [];
  let label = "";
  let afterCont = false;
  let k = i;
  while (k < lrows.length) {
    if (lrows[k].kind === "header") {
      rows.push(lrows[k].r);
      if (lrows[k].label) label = lrows[k].label;
      if (lrows[k].afterCont) afterCont = true;
      k++;
      continue;
    }
    if (lrows[k].kind === "blank") {
      let n = k;
      while (n < lrows.length && lrows[n].kind === "blank") n++;
      if (n < lrows.length && lrows[n].kind === "header") {
        k = n;
        continue;
      }
    }
    break;
  }
  return { rows, label, afterCont, next: k };
}

/** A one-row block with a single caption cell beyond col A, else null. */
function captionOf(grid: Grid, rows: number[]): string | null {
  if (rows.length !== 1) return null;
  const row = grid[rows[0]] ?? [];
  const filled = row.filter((v, j) => j > 0 && !isBlank(v));
  return filled.length === 1 && isBlank(row[0])
    ? normalizeLabel(str(filled[0]).replace(CON_SUFFIX, "")).text
    : null;
}

/**
 * A caption that stands where a top band spanning every column stood
 * ("Median income in current dollars" → "… in constant (2020) dollars",
 * 13.19) replaces that band; otherwise the headers are unchanged.
 */
function recaption(h: HeaderInfo, caption: string): HeaderInfo {
  const paths = Object.values(h.paths).filter((p) => p.length);
  const top = paths[0]?.[0];
  if (!top || !paths.every((p) => p.length >= 2 && p[0] === top)) return h;
  const out: Record<number, string[]> = {};
  for (const [c, p] of Object.entries(h.paths))
    out[Number(c)] = p.length ? [caption, ...p.slice(1)] : p;
  return { ...h, paths: out };
}

function sameHeaders(a: HeaderInfo, b: HeaderInfo): boolean {
  return JSON.stringify(a.paths) === JSON.stringify(b.paths);
}

// ─── Workbook / section / edition ───────────────────────────────────────

/**
 * Sheet → grid of raw cell values indexed from A1 (so grid[r][c] matches the
 * cell address). Built from the cell objects rather than `sheet_to_json`,
 * which turns string cells that carry a date number format ("July 1" with
 * `d-mmm-yy`, 21.20) into Invalid Date when `cellDates` is on.
 */
function sheetGrid(sheet: XLSX.WorkSheet): Grid {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid: Grid = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row: Raw[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as
        XLSX.CellObject | undefined;
      let v: Raw = null;
      if (cell && cell.t !== "z" && cell.t !== "e") {
        v = cell.v ?? null;
        if (v instanceof Date && isNaN(v.getTime())) v = cell.w ?? null;
      }
      row.push(v);
    }
    grid.push(row);
  }
  return grid;
}

function findTitleRow(grid: Grid): number {
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    if (TITLE_RE.test(str(grid[r]?.[0]))) return r;
  }
  return -1;
}

/** Parse every table sheet in one legacy section workbook. */
export function readLegacyWorkbook(
  wb: XLSX.WorkBook,
  edition: number,
  section: number,
): LegacySectionIR {
  const tables: IRTable[] = [];
  const cells: IRCell[] = [];
  let narrative: string | undefined;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const grid = sheetGrid(sheet);
    const titleRow = findTitleRow(grid);
    if (titleRow < 0) {
      if (/narr/i.test(name)) {
        narrative = grid
          .map((row) => rowText(row).trim())
          .filter(Boolean)
          .join("\n");
      }
      continue;
    }
    let res: TableResult | null;
    try {
      res = parseLegacyTable(name, sheet, grid, titleRow, edition, section);
    } catch (e) {
      const t = parseTitle(str(grid[titleRow][0]));
      tables.push({
        edition,
        section,
        tableNum: t.tableNum ?? name,
        sheet: name,
        title: t.title,
        titlePeriod: t.period,
        headnote: "",
        footnotes: {},
        source: "",
        sourceUrl: null,
        layout: "unknown",
        panels: [],
        warnings: [`parse error: ${(e as Error).message}`],
      });
      continue;
    }
    if (!res) continue;
    tables.push(res.table);
    cells.push(...res.cells);
  }
  return { tables, cells, ...(narrative ? { narrative } : {}) };
}

export function readLegacySection(
  filePath: string,
  edition: number,
  section: number,
): LegacySectionIR {
  const wb = XLSX.read(readFileSync(filePath), {
    cellDates: true,
    cellNF: true,
  });
  return readLegacyWorkbook(wb, edition, section);
}

/** Read `${dir}/section01.xls` … `section24.xls`; missing files are skipped. */
export function readLegacyEdition(dir: string, edition: number): EditionIR {
  const tables: IRTable[] = [];
  const cells: IRCell[] = [];
  for (let s = 1; s <= 24; s++) {
    const file = path.join(dir, `section${String(s).padStart(2, "0")}.xls`);
    let res: LegacySectionIR;
    try {
      res = readLegacySection(file, edition, s);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
    tables.push(...res.tables);
    cells.push(...res.cells);
  }
  return { edition, tables, cells };
}
