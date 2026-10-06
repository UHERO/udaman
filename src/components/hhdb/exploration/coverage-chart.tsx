"use client";

import { useEffect, useState } from "react";
import {
  COVERAGE_SERIES,
  type CoverageResult,
} from "@catalog/types/hhdb-coverage";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { getHhdbCoverageByPeriod } from "@/actions/hhdb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Counties in TMK-digit order, always in this order and these colors on every
 * coverage chart (color follows the county, never its rank). Slots 1–4 of the
 * dataviz reference palette, validated as adjacent stack pairs in both modes
 * (worst CVD ΔE 9.1 light / 8.4 dark). "No TMK" is a neutral gray on top:
 * unattributed, not a fifth category.
 */
const chartConfig = {
  honolulu: { label: "Honolulu", theme: { light: "#2a78d6", dark: "#3987e5" } },
  maui: { label: "Maui", theme: { light: "#eb6834", dark: "#d95926" } },
  hawaii: { label: "Hawaii", theme: { light: "#1baf7a", dark: "#199e70" } },
  kauai: { label: "Kauai", theme: { light: "#eda100", dark: "#c98500" } },
  no_tmk: { label: "No TMK", theme: { light: "#b4b2ab", dark: "#6b6a64" } },
} satisfies ChartConfig;

const fmt = (n: number) => n.toLocaleString("en-US");

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
/** "2024-03" → "Mar 2024"; a year stays as is. */
const periodLabel = (p: string) =>
  /^\d{4}-\d{2}$/.test(p)
    ? `${MONTHS[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`
    : p;

interface CoverageChartProps {
  /** freq_ table base name, e.g. "insurance_policies". */
  table: string;
  title: string;
  description: string;
  /** One-line caveat under the chart (partial years, coverage gaps). */
  note?: string;
}

export function CoverageChart({
  table,
  title,
  description,
  note,
}: CoverageChartProps) {
  const [data, setData] = useState<CoverageResult | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    getHhdbCoverageByPeriod(table).then(setData);
  }, [table]);

  const rows = data?.rows ?? [];
  const totalNoTmk = rows.reduce((n, r) => n + r.no_tmk, 0);
  const total = rows.reduce((n, r) => n + r.total, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Show chart" : "Show table"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">
            No counts yet: they are written by the upload script after a load.
          </div>
        ) : showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {data.granularity === "month" ? "Month" : "Year"}
                </TableHead>
                {COVERAGE_SERIES.map((s) => (
                  <TableHead key={s} className="text-right">
                    {chartConfig[s].label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.period}>
                  <TableCell>{periodLabel(r.period)}</TableCell>
                  {COVERAGE_SERIES.map((s) => (
                    <TableCell key={s} className="text-right tabular-nums">
                      {fmt(r[s])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmt(r.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <AreaChart data={rows} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                // Monthly: one tick per January, labelled with the year.
                ticks={
                  data.granularity === "month"
                    ? rows.map((r) => r.period).filter((p) => p.endsWith("-01"))
                    : undefined
                }
                tickFormatter={(p: string) => p.slice(0, 4)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(period, payload) => {
                      const r = payload?.[0]?.payload as
                        { total?: number } | undefined;
                      return `${periodLabel(String(period))} · ${fmt(r?.total ?? 0)} records`;
                    }}
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono tabular-nums">
                          {fmt(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Legend />
              {COVERAGE_SERIES.map((s) => (
                <Area
                  key={s}
                  dataKey={s}
                  name={chartConfig[s].label}
                  stackId="coverage"
                  type="linear"
                  fill={`var(--color-${s})`}
                  fillOpacity={1}
                  // A surface-colored seam separates adjacent bands.
                  stroke="var(--background)"
                  strokeWidth={2}
                  legendType="square"
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
        {rows.length > 0 && (
          <p className="text-muted-foreground mt-3 text-xs">
            {fmt(total)} records; {fmt(totalNoTmk)} (
            {((100 * totalNoTmk) / Math.max(total, 1)).toFixed(1)}%) have no TMK
            and are counted only in the gray band.
            {note ? ` ${note}` : ""}
            {data?.generatedAt
              ? ` Counts as of ${data.generatedAt.slice(0, 10)}.`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
