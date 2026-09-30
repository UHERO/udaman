/**
 * Date grid + range logic, ported from helper.service.ts, highstock-helper
 * and date-slider.component.ts. Pure functions; all dates are "YYYY-MM-DD"
 * strings handled in UTC so there is no local-timezone drift.
 */
import type {
  DateEntry,
  DateRange,
  DateWrapper,
  DefaultRange,
  ExpandedSeries,
  FreqCode,
} from "./types";

/** Sentinel the API uses for "no observations". */
export const NO_DATA_DATE = "1-01-01";

/** Periods per year for each frequency (CAGR, default-range math). */
export const PERIODS_PER_YEAR: Record<FreqCode, number> = {
  A: 1,
  S: 2,
  Q: 4,
  M: 12,
  W: 52,
  D: 365,
};

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const pad2 = (n: number) => `0${n}`.slice(-2);

/** "2020-04-01" (or "2020-04-01T00:00:00-10:00") → UTC Date. */
export function parseISODate(dateString: string): Date {
  const [y, m, d] = dateString.split(/\D+/).map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** Strip any time/offset: "1958-01-01T00:00:00-10:00" → "1958-01-01". */
export const toDateOnly = (s: string) => s.substring(0, 10);

export const toISODate = (d: Date) => d.toISOString().substring(0, 10);

/** Quarter label for a month number 1-12. */
export function quarterOf(month: number): "Q1" | "Q2" | "Q3" | "Q4" {
  return (["Q1", "Q2", "Q3", "Q4"] as const)[Math.floor((month - 1) / 3)];
}

/**
 * Table header label for a period (helper.getTableDate):
 * A "2020" · Q "2020 Q1" · S/M "2020-01" · W/D "2020-01-15".
 */
export function formatTableDate(date: string, freq: FreqCode): string {
  const year = date.substring(0, 4);
  const month = +date.substring(5, 7);
  switch (freq) {
    case "A":
      return year;
    case "Q":
      return `${year} ${quarterOf(month)}`;
    case "S":
    case "M":
      return `${year}-${pad2(month)}`;
    default:
      return date.substring(0, 10);
  }
}

/**
 * Same as formatTableDate — helper.formatDate used for summary-stat ranges
 * and analyzer table columns. (The Angular version bucketed quarters by
 * month 0-2/3-5/…, which mislabels non-quarter-start months; fixed here.)
 */
export const formatDate = formatTableDate;

/**
 * Human label for tooltips (HighstockHelperService.getTooltipFreqLabel):
 * A "2020" · Q "2020 Q1" · S/M "Jan 2020" · W/D "Jan 05, 2020".
 */
export function formatTooltipDate(date: string, freq: FreqCode): string {
  const year = date.substring(0, 4);
  const month = +date.substring(5, 7);
  const day = date.substring(8, 10);
  switch (freq) {
    case "A":
      return year;
    case "Q":
      return `${year} ${quarterOf(month)}`;
    case "S":
    case "M":
      return `${MONTH_ABBR[month - 1]} ${year}`;
    default:
      return `${MONTH_ABBR[month - 1]} ${day}, ${year}`;
  }
}

/** Compact axis tick label: A/S/M "2020", Q "2020" (or "2020 Q1" if short span). */
export function formatAxisTick(
  date: string,
  freq: FreqCode,
  spanYears?: number,
): string {
  if (freq === "Q" && spanYears !== undefined && spanYears <= 5) {
    return formatTooltipDate(date, "Q");
  }
  if (
    (freq === "W" || freq === "D") &&
    spanYears !== undefined &&
    spanYears <= 1
  ) {
    return formatTooltipDate(date, "M");
  }
  return date.substring(0, 4);
}

/**
 * Every period between start and end inclusive (helper.createDateArray).
 * Accepts dates with time/offset suffixes.
 */
export function createDateArray(
  start: string,
  end: string,
  freq: FreqCode,
): DateEntry[] {
  const out: DateEntry[] = [];
  if (!start || !end || start === NO_DATA_DATE || end === NO_DATA_DATE) {
    return out;
  }
  const cur = parseISODate(start);
  const last = parseISODate(end);
  const monthStep: Partial<Record<FreqCode, number>> = { S: 6, Q: 3, M: 1 };
  // Guard against runaway loops on malformed input.
  let guard = 0;
  while (cur <= last && guard++ < 200_000) {
    const date = toISODate(cur);
    out.push({ date, tableDate: formatTableDate(date, freq) });
    if (freq === "A") {
      cur.setUTCFullYear(cur.getUTCFullYear() + 1, 0, 1);
    } else if (freq === "W") {
      cur.setUTCDate(cur.getUTCDate() + 7);
    } else if (freq === "D") {
      cur.setUTCDate(cur.getUTCDate() + 1);
    } else {
      cur.setUTCMonth(cur.getUTCMonth() + (monthStep[freq] ?? 1));
    }
  }
  return out;
}

/** Earliest observationStart / latest observationEnd across series. */
export function getDateWrapper(
  series: Pick<ExpandedSeries, "seriesObservations">[],
): DateWrapper {
  let firstDate = "";
  let endDate = "";
  for (const s of series) {
    const { observationStart, observationEnd } = s.seriesObservations;
    if (observationStart === NO_DATA_DATE) continue;
    if (!firstDate || observationStart < firstDate)
      firstDate = observationStart;
    if (!endDate || observationEnd > endDate) endDate = observationEnd;
  }
  return { firstDate, endDate };
}

// ─── Searching ──────────────────────────────────────────────────────

/** Exact match index in a sorted (asc or desc) array, or -1. */
export function binarySearch(list: string[], target: string): number {
  let start = 0;
  let end = list.length - 1;
  const descending = list[start] > list[end];
  while (start <= end) {
    const mid = (start + end) >> 1;
    const v = list[mid];
    if (v === target) return mid;
    const goRight = descending ? target < v : target > v;
    if (goRight) start = mid + 1;
    else end = mid - 1;
  }
  return -1;
}

/** Index of first date >= target (may equal list.length). */
export function lowerBound(list: string[], target: string): number {
  let start = 0;
  let end = list.length - 1;
  while (start <= end) {
    const mid = (start + end) >> 1;
    if (list[mid] < target) start = mid + 1;
    else end = mid - 1;
  }
  return start;
}

/** Index of last date <= target (may be -1). */
export function upperBound(list: string[], target: string): number {
  let start = 0;
  let end = list.length - 1;
  while (start <= end) {
    const mid = (start + end) >> 1;
    if (list[mid] > target) end = mid - 1;
    else start = mid + 1;
  }
  return end;
}

/** Snap an arbitrary date to the period start for a frequency. */
export function snapToPeriodStart(raw: string, freq: FreqCode): string {
  // Accept partial dates from hand-edited URLs: "2020" / "2020-07".
  const date =
    raw.length === 4 ? `${raw}-01-01` : raw.length === 7 ? `${raw}-01` : raw;
  const year = date.substring(0, 4);
  const month = +date.substring(5, 7);
  switch (freq) {
    case "A":
      return `${year}-01-01`;
    case "Q":
      return `${year}-${pad2(Math.floor((month - 1) / 3) * 3 + 1)}-01`;
    case "S":
    case "M":
      return `${date.substring(0, 7)}-01`;
    default:
      return date.substring(0, 10);
  }
}

// ─── Default + URL-driven ranges (date-slider logic) ───────────────

/**
 * Default [startIndex, endIndex] into `dates` (helper.setDefaultCategoryRange
 * + getRanges). `range` years back from the last date, or from
 * `defaultRange.end` year if set (NTA: 2040).
 */
export function getDefaultRangeIndices(
  dates: DateEntry[],
  freq: FreqCode,
  defaultRange: DefaultRange,
): { startIndex: number; endIndex: number } {
  let endIndex = dates.length - 1;
  if (endIndex < 0) return { startIndex: 0, endIndex: 0 };
  if (defaultRange.end) {
    const endYear = defaultRange.end;
    const idx = upperBound(
      dates.map((d) => d.date),
      `${endYear}-12-31`,
    );
    if (idx >= 0) endIndex = idx;
  }
  const startIndex = Math.max(
    0,
    endIndex - PERIODS_PER_YEAR[freq] * defaultRange.range,
  );
  return { startIndex, endIndex };
}

/**
 * Resolve the displayed range from URL start/end (helper.getSeriesStartAndEnd).
 * Start snaps to the first period >= start, end to the last period <= end;
 * out-of-range values clamp to the data bounds.
 */
export function resolveRangeIndices(
  dates: DateEntry[],
  freq: FreqCode,
  defaultRange: DefaultRange,
  start?: string | null,
  end?: string | null,
): { startIndex: number; endIndex: number } {
  let { startIndex, endIndex } = getDefaultRangeIndices(
    dates,
    freq,
    defaultRange,
  );
  const list = dates.map((d) => d.date);
  if (start) {
    const i = lowerBound(list, snapToPeriodStart(start, freq));
    startIndex = i < list.length ? i : 0;
  }
  if (end) {
    const i = upperBound(list, snapToPeriodStart(end, freq));
    endIndex = i >= 0 ? i : list.length - 1;
  }
  if (startIndex > endIndex) startIndex = endIndex;
  return { startIndex, endIndex };
}

/**
 * When the user switches frequency (e.g. A → Q), keep the same calendar span:
 * an annual end of 2020 should become 2020 Q4, not 2020 Q1
 * (date-slider.updateEndDateAfterFreqChange).
 */
export function adjustEndForFreqChange(
  previousFreq: FreqCode,
  currentFreq: FreqCode,
  dates: DateEntry[],
  routeEnd: string,
): string | undefined {
  const year = routeEnd.substring(0, 4);
  const findLast = (pred: (d: DateEntry) => boolean) => {
    for (let i = dates.length - 1; i >= 0; i--) {
      if (pred(dates[i])) return dates[i].date;
    }
    return undefined;
  };
  if (previousFreq === "A") {
    return findLast((d) => d.date.startsWith(year));
  }
  if (previousFreq === "Q" || previousFreq === "S") {
    const month = +routeEnd.substring(5, 7);
    const span = previousFreq === "Q" ? 3 : 6;
    const nextStartMonth = month + span; // first month after the period
    const limit =
      nextStartMonth > 12
        ? `${+year + 1}-${pad2(nextStartMonth - 12)}-01`
        : `${year}-${pad2(nextStartMonth)}-01`;
    return currentFreq === "A"
      ? findLast((d) => d.date.startsWith(year))
      : findLast((d) => d.date < limit);
  }
  return currentFreq === "A"
    ? findLast((d) => d.date.substring(0, 4) <= year)
    : findLast((d) => d.date <= routeEnd);
}

/**
 * Full date-slider initialisation: given the period grid and URL state,
 * produce the DateRange + slider indices.
 *
 * - no start/end → default range, useDefaultRange = true
 * - start only   → start … last date
 * - freq changed (previousFreq set and different) → end is re-mapped
 */
export function resolveDateRange(opts: {
  dates: DateEntry[];
  freq: FreqCode;
  defaultRange: DefaultRange;
  start?: string | null;
  end?: string | null;
  previousFreq?: FreqCode | null;
}): DateRange & { startIndex: number; endIndex: number } {
  const { dates, freq, defaultRange, previousFreq } = opts;
  const { start } = opts;
  let { end } = opts;
  if (!dates.length) {
    return {
      startDate: "",
      endDate: "",
      useDefaultRange: true,
      endOfSample: true,
      startIndex: 0,
      endIndex: 0,
    };
  }
  const freqChanged = !!previousFreq && previousFreq !== freq;
  if (end && freqChanged) {
    end = adjustEndForFreqChange(previousFreq!, freq, dates, end) ?? null;
  }
  const useDefaultRange = !start && !end;
  if (start && !end) end = dates[dates.length - 1].date;
  const { startIndex, endIndex } = resolveRangeIndices(
    dates,
    freq,
    defaultRange,
    start,
    end,
  );
  const endDate = dates[endIndex].date;
  return {
    startDate: dates[startIndex].date,
    endDate,
    useDefaultRange,
    endOfSample: endDate === dates[dates.length - 1].date,
    startIndex,
    endIndex,
  };
}

/**
 * URL params for a range (landing/single-series changeRange): default range
 * → no start; end of sample → no end.
 */
export function rangeToParams(range: DateRange): {
  start: string | null;
  end: string | null;
} {
  return {
    start: range.useDefaultRange ? null : range.startDate,
    end: range.endOfSample ? null : range.endDate,
  };
}

// ─── Date input parsing (date-slider calendar inputs) ──────────────

/** Placeholder text for a date input by frequency. */
export const DATE_INPUT_PLACEHOLDER: Record<FreqCode, string> = {
  A: "YYYY",
  S: "YYYY-MM",
  Q: "YYYY Q#",
  M: "YYYY-MM",
  W: "YYYY-MM-DD",
  D: "YYYY-MM-DD",
};

/**
 * Parse user input ("2020", "2020 Q3", "2020-07", "2020-07-04") to a period
 * date "YYYY-MM-DD", or null if malformed.
 */
export function parseDateInput(value: string, freq: FreqCode): string | null {
  const v = value.trim().toUpperCase();
  const qMonths: Record<string, string> = {
    Q1: "01",
    Q2: "04",
    Q3: "07",
    Q4: "10",
  };
  let m: RegExpMatchArray | null;
  switch (freq) {
    case "A":
      return /^\d{4}$/.test(v) ? `${v}-01-01` : null;
    case "Q":
      m = v.match(/^(\d{4})\s*-?\s*(Q[1-4])$/);
      return m ? `${m[1]}-${qMonths[m[2]]}-01` : null;
    case "S":
    case "M":
      m = v.match(/^(\d{4})-(\d{2})$/);
      return m ? `${m[1]}-${m[2]}-01` : null;
    default:
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
}
