/**
 * Number formatting (helper.formatNum / formattedValue).
 */

/**
 * Format a number with fixed decimals and thousands separators.
 * NTA rule (per Andy Mason): with 2 decimals, values >= 1 show 1 decimal.
 * Non-finite values render as "" (Angular rendered Infinity as " ").
 */
export function formatNum(
  num: number | null | undefined,
  decimals: number,
  universe?: string,
): string {
  if (num === null || num === undefined || !Number.isFinite(num)) return "";
  let d = decimals;
  if (universe?.toUpperCase() === "NTA" && num >= 1 && d === 2) d = 1;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Parse an API value string ("368.50") to number | null. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : +v;
  return Number.isFinite(n) ? n : null;
}

/** Decimals for a series (API default when missing is 1). */
export const seriesDecimals = (s: { decimals?: number | null }) =>
  s.decimals ?? 1;

/** Growth-rate transformations are always shown with 1 decimal. */
export const GROWTH_DECIMALS = 1;

/** Compact axis number: 1,234,567 → "1.2M"; small numbers unchanged. */
export function formatAxisNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${+(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
