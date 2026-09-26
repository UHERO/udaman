/**
 * Analyzer view-model: turns the analyzer package + URL state into the
 * per-series chart specs, chart rows and table values the analyzer UI (and
 * the /graph embed) render. Pure — no React, safe on server and client.
 *
 * Mirrors AnalyzerService.setCompareChartSeriesObject / updateCompareSeries*
 * from the Angular app, but derived from URL state on every render instead of
 * mutating series objects.
 */
import {
  analyzerDisplayName,
  analyzerSliderDates,
  analyzerTableDates,
  analyzerYAxisLabel,
  availableChartTransformations,
  chartTransformationFor,
  chartTypeFor,
  commonFrequencies,
  defaultAxisSide,
  highestFrequency,
  indexBaseDate,
  initialChartSeries,
  isSingleFrequency,
} from "../../lib/analyzer";
import type { AnalyzerChartType, AxisSide } from "../../lib/analyzer";
import { formatTableDate } from "../../lib/dates";
import { GROWTH_DECIMALS, seriesDecimals, toNumber } from "../../lib/format";
import {
  getTransformations,
  hasObservations,
  TRANSFORMATION_DISPLAY_NAME,
} from "../../lib/series";
import type {
  DateEntry,
  ExpandedSeries,
  Frequency,
  TransformationDisplayName,
  TransformationKey,
  TransformationResult,
} from "../../lib/types";
import type { AnalyzerParams } from "../../lib/url-params";

export type { AnalyzerChartType, AxisSide };

/** Display name → transformation key ("Annual Change" → "c5ma"). */
export const DISPLAY_TO_KEY: Record<
  TransformationDisplayName,
  TransformationKey
> = Object.fromEntries(
  Object.entries(TRANSFORMATION_DISPLAY_NAME).map(([k, v]) => [v, k]),
) as Record<TransformationDisplayName, TransformationKey>;

/** URL list param holding the series drawn with each chart transformation. */
export const TRANSFORMATION_PARAM: Record<
  Exclude<TransformationDisplayName, "Level">,
  "chartYoy" | "chartYtd" | "chartMom" | "chartC5ma"
> = {
  YOY: "chartYoy",
  YTD: "chartYtd",
  MOM: "chartMom",
  "Annual Change": "chartC5ma",
};

/** Subset of AnalyzerParams that drives the comparison chart. */
export type AnalyzerChartParams = Pick<
  AnalyzerParams,
  | "chartSeries"
  | "index"
  | "leftMin"
  | "leftMax"
  | "rightMin"
  | "rightMax"
  | "yleft"
  | "yright"
  | "column"
  | "area"
  | "chartYoy"
  | "chartYtd"
  | "chartMom"
  | "chartC5ma"
>;

/** One analyzer series as drawn/listed by the comparison chart. */
export interface AnalyzerSeriesSpec {
  id: number;
  series: ExpandedSeries;
  /** Palette slot — the series' position in the analyzer (fixed per entity). */
  slot: number;
  /** Drawn in the comparison chart (chartSeries membership). */
  visible: boolean;
  type: AnalyzerChartType;
  axis: AxisSide;
  transformation: TransformationDisplayName;
  transformationKey: TransformationKey;
  /** Transformations this series can be drawn as. */
  chartValues: TransformationDisplayName[];
  /** Axis title contribution ("Thous", "% Change", "Index (2015-01-01)"). */
  yAxisText: string;
  /** Legend name (analyzerDisplayName). */
  name: string;
  /** Decimals for values of the drawn transformation. */
  decimals: number;
  hasData: boolean;
}

/** Frequency + date grids for a set of analyzer series. */
export interface AnalyzerBase {
  /** Analyzer frequency: the common one, or the highest for mixed sets. */
  freq: Frequency | null;
  /** All series share a frequency → freq selector + Index available. */
  singleFrequency: boolean;
  /** Frequencies every series has a sibling in (freq selector options). */
  siblingFreqs: Frequency[];
  /** Union of all series' periods (table columns before range filter). */
  tableDates: DateEntry[];
  /** Unique dates (date-slider positions). */
  sliderDates: DateEntry[];
}

