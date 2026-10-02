"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
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
  AXIS_TICK,
  COMPANION_BAR_PROPS,
  formatTimeTick,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  timeTicks,
} from "./chart-theme";
import { GrowBar } from "./grow-bar";
import { PSEUDO_DASH } from "./pseudo-history-note";
import { timeBarLayout, useElementWidth } from "./use-element-width";

type Companion = "yoy" | "ytd" | "c5ma" | "mom";

type Row = SeriesChartRow & { levelPseudo?: number | null };

/**
 * Minimal level-line chart for category grids and analyzer mini charts —
 * the reference implementation of the portal chart look (chart-theme.ts).
 *
 * - Level as a 1.5px line in palette slot `slot`, no dots.
 * - Optional companion growth rate (config.miniChart.secondary) in the
 *   tooltip. Faithful to Angular highchart.component: its series1 (YTD
 *   column) was styled transparent in every portal ($highcharts-series1:
 *   none; `.highcharts-series-1 rect.highcharts-point { fill: none }`), so
 *   by default no bars are drawn. `companionBars` draws them as thin muted
 *   bars on a hidden secondary scale (Angular: second y-axis, labels off).
 * - Pseudo-history drawn dashed up to the last pseudo zone.
 * - Crosshair tooltip with the frequency-formatted date. `tooltip={false}`
 *   keeps only the crosshair and reports the hovered row via `onHoverRow`
 *   (category cards show it in their header instead).
 */
