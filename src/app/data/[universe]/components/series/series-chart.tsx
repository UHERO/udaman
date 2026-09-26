"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  Brush,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

import { formatTooltipDate } from "../../lib/dates";
import { formatAxisNumber, formatNum, GROWTH_DECIMALS } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import type { FreqCode, PseudoZone, SeriesChartRow } from "../../lib/types";
import {
  AXIS_PROPS,
  COMPANION_BAR_PROPS,
  formatTimeTick,
  LINE_PROPS,
  seriesColor,
  timeTicks,
} from "../ui/chart-theme";
import { ChartZoomBar, useChartZoom } from "../ui/use-chart-zoom";
import { companionLabel } from "./series-labels";
import type { SeriesCompanion } from "./series-labels";

type Row = SeriesChartRow & { levelPseudo?: number | null };

const Y_AXIS_WIDTH = 56;
/** Companion bars fill this share of each period's horizontal slot. */
const BAR_FILL = 0.75;
const MAX_BAR_PX = 64;

export interface SeriesChartProps {
  /** Full series on its own date grid (seriesChartData(series).rows). */
  rows: SeriesChartRow[];
  freq: FreqCode;
  decimals: number;
  universe?: string;
  /** series.percent — companions are changes, not % changes. */
  percent?: boolean;
  /** Units label for the level (right) axis (e.g. "Thousands"). */
  unitsLabel?: string;
  /**
   * Companion transformations (config.seriesChart.companions, already
   * filtered for freq). The FIRST is drawn as bars on the left axis; all
   * appear in the tooltip (Angular: series2 had color "none").
   */
  companions?: SeriesCompanion[];
  pseudoZones?: PseudoZone[];
  /** Visible window as indices into `rows` (inclusive). Default: all. */
  startIndex?: number;
  endIndex?: number;
  /**
   * When given, a navigator (brush over the full series) is drawn, the plot
   * gets wheel / double-click zoom (useChartZoom), and both report the new
   * window here. Omit for a static chart.
   */
  onRangeChange?: (startIndex: number, endIndex: number) => void;
  /** Height of the plot in px. */
  height?: number;
  /** Palette slot for the level line. */
  slot?: number;
  /** Receives the plot wrapper (for chart-export's exportChartImage). */
  plotRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

/**
 * Single-series chart (port of highstock.component), one plot, two axes —
 * faithful to the Angular Highstock:
 *
 *   ▮ YOY % Chg                               Thousands ─
 *   4%  ┤ ▮ ▮▮   level line (brand slot 0)   ├ 1,200     right axis labels in
 *   0%  ┼─▮─▮────────────────────────────────┤ 1,000     the line color; left
 *  -4%  ┤    ▮▮  muted bars                  ├ 800       (bars) muted gray
 *       2016        2019        2022        2025
 *   ├ navigator (brush over full sample) ─────────┤      only with onRangeChange
 *
 * Highstock yAxis[0] ("series2", opposite:false) = the first companion as
 * columns; yAxis[1] ("series1", default opposite → right) = level. Scales
 * are independent (no zero alignment), no gridlines, minPadding 0. The bar
 * axis always includes 0 (Highcharts column threshold) and draws a zero line.
 */
export function SeriesChart({
  rows,
  freq,
  decimals,
  universe,
  percent,
  unitsLabel,
  companions = [],
  pseudoZones,
  startIndex = 0,
  endIndex,
  onRangeChange,
  height = 320,
  slot = 0,
  plotRef,
  className,
}: SeriesChartProps) {
  const { config } = usePortalConfig();
  const stroke = seriesColor(config, slot);
  const muted = config.colors.chartMuted;
  const barKey = companions[0] ?? null;
  const last = rows.length - 1;
  const lo = Math.max(0, Math.min(startIndex, last));
  const hi = Math.max(lo, Math.min(endIndex ?? last, last));

  const innerRef = useRef<HTMLDivElement>(null);
  const target = plotRef ?? innerRef;
  const zoom = useChartZoom(target, {
    count: rows.length,
    start: lo,
    end: hi,
    freq,
    onChange: (s, e) => onRangeChange?.(s, e),
    enabled: !!onRangeChange,
  });

  const pseudoBoundary = pseudoZones?.length
    ? pseudoZones[pseudoZones.length - 1].date
    : null;

  const data = useMemo<Row[]>(() => {
    const visible = rows.slice(lo, hi + 1);
    if (!pseudoBoundary) return visible;
    return visible.map((r) => ({
      ...r,
      levelPseudo: r.date <= pseudoBoundary ? r.level : null,
      level: r.date >= pseudoBoundary ? r.level : null,
    }));
  }, [rows, lo, hi, pseudoBoundary]);

  // Level zero line when level goes negative and no bars own the zero line.
  const levelHasNegative = useMemo(
    () => data.some((r) => (r.level ?? r.levelPseudo ?? 0) < 0),
    [data],
  );

  const ticks = useMemo(
    () =>
      timeTicks(
        data.map((d) => d.ts),
        5,
      ),
    [data],
  );
  const spanYears =
    data.length > 1
      ? (data[data.length - 1].ts - data[0].ts) / (365.25 * 864e5)
      : 0;
  // Bar width = BAR_FILL of one period's slot. Recharts can't derive a band
  // on a numeric time axis, so measure the plot and size bars ourselves.
  // X padding of half a bar keeps the first/last bars inside the plot:
  //   plotW = (n - 1)·p + BAR_FILL·p + 4  →  p = (plotW - 4) / (n - 1 + BAR_FILL)
  const chartWidth = useElementWidth(target);
  const plotWidth = chartWidth - (barKey ? 2 * Y_AXIS_WIDTH : Y_AXIS_WIDTH + 8);
  const periodPx =
    data.length && plotWidth > 0
      ? (plotWidth - 4) / (data.length - 1 + BAR_FILL)
      : 0;
  const barSize = Math.max(
    1,
    Math.min(MAX_BAR_PX, Math.floor(periodPx * BAR_FILL)),
  );
  const xPad = Math.ceil(barSize / 2) + 2;

  const domain: [number, number] = data.length
    ? [data[0].ts, data[data.length - 1].ts]
    : [0, 1];

  const barLabel = barKey ? companionLabel(barKey, percent) : "";
  const chartConfig = {
    level: { label: "Level", color: stroke },
    levelPseudo: { label: "Pseudo History", color: stroke },
    ...Object.fromEntries(
      companions.map((c) => [
        c,
        { label: companionLabel(c, percent), color: muted },
      ]),
    ),
  } satisfies ChartConfig;

  if (!rows.length) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height }}
      >
        Data not available
      </div>
    );
  }

  // Level on the right when bars take the left axis (Angular); else left.
  const levelSide = barKey ? "right" : "left";
  const rightWidth = barKey ? Y_AXIS_WIDTH : 0;
  const pctSuffix = barKey && !percent ? "%" : "";

  return (
    <div className={cn("w-full", className)}>
      <div className="text-muted-foreground mb-1 flex items-center justify-between gap-4 text-[11px] tracking-wide">
        <span className="flex min-w-0 items-center gap-1.5">
          {barKey && (
            <>
              <span
                aria-hidden
                className="inline-block h-2.5 w-1.5 shrink-0"
                style={{ background: muted }}
              />
              <span className="truncate">{barLabel}</span>
            </>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{unitsLabel || "Level"}</span>
          <span
            aria-hidden
            className="inline-block h-0.5 w-3 shrink-0"
            style={{ background: stroke }}
          />
        </span>
      </div>
      <div ref={target} className="select-none">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height }}
        >
          <ComposedChart
            data={data}
            margin={{ top: 6, right: barKey ? 0 : 8, bottom: 0, left: 0 }}
          >
            <XAxis
              {...AXIS_PROPS}
              dataKey="ts"
              type="number"
              scale="time"
              domain={domain}
              ticks={ticks}
              tickFormatter={(ts: number) =>
                formatTimeTick(ts, freq, spanYears)
              }
              axisLine={{ stroke: "var(--border)" }}
              padding={barKey ? { left: xPad, right: xPad } : undefined}
            />
            {barKey && (
              <YAxis
                {...AXIS_PROPS}
                yAxisId="change"
                orientation="left"
                width={Y_AXIS_WIDTH}
                tickCount={5}
                domain={[
                  (min: number) => Math.min(0, min),
                  (max: number) => Math.max(0, max),
                ]}
                tickFormatter={(v: number) =>
                  `${formatAxisNumber(v)}${pctSuffix}`
                }
              />
            )}
            <YAxis
              {...AXIS_PROPS}
              yAxisId="level"
              orientation={levelSide}
              width={Y_AXIS_WIDTH}
              tickCount={5}
              domain={["auto", "auto"]}
              tick={{
                ...AXIS_PROPS.tick,
                fill: barKey ? stroke : AXIS_PROPS.tick.fill,
              }}
              tickFormatter={formatAxisNumber}
            />
            {barKey && (
              <ReferenceLine
                yAxisId="change"
                y={0}
                stroke="var(--border)"
                ifOverflow="extendDomain"
              />
            )}
            {barKey && (
              <Bar
                {...COMPANION_BAR_PROPS}
                maxBarSize={MAX_BAR_PX}
                barSize={barSize}
                yAxisId="change"
                dataKey={barKey}
                fill={muted}
              />
            )}
            {!barKey && levelHasNegative && (
              <ReferenceLine
                yAxisId="level"
                y={0}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.35}
              />
            )}
            {pseudoBoundary && (
              <Line
                {...LINE_PROPS}
                yAxisId="level"
                dataKey="levelPseudo"
                stroke={stroke}
                strokeDasharray="4 3"
              />
            )}
            <Line
              {...LINE_PROPS}
              yAxisId="level"
              dataKey="level"
              stroke={stroke}
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeWidth: 1,
                strokeOpacity: 0.5,
              }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                const isPseudo = row.level === null && row.levelPseudo != null;
                const level = row.level ?? row.levelPseudo ?? null;
                return (
                  <div className="bg-card border-border min-w-40 border px-2.5 py-1.5 text-xs shadow-md">
                    <div className="text-foreground mb-1 font-medium">
                      {formatTooltipDate(row.date, freq)}
                    </div>
                    <TooltipLine
                      swatch={stroke}
                      dashed={isPseudo}
                      label={isPseudo ? "Pseudo History Level" : "Level"}
                      value={formatNum(level, decimals, universe) || "–"}
                    />
                    {companions.map((c) => (
                      <TooltipLine
                        key={c}
                        swatch={c === barKey ? muted : undefined}
                        bar={c === barKey}
                        label={companionLabel(c, percent)}
                        value={
                          formatNum(
                            row[c],
                            c === "c5ma" ? decimals : GROWTH_DECIMALS,
                            universe,
                          ) || "–"
                        }
                      />
                    ))}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      {onRangeChange && <ChartZoomBar zoom={zoom} className="mt-1" />}

      {onRangeChange && rows.length > 1 && (
        <SeriesNavigator
          rows={rows}
          freq={freq}
          startIndex={lo}
          endIndex={hi}
          stroke={muted}
          padLeft={Y_AXIS_WIDTH + (barKey ? 4 : 0)}
          padRight={barKey ? rightWidth + 4 : 8}
          onChange={onRangeChange}
        />
      )}
    </div>
  );
}

