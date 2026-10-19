/**
 * Kauaʻi dashboard look — same rules as the UHERO portal
 * (src/app/data/[universe]/components/ui/chart-theme.ts): UHERO brand
 * palette in fixed order, muted gray growth bars, square corners.
 */
import { formatNum, GROWTH_DECIMALS } from "@/app/data/[universe]/lib/format";
import type { FreqCode } from "@/app/data/[universe]/lib/types";

import type { DashboardSeries } from "./data";

export const PRIMARY = "#1D667F";
export const ACCENT = "#F6A01B";
export const MUTED = "#9E9E9E";
/** Text colors for signed changes (AA on white). */
export const POSITIVE = "#1D667F";
export const NEGATIVE = "#B4541A";

/** UHERO brand palette (config.ts BRAND_UHERO), slot order fixed. */
export const PALETTE = [
  PRIMARY,
  ACCENT,
  "#9BBB59",
  "#8064A2",
  "#C0504D",
  "#4BACC6",
];

/** Ten sector colors for the jobs treemap (brand palette + tempered extensions). */
export const SECTOR_COLORS = [
  "#1D667F",
  "#4BACC6",
  "#7FA34A",
  "#E0901A",
  "#8064A2",
  "#C0504D",
  "#2E8B7A",
  "#B07A55",
  "#5B7DB1",
  "#8C8A3E",
];

/** CSS variables the shared portal components read (--portal-primary …). */
export const KAUAI_CSS_VARS = {
  "--radius": "0px",
  "--theme": PRIMARY,
  "--portal-primary": PRIMARY,
  "--portal-accent": ACCENT,
  "--portal-muted-series": MUTED,
} as React.CSSProperties;

export function formatLevel(s: DashboardSeries, v: number | null | undefined) {
  return formatNum(v, s.decimals);
}

/** Signed change: "+2.8%" (or "+0.25" points for rate series). */
export function formatChange(
  v: number | null | undefined,
  percent: boolean,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const d = percent ? 2 : GROWTH_DECIMALS;
  const s = formatNum(Math.abs(v), d);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${s}${percent ? "" : "%"}`;
}

export function changeColor(v: number | null | undefined): string | undefined {
  if (v === null || v === undefined || v === 0) return undefined;
  return v > 0 ? POSITIVE : NEGATIVE;
}

/** "YoY % change" / "YoY change" (rate series). */
export function changeLabel(percent: boolean) {
  return percent ? "Change from year ago (pts)" : "% change from year ago";
}

/** Latest-value column change: YTD for sub-annual data, YoY for annual. */
export function latestChange(s: DashboardSeries, i: number, freq: FreqCode) {
  return freq === "A" ? s.pc1[i] : s.ytd[i];
}

/** Units for display: "Thous", "82-84$Mil" … falling back to the long label. */
export function unitsText(s: DashboardSeries) {
  return s.unitsShort || s.units;
}