export function MiniLineChart({
  rows,
  freq,
  decimals,
  universe,
  slot = 0,
  color,
  levelLabel = "Level",
  companion = null,
  companionLabel,
  companionBars = false,
  startDate,
  endDate,
  yDomain,
  pseudoZones,
  height = 140,
  showGrid = false,
  showYAxis = true,
  showXAxis = true,
  edgeTicks = false,
  valueKey = "level",
  tooltip = true,
  onHoverRow,
  className,
}: {
  rows: SeriesChartRow[];
  freq: FreqCode;
  decimals: number;
  universe?: string;
  /** Palette slot (fixed per entity). */
  slot?: number;
  /** Explicit color override (otherwise config palette[slot]). */
  color?: string;
  levelLabel?: string;
  companion?: Companion | null;
  companionLabel?: string;
  /** Draw the companion as bars (Angular kept them invisible). */
  companionBars?: boolean;
  /** Visible range "YYYY-MM-DD" (inclusive). */
  startDate?: string;
  endDate?: string;
  /** Shared y-range (NTA sharedYAxis). */
  yDomain?: [number, number];
  pseudoZones?: PseudoZone[];
  height?: number;
  showGrid?: boolean;
  showYAxis?: boolean;
  showXAxis?: boolean;
  /**
   * Label only the extremes: first/last period on x (anchored inward so
   * they aren't clipped), min/max of the plotted values on y.
   */
  edgeTicks?: boolean;
  /** Which value the line plots (pseudo-history styling applies to level only). */
  valueKey?: "level" | "yoy" | "ytd" | "c5ma";
  /** Render the floating tooltip (the crosshair is always drawn). */
  tooltip?: boolean;
  /** Hovered row (pseudo-history merged back into `level`), null on leave. */
  onHoverRow?: (row: SeriesChartRow | null) => void;
  className?: string;
}) {
  const { config } = usePortalConfig();
  const stroke = color ?? seriesColor(config, slot);
  const bars = !!companion && companionBars;

  // Animate the line only after first paint: no draw-in on page load, but a
  // later rescale (bars toggled, range or shared axis changed) morphs smoothly.
  const [animate, setAnimate] = useState(false);
  useEffect(() => setAnimate(true), []);

  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);

  const data = useMemo<Row[]>(() => {
    const visible = rows.filter(
      (r) =>
        (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate),
    );
    const boundary = pseudoZones?.length
      ? pseudoZones[pseudoZones.length - 1].date
      : null;
    if (!boundary || valueKey !== "level") return visible;
    return visible.map((r) => ({
      ...r,
      levelPseudo: r.date <= boundary ? r.level : null,
      level: r.date >= boundary ? r.level : null,
    }));
  }, [rows, startDate, endDate, pseudoZones, valueKey]);

  // Edge ticks: first/last period, min/max plotted value.
  const edge = useMemo(() => {
    if (!edgeTicks || !data.length) return null;
    const first = data[0];
    const last = data[data.length - 1];
    let min = Infinity;
    let max = -Infinity;
    for (const r of data) {
      const v = valueKey === "level" ? (r.level ?? r.levelPseudo) : r[valueKey];
      if (v === null || v === undefined) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const [lo, hi] = yDomain ?? [min, max];
    return {
      x: first.ts === last.ts ? [first.ts] : [first.ts, last.ts],
      dateByTs: new Map(data.map((r) => [r.ts, r.date])),
      y: Number.isFinite(lo) ? (lo === hi ? [lo] : [lo, hi]) : undefined,
      domain: Number.isFinite(lo) ? ([lo, hi] as [number, number]) : undefined,
    };
  }, [edgeTicks, data, valueKey, yDomain]);

  // Faint zero line only when the plotted values dip below zero.
  const hasNegative = useMemo(
    () =>
      (yDomain ? yDomain[0] < 0 : false) ||
      data.some((r) => {
        const v =
          valueKey === "level" ? (r.level ?? r.levelPseudo) : r[valueKey];
        return v !== null && v !== undefined && v < 0;
      }),
    [data, valueKey, yDomain],
  );

  const { barSize, xPad } = timeBarLayout(
    width - (showYAxis ? 40 : 0) - 4,
    data.length,
    24,
  );

  const ticks = useMemo(
    () =>
      timeTicks(
        data.map((d) => d.ts),
        4,
      ),
    [data],
  );
  const spanYears =
    data.length > 1
      ? (data[data.length - 1].ts - data[0].ts) / (365.25 * 864e5)
      : 0;

  // Report hover only when the index changes, so parents re-render per point.
  const hoverIndex = useRef<number | null>(null);
  const reportHover = useCallback(
    (index: number | null) => {
      if (!onHoverRow || index === hoverIndex.current) return;
      hoverIndex.current = index;
      const row = index === null ? null : data[index];
      onHoverRow(
        row ? { ...row, level: row.level ?? row.levelPseudo ?? null } : null,
      );
    },
    [data, onHoverRow],
  );

  const chartConfig = {
    level: { label: levelLabel, color: stroke },
    levelPseudo: { label: `${levelLabel} (pseudo history)`, color: stroke },
    ...(companion
      ? {
          [companion]: {
            label: companionLabel ?? companion.toUpperCase(),
            color: config.colors.chartMuted,
          },
        }
      : {}),
  } satisfies ChartConfig;

  if (!data.length) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center text-xs",
          className,
        )}
        style={{ height }}
      >
        No data in range
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("w-full", className)}>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onMouseMove={(state) => {
            const i = state?.activeTooltipIndex;
            reportHover(typeof i === "number" && i >= 0 ? i : null);
          }}
          onMouseLeave={() => reportHover(null)}
        >
          {showGrid && <CartesianGrid {...GRID_PROPS} />}
          <XAxis
            {...AXIS_PROPS}
            dataKey="ts"
            hide={!showXAxis}
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={edge?.x ?? ticks}
            tickFormatter={(ts: number) => {
              const date = edge?.dateByTs.get(ts);
              return date
                ? formatTooltipDate(date, freq)
                : formatTimeTick(ts, freq, spanYears);
            }}
            {...(edge && { tick: <EdgeXTick />, interval: 0 })}
            axisLine={edge ? false : { stroke: "var(--border)" }}
            padding={bars ? { left: xPad, right: xPad } : undefined}
          />
          <YAxis
            {...AXIS_PROPS}
            yAxisId="level"
            hide={!showYAxis}
            width={40}
            tickCount={3}
            domain={edge?.domain ?? yDomain ?? ["auto", "auto"]}
            tickFormatter={formatAxisNumber}
            {...(edge && {
              ticks: edge.y,
              interval: 0,
              padding: { top: 6, bottom: 6 },
            })}
          />
          {bars && (
            <YAxis
              yAxisId="companion"
              hide
              domain={[
                (min: number) => Math.min(0, min),
                (max: number) => Math.max(0, max),
              ]}
            />
          )}
          {bars && (
            // Keyed by measure so switching YOY ↔ YTD regrows from zero.
            <Bar
              key={companion}
              {...COMPANION_BAR_PROPS}
              shape={<GrowBar />}
              barSize={barSize}
              maxBarSize={24}
              yAxisId="companion"
              dataKey={companion}
              fill={config.colors.chartMuted}
            />
          )}
          {hasNegative && (
            <ReferenceLine
              yAxisId="level"
              y={0}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          )}
          {pseudoZones?.length && valueKey === "level" ? (
            <Line
              {...LINE_PROPS}
              isAnimationActive={animate}
              animationDuration={450}
              yAxisId="level"
              dataKey="levelPseudo"
              stroke={stroke}
              strokeDasharray={PSEUDO_DASH}
            />
          ) : null}
          <Line
            {...LINE_PROPS}
            isAnimationActive={animate}
            animationDuration={450}
            yAxisId="level"
            dataKey={valueKey}
            stroke={stroke}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!tooltip || !active || !payload?.length) return null;
              const row = payload[0].payload as Row;
              const level = row.level ?? row.levelPseudo ?? null;
              const comp = companion ? row[companion] : null;
              return (
                <div className="bg-card border-border min-w-32 border px-2.5 py-1.5 text-xs shadow-md">
                  <div className="text-foreground mb-1 font-medium">
                    {formatTooltipDate(row.date, freq)}
                  </div>
                  <TooltipLine
                    swatch={stroke}
                    label={levelLabel}
                    value={formatNum(level, decimals, universe) || "–"}
                  />
                  {companion && (
                    <TooltipLine
                      swatch={config.colors.chartMuted}
                      label={companionLabel ?? companion.toUpperCase()}
                      value={formatNum(comp, GROWTH_DECIMALS, universe) || "–"}
                    />
                  )}
                </div>
              );
            }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function TooltipLine({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-0.5 w-3 shrink-0" style={{ background: swatch }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** X tick for `edgeTicks`: first label anchored start, last anchored end. */
function EdgeXTick(props: {
  x?: number;
  y?: number;
  index?: number;
  visibleTicksCount?: number;
  payload?: { value: number };
  tickFormatter?: (value: number, index: number) => string;
}) {
  const { x = 0, y = 0, index = 0, visibleTicksCount = 1, payload } = props;
  if (!payload) return null;
  const anchor =
    visibleTicksCount < 2 ? "middle" : index === 0 ? "start" : "end";
  return (
    <text
      x={x}
      y={y}
      dy="0.71em"
      textAnchor={anchor}
      fontSize={AXIS_TICK.fontSize}
      fill={AXIS_TICK.fill}
    >
      {props.tickFormatter?.(payload.value, index) ?? payload.value}
    </text>
  );
}
