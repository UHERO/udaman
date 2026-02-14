"use client";

import { useMemo } from "react";
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BarMode = "yoy" | "ytd" | "levelChange";

const BAR_LABELS: Record<BarMode, string> = {
  yoy: "YOY %",
  ytd: "YTD %",
  levelChange: "LVL Chg",
};

interface AnalyzeChartProps {
  data: [string, number][];
  yoyData: [string, number][];
  ytdData: [string, number][];
  levelChangeData: [string, number][];
  decimals: number;
  barMode: BarMode;
}

interface ChartRow {
  date: string;
  level: number | null;
  bar: number | null;
}

export function AnalyzeChart({
  data,
  yoyData,
  ytdData,
  levelChangeData,
  decimals,
  barMode,
}: AnalyzeChartProps) {
  const barSource =
    barMode === "yoy" ? yoyData : barMode === "ytd" ? ytdData : levelChangeData;
  const isPercent = barMode === "yoy" || barMode === "ytd";

  const chartData = useMemo(() => {
    const map = new Map<string, ChartRow>();
    for (const [date, value] of data) {
      map.set(date, { date, level: value, bar: null });
    }
    for (const [date, value] of barSource) {
      const existing = map.get(date);
      if (existing) {
        existing.bar = value;
      } else {
        map.set(date, { date, level: null, bar: value });
      }
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, barSource]);

  if (chartData.length === 0) return null;

  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  };

  const formatValue = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(decimals);
  };

  const barLabel = BAR_LABELS[barMode];

  return (
    <div className="w-full rounded-lg border bg-white p-4">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
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
            yAxisId="left"
            tickFormatter={formatValue}
            tick={{ fontSize: 11 }}
            width={60}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v: number) =>
              isPercent ? `${v.toFixed(1)}%` : formatValue(v)
            }
            tick={{ fontSize: 11 }}
            width={60}
          />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value: number, name: string) => {
              if (name === "bar") {
                const formatted = isPercent
                  ? `${value.toFixed(2)}%`
                  : value.toFixed(decimals);
                return [formatted, barLabel];
              }
              return [value.toFixed(decimals), "Level"];
            }}
          />
          <Bar
            yAxisId="right"
            dataKey="bar"
            fill="var(--color-ucyan)"
            opacity={0.5}
            isAnimationActive={true}
            animationDuration={600}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="level"
            stroke="var(--color-ublue)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {chartData.length > 24 && (
            <Brush
              dataKey="date"
              height={30}
              stroke="var(--color-ublue)"
              tickFormatter={formatDate}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
