/**
 * Analyzer data shaping (the non-UI half of analyzer.service.ts).
 * Selection state (which ids are in the analyzer) lives in
 * analyzer-context.tsx; per-series chart options live in the URL
 * (see url-params.ts AnalyzerParams).
 */
import { createDateArray, formatTableDate } from "./dates";
import { getTransformations, TRANSFORMATION_DISPLAY_NAME } from "./series";
import type {
  DateEntry,
  ExpandedSeries,
  FreqCode,
  Frequency,
  PortalSeries,
  TransformationDisplayName,
  TransformationKey,
} from "./types";
import { FREQ_ORDER } from "./types";

export type AnalyzerChartType = "line" | "column" | "area";
export type AxisSide = "left" | "right";

/**
 * Series display name (analyzer.formatDisplayName):
 * "Employment (Thous) (State of Hawaii; Quarterly; Seasonally Adjusted)".
 * With a non-level transformation the units become its name; when indexed
 * "Index - {transformation}".
 */
export function analyzerDisplayName(
  s: PortalSeries,
  indexed: boolean,
  transformation: TransformationDisplayName = "Level",
): string {
  let ending = "";
  if (s.seasonalAdjustment === "seasonally_adjusted") {
    ending = "; Seasonally Adjusted";
  } else if (s.seasonalAdjustment === "not_seasonally_adjusted") {
    ending = "; Not Seasonally Adjusted";
  }
  const units =
    transformation !== "Level"
      ? transformation
      : s.unitsLabelShort || s.unitsLabel || "";
  const displayUnits = indexed ? `Index - ${transformation}` : units;
  return `${s.title} (${displayUnits}) (${s.geography.shortName}; ${s.frequency}${ending})`;
}

/** Y-axis label (analyzer.setYAxisLabel). */
export function analyzerYAxisLabel(
  s: PortalSeries,
  indexed: boolean,
  baseDate: string | null,
  transformation: TransformationDisplayName,
): string {
  if (indexed) return `Index (${baseDate ?? ""})`;
  if (transformation !== "Level") return s.percent ? "Change" : "% Change";
  return s.unitsLabelShort || s.unitsLabel || "";
}

/**
 * Base date for indexing (analyzer.getIndexBaseYear): the latest
 * observationStart among the (visible) series, or the range start if later.
 */
export function indexBaseDate(
  series: Pick<ExpandedSeries, "seriesObservations">[],
  rangeStart?: string | null,
): string | null {
  if (!series.length) return rangeStart ?? null;
  const maxStart = series.reduce(
    (acc, s) =>
      s.seriesObservations.observationStart > acc
        ? s.seriesObservations.observationStart
        : acc,
    "",
  );
  return !rangeStart || maxStart > rangeStart ? maxStart : rangeStart;
}

/** Frequencies available for ALL series (analyzer.getSiblingFrequencies). */
export function commonFrequencies(series: PortalSeries[]): Frequency[] {
  if (!series.length) return [];
  const lists = series.map((s) =>
    (s.freqs ?? [{ freq: s.frequencyShort, label: s.frequency }]).map(
      ({ freq, label }) => ({ freq, label }),
    ),
  );
  return lists.reduce((acc, cur) =>
    acc.filter((f) => cur.some((c) => c.freq === f.freq)),
  );
}

/** True when every series has the same frequency (freq selector shown). */
export const isSingleFrequency = (series: PortalSeries[]) =>
  new Set(series.map((s) => s.frequencyShort)).size === 1;

/** Highest frequency present (D > W > M > Q > S > A). */
export function highestFrequency(series: PortalSeries[]): Frequency | null {
  let best: PortalSeries | null = null;
  for (const s of series) {
    if (
      !best ||
      FREQ_ORDER.indexOf(s.frequencyShort) <
        FREQ_ORDER.indexOf(best.frequencyShort)
    ) {
      best = s;
    }
  }
  return best ? { freq: best.frequencyShort, label: best.frequency } : null;
}

/** MOM is fetched (package/analyzermom) only for M/W/D analyzers. */
export const allowMoM = (freq: FreqCode | null | undefined) =>
  freq === "M" || freq === "W" || freq === "D";

/**
 * Merge /package/analyzermom results into the analyzer series: appends the
 * `mom` transformation to each matching series' transformationResults
 * (analyzer.addMoMTransformation). Returns new objects.
 */
