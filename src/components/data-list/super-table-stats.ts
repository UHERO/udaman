import Series from "@catalog/models/series";
import type { SuperTableSeriesEntry } from "@catalog/types/data-list-table";

export interface ComputedSeriesData {
  dataMap: Map<string, number>;
  yoyMap: Map<string, number>;
  yoyDiffMap: Map<string, number>;
  ytdMap: Map<string, number>;
}

export interface SeriesStats {
  lastObs: { value: number; date: string; ytdPctChg: number | null } | null;
  minObs: { value: number; date: string; lastMinusMin: number } | null;
  maxObs: { value: number; date: string; lastMinusMax: number } | null;
  pctChange: {
    fromFirst: number | null;
    fromMin: number | null;
    fromMax: number | null;
  };
  range: {
    maxMinusMin: number | null;
    lastMinOverRange: number | null;
    lastMaxOverRange: number | null;
  };
}

/**
 * Pre-compute derived series data (yoy, yoyDiff, ytd) from full data.
 * Called once per series and memoized.
 */
export function computeDerivedData(
  entry: SuperTableSeriesEntry,
): ComputedSeriesData {
  const s = new Series({ name: entry.seriesName });
  s.frequency = entry.frequency;
  const dataMap = new Map<string, number>();
  for (const [d, v] of entry.data) dataMap.set(d, v);
  s.data = dataMap;

  return {
    dataMap,
    yoyMap: s.yoy().data,
    yoyDiffMap: s.yoyDiff().data,
    ytdMap: s.ytd().data,
  };
}

function pctChg(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * Compute summary statistics for a series within a date range.
 * Stats are recomputed whenever the slider date range changes.
 */
export function computeStatsForRange(
  computed: ComputedSeriesData,
  visibleDates: string[],
): SeriesStats | null {
  const points: { date: string; value: number }[] = [];
  for (const d of visibleDates) {
    const v = computed.dataMap.get(d);
    if (v != null) points.push({ date: d, value: v });
  }
  if (!points.length) return null;

  const last = points[points.length - 1];
  const first = points[0];

  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].value < points[minIdx].value) minIdx = i;
    if (points[i].value > points[maxIdx].value) maxIdx = i;
  }
  const minPt = points[minIdx];
  const maxPt = points[maxIdx];
  const rangeVal = maxPt.value - minPt.value;

  const ytdPctChg = computed.ytdMap.get(last.date) ?? null;

  return {
    lastObs: { value: last.value, date: last.date, ytdPctChg },
    minObs: {
      value: minPt.value,
      date: minPt.date,
      lastMinusMin: last.value - minPt.value,
    },
    maxObs: {
      value: maxPt.value,
      date: maxPt.date,
      lastMinusMax: last.value - maxPt.value,
    },
    pctChange: {
      fromFirst: pctChg(first.value, last.value),
      fromMin: pctChg(minPt.value, last.value),
      fromMax: pctChg(maxPt.value, last.value),
    },
    range: {
      maxMinusMin: rangeVal,
      lastMinOverRange:
        rangeVal !== 0 ? ((last.value - minPt.value) / rangeVal) * 100 : null,
      lastMaxOverRange:
        rangeVal !== 0 ? ((last.value - maxPt.value) / rangeVal) * 100 : null,
    },
  };
}
