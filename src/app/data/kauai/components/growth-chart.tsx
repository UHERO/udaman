"use client";

import { useMemo } from "react";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { AXIS_PROPS } from "@/app/data/[universe]/components/ui/chart-theme";
import { formatAxisNumber } from "@/app/data/[universe]/lib/format";
import type { DateEntry } from "@/app/data/[universe]/lib/types";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

import type { DashboardSeries } from "../lib/data";
import { formatChange, PALETTE } from "../lib/theme";
import { TooltipLine } from "./main-chart";

export const GROWTH_PERIODS = 5;

/**
 * Major Indicators slice panel (old clustered bar chart): year-over-year
 * growth of a few headline series for the five periods ending at the
 * selected date, one cluster per period.
 */
export function GrowthChart({
  dates,
  series,
  selected,
  height = 300,
}: {
  dates: DateEntry[];
  series: DashboardSeries[];
  selected: number;
  height?: number;
}) {
  const data = useMemo(() => {
    const start = Math.max(0, selected - GROWTH_PERIODS + 1);
    return dates.slice(start, selected + 1).map((d, k) => {
      const row: Record<string, string | number | null> = {
        period: d.tableDate,
      };
      series.forEach((s) => (row[s.name] = s.pc1[start + k]));
      return row;
    });
  }, [dates, series, selected]);

  return (
    <div className="w-full">
      <ul className="text-muted-foreground mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tracking-wide">
        {series.map((s, i) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ background: PALETTE[i] }}
            />
            {s.short}
          </li>
        ))}
      </ul>
      <ChartContainer
        config={Object.fromEntries(
          series.map((s, i) => [s.name, { label: s.short, color: PALETTE[i] }]),
        )}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <BarChart
          data={data}
          margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="22%"
          barGap={2}
        >
          <XAxis {...AXIS_PROPS} dataKey="period" />
          <YAxis
            {...AXIS_PROPS}
            width={44}
            tickCount={6}
            domain={[
              (min: number) => Math.min(0, Math.floor(min)),
              (max: number) => Math.max(0, Math.ceil(max)),
            ]}
            tickFormatter={(v: number) => `${formatAxisNumber(v)}%`}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          {series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={PALETTE[i]}
              isAnimationActive={false}
              maxBarSize={22}
            />
          ))}
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-card border-border min-w-48 border px-2.5 py-1.5 text-xs shadow-md">
                  <div className="text-foreground mb-1 font-medium">
                    {label} · % change from year ago
                  </div>
                  {series.map((s, i) => (
                    <TooltipLine
                      key={s.name}
                      bar
                      swatch={PALETTE[i]}
                      label={s.short}
                      value={
                        formatChange(
                          payload[0].payload[s.name] as number | null,
                          s.percent,
                        ) || "–"
                      }
                    />
                  ))}
                </div>
              );
            }}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
