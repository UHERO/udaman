/**
 * Shared "latest value + change" wording for link previews: the Slack unfurl
 * for udaman series pages and the data portal's Open Graph description.
 * Pure — callers format the period label themselves.
 */

export interface LatestObservation {
  value: number;
  /** The observation before `value`, if any. */
  prevValue?: number | null;
  decimals?: number | null;
  /** Percent-valued series: change is reported in points, not percent. */
  percent?: boolean;
  unitsLabel?: string | null;
}

export function formatPreviewNumber(n: number, decimals = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** "812,345.0 persons", "2.6%" (units omitted when absent). */
export function formatLatestValue(o: LatestObservation): string {
  const v = formatPreviewNumber(o.value, o.decimals ?? 1);
  if (!o.unitsLabel) return v;
  return o.unitsLabel === "%" ? `${v}%` : `${v} ${o.unitsLabel}`;
}

/**
 * Change vs the prior observation: "▲ 2.1%" / "▼ 0.3 pts" / "unchanged".
 * Null when there is no prior value, or a percent change against zero.
 */
export function formatChange(o: LatestObservation): string | null {
  if (o.prevValue === null || o.prevValue === undefined) return null;
  const diff = o.value - o.prevValue;
  if (diff === 0) return "unchanged";
  const arrow = diff > 0 ? "▲" : "▼";
  if (o.percent) {
    return `${arrow} ${formatPreviewNumber(Math.abs(diff), o.decimals ?? 1)} pts`;
  }
  if (o.prevValue === 0) return null;
  const pct = (diff / Math.abs(o.prevValue)) * 100;
  return `${arrow} ${formatPreviewNumber(Math.abs(pct), 1)}%`;
}
