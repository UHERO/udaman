/**
 * Series data shaping: transformations, chart rows, table rows, summary
 * statistics, sibling selection and seasonal display rules.
 * Ported from helper.service.ts, series-helper.service.ts and
 * table-helper.service.ts — no Highcharts, no Angular.
 */
import {
  binarySearch,
  createDateArray,
  formatDate,
  NO_DATA_DATE,
  PERIODS_PER_YEAR,
} from "./dates";
import { formatNum, GROWTH_DECIMALS, seriesDecimals, toNumber } from "./format";
import type {
  DateEntry,
  ExpandedSeries,
  FreqCode,
  PortalSeries,
  PseudoZone,
  SeriesChartRow,
  SeriesObservations,
  SeriesTableRow,
  SummaryStats,
  TransformationCode,
  TransformationDisplayName,
  TransformationKey,
  TransformationResult,
  TransformationSet,
} from "./types";

// ─── Transformations ────────────────────────────────────────────────

export const TRANSFORMATION_CODE: Record<
  TransformationKey,
  TransformationCode
> = {
  level: "lvl",
  yoy: "pc1",
  ytd: "ytd",
  c5ma: "c5ma",
  mom: "mom",
};

export const TRANSFORMATION_KEY: Record<TransformationCode, TransformationKey> =
  {
    lvl: "level",
    pc1: "yoy",
    ytd: "ytd",
    c5ma: "c5ma",
    mom: "mom",
  };

/** Names used in chart/analyzer menus (helper.formatSeriesForCharts). */
export const TRANSFORMATION_DISPLAY_NAME: Record<
  TransformationKey,
  TransformationDisplayName
> = {
  level: "Level",
  yoy: "YOY",
  ytd: "YTD",
  c5ma: "Annual Change",
  mom: "MOM",
};

/** Pick transformations out of transformationResults by key. */
export function getTransformations(
  results: TransformationResult[] | undefined,
): TransformationSet {
  const set: TransformationSet = {};
  for (const t of results ?? []) {
    const key = TRANSFORMATION_KEY[t.transformation];
    if (key && !set[key]) set[key] = t;
  }
  return set;
}

/** True when the series has level observations. */
export function hasObservations(obs: SeriesObservations | undefined): boolean {
  if (!obs || obs.observationStart === NO_DATA_DATE) return false;
  const level = obs.transformationResults?.[0];
  return !!level?.dates?.length;
}

/** Look up a transformation's value on a date (binary search) → number|null. */
export function valueOnDate(
  t: TransformationResult | undefined,
  date: string,
): number | null {
  if (!t?.dates || !t.values) return null;
  const i = binarySearch(t.dates, date);
  return i > -1 ? toNumber(t.values[i]) : null;
}

/** Round to n decimals, keeping null. Growth rates are rounded to 1 dp. */
const round = (v: number | null, n: number) =>
  v === null ? null : Math.round(v * 10 ** n) / 10 ** n;

/**
 * Chart rows over a date grid (helper.createSeriesChart /
 * formatSeriesForCharts). Growth rates (yoy/ytd/mom) are rounded to 1
 * decimal like the Angular charts; level/c5ma keep full precision.
 */
export function buildSeriesChartRows(
  dates: DateEntry[],
  transformations: TransformationSet,
): SeriesChartRow[] {
  const { level, yoy, ytd, c5ma, mom } = transformations;
  return dates.map(({ date }) => ({
    date,
    ts: Date.parse(date),
    level: valueOnDate(level, date),
    yoy: round(valueOnDate(yoy, date), GROWTH_DECIMALS),
    ytd: round(valueOnDate(ytd, date), GROWTH_DECIMALS),
    c5ma: valueOnDate(c5ma, date),
    mom: round(valueOnDate(mom, date), GROWTH_DECIMALS),
  }));
}

