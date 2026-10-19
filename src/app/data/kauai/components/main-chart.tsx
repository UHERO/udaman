"use client";

import { useMemo, useRef } from "react";
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_PROPS,
  COMPANION_BAR_PROPS,
  formatTimeTick,
  LINE_PROPS,
  timeTicks,
} from "@/app/data/[universe]/components/ui/chart-theme";
import {
  timeBarLayout,
  useElementWidth,
} from "@/app/data/[universe]/components/ui/use-element-width";
import { formatTooltipDate } from "@/app/data/[universe]/lib/dates";
import { formatAxisNumber } from "@/app/data/[universe]/lib/format";
import type { DateEntry, FreqCode } from "@/app/data/[universe]/lib/types";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

import type { DashboardSeries } from "../lib/data";
import {
  ACCENT,
  changeLabel,
  formatChange,
  formatLevel,
  MUTED,
  PRIMARY,
  unitsText,
} from "../lib/theme";

const Y_AXIS_WIDTH = 52;

interface Row {
  ts: number;
  date: string;
  level: number | null;
  chg: number | null;
  cmp: number | null;
}

/**
 * Main dashboard chart (old time_series_chart). Two modes, one plot:
 *
 *   default   ▮ YoY % change bars (left axis, muted) + level line (right axis)
 *   compare   compared series line (left axis, accent) + level line (right)
 *
 * Same axis layout as the portal's SeriesChart: level on the right in the
 * line color, the companion on the left.
 */
export function MainChart({
  dates,
  freq,
  primary,
  compare,
  lo,
  hi,
  height = 300,
}: {
  dates: DateEntry[];
  freq: FreqCode;
  primary: DashboardSeries;
  compare: DashboardSeries | null;
  lo: number;
  hi: number;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef);

  const data = useMemo<Row[]>(
    () =>
      dates.slice(lo, hi + 1).map((d, k) => {
        const i = lo + k;
        return {
          ts: Date.parse(d.date),
          date: d.date,
          level: primary.lvl[i],
          chg: primary.pc1[i],
          cmp: compare?.lvl[i] ?? null,
        };
      }),
    [dates, lo, hi, primary, compare],
  );

  const ticks = useMemo(
    () =>
      timeTicks(
        data.map((r) => r.ts),
        5,
      ),
    [data],
  );
  const spanYears =
    data.length > 1 ? (data[data.length - 1].ts - data[0].ts) / 3.15576e10 : 0;
  const { barSize, xPad } = timeBarLayout(
    width - 2 * Y_AXIS_WIDTH,
    data.length,
    40,
  );
  const domain: [number, number] = data.length
    ? [data[0].ts, data[data.length - 1].ts]
    : [0, 1];

  const leftLabel = compare
    ? `${compare.short} (${unitsText(compare)})`
    : changeLabel(primary.percent);
  const leftColor = compare ? ACCENT : MUTED;

  return (
    <div className="w-full">
      <div className="text-muted-foreground mb-1 flex items-center justify-between gap-4 text-[11px] tracking-wide">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className={compare ? "h-0.5 w-3 shrink-0" : "h-2.5 w-1.5 shrink-0"}
            style={{ background: leftColor }}
          />
          <span className="truncate">{leftLabel}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">
            {primary.short} ({unitsText(primary)})
          </span>
          <span
            aria-hidden
            className="h-0.5 w-3 shrink-0"
            style={{ background: PRIMARY }}
          />
        </span>
      </div>
      <div ref={wrapRef} className="select-none">
        <ChartContainer
          config={{
            level: { label: primary.short, color: PRIMARY },
            chg: { label: changeLabel(primary.percent), color: MUTED },
            cmp: { label: compare?.short ?? "", color: ACCENT },
          }}
          className="aspect-auto w-full"
          style={{ height }}
        >
          <ComposedChart
            data={data}
            margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
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
              padding={compare ? undefined : { left: xPad, right: xPad }}
            />
            <YAxis
              {...AXIS_PROPS}
              yAxisId="left"
              orientation="left"
              width={Y_AXIS_WIDTH}
              tickCount={5}
              domain={
                compare
                  ? ["auto", "auto"]
                  : [
                      (min: number) => Math.min(0, min),
                      (max: number) => Math.max(0, max),
                    ]
              }
              tick={{ ...AXIS_PROPS.tick, fill: compare ? ACCENT : undefined }}
              tickFormatter={(v: number) =>
                compare || primary.percent
                  ? formatAxisNumber(v)
                  : `${formatAxisNumber(v)}%`
              }
            />
            <YAxis
              {...AXIS_PROPS}
              yAxisId="right"
              orientation="right"
              width={Y_AXIS_WIDTH}
              tickCount={5}
              domain={["auto", "auto"]}
              tick={{ ...AXIS_PROPS.tick, fill: PRIMARY }}
              tickFormatter={formatAxisNumber}
            />
            {!compare && (
              <ReferenceLine
                yAxisId="left"
                y={0}
                stroke="var(--border)"
                ifOverflow="extendDomain"
              />
            )}
            {!compare && (
              <Bar
                {...COMPANION_BAR_PROPS}
                yAxisId="left"
                dataKey="chg"
                fill={MUTED}
                barSize={barSize}
                maxBarSize={40}
              />
            )}
            {compare && (
              <Line
                {...LINE_PROPS}
                yAxisId="left"
                dataKey="cmp"
                stroke={ACCENT}
              />
            )}
            <Line
              {...LINE_PROPS}
              yAxisId="right"
              dataKey="level"
              stroke={PRIMARY}
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
                return (
                  <div className="bg-card border-border min-w-44 border px-2.5 py-1.5 text-xs shadow-md">
                    <div className="text-foreground mb-1 font-medium">
                      {formatTooltipDate(row.date, freq)}
                    </div>
                    <TooltipLine
                      swatch={PRIMARY}
                      label={primary.short}
                      value={formatLevel(primary, row.level) || "–"}
                    />
                    {compare ? (
                      <TooltipLine
                        swatch={ACCENT}
                        label={compare.short}
                        value={formatLevel(compare, row.cmp) || "–"}
                      />
                    ) : (
                      <TooltipLine
                        swatch={MUTED}
                        bar
                        label="YoY"
                        value={formatChange(row.chg, primary.percent) || "–"}
                      />
                    )}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export function TooltipLine({
  swatch,
  bar,
  label,
  value,
}: {
  swatch?: string;
  bar?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={bar ? "h-2.5 w-1.5 shrink-0" : "h-0.5 w-3 shrink-0"}
        style={swatch ? { background: swatch } : undefined}
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}
