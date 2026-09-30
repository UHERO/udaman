"use client";

/**
 * Mouse-wheel / double-click zoom for time-series charts, on the date-INDEX
 * domain (the same [startIndex, endIndex] window the range buttons, brush and
 * date slider drive). Shared by the series chart and the analyzer compare
 * chart; the caller owns the window and writes it to the URL as usual.
 *
 * UX:
 *   - ⌘/Ctrl + wheel (and trackpad pinch, which browsers report as
 *     ctrl+wheel) always zooms, centered on the date under the cursor.
 *   - Plain wheel zooms only once the pointer has rested on the plot for
 *     ARM_DELAY ms with no scroll-through — so scrolling the page past the
 *     chart never gets hijacked. While disarmed the page scrolls normally.
 *   - Horizontal wheel (trackpad swipe / shift+wheel) pans the window.
 *   - Zooming out at the full extent lets the page scroll instead.
 *   - Double-click zooms in 2× around the point; shift+double-click zooms
 *     out 2×. "Reset zoom" (ChartZoomBar) returns to the pre-zoom window.
 *   - Clamped to the data extent and a minimum window per frequency.
 *
 * The plot area is read from recharts' clipPath rect, so axis widths never
 * need to be passed in.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FreqCode } from "../../lib/types";

/** Smallest window, in periods, per frequency. */
export const MIN_ZOOM_POINTS: Record<FreqCode, number> = {
  A: 3,
  S: 3,
  Q: 4,
  M: 6,
  W: 4,
  D: 7,
};

const ARM_DELAY = 400;
/** Zoom factor per wheel pixel (exp scale → smooth on trackpads). */
const WHEEL_SENSITIVITY = 0.0025;

type Win = [number, number];

/**
 * Pure: zoom the float window [s, e] (indices) by `factor` (<1 = in)
 * keeping the index at fraction `anchor` (0..1 across the window) fixed.
 */
export function zoomWindow(
  [s, e]: Win,
  factor: number,
  anchor: number,
  count: number,
  minPoints: number,
): Win {
  const last = count - 1;
  const minSpan = Math.min(Math.max(1, minPoints - 1), last);
  const span = e - s;
  const nextSpan = Math.min(Math.max(span * factor, minSpan), last);
  const a = s + anchor * span;
  return clampWindow(
    [a - anchor * nextSpan, a - anchor * nextSpan + nextSpan],
    count,
  );
}

/** Pure: shift [s, e] by `delta` indices, kept inside [0, count-1]. */
export function panWindow([s, e]: Win, delta: number, count: number): Win {
  return clampWindow([s + delta, e + delta], count);
}

function clampWindow([s, e]: Win, count: number): Win {
  const last = count - 1;
  const span = Math.min(e - s, last);
  let ns = s;
  if (ns < 0) ns = 0;
  if (ns + span > last) ns = last - span;
  return [ns, ns + span];
}

export interface ChartZoomOptions {
  /** Number of points in the full date grid. */
  count: number;
  /** Current window (inclusive indices). */
  start: number;
  end: number;
  freq: FreqCode;
  /** Receives the new window; the caller updates state / URL (debounced). */
  onChange: (start: number, end: number) => void;
  enabled?: boolean;
}

export interface ChartZoom {
  /** A zoom gesture moved the window and it hasn't been changed elsewhere since. */
  zoomed: boolean;
  /** Back to the window before the first zoom gesture. */
  reset: () => void;
  enabled: boolean;
}

/**
 * Attach wheel / double-click zoom to the element in `targetRef` (the div
 * wrapping the recharts plot — not the legend or navigator).
 */
