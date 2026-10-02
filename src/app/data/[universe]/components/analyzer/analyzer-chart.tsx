"use client";

import { forwardRef, useMemo, useRef } from "react";
import {
  Area,
  Bar,
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
import { formatTableDate, formatTooltipDate } from "../../lib/dates";
import { formatAxisNumber, formatNum, GROWTH_DECIMALS } from "../../lib/format";
import { usePortalConfig } from "../../lib/portal-context";
import { getTransformations } from "../../lib/series";
import type { FreqCode } from "../../lib/types";
import type { TableTransform } from "../selectors/transform-toggle";
import { AnchoredTimeTick } from "../ui/anchored-time-tick";
import {
  AXIS_PROPS,
  axisWidthFor,
  CHART_LINE_WIDTH,
  CURVE_TYPE,
  edgeTimeTicks,
  formatTimeTick,
  LINE_PROPS,
  niceTicks,
} from "../ui/chart-theme";
import { GrowBar } from "../ui/grow-bar";
import { PSEUDO_DASH, PseudoHistoryNote } from "../ui/pseudo-history-note";
import { timeBarLayout, useElementWidth } from "../ui/use-element-width";
import {
  analyzerChartRows,
  axisExtent,
  axisTitle,
  growthKey,
  pseudoKey,
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

const Y_AXIS_W = 52;

/** Growth-axis labels (top-left, like the series chart's "YOY % Change"). */
const GROWTH_AXIS_LABEL: Record<TableTransform, string> = {
  yoy: "YOY % Chg",
  ytd: "YTD % Chg",
  mom: "MOM % Chg",
  c5ma: "Annual % Chg",
};

/** Stroke color + dash for a palette slot (6 solid, 6 dashed, repeat). */
export function specStroke(
  palette: string[],
  slot: number,
): { color: string; dash?: string } {
  // Six solid colors, then the same six with a long dash, then repeat. The
  // long dash stays distinct from the short pseudo-history dash.
  const n = palette.length;
  return {
    color: palette[slot % n],
    dash: Math.floor(slot / n) % 2 === 1 ? "9 4" : undefined,
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
    /** Growth rate drawn as translucent bars behind each visible series. */
    growth?: TableTransform | null;
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
    growth = null,
    className,
  },
  ref,
) {
  const { config } = usePortalConfig();
  const palette = getChartPalette(config);
  const universe = config.universe;

  const visible = specs.filter((s) => s.visible);
  const { rows, points } = useMemo(() => {
    const out = analyzerChartRows(specs, baseDate, startDate, endDate);
    if (!growth) return out;
    // Growth bars: each visible series' growth value on its own dates.
    for (const s of specs) {
      if (!s.visible) continue;
      const t = getTransformations(
        s.series.seriesObservations.transformationResults,
      )[growth];
      if (!t?.dates) continue;
      const byDate = new Map(t.dates.map((d, i) => [d, t.values?.[i]]));
      for (const r of out.rows) {
        const v = byDate.get(r.date);
        if (v !== undefined && v !== null && v !== "")
          r[growthKey(s.id)] = Number(v);
      }
    }
    return out;
  }, [specs, baseDate, startDate, endDate, growth]);
  const barSpecs = growth
    ? visible.filter((s) => rows.some((r) => r[growthKey(s.id)] != null))
    : [];

  const hasRight = visible.some((s) => s.axis === "right");
  const hasLeft = visible.some((s) => s.axis === "left");
  const leftTitle = axisTitle(specs, "left");
  const rightTitle = axisTitle(specs, "right");

  // Growth bars on → layout matches the series page: the labelled growth %
  // axis takes the left side and the left-assigned lines' axis moves to the
  // right (right-assigned lines keep their own, outer right axis).
  const growthOn = barSpecs.length > 0;
  const rightAxes = (growthOn && hasLeft ? 1 : 0) + (hasRight ? 1 : 0);
  const titleLeft = growthOn
    ? GROWTH_AXIS_LABEL[growth!]
    : hasLeft
      ? leftTitle
      : "";
  const titleRight = [
    growthOn && hasLeft ? leftTitle : "",
    hasRight ? rightTitle : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // ── Y axes (same approach as the series chart, made label-safe) ──────
  // Nice ticks over the values in the visible range; each axis is as wide
  // as its widest label (a 4-digit "5,643.3%" was clipped at a fixed 52px).
  const growthFmt = (v: number) => `${formatAxisNumber(v)}%`;
  let growthExt: [number, number] | null = null;
  if (growthOn) {
    let lo = 0;
    let hi = 0;
    for (const r of rows)
      for (const s of barSpecs) {
        const v = r[growthKey(s.id)];
        if (v == null || !Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    growthExt = [lo, hi];
  }
  const axisFor = (
    ext: [number, number] | null,
    fmt: (v: number) => string,
    min?: number | null,
    max?: number | null,
  ) => {
    if (min != null || max != null) {
      // Explicit bounds (embed URLs): honor them as given.
      const lo = min ?? ext?.[0] ?? 0;
      const hi = max ?? ext?.[1] ?? 1;
      return {
        domain: [lo, hi] as [number, number],
        ticks: undefined,
        allowDataOverflow: true,
        width: axisWidthFor(niceTicks(lo, hi).map(fmt)),
      };
    }
    const ticks = ext ? niceTicks(ext[0], ext[1], 5) : [];
    return ticks.length
      ? {
          domain: [ticks[0], ticks[ticks.length - 1]] as [number, number],
          ticks,
          allowDataOverflow: false,
          width: axisWidthFor(ticks.map(fmt)),
        }
      : {
          domain: ["auto", "auto"] as ["auto", "auto"],
          ticks: undefined,
          allowDataOverflow: false,
          width: Y_AXIS_W,
        };
  };
  const leftAxis = axisFor(
    axisExtent(specs, rows, "left"),
    formatAxisNumber,
    bounds.leftMin,
    bounds.leftMax,
  );
  const rightAxis = axisFor(
    axisExtent(specs, rows, "right"),
    formatAxisNumber,
    bounds.rightMin,
    bounds.rightMax,
  );
  const growthAxis = axisFor(growthExt, growthFmt);

  // Bars share BAR_FILL of each period's slot (side by side per series).
  const plotRef = useRef<HTMLDivElement>(null);
  const leftAxesW = growthOn ? growthAxis.width : hasLeft ? leftAxis.width : 0;
  const rightAxesW =
    (growthOn && hasLeft ? leftAxis.width : 0) +
    (hasRight ? rightAxis.width : 0);
  const plotWidth = useElementWidth(plotRef) - leftAxesW - (rightAxesW || 8);
  const barLayout = timeBarLayout(plotWidth, rows.length, 48);
  const growthBarSize = growthOn
    ? Math.max(1, Math.floor(barLayout.barSize / barSpecs.length))
    : 0;

  // X: always the first and last period (full label), ≤3 years between.
  const ticks = useMemo(
    () =>
      edgeTimeTicks(
        rows.map((r) => r.ts),
        3,
      ),
    [rows],
  );
  const dateByTs = useMemo(
    () => new Map(rows.map((r) => [r.ts, r.date])),
    [rows],
  );
  const spanYears =
    rows.length > 1
      ? (rows[rows.length - 1].ts - rows[0].ts) / (365.25 * 864e5)
      : 0;

  // One zero line: the growth axis's when bars are on (like the series
  // page), else the first line axis whose data goes negative (two zero lines
  // on independent scales would read as a contradiction).
  const zeroAxis = growthOn
    ? undefined
    : ([hasLeft && "left", hasRight && "right"] as const).find(
        (side): side is AxisSide => {
          if (!side) return false;
          const ext = axisExtent(specs, rows, side);
          return !!ext && ext[0] < 0;
        },
      );

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
  // Specs with pseudo-history points in the visible rows (columns excluded:
  // bars have no dashed form).
  const pseudoIds = new Set(
    visible
      .filter(
        (s) =>
          s.type !== "column" &&
          rows.some(
            (r) => r[pseudoKey(s.id)] != null && r[specKey(s.id)] == null,
          ),
      )
      .map((s) => s.id),
  );

  return (
    <div className={cn("w-full", className)}>
      {(titleLeft || titleRight || pseudoIds.size > 0) && (
        <div className="text-muted-foreground flex justify-between gap-4 pb-1 text-[11px]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">{titleLeft}</span>
            {pseudoIds.size > 0 && (
              <PseudoHistoryNote color="var(--muted-foreground)" />
            )}
          </span>
          <span className="truncate text-right">{titleRight}</span>
        </div>
      )}
      <div ref={ref}>
        <div ref={plotRef}>
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
                margin={{
                  top: 6,
                  right: rightAxes ? 0 : 8,
                  bottom: 0,
                  left: 0,
                }}
                barCategoryGap={1}
              >
                <XAxis
                  {...AXIS_PROPS}
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={ticks}
                  interval={0}
                  tick={<AnchoredTimeTick />}
                  tickFormatter={(ts: number, i: number) =>
                    i === 0 || i === ticks.length - 1
                      ? formatTableDate(dateByTs.get(ts) ?? "", freq)
                      : formatTimeTick(ts, freq, spanYears)
                  }
                  axisLine={false}
                  padding={
                    barSpecs.length
                      ? { left: barLayout.xPad, right: barLayout.xPad }
                      : visible.some((s) => s.type === "column")
                        ? { left: 8, right: 8 }
                        : undefined
                  }
                />
                {growthOn && (
                  <YAxis
                    {...AXIS_PROPS}
                    yAxisId="growth"
                    orientation="left"
                    width={growthAxis.width}
                    ticks={growthAxis.ticks}
                    interval={0}
                    tickFormatter={growthFmt}
                    domain={growthAxis.domain}
                  />
                )}
                <YAxis
                  {...AXIS_PROPS}
                  yAxisId="left"
                  orientation={growthOn ? "right" : "left"}
                  hide={!hasLeft}
                  width={hasLeft ? leftAxis.width : 0}
                  ticks={leftAxis.ticks}
                  interval={0}
                  tickCount={5}
                  tickFormatter={formatAxisNumber}
                  domain={leftAxis.domain}
                  allowDataOverflow={leftAxis.allowDataOverflow}
                />
                <YAxis
                  {...AXIS_PROPS}
                  yAxisId="right"
                  orientation="right"
                  hide={!hasRight}
                  width={hasRight ? rightAxis.width : 0}
                  ticks={rightAxis.ticks}
                  interval={0}
                  tickCount={5}
                  tickFormatter={formatAxisNumber}
                  domain={rightAxis.domain}
                  allowDataOverflow={rightAxis.allowDataOverflow}
                />
                {growthOn && (
                  <ReferenceLine
                    yAxisId="growth"
                    y={0}
                    stroke="var(--border)"
                    ifOverflow="extendDomain"
                  />
                )}
                {barSpecs.map((s) => (
                  // Behind the lines (rendered first); keyed by measure so
                  // switching YOY ↔ YTD regrows the bars from zero.
                  <Bar
                    key={`${growthKey(s.id)}-${growth}`}
                    yAxisId="growth"
                    dataKey={growthKey(s.id)}
                    name={`${s.name} (${growth?.toUpperCase()})`}
                    fill={specStroke(palette, s.slot).color}
                    fillOpacity={0.28}
                    barSize={growthBarSize}
                    shape={<GrowBar />}
                    isAnimationActive={false}
                    legendType="none"
                  />
                ))}
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
                  const pseudo = pseudoIds.has(s.id) && (
                    <Line
                      key={`${key}-pseudo`}
                      {...LINE_PROPS}
                      yAxisId={s.axis}
                      dataKey={pseudoKey(s.id)}
                      name={`${s.name} (pseudo history)`}
                      stroke={color}
                      strokeDasharray={PSEUDO_DASH}
                      activeDot={false}
                      legendType="none"
                    />
                  );
                  if (s.type === "area") {
                    return [
                      pseudo,
                      <Area
                        key={key}
                        yAxisId={s.axis}
                        type={CURVE_TYPE}
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
                      />,
                    ];
                  }
                  return [
                    pseudo,
                    <Line
                      key={key}
                      {...LINE_PROPS}
                      yAxisId={s.axis}
                      dataKey={key}
                      name={s.name}
                      stroke={color}
                      strokeDasharray={dash}
                      connectNulls={bridge}
                    />,
                  ];
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
                            <span className="text-foreground text-right font-medium tabular-nums">
                              {formatNum(hit.value, s.decimals, universe)}
                              {growth && row[growthKey(s.id)] != null && (
                                <span className="text-muted-foreground block text-[11px] font-normal">
                                  {growth.toUpperCase()}{" "}
                                  {formatNum(
                                    row[growthKey(s.id)],
                                    GROWTH_DECIMALS,
                                    universe,
                                  )}
                                </span>
                              )}
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
        strokeDasharray={dashed ? "7 3" : undefined}
      />
    </svg>
  );
}
