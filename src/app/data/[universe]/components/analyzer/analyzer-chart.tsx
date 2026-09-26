"use client";

import { forwardRef, useMemo } from "react";
import {
  Area,
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

import { getChartPalette } from "../../lib/config";
import { formatTooltipDate } from "../../lib/dates";
import { formatAxisNumber, formatNum } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import type { FreqCode } from "../../lib/types";
import {
  AXIS_PROPS,
  CHART_LINE_WIDTH,
  formatTimeTick,
  GRID_PROPS,
  LINE_PROPS,
  timeTicks,
} from "../ui/chart-theme";
import {
  analyzerChartRows,
  axisExtent,
  axisTitle,
  specKey,
  valueForPeriod,
} from "./analyzer-model";
import type {
  AnalyzerChartRow,
  AnalyzerSeriesSpec,
  AxisSide,
} from "./analyzer-model";

export interface AxisBounds {
  leftMin: number | null;
  leftMax: number | null;
  rightMin: number | null;
  rightMax: number | null;
}

/** Stroke color + dash for a palette slot (dashed once the palette wraps). */
export function specStroke(
  palette: string[],
  slot: number,
): { color: string; dash?: string } {
  return {
    color: palette[slot % palette.length],
    dash: slot >= palette.length ? "5 3" : undefined,
  };
}

/**
 * Multi-series comparison chart (Angular analyzer-highstock), props-driven so
 * the /graph embed can reuse it.
 *
 * - one line/column/area per visible spec, colored by its fixed slot
 * - left y-axis; a right y-axis ONLY when a drawn series is assigned to it
 *   (yleft/yright URL state — kept for parity with the Angular analyzer)
 * - axis titles above the plot, left- and right-aligned to their axis
 * - y-domain: explicit min/max, else zero-based when all values ≥ 0
 *   (Highcharts' default in the Angular chart), else data-driven
 * - shared crosshair tooltip; mixed frequencies answer for the period
 *   containing the hovered date (annual value for every month of its year)
 * - legend below: every spec (or only visible ones), optional per-series
 *   controls slot (`renderLegendControls`) used by the analyzer page
 */
export const AnalyzerChart = forwardRef<
  HTMLDivElement,
  {
    specs: AnalyzerSeriesSpec[];
    baseDate: string | null;
    startDate?: string | null;
    endDate?: string | null;
    /** Analyzer (highest) frequency — x tick formatting + null bridging. */
    freq: FreqCode;
    bounds?: Partial<AxisBounds>;
    height?: number;
    /** List hidden (not in comparison) series in the legend, muted. */
    legendShowsHidden?: boolean;
    renderLegendControls?: (spec: AnalyzerSeriesSpec) => React.ReactNode;
    className?: string;
  }
>(function AnalyzerChart(
  {
    specs,
    baseDate,
    startDate,
    endDate,
    freq,
    bounds = {},
    height = 360,
    legendShowsHidden = false,
    renderLegendControls,
    className,
  },
  ref,
) {
  const { config } = usePortalConfig();
  const palette = getChartPalette(config);
  const universe = config.universe;

  const { rows, points } = useMemo(
    () => analyzerChartRows(specs, baseDate, startDate, endDate),
    [specs, baseDate, startDate, endDate],
  );
  const visible = specs.filter((s) => s.visible);
  const hasRight = visible.some((s) => s.axis === "right");
  const hasLeft = visible.some((s) => s.axis === "left");
  const leftTitle = axisTitle(specs, "left");
  const rightTitle = axisTitle(specs, "right");

  const ticks = useMemo(
    () =>
      timeTicks(
        rows.map((r) => r.ts),
        5,
      ),
    [rows],
  );
  const spanYears =
    rows.length > 1
      ? (rows[rows.length - 1].ts - rows[0].ts) / (365.25 * 864e5)
      : 0;

  // One zero line, on the first drawn axis whose data goes negative (two
  // zero lines on independent scales would read as a contradiction).
  const zeroAxis = ([hasLeft && "left", hasRight && "right"] as const).find(
    (side): side is AxisSide => {
      if (!side) return false;
      const ext = axisExtent(specs, rows, side);
      return !!ext && ext[0] < 0;
    },
  );

  const domain = (side: AxisSide) => {
    const min = side === "left" ? bounds.leftMin : bounds.rightMin;
    const max = side === "left" ? bounds.leftMax : bounds.rightMax;
    const ext = axisExtent(specs, rows, side);
    const autoMin = ext && ext[0] >= 0 ? 0 : "auto";
    return {
      domain: [min ?? autoMin, max ?? "auto"] as [
        number | "auto",
        number | "auto",
      ],
      allowDataOverflow: min != null || max != null,
    };
  };

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        visible.map((s) => [
          specKey(s.id),
          { label: s.name, color: specStroke(palette, s.slot).color },
        ]),
      ) satisfies ChartConfig,
    [visible, palette],
  );

  const legendSpecs = legendShowsHidden ? specs : visible;

  return (
    <div className={cn("w-full", className)}>
      {(leftTitle || rightTitle) && (
        <div className="text-muted-foreground flex justify-between gap-4 pb-1 text-[11px]">
          <span className="truncate">{hasLeft ? leftTitle : ""}</span>
          <span className="truncate text-right">
            {hasRight ? rightTitle : ""}
          </span>
        </div>
      )}
      <div ref={ref}>
        {rows.length === 0 ? (
          <div
            className="text-muted-foreground flex items-center justify-center text-sm"
            style={{ height }}
          >
            {visible.length
              ? "No data in the selected range."
              : "Add a series to the comparison to draw it."}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height }}
          >
            <ComposedChart
              data={rows}
              margin={{ top: 6, right: hasRight ? 0 : 8, bottom: 0, left: 0 }}
              barCategoryGap={1}
            >
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                {...AXIS_PROPS}
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(ts: number) =>
                  formatTimeTick(ts, freq, spanYears)
                }
                axisLine={{ stroke: "var(--border)" }}
                padding={
                  visible.some((s) => s.type === "column")
                    ? { left: 8, right: 8 }
                    : undefined
                }
              />
              <YAxis
                {...AXIS_PROPS}
                yAxisId="left"
                orientation="left"
                hide={!hasLeft}
                width={52}
                tickCount={5}
                tickFormatter={formatAxisNumber}
                {...domain("left")}
              />
              <YAxis
                {...AXIS_PROPS}
                yAxisId="right"
                orientation="right"
                hide={!hasRight}
                width={hasRight ? 52 : 0}
                tickCount={5}
                tickFormatter={formatAxisNumber}
                {...domain("right")}
              />
              {zeroAxis && (
                <ReferenceLine
                  yAxisId={zeroAxis}
                  y={0}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.35}
                />
              )}
              {visible.map((s) => {
                const { color, dash } = specStroke(palette, s.slot);
                const key = specKey(s.id);
                const bridge = s.series.frequencyShort !== freq;
                if (s.type === "column") {
                  return (
                    <Bar
                      key={key}
                      yAxisId={s.axis}
                      dataKey={key}
                      name={s.name}
                      fill={color}
                      maxBarSize={10}
                      isAnimationActive={false}
                    />
                  );
                }
                if (s.type === "area") {
                  return (
                    <Area
                      key={key}
                      yAxisId={s.axis}
                      type="linear"
                      dataKey={key}
                      name={s.name}
                      stroke={color}
                      strokeWidth={CHART_LINE_WIDTH}
                      strokeDasharray={dash}
                      fill={color}
                      fillOpacity={0.14}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      isAnimationActive={false}
                      connectNulls={bridge}
                    />
                  );
                }
                return (
                  <Line
                    key={key}
                    {...LINE_PROPS}
                    yAxisId={s.axis}
                    dataKey={key}
                    name={s.name}
                    stroke={color}
                    strokeDasharray={dash}
                    connectNulls={bridge}
                  />
                );
              })}
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as AnalyzerChartRow;
                  const lines = visible.flatMap((s) => {
                    const hit = valueForPeriod(s, points.get(s.id), row.date);
                    if (!hit || hit.value === null) return [];
                    return [{ s, hit }];
                  });
                  if (!lines.length) return null;
                  return (
                    <div className="bg-card border-border max-w-sm min-w-44 border px-2.5 py-1.5 text-xs shadow-md">
                      {lines.map(({ s, hit }) => (
                        <div
                          key={s.id}
                          className="flex items-start gap-2 py-0.5"
                        >
                          <span
                            className="mt-1.5 h-0.5 w-3 shrink-0"
                            style={{
                              background: specStroke(palette, s.slot).color,
                            }}
                          />
                          <span className="text-muted-foreground flex-1 leading-snug">
                            {hit.pseudo && "Pseudo History "}
                            {s.series.title} ({s.series.geography.name})
                            {s.transformation !== "Level" &&
                              ` · ${s.transformation}`}{" "}
                            <span className="text-foreground/70">
                              {formatTooltipDate(
                                hit.date,
                                s.series.frequencyShort,
                              )}
                            </span>
                          </span>
                          <span className="text-foreground font-medium tabular-nums">
                            {formatNum(hit.value, s.decimals, universe)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
      {legendSpecs.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {legendSpecs.map((s) => {
            const { color, dash } = specStroke(palette, s.slot);
            return (
              <li key={s.id} className="flex items-center gap-2">
                {renderLegendControls?.(s)}
                <LegendSwatch
                  color={s.visible ? color : "var(--border)"}
                  dashed={!!dash}
                  type={s.type}
                />
                <span
                  className={cn(
                    "leading-snug",
                    s.visible ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.name}
                  {s.visible && (
                    <span className="text-muted-foreground"> ({s.axis})</span>
                  )}
                  {!s.hasData && (
                    <span className="text-muted-foreground">
                      {" "}
                      — data not available
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

function LegendSwatch({
  color,
  dashed,
  type,
}: {
  color: string;
  dashed: boolean;
  type: AnalyzerSeriesSpec["type"];
}) {
  if (type === "column") {
    return <span className="size-2.5 shrink-0" style={{ background: color }} />;
  }
  return (
    <svg width="16" height="8" className="shrink-0" aria-hidden>
      {type === "area" && (
        <rect x="0" y="4" width="16" height="4" fill={color} opacity={0.2} />
      )}
      <line
        x1="0"
        x2="16"
        y1="4"
        y2="4"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "4 2" : undefined}
      />
    </svg>
  );
}