/**
 * Brush over the full sample (Highstock navigator). Controlled by indices;
 * reports drags via onChange.
 */
function SeriesNavigator({
  rows,
  freq,
  startIndex,
  endIndex,
  stroke,
  padLeft,
  padRight,
  onChange,
}: {
  rows: SeriesChartRow[];
  freq: FreqCode;
  startIndex: number;
  endIndex: number;
  stroke: string;
  padLeft: number;
  padRight: number;
  onChange: (startIndex: number, endIndex: number) => void;
}) {
  return (
    <div
      className="mt-1 w-full"
      style={{ paddingLeft: padLeft, paddingRight: padRight }}
    >
      <ChartContainer
        config={{ level: { label: "Level", color: stroke } }}
        className="aspect-auto w-full"
        style={{ height: 40 }}
        aria-label="Date range navigator"
      >
        <ComposedChart
          data={rows}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Brush
            dataKey="date"
            height={38}
            travellerWidth={7}
            startIndex={startIndex}
            endIndex={endIndex}
            stroke="var(--muted-foreground)"
            fill="transparent"
            tickFormatter={(date: string) => formatTooltipDate(date, freq)}
            onChange={(r) => {
              const s = r.startIndex ?? 0;
              const e = r.endIndex ?? rows.length - 1;
              if (s !== startIndex || e !== endIndex) onChange(s, e);
            }}
          >
            <ComposedChart data={rows}>
              <Line
                {...LINE_PROPS}
                dataKey="level"
                stroke={stroke}
                strokeWidth={1}
                activeDot={false}
              />
            </ComposedChart>
          </Brush>
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function TooltipLine({
  swatch,
  dashed,
  bar,
  label,
  value,
}: {
  swatch?: string;
  dashed?: boolean;
  bar?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("w-3 shrink-0", bar ? "h-2.5 px-[3px]" : "h-0.5")}
        style={
          swatch
            ? bar
              ? { background: swatch, backgroundClip: "content-box" }
              : dashed
                ? { borderTop: `2px dashed ${swatch}`, height: 0 }
                : { background: swatch }
            : undefined
        }
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Live content width of a ref'd element (0 until measured). */
function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
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
