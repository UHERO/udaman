/**
 * Cross-edition matching (plan §3.2): link every numeric cell of every
 * Data Book edition to a DATABOOK series from the manifest.
 *
 * Walks backwards from the newest edition. Each older edition is matched
 * against the most recent instance of each table lineage (so a column that
 * was renamed twice is followed one step at a time):
 *
 *  1. Table lineage — one-to-one greedy on title similarity + shared values
 *     + shared header labels, within the same section, allowing gaps of up
 *     to 3 editions.
 *  2. Series within a matched table — one-to-one greedy on canonical label
 *     equality, identical values over shared dates, and fuzzy labels.
 *
 * Unmatched cells are kept (series = "") so the review report can show them.
 */
import { geoHandle } from "./geo";
import type { EditionIR, IRCell, IRTable } from "./ir";
import { labelKey, parsePeriod } from "./labels";
import type { ManifestSection } from "./manifest";
import { allSeries } from "./manifest";
import { panelIdentities } from "./panels";
import { vintageDate, type MatchMethod, type VintageRow } from "./store";

const MAX_GAP = 3;
const SERIES_THRESHOLD = 0.6;

// ─── Canonical forms ────────────────────────────────────────────────

/** Geography labels canonicalize to their handle so "Honolulu County" = "City and County of Honolulu". */
export function canonLabel(label: string): string {
  const geo = geoHandle(label);
  return geo ? `@${geo}` : labelKey(label);
}

/**
 * A row/column path compared as one string: legacy editions split headers
 * into bands (["Civilian labor force", "Female"]) where 2025 flattens them
 * ("Civilian labor force, Female"). A geography leaf canonicalizes to its
 * handle.
 */
function canonPath(path: string[]): string {
  if (path.length === 0) return "";
  const leaf = path[path.length - 1];
  const geo = geoHandle(leaf);
  const rest = labelKey((geo ? path.slice(0, -1) : path).join(" "));
  return geo ? `${rest}@${geo}` : rest;
}

function canonPanel(label: string): string {
  if (!label) return "";
  return parsePeriod(label).basis === "unknown" ? labelKey(label) : "";
}

function pathKey(path: string[]): string {
  return path.map(labelKey).join(">");
}

function locatorKey(
  tableNum: string,
  panel: number,
  rowPath: string[],
  colPath: string[],
): string {
  return `${tableNum}|${panel}|${pathKey(rowPath)}|${pathKey(colPath)}`;
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\d{4}(-\d{2,4})?/g, " ")
      .replace(/[^a-z ]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !["and", "the", "for", "from", "selected"].includes(w),
      ),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}

function roundKey(v: number): string {
  return Math.abs(v) >= 1
    ? String(Math.round(v * 100) / 100)
    : v.toPrecision(4);
}

function sameValue(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale > 0 && Math.abs(a - b) / scale < 1e-6;
}

// ─── Groups and reference tables ────────────────────────────────────

interface Group {
  /** Panel identity (see panels.ts). */
  panel: number;
  panelLabel: string;
  rowPath: string[];
  colPath: string[];
  /** Canonical identity for label matching. */
  canon: string;
  /** Panel + row leaf + column leaf only — tolerant of reworded parents. */
  leaf: string;
  tokens: Set<string>;
  byDate: Map<string, number>;
  cells: IRCell[];
}

interface RefGroup extends Group {
  series: string;
}

interface RefTable {
  lineage: string;
  section: number;
  edition: number;
  tableNum: string;
  titleTokens: Set<string>;
  values: Set<string>;
  labels: Set<string>;
  groups: RefGroup[];
}

function groupCells(table: IRTable, cells: IRCell[]): Group[] {
  // Year panels share one identity, so their cells form one series.
  const idents = panelIdentities(table);
  const groups = new Map<string, Group>();
  for (const c of cells) {
    const ident = idents.get(c.panel) ?? { id: c.panel, label: "" };
    const pl = ident.label;
    const k = `${ident.id}|${pathKey(c.rowPath)}|${pathKey(c.colPath)}`;
    let g = groups.get(k);
    if (!g) {
      const canon = [
        canonPanel(pl),
        canonPath(c.rowPath),
        canonPath(c.colPath),
      ].join("|");
      groups.set(
        k,
        (g = {
          panel: ident.id,
          panelLabel: pl,
          rowPath: c.rowPath,
          colPath: c.colPath,
          canon,
          leaf: [
            canonPanel(pl),
            canonPath(c.rowPath.slice(-1)),
            canonPath(c.colPath.slice(-1)),
          ].join("|"),
          tokens: tokens([pl, ...c.rowPath, ...c.colPath].join(" ")),
          byDate: new Map(),
          cells: [],
        }),
      );
    }
    if (c.period.date) g.byDate.set(c.period.date, c.value);
    g.cells.push(c);
  }
  return [...groups.values()];
}