/** Convenience: date grid + chart rows for an expanded series. */
export function seriesChartData(series: ExpandedSeries): {
  dates: DateEntry[];
  rows: SeriesChartRow[];
  pseudoZones: PseudoZone[];
} {
  const obs = series.seriesObservations;
  if (!hasObservations(obs)) return { dates: [], rows: [], pseudoZones: [] };
  const dates = createDateArray(
    obs.observationStart,
    obs.observationEnd,
    series.frequencyShort,
  );
  const t = getTransformations(obs.transformationResults);
  return {
    dates,
    rows: buildSeriesChartRows(dates, t),
    pseudoZones: getPseudoZones(t.level),
  };
}

/**
 * Pseudo-history boundaries (helper.getPseudoZones): each date where a run
 * of pseudoHistory=true ends. Angular drew the level line dashed up to it.
 */
export function getPseudoZones(
  t: TransformationResult | undefined,
): PseudoZone[] {
  const zones: PseudoZone[] = [];
  const ph = t?.pseudoHistory;
  if (!ph || !t?.dates) return zones;
  ph.forEach((isPseudo, i) => {
    if (isPseudo && !ph[i + 1]) {
      zones.push({ date: t.dates![i], ts: Date.parse(t.dates![i]) });
    }
  });
  return zones;
}

// ─── Tables ─────────────────────────────────────────────────────────

/**
 * Single-series table rows (helper.createSeriesTable). Level/c5ma use the
 * series' decimals; yoy/ytd use 1 decimal. Missing values → null / "".
 */
export function buildSeriesTable(
  dates: DateEntry[],
  transformations: TransformationSet,
  decimals: number,
  universe?: string,
): SeriesTableRow[] {
  const { level, yoy, ytd, c5ma } = transformations;
  return dates.map(({ date, tableDate }) => {
    const value = valueOnDate(level, date);
    const yoyValue = valueOnDate(yoy, date);
    const ytdValue = valueOnDate(ytd, date);
    const c5maValue = valueOnDate(c5ma, date);
    return {
      date,
      tableDate,
      value,
      formattedValue: formatNum(value, decimals, universe),
      yoyValue,
      formattedYoy: formatNum(yoyValue, GROWTH_DECIMALS, universe),
      ytdValue,
      formattedYtd: formatNum(ytdValue, GROWTH_DECIMALS, universe),
      c5maValue,
      formattedC5ma: formatNum(c5maValue, decimals, universe),
    };
  });
}

/**
 * Label for a transformation row in category/analyzer tables:
 * "YOY (%)" or, for percent series, "YOY (ch.)".
 */
export function transformationRowLabel(
  key: Exclude<TransformationKey, "level">,
  percent?: boolean,
): string {
  const label: Record<typeof key, string> = {
    yoy: "YOY",
    ytd: "YTD",
    c5ma: "Annual",
    mom: "MOM",
  };
  return `${label[key]} (${percent ? "ch." : "%"})`;
}

/** Labels shown above the single-series table / chart toggles. */
export function changeLabels(percent?: boolean) {
  return {
    yoy: percent ? "Year/Year Change" : "Year/Year % Change",
    ytd: percent ? "Year-to-Date Change" : "Year-to-Date % Change",
  };
}

/** Units string: short label preferred (category tables), falls back. */
export const seriesUnits = (s: PortalSeries) =>
  s.unitsLabelShort || s.unitsLabel || "";

/**
 * Category table row label (category-table-view.formatLvlData):
 * "{tablePrefix} {displayName} {tablePostfix} (units)".
 * displayName = geography name on NTA, title elsewhere.
 */
export function categoryRowLabel(s: PortalSeries, universe: string): string {
  const name = universe.toLowerCase() === "nta" ? s.geography.name : s.title;
  return [s.tablePrefix, name, s.tablePostfix, `(${seriesUnits(s)})`]
    .filter(Boolean)
    .join(" ");
}

/** Series info popover title (table-helper.getPopoverTitle). */
export function seriesInfoTitle(s: PortalSeries): string {
  return `${s.title} (${s.geography.shortName}; ${s.frequency}) (${s.unitsLabel || s.unitsLabelShort || ""})`;
}

