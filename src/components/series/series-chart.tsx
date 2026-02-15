"use client";

import { useMemo } from "react";
import { DataPoint } from "@catalog/types/shared";
import { Line, LineChart, ReferenceDot, XAxis, YAxis } from "recharts";

import { ChartConfig, ChartContainer } from "@/components/ui/chart";

import { useSeriesHover } from "./series-data-section";

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function SeriesChart({ data }: { data: DataPoint[] }) {
  const { hoveredDate } = useSeriesHover();

  const { chartData, minVal, maxVal } = useMemo(() => {
    const points = data
      .filter((d) => d.value != null)
      .map((d) => ({
        date: new Date(d.date).getTime(),
        value: Number(d.value),
      }))
      .sort((a, b) => a.date - b.date)
      .slice(-24);

    if (!points.length) {
      return { chartData: [], minVal: 0, maxVal: 0 };
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.05 || 1;

    return {
      chartData: points,
      minVal: min - padding,
      maxVal: max + padding,
    };
  }, [data]);

  const hoveredPoint = useMemo(() => {
    if (!hoveredDate || !chartData.length) return null;
    const ts = new Date(hoveredDate).getTime();
    return chartData.find((p) => p.date === ts) ?? null;
  }, [hoveredDate, chartData]);

  if (!chartData.length) return null;

  return (
    <ChartContainer config={chartConfig} className="h-42 w-full">
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
      >
        <XAxis
          dataKey="date"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={[chartData[0].date, chartData[chartData.length - 1].date]}
          tickFormatter={(ts) => new Date(ts).getFullYear().toString()}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minVal, maxVal]}
          ticks={[minVal, maxVal]}
          tickFormatter={(v) => {
            const abs = Math.abs(v);
            if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
            return v.toFixed(1);
          }}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        {hoveredPoint && (
          <ReferenceDot
            x={hoveredPoint.date}
            y={hoveredPoint.value}
            r={4}
            fill="var(--color-value)"
            stroke="white"
            strokeWidth={2}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