export function mergeMomSeries(
  series: ExpandedSeries[],
  momSeries: ExpandedSeries[],
): ExpandedSeries[] {
  return series.map((s) => {
    const results = s.seriesObservations.transformationResults;
    if (results.some((t) => t.transformation === "mom")) return s;
    const mom = momSeries
      .find((m) => m.id === s.id)
      ?.seriesObservations.transformationResults.find(
        (t) => t.transformation === "mom",
      );
    if (!mom) return s;
    return {
      ...s,
      seriesObservations: {
        ...s.seriesObservations,
        transformationResults: [...results, mom],
      },
    };
  });
}

/** Transformation display names available for a series (chartValues). */
export function availableChartTransformations(
  s: ExpandedSeries,
): TransformationDisplayName[] {
  const t = getTransformations(s.seriesObservations.transformationResults);
  return (Object.keys(t) as TransformationKey[])
    .filter((k) => t[k]?.dates?.length)
    .map((k) => TRANSFORMATION_DISPLAY_NAME[k]);
}

/**
 * Union of all series' periods, keyed by tableDate and sorted by date
 * (analyzer.createAnalyzerTableDates). Mixed frequencies interleave, e.g.
 * "2020", "2020 Q1", "2020-01" all on 2020-01-01 (ordered by label).
 * Optional [start, end] filter.
 */
export function analyzerTableDates(
  series: ExpandedSeries[],
  start?: string,
  end?: string,
): DateEntry[] {
  const seen = new Map<string, DateEntry>();
  for (const s of series) {
    const { observationStart, observationEnd } = s.seriesObservations;
    for (const d of createDateArray(
      observationStart,
      observationEnd,
      s.frequencyShort,
    )) {
      if (!seen.has(d.tableDate)) seen.set(d.tableDate, d);
    }
  }
  let all = [...seen.values()].sort((a, b) =>
    a.date === b.date
      ? a.tableDate.localeCompare(b.tableDate)
      : a.date < b.date
        ? -1
        : 1,
  );
  if (start && end) all = all.filter((d) => d.date >= start && d.date <= end);
  return all;
}

/** Unique dates for the analyzer slider (createSliderDates). */
export function analyzerSliderDates(tableDates: DateEntry[]): DateEntry[] {
  const seen = new Set<string>();
  return tableDates.filter((d) =>
    seen.has(d.date) ? false : (seen.add(d.date), true),
  );
}

/**
 * Values of one transformation keyed by tableDate — the shape an analyzer
 * table row needs (row[tableDate] = value). Values are numbers.
 */
export function transformationByTableDate(
  s: ExpandedSeries,
  key: TransformationKey,
): Record<string, number> {
  const t = getTransformations(s.seriesObservations.transformationResults)[key];
  const out: Record<string, number> = {};
  t?.dates?.forEach((d, i) => {
    const v = +(t.values?.[i] ?? NaN);
    if (Number.isFinite(v)) out[formatTableDate(d, s.frequencyShort)] = v;
  });
  return out;
}

/**
 * Initial comparison-chart membership (analyzer.isVisible): if the URL gave
 * chartSeries use it; otherwise the first two series are drawn.
 */
export function initialChartSeries(
  ids: number[],
  chartSeries: number[] | undefined,
): number[] {
  if (chartSeries?.length) return chartSeries.filter((id) => ids.includes(id));
  return ids.slice(0, 2);
}

/**
 * Default axis side (analyzer.assignYAxisSide): explicit yleft/yright win;
 * otherwise left if it's the first series, matches the first series' units,
 * or the chart is indexed; else right.
 */
export function defaultAxisSide(opts: {
  id: number;
  yAxisText: string;
  firstYAxisText: string | undefined;
  indexed: boolean;
  yleft?: number[];
  yright?: number[];
}): AxisSide {
  const { id, yAxisText, firstYAxisText, indexed, yleft, yright } = opts;
  if (yleft?.includes(id)) return "left";
  if (yright?.includes(id)) return "right";
  return !firstYAxisText || firstYAxisText === yAxisText || indexed
    ? "left"
    : "right";
}

/** Chart type from URL column/area lists (analyzer.assignChartType). */
export function chartTypeFor(
  id: number,
  column?: number[],
  area?: number[],
): AnalyzerChartType {
  if (column?.includes(id)) return "column";
  if (area?.includes(id)) return "area";
  return "line";
}

/** Chart transformation from URL lists (analyzer.assignChartTransformation). */
export function chartTransformationFor(
  id: number,
  lists: {
    chartYoy?: number[];
    chartYtd?: number[];
    chartMom?: number[];
    chartC5ma?: number[];
  },
): TransformationDisplayName {
  if (lists.chartYoy?.includes(id)) return "YOY";
  if (lists.chartYtd?.includes(id)) return "YTD";
  if (lists.chartMom?.includes(id)) return "MOM";
  if (lists.chartC5ma?.includes(id)) return "Annual Change";
  return "Level";
}