/** Series info popover lines (table-helper.getPopoverContent), as data. */
export function seriesInfoLines(s: PortalSeries): {
  seasonallyAdjusted: boolean;
  source?: string;
  sourceLink?: string;
  sourceDetails?: string;
} {
  return {
    seasonallyAdjusted: s.seasonalAdjustment === "seasonally_adjusted",
    source: s.sourceDescription || undefined,
    sourceLink: s.sourceLink || undefined,
    sourceDetails: s.sourceDetails || undefined,
  };
}

// ─── Seasonal display rules ────────────────────────────────────────

/**
 * Should a series show given the SA toggle (helper.shouldDisplay)?
 * Always shown when seasonality is n/a, annual, the whole list has no SA
 * series, or in the analyzer.
 */
export function shouldDisplaySeries(
  s: Pick<PortalSeries, "seasonalAdjustment" | "frequencyShort">,
  showSeasonal: boolean,
  listHasSeasonal: boolean,
  analyzerView = false,
): boolean {
  const sa = s.seasonalAdjustment;
  if (
    !sa ||
    sa === "not_applicable" ||
    analyzerView ||
    s.frequencyShort === "A" ||
    !listHasSeasonal
  ) {
    return true;
  }
  if (showSeasonal) return sa === "seasonally_adjusted";
  return sa === "not_seasonally_adjusted";
}

/**
 * Apply the SA toggle to a measurement group (helper.toggleSeriesDisplay).
 * If nothing in the group survives, every series is returned with
 * `seasonalMessage: true` so the UI can show "only available as (N)SA".
 */
export function applySeasonalDisplay<S extends PortalSeries>(
  group: S[],
  showSeasonal: boolean,
  listHasSeasonal: boolean,
  analyzerView = false,
): { series: S; display: boolean; seasonalMessage: boolean }[] {
  const rows = group.map((series) => ({
    series,
    display: shouldDisplaySeries(
      series,
      showSeasonal,
      listHasSeasonal,
      analyzerView,
    ),
    seasonalMessage: false,
  }));
  if (!rows.some((r) => r.display)) {
    rows.forEach((r) => (r.seasonalMessage = true));
  }
  return rows;
}

export const hasSeasonalSeries = (series: PortalSeries[]) =>
  series.some((s) => s.seasonalAdjustment === "seasonally_adjusted");

// ─── Siblings (geo / freq / SA switching on the series page) ───────

/** Siblings matching a geo handle + freq (+ optional forecast tag in name). */
export function findGeoFreqSiblings<S extends PortalSeries>(
  siblings: S[] | undefined,
  geo: string,
  freq: FreqCode,
  forecast?: string | null,
): S[] {
  const matches = (siblings ?? []).filter(
    (s) => s.geography.handle === geo && s.frequencyShort === freq,
  );
  return forecast ? matches.filter((s) => s.name.includes(forecast)) : matches;
}

/** True if both an SA and an NSA sibling exist (shows the SA toggle). */
export function hasSaPair(siblings: PortalSeries[] | undefined): boolean {
  if (!siblings) return false;
  return (
    siblings.some((s) => s.seasonalAdjustment === "seasonally_adjusted") &&
    siblings.some((s) => s.seasonalAdjustment === "not_seasonally_adjusted")
  );
}

/**
 * Pick the sibling id to navigate to (series-helper.selectSibling).
 * Annual → the annual one; otherwise prefer the SA/NSA match for `sa`,
 * then whichever exists, then not_applicable.
 */
export function selectSibling(
  geoFreqSiblings: PortalSeries[],
  sa: boolean,
  freq: FreqCode,
): number | null {
  if (freq === "A") {
    return geoFreqSiblings.find((s) => s.frequencyShort === "A")?.id ?? null;
  }
  const pick = (seasonality: string) =>
    geoFreqSiblings.find(
      (s) =>
        (s.seasonalAdjustment === seasonality && s.frequencyShort === freq) ||
        !s.seasonalAdjustment,
    );
  const saS = pick("seasonally_adjusted");
  const nsaS = pick("not_seasonally_adjusted");
  const naS = pick("not_applicable");
  if (saS && nsaS) return (sa ? saS : nsaS).id;
  return (nsaS ?? saS ?? naS)?.id ?? null;
}

