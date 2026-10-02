"use client";

import { useEffect, useState } from "react";

/** Live content width of a ref'd element (0 until measured). */
export function useElementWidth(
  ref: React.RefObject<HTMLElement | null>,
): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Share of each period's horizontal slot a growth-rate bar fills. */
export const BAR_FILL = 0.75;

/**
 * Bar width + x padding for bars on a numeric time axis, where Recharts
 * can't derive a band: `n` evenly spaced periods across `plotWidth`, each
 * bar BAR_FILL of its slot, half a bar of padding at both ends so the
 * edge bars aren't clipped:
 *   plotW = (n - 1)·p + BAR_FILL·p + 4  →  p = (plotW - 4) / (n - 1 + BAR_FILL)
 */
export function timeBarLayout(
  plotWidth: number,
  n: number,
  maxBar = 64,
): { barSize: number; xPad: number } {
  const periodPx =
    n && plotWidth > 0 ? (plotWidth - 4) / (n - 1 + BAR_FILL) : 0;
  const barSize = Math.max(
    1,
    Math.min(maxBar, Math.floor(periodPx * BAR_FILL)),
  );
  return { barSize, xPad: Math.ceil(barSize / 2) + 2 };
}
