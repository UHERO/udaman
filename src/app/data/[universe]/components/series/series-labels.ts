/**
 * Small label/format helpers for the single-series view (ported from
 * highstock.component formatChartSeries / single-series-table).
 */
import { lowerBound } from "../../lib/dates";
import type { DateEntry, FreqCode } from "../../lib/types";

export type SeriesCompanion = "yoy" | "ytd" | "c5ma";

/** Chart/tooltip name of a companion series ("YOY % Change" / "YOY Change"). */
export function companionLabel(key: SeriesCompanion, percent?: boolean) {
  const base = { yoy: "YOY", ytd: "YTD", c5ma: "Annual" }[key];
  return percent ? `${base} Change` : `${base} % Change`;
}

/**
 * Companions that apply at a frequency: YTD is meaningless for annual series
 * (Angular hid the YTD table column and excluded it from annual exports).
 */
export function companionsForFreq(
  companions: readonly SeriesCompanion[],
  freq: FreqCode,
): SeriesCompanion[] {
  return companions.filter((c) => !(c === "ytd" && freq === "A"));
}

/** Range preset buttons (highstock.formatChartButtons): no 1Y for annual. */
export function rangePresets(
  buttons: readonly (number | "all")[],
  freq: FreqCode,
): { key: string; label: string; years: number | "all" }[] {
  return buttons
    .filter((b) => !(freq === "A" && b === 1))
    .map((b) =>
      b === "all"
        ? { key: "all", label: "All", years: "all" as const }
        : { key: `${b}y`, label: `${b}Y`, years: b },
    );
}

/**
 * Indices for a preset: `years` back from the current end (Highstock
 * rangeSelector type "year"), or the full sample for "all".
 */
export function presetRange(
  dates: DateEntry[],
  endIndex: number,
  years: number | "all",
): { startIndex: number; endIndex: number } {
  const last = dates.length - 1;
  if (years === "all") return { startIndex: 0, endIndex: last };
  const end = dates[endIndex]?.date ?? dates[last].date;
  const shifted = `${String(+end.substring(0, 4) - years).padStart(4, "0")}${end.substring(4)}`;
  const startIndex = Math.min(
    lowerBound(
      dates.map((d) => d.date),
      shifted,
    ),
    endIndex,
  );
  return { startIndex, endIndex };
}

/**
 * Minimal sanitizer for API-provided `sourceDetails` HTML (Angular bound it
 * via [innerHTML], which Angular sanitizes). Drops script/style/iframe
 * blocks, inline event handlers and javascript: URLs; keeps links/formatting.
 */
export function sanitizeSourceHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
}