// ─── Summary statistics ────────────────────────────────────────────

/** Compound annual growth rate in % (series-helper.calculateCAGR). */
export function calculateCAGR(
  first: number,
  last: number,
  freq: FreqCode,
  periods: number,
): number | null {
  if (!periods || !first) return null;
  const v =
    (Math.pow(last / first, PERIODS_PER_YEAR[freq] / periods) - 1) * 100;
  return Number.isFinite(v) ? v : null;
}

/** Values indexed to 100 at `baseDate` (analyzer "Index" toggle). */
export function indexValues<T extends { date: string; value: number | null }>(
  points: T[],
  baseDate: string,
): (T & { value: number | null })[] {
  const base = points.find((p) => p.date === baseDate)?.value;
  return points.map((p) => ({
    ...p,
    value:
      base && p.value !== null && Number.isFinite(base)
        ? (p.value / base) * 100
        : null,
  }));
}

/**
 * Summary statistics for a series over [startDate, endDate]
 * (series-helper.calculateSeriesSummaryStats).
 *
 * `points` are the level values on the series' own date grid (e.g.
 * rows.map(r => ({date: r.date, value: r.level}))), already indexed if the
 * analyzer's Index toggle is on.
 *
 * Deviation from Angular: total/avg ignore null gaps (Angular summed nulls
 * as 0 and divided by the full count).
 */
export function calculateSummaryStats(
  series: Pick<
    PortalSeries,
    "frequencyShort" | "decimals" | "percent" | "universe"
  >,
  points: { date: string; value: number | null }[],
  startDate: string,
  endDate: string,
): SummaryStats {
  const freq = series.frequencyShort;
  const decimals = seriesDecimals(series);
  const u = series.universe;
  const stats: SummaryStats = {
    range: `${formatDate(startDate, freq)} - ${formatDate(endDate, freq)}`,
    minValue: "N/A",
    maxValue: "N/A",
    percChange: "N/A",
    levelChange: "N/A",
    total: "N/A",
    avg: "N/A",
    cagr: "N/A",
    missing: false,
  };
  const hasStart = points.some((p) => p.date === startDate);
  const hasEnd = points.some((p) => p.date === endDate);
  if (!hasStart || !hasEnd) {
    stats.missing = true;
    return stats;
  }
  const inRange = points.filter(
    (p) => p.date >= startDate && p.date <= endDate,
  );
  const present = inRange.filter(
    (p): p is { date: string; value: number } => p.value !== null,
  );
  if (!present.length) {
    stats.missing = true;
    return stats;
  }
  let min = present[0];
  let max = present[0];
  let sum = 0;
  for (const p of present) {
    if (p.value < min.value) min = p;
    if (p.value > max.value) max = p;
    sum += p.value;
  }
  stats.total = formatNum(sum, decimals, u);
  stats.avg = formatNum(sum / present.length, decimals, u);
  stats.minValue = `${formatNum(min.value, decimals, u)} (${formatDate(min.date, freq)})`;
  stats.maxValue = `${formatNum(max.value, decimals, u)} (${formatDate(max.date, freq)})`;

  const first = inRange[0].value;
  const last = inRange[inRange.length - 1].value;
  if (first === null || last === null) {
    stats.missing = true;
    return stats;
  }
  const diff = last - first;
  stats.levelChange = formatNum(diff, decimals, u);
  stats.percChange = series.percent
    ? null
    : first
      ? formatNum((diff / first) * 100, decimals, u)
      : "N/A";
  const cagr = calculateCAGR(first, last, freq, inRange.length - 1);
  stats.cagr = cagr === null ? "N/A" : formatNum(cagr, decimals, u);
  return stats;
}