export function useChartZoom(
  targetRef: React.RefObject<HTMLElement | null>,
  { count, start, end, freq, onChange, enabled = true }: ChartZoomOptions,
): ChartZoom {
  const active = enabled && count > 2;
  // base = window before zooming; emitted = last window we reported.
  const [session, setSession] = useState<{ base: Win; emitted: Win } | null>(
    null,
  );
  const zoomed =
    !!session && session.emitted[0] === start && session.emitted[1] === end;

  const latest = useRef({ count, start, end, freq, onChange, zoomed, session });
  useLayoutEffect(() => {
    latest.current = { count, start, end, freq, onChange, zoomed, session };
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !active) return;

    // Float window so small wheel deltas accumulate between integer steps.
    let floatWin: Win | null = null;
    let armedAt = Infinity;

    const currentWin = (): Win => {
      const { start: s, end: e } = latest.current;
      if (
        floatWin &&
        Math.round(floatWin[0]) === s &&
        Math.round(floatWin[1]) === e
      )
        return floatWin;
      floatWin = [s, e];
      return floatWin;
    };

    /** Plot-area geometry in client px (recharts clipPath rect). */
    const plotBox = () => {
      const box = el.getBoundingClientRect();
      const svg = el.querySelector<SVGSVGElement>("svg.recharts-surface");
      const clip = svg?.querySelector("defs clipPath rect");
      if (svg && clip) {
        const sb = svg.getBoundingClientRect();
        const x = Number(clip.getAttribute("x")) || 0;
        const w = Number(clip.getAttribute("width")) || sb.width;
        return { left: sb.left + x, width: w };
      }
      return { left: box.left, width: box.width };
    };
    const anchorAt = (clientX: number) => {
      const { left, width } = plotBox();
      return width > 0
        ? Math.min(1, Math.max(0, (clientX - left) / width))
        : 0.5;
    };

    const emit = (next: Win) => {
      floatWin = next;
      const s = Math.round(next[0]);
      const e = Math.round(next[1]);
      const cur = latest.current;
      if (s === cur.start && e === cur.end) return;
      const base: Win =
        cur.zoomed && cur.session ? cur.session.base : [cur.start, cur.end];
      setSession({ base, emitted: [s, e] });
      cur.onChange(s, e);
    };

    const onEnter = () => {
      armedAt = performance.now() + ARM_DELAY;
    };
    // pointerenter can be skipped when the page scrolls the chart under a
    // still cursor; the first move arms it instead.
    const onMove = () => {
      if (armedAt === Infinity) armedAt = performance.now() + ARM_DELAY;
    };
    const onLeave = () => {
      armedAt = Infinity;
    };

    const onWheel = (ev: WheelEvent) => {
      const now = performance.now();
      const explicit = ev.ctrlKey || ev.metaKey;
      if (!explicit && now < armedAt) {
        // Scrolling through: let the page scroll and stay disarmed.
        armedAt = now + ARM_DELAY;
        return;
      }
      const { count: n, freq: f } = latest.current;
      const px = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
      const dx = (ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX) * px;
      const dy = ev.shiftKey && !ev.deltaX ? 0 : ev.deltaY * px;
      const win = currentWin();

      if (Math.abs(dx) > Math.abs(dy)) {
        // Pan.
        const { width } = plotBox();
        const span = win[1] - win[0];
        const next = panWindow(win, (dx / Math.max(width, 1)) * span, n);
        if (next[0] === win[0] && next[1] === win[1]) return;
        ev.preventDefault();
        emit(next);
        return;
      }
      if (!dy) return;
      const fullOut = win[0] <= 0 && win[1] >= n - 1;
      if (dy > 0 && fullOut && !explicit) return; // let the page scroll
      ev.preventDefault();
      const factor = Math.exp(dy * WHEEL_SENSITIVITY);
      emit(
        zoomWindow(win, factor, anchorAt(ev.clientX), n, MIN_ZOOM_POINTS[f]),
      );
    };

    const onDblClick = (ev: MouseEvent) => {
      const { count: n, freq: f } = latest.current;
      ev.preventDefault();
      window.getSelection()?.removeAllRanges();
      const win = currentWin();
      emit(
        zoomWindow(
          win,
          ev.shiftKey ? 2 : 0.5,
          anchorAt(ev.clientX),
          n,
          MIN_ZOOM_POINTS[f],
        ),
      );
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, [targetRef, active]);

  const reset = () => {
    const s = latest.current.session;
    setSession(null);
    if (s) latest.current.onChange(s.base[0], s.base[1]);
  };

  return { zoomed: active && zoomed, reset, enabled: active };
}

/**
 * Hint line + "Reset zoom" button shown under a zoomable chart. The hint is
 * muted and tiny; the button appears only while zoomed.
 */
export function ChartZoomBar({
  zoom,
  className,
}: {
  zoom: ChartZoom;
  className?: string;
}) {
  if (!zoom.enabled) return null;
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-6 flex-wrap items-center justify-end gap-x-3 text-[10px]",
        className,
      )}
    >
      <span className="hidden sm:inline">
        Scroll (pause on chart) or ⌘/Ctrl+scroll to zoom · double-click to zoom
        in, shift+double-click out
      </span>
      {zoom.zoomed && (
        <button
          type="button"
          onClick={zoom.reset}
          className="border-border text-foreground hover:bg-muted inline-flex h-6 items-center gap-1 border px-2 text-[11px]"
        >
          <RotateCcw className="size-3" />
          Reset zoom
        </button>
      )}
    </div>
  );
}