function tableValues(cells: IRCell[]): Set<string> {
  const out = new Set<string>();
  for (const c of cells) {
    const v = c.value;
    if (Math.abs(v) < 10) continue;
    if (Number.isInteger(v) && v >= 1900 && v <= 2100) continue;
    out.add(roundKey(v));
  }
  return out;
}

function tableLabels(groups: Group[]): Set<string> {
  const out = new Set<string>();
  for (const g of groups) {
    for (const l of [...g.rowPath, ...g.colPath]) out.add(canonLabel(l));
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const big = small === a ? b : a;
  if (small.size < 5) return 0;
  let n = 0;
  for (const x of small) if (big.has(x)) n++;
  return n / small.size;
}

function cellsByTable(ir: EditionIR): Map<string, IRCell[]> {
  const m = new Map<string, IRCell[]>();
  for (const c of ir.cells) {
    let l = m.get(c.tableNum);
    if (!l) m.set(c.tableNum, (l = []));
    l.push(c);
  }
  return m;
}

// ─── Series matching inside one table pair ──────────────────────────

interface SeriesMatch {
  group: Group;
  ref: RefGroup;
  method: MatchMethod;
  confidence: number;
}

function scorePair(
  g: Group,
  r: RefGroup,
  uniqueLeaf: boolean,
): { score: number; method: MatchMethod } {
  let shared = 0;
  let equal = 0;
  for (const [date, v] of g.byDate) {
    const rv = r.byDate.get(date);
    if (rv === undefined) continue;
    shared++;
    if (sameValue(v, rv)) equal++;
  }
  const valueRatio = shared ? equal / shared : 0;
  if (g.canon === r.canon) {
    // Same label: trust it unless overlapping values flatly disagree.
    if (shared >= 3 && valueRatio < 0.2) return { score: 0.7, method: "label" };
    return { score: 1, method: "label" };
  }
  // Same leaves, and that leaf pair is unique on both sides: a reworded or
  // added parent band ("Unemployment rate > U-1" vs "U-1").
  if (uniqueLeaf && g.leaf === r.leaf && !(shared >= 3 && valueRatio < 0.2))
    return { score: 0.85, method: "label" };
  if (shared >= 2 && valueRatio >= 0.9)
    return { score: 0.9 + 0.01 * Math.min(shared, 9), method: "value-overlap" };
  if (shared >= 3 && valueRatio >= 0.6)
    return { score: 0.75 * valueRatio, method: "value-overlap" };
  const j = jaccard(g.tokens, r.tokens);
  if (j >= 0.6)
    return {
      score: 0.75 * j + (shared && valueRatio > 0.5 ? 0.15 : 0),
      method: "label",
    };
  return { score: 0, method: "none" };
}

function matchSeries(groups: Group[], ref: RefGroup[]): SeriesMatch[] {
  const count = (xs: Group[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x.leaf, (m.get(x.leaf) ?? 0) + 1);
    return m;
  };
  const gLeaves = count(groups);
  const rLeaves = count(ref);
  const pairs: SeriesMatch[] = [];
  for (const g of groups) {
    for (const r of ref) {
      const unique = gLeaves.get(g.leaf) === 1 && rLeaves.get(r.leaf) === 1;
      const { score, method } = scorePair(g, r, unique);
      if (score >= SERIES_THRESHOLD)
        pairs.push({ group: g, ref: r, method, confidence: score });
    }
  }
  pairs.sort((a, b) => b.confidence - a.confidence);
  const usedG = new Set<Group>();
  const usedR = new Set<RefGroup>();
  const out: SeriesMatch[] = [];
  for (const p of pairs) {
    if (usedG.has(p.group) || usedR.has(p.ref)) continue;
    usedG.add(p.group);
    usedR.add(p.ref);
    out.push(p);
  }
  return out;
}

// ─── Driver ─────────────────────────────────────────────────────────

export interface TableMatchReport {
  edition: number;
  tableNum: string;
  title: string;
  lineage: string | null;
  score: number;
  groups: number;
  matchedGroups: number;
  cells: number;
  matchedCells: number;
}

export interface MatchResult {
  rows: VintageRow[];
  /** series name → editions it was matched in. */
  editions: Map<string, Set<number>>;
  tables: TableMatchReport[];
}

/**
 * Match all editions. `editionYears` must include the manifest's edition
 * (default: the newest given). Older editions are matched walking
 * backwards from it; editions newer than the manifest (each new annual
 * edition) walking forwards from it. `loadEdition` is called once per
 * edition, so callers can stream IR from disk.
 */
export function matchEditions(
  manifest: ManifestSection[],
  editionYears: number[],
  loadEdition: (edition: number) => EditionIR,
  manifestEdition = Math.max(...editionYears),
): MatchResult {
  const older = editionYears
    .filter((y) => y < manifestEdition)
    .sort((a, b) => b - a);
  const newer = editionYears
    .filter((y) => y > manifestEdition)
    .sort((a, b) => a - b);
  const years = [manifestEdition, ...older, ...newer];
  const rows: VintageRow[] = [];
  const editions = new Map<string, Set<number>>();
  const reports: TableMatchReport[] = [];
  // lineage → nearest matched instance, one map per direction.
  const backRefs = new Map<string, RefTable>();
  let forwardRefs = new Map<string, RefTable>();

  const note = (series: string, edition: number) => {
    let s = editions.get(series);
    if (!s) editions.set(series, (s = new Set()));
    s.add(edition);
  };

  const locatorToSeries = new Map<string, string>();
  const manifestTables = new Set<string>();
  for (const { table, series } of allSeries(manifest)) {
    manifestTables.add(table.tableNum);
    const l = series.locator;
    locatorToSeries.set(
      locatorKey(table.tableNum, l.panel, l.rowPath, l.colPath),
      series.name,
    );
  }

  for (const edition of years) {
    const refs = edition > manifestEdition ? forwardRefs : backRefs;
    const ir = loadEdition(edition);
    const byTable = cellsByTable(ir);
    const emit = (
      table: IRTable,
      lineage: string,
      cell: IRCell,
      series: string,
      match: MatchMethod,
      confidence: number,
    ) => {
      if (!cell.period.date) return;
      rows.push({
        vintage: edition,
        vintageDate: vintageDate(edition),
        tableNum: table.tableNum,
        tableLine: lineage,
        panel: table.panels.find((p) => p.index === cell.panel)?.label ?? "",
        rowPath: cell.rowPath,
        colPath: cell.colPath,
        periodLabel: cell.period.label,
        date: cell.period.date,
        value: cell.value,
        series,
        match,
        confidence: Math.round(confidence * 1000) / 1000,
        cellAddr: cell.cellAddr,
      });
      if (series) note(series, edition);
    };

    if (edition === manifestEdition) {
      // The manifest edition: series come straight from locators.
      for (const table of ir.tables) {
        const cells = byTable.get(table.tableNum) ?? [];
        const groups = groupCells(table, cells);
        const refGroups: RefGroup[] = [];
        let matchedCells = 0;
        for (const g of groups) {
          const series =
            locatorToSeries.get(
              locatorKey(table.tableNum, g.panel, g.rowPath, g.colPath),
            ) ?? "";
          for (const c of g.cells)
            emit(
              table,
              manifestTables.has(table.tableNum) ? table.tableNum : "",
              c,
              series,
              series ? "manifest" : "none",
              series ? 1 : 0,
            );
          if (series) {
            refGroups.push({ ...g, series });
            matchedCells += g.cells.length;
          }
        }
        reports.push({
          edition,
          tableNum: table.tableNum,
          title: table.title,
          lineage: manifestTables.has(table.tableNum) ? table.tableNum : null,
          score: 1,
          groups: groups.length,
          matchedGroups: refGroups.length,
          cells: cells.length,
          matchedCells,
        });
        if (manifestTables.has(table.tableNum) && refGroups.length) {
          refs.set(table.tableNum, {
            lineage: table.tableNum,
            section: table.section,
            edition,
            tableNum: table.tableNum,
            titleTokens: tokens(table.title),
            values: tableValues(cells),
            labels: tableLabels(groups),
            groups: refGroups,
          });
        }
      }
      // Refs are replaced, never mutated, so a shallow copy is a snapshot.
      forwardRefs = new Map(backRefs);
      continue;
    }

    // 1. Table lineage: score every (older table, live reference) pair.
    const candidates: Array<{
      table: IRTable;
      groups: Group[];
      cells: IRCell[];
      ref: RefTable;
      score: number;
    }> = [];
    const prepared = ir.tables.map((table) => {
      const cells = byTable.get(table.tableNum) ?? [];
      const groups = groupCells(table, cells);
      return {
        table,
        cells,
        groups,
        titleTokens: tokens(table.title),
        values: tableValues(cells),
        labels: tableLabels(groups),
      };
    });
    for (const p of prepared) {
      if (p.cells.length === 0) continue;
      for (const ref of refs.values()) {
        if (ref.section !== p.table.section) continue;
        const gap = Math.abs(ref.edition - edition);
        if (gap < 1 || gap > MAX_GAP) continue;
        const t = jaccard(p.titleTokens, ref.titleTokens);
        const v = overlap(p.values, ref.values);
        const h = jaccard(p.labels, ref.labels);
        const ok =
          t >= 0.5 || (v >= 0.5 && t >= 0.25) || (h >= 0.6 && t >= 0.3);
        if (!ok) continue;
        const score =
          0.5 * t +
          0.3 * v +
          0.2 * h +
          (ref.tableNum === p.table.tableNum ? 0.1 : 0) -
          0.05 * (gap - 1);
        candidates.push({
          table: p.table,
          groups: p.groups,
          cells: p.cells,
          ref,
          score,
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const usedTables = new Set<IRTable>();
    const usedRefs = new Set<string>();
    const matchedTables = new Map<IRTable, { ref: RefTable; score: number }>();
    for (const c of candidates) {
      if (usedTables.has(c.table) || usedRefs.has(c.ref.lineage)) continue;
      usedTables.add(c.table);
      usedRefs.add(c.ref.lineage);
      matchedTables.set(c.table, { ref: c.ref, score: c.score });
    }

    // 2. Series within each matched table; unmatched tables emit unmatched rows.
    for (const p of prepared) {
      const m = matchedTables.get(p.table);
      let matchedCells = 0;
      let matchedGroups = 0;
      if (!m) {
        for (const c of p.cells) emit(p.table, "", c, "", "none", 0);
      } else {
        const sm = matchSeries(p.groups, m.ref.groups);
        const byGroup = new Map(sm.map((s) => [s.group, s]));
        for (const g of p.groups) {
          const s = byGroup.get(g);
          for (const c of g.cells) {
            emit(
              p.table,
              m.ref.lineage,
              c,
              s?.ref.series ?? "",
              s?.method ?? "none",
              s ? s.confidence * Math.min(1, m.score + 0.2) : 0,
            );
          }
          if (s) {
            matchedGroups++;
            matchedCells += g.cells.length;
          }
        }
        // New reference: this edition's matched groups, plus the old
        // reference's groups that weren't matched (they may reappear in an
        // older edition).
        const matchedRefs = new Set(sm.map((s) => s.ref));
        refs.set(m.ref.lineage, {
          lineage: m.ref.lineage,
          section: p.table.section,
          edition,
          tableNum: p.table.tableNum,
          titleTokens: tokens(p.table.title),
          values: p.values,
          labels: p.labels,
          groups: [
            ...sm.map((s) => ({ ...s.group, series: s.ref.series })),
            ...m.ref.groups.filter((g) => !matchedRefs.has(g)),
          ],
        });
      }
      reports.push({
        edition,
        tableNum: p.table.tableNum,
        title: p.table.title,
        lineage: m?.ref.lineage ?? null,
        score: m ? Math.round(m.score * 1000) / 1000 : 0,
        groups: p.groups.length,
        matchedGroups,
        cells: p.cells.length,
        matchedCells,
      });
    }
  }

  return { rows, editions, tables: reports };
}

// ─── Post-match series attributes ───────────────────────────────────

/**
 * Should a series get a linear pseudo-history loader? Yes when its
 * observed dates (across all vintages) have a median spacing of ≥2 years —
 * decennial census, 5-year Ag Census style series.
 */
export function needsInterpolation(dates: string[]): boolean {
  const years = [...new Set(dates.map((d) => Number(d.slice(0, 4))))].sort(
    (a, b) => a - b,
  );
  if (years.length < 2) return false;
  const gaps = years.slice(1).map((y, i) => y - years[i]);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return median >= 2;
}
