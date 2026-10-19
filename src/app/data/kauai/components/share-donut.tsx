"use client";

import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { formatNum } from "@/app/data/[universe]/lib/format";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

import type { DashboardSeries } from "../lib/data";
import { changeColor, formatChange, PALETTE, unitsText } from "../lib/theme";

/**
 * Visitor Industry slice panel (old pie chart): a parent's components at
 * the selected date, as a donut with the total in the middle and a legend
 * table (value, share, YoY) beside it. Hovering a slice or legend row
 * highlights both.
 */
export function ShareDonut({
  parent,
  parts,
  selected,
  dateLabel,
  height = 300,
}: {
  parent: DashboardSeries;
  parts: DashboardSeries[];
  selected: number;
  dateLabel: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = parts.map((s, i) => ({
    name: s.short,
    value: s.lvl[selected] ?? 0,
    yoy: s.pc1[selected],
    color: PALETTE[i % PALETTE.length],
    series: s,
  }));
  const sum = slices.reduce((t, s) => t + s.value, 0);
  const total = parent.lvl[selected] ?? sum;

  return (
    <div className="@container flex items-center" style={{ minHeight: height }}>
      <div className="flex w-full flex-col items-center gap-4 @md:flex-row">
        <div className="relative w-full max-w-56 shrink-0">
          <ChartContainer
            config={Object.fromEntries(
              slices.map((s) => [s.name, { label: s.name, color: s.color }]),
            )}
            className="aspect-square w-full"
          >
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="92%"
                startAngle={90}
                endAngle={-270}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
                onMouseEnter={(_, i) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.name}
                    fill={s.color}
                    fillOpacity={hover === null || hover === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
              {hover === null ? "Total" : slices[hover].name}
            </span>
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatNum(
                hover === null ? total : slices[hover].value,
                parent.decimals,
              )}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {hover === null
                ? dateLabel
                : `${formatNum((slices[hover].value / (sum || 1)) * 100, 1)}% of total`}
            </span>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-neutral-300 text-[10px] tracking-wider uppercase">
              <th className="py-1 text-left font-medium">
                {unitsText(parent)}
              </th>
              <th className="py-1 text-right font-medium">Value</th>
              <th className="py-1 text-right font-medium">Share</th>
              <th className="py-1 text-right font-medium">YoY</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s, i) => (
              <tr
                key={s.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "border-b border-neutral-100 transition-opacity",
                  hover !== null && hover !== i && "opacity-50",
                )}
              >
                <td className="py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0"
                      style={{ background: s.color }}
                    />
                    {s.name}
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatNum(s.value, s.series.decimals)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatNum((s.value / (sum || 1)) * 100, 1)}%
                </td>
                <td
                  className="py-1.5 text-right tabular-nums"
                  style={{ color: changeColor(s.yoy) }}
                >
                  {formatChange(s.yoy, s.series.percent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
