"use client";

import { useMemo } from "react";

import { formatLevel } from "@catalog/utils/format";

import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BarMode = "yoy" | "ytd" | "levelChange";

export const BAR_LABELS: Record<BarMode, string> = {
  yoy: "YOY %",
  ytd: "YTD %",
  levelChange: "LVL Chg",
};

export interface ChartRow {
  date: string;
  level: number | null;
  levelChange: number | null;
  yoy: number | null;
  ytd: number | null;
  trend?: number | null;
}

export type StatsOverlay = "mean" | "median" | "stdDev" | "trend";

export const formatDate = (d: string) => d;

export const formatValue = (v: number, decimals: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(decimals);
};

/* ------------------------------------------------------------------ */
/*  Linear regression helper                                           */
/* ------------------------------------------------------------------ */

function linearRegression(data: ChartRow[]): ChartRow[] {
  const points: { i: number; v: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].level != null) points.push({ i, v: data[i].level! });
  }
  if (points.length < 2) return data;

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.i;
    sumY += p.v;
    sumXY += p.i * p.v;
    sumXX += p.i * p.i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return data.map((row, i) => ({
    ...row,
    trend: intercept + slope * i,
  }));
}

/* ------------------------------------------------------------------ */
/*  Shared custom tooltip                                              */
/* ------------------------------------------------------------------ */

interface ChartTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  decimals: number;
  unitShortLabel?: string | null;
}

function ChartTooltip({ active, payload, label, decimals, unitShortLabel }: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const fmt = (v: number | null) =>
    v != null ? formatLevel(v, decimals, unitShortLabel) : "—";
  const fmtPct = (v: number | null) =>
    v != null ? `${v.toFixed(2)}%` : "—";

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">
        {formatDate(label)}
      </p>
      <p className="text-sm font-semibold text-slate-900">
        Level: {fmt(row.level)}
      </p>
      <div className="mt-1 space-y-0.5 border-t pt-1 text-xs text-slate-600">
        <p>LVL Chg: {fmt(row.levelChange)}</p>
        <p>YOY %: {fmtPct(row.yoy)}</p>
        <p>YTD %: {fmtPct(row.ytd)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LevelChart — Primary line chart showing level data                */
/* ------------------------------------------------------------------ */

interface LevelChartProps {
  data: ChartRow[];
  decimals: number;
  stats?: { mean: number; median: number | null; standardDeviation: number };
  overlays?: StatsOverlay[];
  unitShortLabel?: string | null;
}

export function LevelChart({ data, decimals, stats, overlays = [], unitShortLabel }: LevelChartProps) {
  const showTrend = overlays.includes("trend");

  const chartData = useMemo(() => {
    if (!showTrend) return data;
    return linearRegression(data);
  }, [data, showTrend]);

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => formatValue(v, decimals)}
          tick={{ fontSize: 11 }}
          width={70}
        />
        <Tooltip content={<ChartTooltip decimals={decimals} unitShortLabel={unitShortLabel} />} />
        {/* σ bands — 2σ first (lighter), then 1σ on top (additive opacity) */}
        {stats && overlays.includes("stdDev") && (
          <ReferenceArea
            y1={stats.mean - 2 * stats.standardDeviation}
            y2={stats.mean + 2 * stats.standardDeviation}
            fill="#3b82f6"
            fillOpacity={0.06}
            strokeOpacity={0}
            label={{
              value: "2σ",
              position: "insideTopRight",
              fontSize: 10,
              fill: "#94a3b8",
            }}
          />
        )}
        {stats && overlays.includes("stdDev") && (
          <ReferenceArea
            y1={stats.mean - stats.standardDeviation}
            y2={stats.mean + stats.standardDeviation}
            fill="#3b82f6"
            fillOpacity={0.06}
            strokeOpacity={0}
            label={{
              value: "1σ",
              position: "insideTopRight",
              fontSize: 10,
              fill: "#64748b",
            }}
          />
        )}
        {stats && overlays.includes("mean") && (
          <ReferenceLine
            y={stats.mean}
            stroke="#16a34a"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Mean: ${formatLevel(stats.mean, decimals, unitShortLabel)}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#16a34a",
            }}
          />
        )}
        {stats && overlays.includes("median") && stats.median != null && (
          <ReferenceLine
            y={stats.median}
            stroke="#ea580c"
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{
              value: `Median: ${formatLevel(stats.median, decimals, unitShortLabel)}`,
              position: "insideBottomRight",
              fontSize: 10,
              fill: "#ea580c",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="level"
          stroke="var(--color-ublue)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {showTrend && (
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            strokeDasharray="8 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  ChangeChart — Secondary bar chart with Brush for date range       */
/* ------------------------------------------------------------------ */

interface ChangeChartProps {
  data: ChartRow[];
  decimals: number;
  barMode: BarMode;
  brushStartIndex: number;
  brushEndIndex: number;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  unitShortLabel?: string | null;
}

export function ChangeChart({
  data,
  decimals,
  barMode,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
  unitShortLabel,
}: ChangeChartProps) {
  if (data.length === 0) return null;

  const isPercent = barMode === "yoy" || barMode === "ytd";

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) =>
            isPercent ? `${v.toFixed(1)}%` : formatValue(v, decimals)
          }
          tick={{ fontSize: 11 }}
          width={60}
        />
        <Tooltip content={<ChartTooltip decimals={decimals} unitShortLabel={unitShortLabel} />} />
        <Bar
          dataKey={barMode}
          fill="var(--color-ucyan)"
          opacity={0.6}
          isAnimationActive={true}
          animationDuration={600}
        />
        {data.length > 24 && (
          <Brush
            dataKey="date"
            height={30}
            stroke="var(--color-ublue)"
            tickFormatter={formatDate}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