export function analyzerBase(series: ExpandedSeries[]): AnalyzerBase {
  const singleFrequency = series.length > 0 && isSingleFrequency(series);
  const siblingFreqs = commonFrequencies(series);
  let freq: Frequency | null = null;
  if (singleFrequency) {
    // analyzer.getCurrentAnalyzerFrequency
    freq = siblingFreqs.find((f) => f.freq === series[0].frequencyShort) ?? {
      freq: series[0].frequencyShort,
      label: series[0].frequency,
    };
  } else {
    freq = highestFrequency(series);
  }
  const tableDates = analyzerTableDates(series.filter(withData));
  return {
    freq,
    singleFrequency,
    siblingFreqs,
    tableDates,
    sliderDates: analyzerSliderDates(tableDates),
  };
}

const withData = (s: ExpandedSeries) => hasObservations(s.seriesObservations);

/** Decimals for a transformation (growth rates always 1 dp). */
export function transformationDecimals(
  s: ExpandedSeries,
  key: TransformationKey,
): number {
  return key === "yoy" || key === "ytd" || key === "mom"
    ? GROWTH_DECIMALS
    : seriesDecimals(s);
}

/**
 * Per-series chart specs + index base date.
 *
 * - membership: initialChartSeries (URL chartSeries, else first two)
 * - base date: latest observationStart among the drawn series (all series
 *   if none drawn), or the range start if later (getIndexBaseYear)
 * - axis: explicit yleft/yright, else left if first series / same units /
 *   indexed (assignYAxisSide; "first" = first analyzer series, as Angular)
 */
export function analyzerSeriesSpecs(
  series: ExpandedSeries[],
  params: AnalyzerChartParams,
  opts: { rangeStart: string | null; indexAllowed: boolean },
): { specs: AnalyzerSeriesSpec[]; baseDate: string | null; indexed: boolean } {
  const ids = series.map((s) => s.id);
  const chartIds = initialChartSeries(ids, params.chartSeries);
  const indexed = params.index && opts.indexAllowed;
  const visibleSeries = series.filter((s) => chartIds.includes(s.id));
  const baseDate = indexed
    ? indexBaseDate(
        visibleSeries.length ? visibleSeries : series,
        opts.rangeStart,
      )
    : null;

  const partial = series.map((s, slot) => {
    const chartValues = availableChartTransformations(s);
    const wanted = chartTransformationFor(s.id, params);
    const transformation = chartValues.includes(wanted)
      ? wanted
      : (chartValues[0] ?? "Level");
    const yAxisText = analyzerYAxisLabel(s, indexed, baseDate, transformation);
    const transformationKey = DISPLAY_TO_KEY[transformation];
    return {
      id: s.id,
      series: s,
      slot,
      visible: chartIds.includes(s.id),
      type: chartTypeFor(s.id, params.column, params.area),
      transformation,
      transformationKey,
      chartValues: chartValues.length ? chartValues : ["Level" as const],
      yAxisText,
      name: analyzerDisplayName(s, indexed, transformation),
      decimals: transformationDecimals(s, transformationKey),
      hasData: withData(s),
    };
  });
  const firstYAxisText = partial[0]?.yAxisText;
  const specs: AnalyzerSeriesSpec[] = partial.map((p) => ({
    ...p,
    axis: defaultAxisSide({
      id: p.id,
      yAxisText: p.yAxisText,
      firstYAxisText,
      indexed,
      yleft: params.yleft,
      yright: params.yright,
    }),
  }));
  return { specs, baseDate, indexed };
}

/** Axis title: unique units of the drawn series on that side (createYAxisLabel). */
export function axisTitle(specs: AnalyzerSeriesSpec[], side: AxisSide): string {
  return [
    ...new Set(
      specs.filter((s) => s.visible && s.axis === side).map((s) => s.yAxisText),
    ),
  ].join(", ");
}

/** A transformation's numeric points (values parsed, nulls kept). */
export interface SeriesPoints {
  dates: string[];
  values: (number | null)[];
  /** pseudoHistory flags aligned with dates (level only). */
  pseudo?: boolean[];
}

