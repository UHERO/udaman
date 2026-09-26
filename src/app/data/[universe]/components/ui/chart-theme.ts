/**
 * Portal chart look (recharts 2.15 + shadcn ChartContainer).
 *
 * Rules (see docs/data-portal-port.md → Style):
 *   - 1.5px lines, no dots (activeDot only on hover), no legend for one series
 *   - no vertical gridlines; horizontal gridlines optional and faint
 *   - few ticks (≈4 x, ≈3-4 y), no tick marks, no axis lines except a thin baseline
 *   - colors from getChartPalette(config) (brand palette by default) in FIXED
 *     order — a series keeps its slot when others are hidden (color follows
 *     the entity, not its rank). Never read config.colors.palettes directly.
 *   - companion growth-rate bars use config.colors.chartMuted
 *   - text never wears the series color
 */
import { getChartPalette } from "../../lib/config";
import type { ChartPaletteMode, PortalConfig } from "../../lib/config";
import type { FreqCode } from "../../lib/types";

export const CHART_LINE_WIDTH = 1.5;

export const AXIS_TICK = {
  fontSize: 10,
  fill: "var(--muted-foreground)",
} as const;

/** Spread onto <XAxis>/<YAxis>. */
export const AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
  tickMargin: 4,
} as const;

/** Spread onto <CartesianGrid> when a faint horizontal grid is wanted. */
export const GRID_PROPS = {
  vertical: false,
  stroke: "var(--border)",
  strokeOpacity: 0.7,
  strokeDasharray: undefined,
} as const;

/** Spread onto <Line>. */
export const LINE_PROPS = {
  type: "linear",
  strokeWidth: CHART_LINE_WIDTH,
  dot: false,
  activeDot: { r: 3, strokeWidth: 0 },
  isAnimationActive: false,
  connectNulls: false,
} as const;

/** Spread onto companion <Bar>s (growth rates behind the level line). */
export const COMPANION_BAR_PROPS = {
  isAnimationActive: false,
  maxBarSize: 6,
  fillOpacity: 0.55,
} as const;

/** Color for series slot i (fixed order, wraps only as a last resort). */
export function seriesColor(
  config: PortalConfig,
  slot: number,
  mode?: ChartPaletteMode,
): string {
  const p = getChartPalette(config, mode);
  return p[((slot % p.length) + p.length) % p.length];
}

/**
 * CSS variables for the portal wrapper (layout.tsx): square corners, brand
 * colors, and --portal-series-N for plain-CSS consumers.
 */
export function portalCssVars(config: PortalConfig): React.CSSProperties {
  const vars: Record<string, string> = {
    "--radius": "0px",
    "--theme": config.colors.primary,
    "--portal-primary": config.colors.primary,
    "--portal-accent": config.colors.accent,
    "--portal-muted-series": config.colors.chartMuted,
    "--sidebar": "#ffffff",
  };
  getChartPalette(config).forEach((c, i) => {
    vars[`--portal-series-${i + 1}`] = c;
  });
  return vars as React.CSSProperties;
}

/**
 * ~`count` evenly spaced x ticks (UTC ms) snapped to Jan 1 of whole years
 * when the span allows, else to the given timestamps.
 */
export function timeTicks(timestamps: number[], count = 4): number[] {
  if (timestamps.length < 2) return timestamps;
  const min = timestamps[0];
  const max = timestamps[timestamps.length - 1];
  const y0 = new Date(min).getUTCFullYear();
  const y1 = new Date(max).getUTCFullYear();
  const years = y1 - y0;
  if (years >= count - 1) {
    const step = Math.max(1, Math.ceil(years / (count - 1)));
    const ticks: number[] = [];
    for (let y = y1; y >= y0; y -= step) {
      const t = Date.UTC(y, 0, 1);
      if (t >= min) ticks.unshift(t);
    }
    return ticks;
  }
  const step = Math.max(1, Math.floor((timestamps.length - 1) / (count - 1)));
  const ticks: number[] = [];
  for (let i = timestamps.length - 1; i >= 0; i -= step)
    ticks.unshift(timestamps[i]);
  return ticks;
}

/** X tick label for a UTC ms timestamp. */
export function formatTimeTick(ts: number, freq: FreqCode, spanYears: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  if (spanYears <= 2 && freq !== "A") {
    const m = d.getUTCMonth();
    if (freq === "Q" || freq === "S") return `${y} Q${Math.floor(m / 3) + 1}`;
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]} ${y}`;
  }
  return String(y);
}
