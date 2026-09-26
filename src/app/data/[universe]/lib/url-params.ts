/**
 * URL query-param spec for the portal. Param NAMES are identical to the
 * Angular app so old links (after hash → path translation) keep working.
 *
 * Pure: usable from server pages (`searchParams` prop) and the client hook
 * (use-portal-params.ts).
 */
import { parseIdParam } from "./category";
import type { HrefParams } from "./links";
import type { FreqCode } from "./types";

export type SearchParamsInput =
  URLSearchParams | Record<string, string | string[] | undefined>;

export function getParam(sp: SearchParamsInput, key: string): string | null {
  if (sp instanceof URLSearchParams) return sp.get(key);
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Angular semantics: only the literal "true" is true. */
export const isTrue = (v: string | null | undefined) => v === "true";

/** "1-2-3" → [1, 2, 3] (drops non-numeric). */
export function parseIdList(v: string | null | undefined): number[] {
  if (!v) return [];
  return v
    .split(/[-,]/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

const parseNum = (v: string | null) => {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const FREQS: FreqCode[] = ["A", "S", "Q", "M", "W", "D"];
const parseFreq = (v: string | null): FreqCode | null =>
  v && FREQS.includes(v as FreqCode) ? (v as FreqCode) : null;

// ─── Landing / category / search ('' | 'category' | 'search') ──────

export interface CategoryParams {
  /** Top-level category id, or a search term (old /search?id=term). */
  id: number | string | null;
  data_list_id: number | null;
  geo: string | null;
  freq: FreqCode | null;
  /** FC universe forecast, e.g. "26Q1FF". */
  fc: string | null;
  /** NTA measurement name, e.g. "Region". */
  m: string | null;
  /** Show seasonally adjusted. Default TRUE when absent. */
  sa: boolean;
  /** Table view transformation rows. */
  yoy: boolean;
  ytd: boolean;
  c5ma: boolean;
  /** Chart-view value (level | yoy | ytd | c5ma); validated by the view. */
  transform: string | null;
  view: "chart" | "table";
  start: string | null;
  end: string | null;
  nocache: boolean;
}

export function parseCategoryParams(sp: SearchParamsInput): CategoryParams {
  const sa = getParam(sp, "sa");
  return {
    id: parseIdParam(getParam(sp, "id")),
    data_list_id: parseNum(getParam(sp, "data_list_id")),
    geo: getParam(sp, "geo"),
    freq: parseFreq(getParam(sp, "freq")),
    fc: getParam(sp, "fc"),
    m: getParam(sp, "m"),
    sa: sa === null ? true : isTrue(sa),
    yoy: isTrue(getParam(sp, "yoy")),
    ytd: isTrue(getParam(sp, "ytd")),
    c5ma: isTrue(getParam(sp, "c5ma")),
    transform: getParam(sp, "transform"),
    view: getParam(sp, "view") === "table" ? "table" : "chart",
    start: getParam(sp, "start"),
    end: getParam(sp, "end"),
    nocache: isTrue(getParam(sp, "nocache")),
  };
}

/** Search term: `/search?id=term` (Angular) or `?q=term`. */
export function parseSearchTerm(sp: SearchParamsInput): string | null {
  const q = getParam(sp, "q") ?? getParam(sp, "id");
  return q && q.trim() ? q.trim() : null;
}

// ─── Single series ('series') ───────────────────────────────────────

export interface SeriesParams {
  id: number | null;
  /** Default TRUE when absent. */
  sa: boolean;
  /** Category the user came from; passed to package/series as `cat`. */
  data_list_id: number | null;
  geo: string | null;
  freq: FreqCode | null;
  fc: string | null;
  start: string | null;
  end: string | null;
  nocache: boolean;
}

export function parseSeriesParams(sp: SearchParamsInput): SeriesParams {
  const sa = getParam(sp, "sa");
  return {
    id: parseNum(getParam(sp, "id")),
    sa: sa === null ? true : isTrue(sa),
    data_list_id: parseNum(getParam(sp, "data_list_id")),
    geo: getParam(sp, "geo"),
    freq: parseFreq(getParam(sp, "freq")),
    fc: getParam(sp, "fc"),
    start: getParam(sp, "start"),
    end: getParam(sp, "end"),
    nocache: isTrue(getParam(sp, "nocache")),
  };
}

// ─── Analyzer ('analyzer') and embed ('graph') ─────────────────────

export interface AnalyzerParams {
  /** Series in the analyzer, "1-2-3". */
  analyzerSeries: number[];
  /** Series drawn in the comparison chart. Empty → first two. */
  chartSeries: number[];
  start: string | null;
  end: string | null;
  /** Index to 100 at the base date. */
  index: boolean;
  leftMin: number | null;
  leftMax: number | null;
  rightMin: number | null;
  rightMax: number | null;
  /** Show the comparison chart (vs. the mini-chart grid). */
  compare: boolean;
  /** Table transformation rows. */
  yoy: boolean;
  ytd: boolean;
  c5ma: boolean;
  mom: boolean;
  /** Axis assignment overrides. */
  yright: number[];
  yleft: number[];
  /** Chart type overrides (default line). */
  column: number[];
  area: number[];
  /** Chart transformation overrides (default Level). */
  chartYoy: number[];
  chartYtd: number[];
  chartMom: number[];
  chartC5ma: number[];
  nocache: boolean;
}

export function parseAnalyzerParams(sp: SearchParamsInput): AnalyzerParams {
  const ids = (k: string) => parseIdList(getParam(sp, k));
  return {
    analyzerSeries: ids("analyzerSeries"),
    chartSeries: ids("chartSeries"),
    start: getParam(sp, "start"),
    end: getParam(sp, "end"),
    index: isTrue(getParam(sp, "index")),
    leftMin: parseNum(getParam(sp, "leftMin")),
    leftMax: parseNum(getParam(sp, "leftMax")),
    rightMin: parseNum(getParam(sp, "rightMin")),
    rightMax: parseNum(getParam(sp, "rightMax")),
    compare: isTrue(getParam(sp, "compare")),
    yoy: isTrue(getParam(sp, "yoy")),
    ytd: isTrue(getParam(sp, "ytd")),
    c5ma: isTrue(getParam(sp, "c5ma")),
    mom: isTrue(getParam(sp, "mom")),
    yright: ids("yright"),
    yleft: ids("yleft"),
    column: ids("column"),
    area: ids("area"),
    chartYoy: ids("chartYoy"),
    chartYtd: ids("chartYtd"),
    chartMom: ids("chartMom"),
    chartC5ma: ids("chartC5ma"),
    nocache: isTrue(getParam(sp, "nocache")),
  };
}

/**
 * Serialize analyzer state back to params. Empty lists / false / null are
 * omitted (same as Angular's analyzerParams computed signal).
 */
export function analyzerParamsToQuery(p: Partial<AnalyzerParams>): HrefParams {
  const list = (v?: number[]) => (v?.length ? v.join("-") : null);
  const flag = (v?: boolean) => (v ? "true" : null);
  return {
    analyzerSeries: list(p.analyzerSeries),
    chartSeries: list(p.chartSeries),
    start: p.start ?? null,
    end: p.end ?? null,
    index: flag(p.index),
    leftMin: p.leftMin ?? null,
    leftMax: p.leftMax ?? null,
    rightMin: p.rightMin ?? null,
    rightMax: p.rightMax ?? null,
    compare: flag(p.compare),
    yoy: flag(p.yoy),
    ytd: flag(p.ytd),
    c5ma: flag(p.c5ma),
    mom: flag(p.mom),
    yright: list(p.yright),
    yleft: list(p.yleft),
    column: list(p.column),
    area: list(p.area),
    chartYoy: list(p.chartYoy),
    chartYtd: list(p.chartYtd),
    chartMom: list(p.chartMom),
    chartC5ma: list(p.chartC5ma),
  };
}

/** Embed page: `id` → single series chart; else analyzer params. */
export interface GraphParams extends AnalyzerParams {
  id: number | null;
}

export function parseGraphParams(sp: SearchParamsInput): GraphParams {
  return { ...parseAnalyzerParams(sp), id: parseNum(getParam(sp, "id")) };
}

/**
 * Sidebar data-list links (primeng-menu-nav.setQueryParams) MERGE into the
 * current query: geo/freq/view/sa/yoy/ytd/start/end carry over (geo/freq are
 * only honored on the new list if both exist there), these are cleared.
 */
export const NAV_RESET_PARAMS = {
  analyzerSeries: null,
  chartSeries: null,
  name: null,
  units: null,
} as const;

/** Search submit (header.onSearch) additionally clears the date range. */
export const SEARCH_RESET_PARAMS = {
  ...NAV_RESET_PARAMS,
  geography: null,
  start: null,
  end: null,
} as const;