/**
 * Transformation values, optionally indexed to 100 at `baseDate`
 * (getChartIndexedValues / getIndexedValues). No value at the base date →
 * every point is null ("Not available for current base year").
 */
export function transformationPoints(
  t: TransformationResult | undefined,
  indexBase: string | null,
): SeriesPoints {
  const dates = t?.dates ?? [];
  const raw = dates.map((_, i) => toNumber(t?.values?.[i]));
  const pseudo = t?.pseudoHistory;
  if (!indexBase) return { dates, values: raw, pseudo };
  const bi = dates.indexOf(indexBase);
  const base = bi > -1 ? raw[bi] : null;
  return {
    dates,
    values: raw.map((v) => (base && v !== null ? (v / base) * 100 : null)),
    pseudo,
  };
}

/** Points for what a spec draws (its selected transformation, maybe indexed). */
export function specPoints(
  spec: AnalyzerSeriesSpec,
  baseDate: string | null,
): SeriesPoints {
  const t = getTransformations(
    spec.series.seriesObservations.transformationResults,
  )[spec.transformationKey];
  return transformationPoints(t, baseDate);
}

/** One recharts row: `s{id}` → value for each drawn series. */
export type AnalyzerChartRow = {
  ts: number;
  date: string;
} & Record<`s${number}`, number | null>;

export const specKey = (id: number) => `s${id}` as const;

/**
 * Chart rows over the union of the drawn series' dates, restricted to
 * [start, end] (inclusive). Also returns each series' points for tooltips.
 */
export function analyzerChartRows(
  specs: AnalyzerSeriesSpec[],
  baseDate: string | null,
  start?: string | null,
  end?: string | null,
): { rows: AnalyzerChartRow[]; points: Map<number, SeriesPoints> } {
  const byDate = new Map<string, AnalyzerChartRow>();
  const points = new Map<number, SeriesPoints>();
  for (const spec of specs) {
    if (!spec.visible) continue;
    const p = specPoints(spec, baseDate);
    points.set(spec.id, p);
    p.dates.forEach((date, i) => {
      if ((start && date < start) || (end && date > end)) return;
      let row = byDate.get(date);
      if (!row) {
        row = { ts: Date.parse(date), date } as AnalyzerChartRow;
        byDate.set(date, row);
      }
      row[specKey(spec.id)] = p.values[i];
    });
  }
  const rows = [...byDate.values()].sort((a, b) => a.ts - b.ts);
  return { rows, points };
}

/**
 * Value of a series for the period containing `date` (tooltip for mixed
 * frequencies: an annual series answers for every month of its year).
 */
export function valueForPeriod(
  spec: AnalyzerSeriesSpec,
  pts: SeriesPoints | undefined,
  date: string,
): { date: string; value: number | null; pseudo: boolean } | null {
  if (!pts?.dates.length) return null;
  const freq = spec.series.frequencyShort;
  let lo = 0;
  let hi = pts.dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pts.dates[mid] <= date) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const d = pts.dates[found];
  if (formatTableDate(d, freq) !== formatTableDate(date, freq)) return null;
  return {
    date: d,
    value: pts.values[found],
    pseudo: !!pts.pseudo?.[found],
  };
}

/** Numeric extent of the drawn series on one axis within the rows. */
export function axisExtent(
  specs: AnalyzerSeriesSpec[],
  rows: AnalyzerChartRow[],
  side: AxisSide,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const spec of specs) {
    if (!spec.visible || spec.axis !== side) continue;
    const k = specKey(spec.id);
    for (const r of rows) {
      const v = r[k];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return Number.isFinite(min) ? [min, max] : null;
}

/**
 * Remap every per-series id list after a frequency switch (old id → new id).
 * Ids without a replacement are dropped.
 */
export function remapIdList(
  list: number[],
  idMap: Map<number, number>,
): number[] {
  return [
    ...new Set(list.flatMap((id) => (idMap.has(id) ? [idMap.get(id)!] : []))),
  ];
}
