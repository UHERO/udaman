"use client";

import { useEffect, useState } from "react";
import {
  COVERAGE_SERIES,
  RECORDS_BY_YEAR_SOURCES,
  type CoverageRow,
  type CoverageSeries,
  type RecordsByYearResult,
  type RecordsByYearTable,
} from "@catalog/types/hhdb-coverage";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { getHhdbRecordsByYear } from "@/actions/hhdb";
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
} from "@/components/ui/chart";
import {
  RawTable,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { countyChartConfig as chartConfig } from "./coverage-chart";

const fmt = (n: number) => n.toLocaleString("en-US");

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

/** Round-year ticks once the bars outnumber what the axis can label. */
function yearTicks(years: string[]): string[] | undefined {
  const n = years.length;
  const step = n > 80 ? 20 : n > 40 ? 10 : n > 16 ? 5 : 0;
  return step ? years.filter((y) => Number(y) % step === 0) : undefined;
}

function SeriesLegend({ series }: { series: readonly CoverageSeries[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs">
      {series.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: `var(--color-${s})` }}
          />
          {chartConfig[s].label}
        </div>
      ))}
    </div>
  );
}

type SortKey = "period" | CoverageSeries | "total";
type Sort = { key: SortKey; dir: "asc" | "desc" };

function SortableHead({
  label,
  column,
  sort,
  onSort,
  numeric,
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (column: SortKey) => void;
  numeric?: boolean;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  const direction = sort.dir === "asc" ? "ascending" : "descending";
  return (
    <TableHead
      aria-sort={active ? direction : "none"}
      className={numeric ? "text-right" : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "flex w-full items-center gap-1 font-semibold",
          numeric && "justify-end",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}

/** Counts per year and county, newest first until a header is clicked. */
function YearCountsTable({
  rows,
  series,
}: {
  rows: CoverageRow[];
  series: readonly CoverageSeries[];
}) {
  const [sort, setSort] = useState<Sort>({ key: "period", dir: "desc" });

  const toggle = (key: SortKey) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "desc" ? "asc" : "desc",
    }));

  const columns: { key: CoverageSeries | "total"; label: string }[] = [
    ...series.map((s) => ({ key: s, label: chartConfig[s].label })),
    { key: "total", label: "Total" },
  ];

  const year = (r: CoverageRow) => Number(r.period);
  const value = (r: CoverageRow) =>
    sort.key === "period" ? year(r) : r[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  // Equal counts (zeros, mostly) fall back to newest first.
  const sorted = [...rows].sort(
    (a, b) => sign * (value(a) - value(b)) || year(b) - year(a),
  );

  return (
    <div className="bg-background max-h-[420px] overflow-auto rounded-md border">
      <RawTable>
        <TableHeader className="bg-background sticky top-0 z-10 shadow-[0_1px_0_0_var(--border)]">
          <TableRow>
            <SortableHead
              label="Year"
              column="period"
              sort={sort}
              onSort={toggle}
            />
            {columns.map((c) => (
              <SortableHead
                key={c.key}
                label={c.label}
                column={c.key}
                sort={sort}
                onSort={toggle}
                numeric
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.period} className="odd:bg-muted/50">
              <TableCell className="font-mono">{r.period}</TableCell>
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={cn(
                    "text-right font-mono",
                    c.key === "total" && "font-medium",
                    r[c.key] === 0 && "text-muted-foreground",
                  )}
                >
                  {fmt(r[c.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-background sticky bottom-0 z-10 border-t-0 shadow-[0_-1px_0_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            <TableCell className="font-semibold">Total</TableCell>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                className="text-right font-mono font-semibold"
              >
                {fmt(rows.reduce((n, r) => n + r[c.key], 0))}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </RawTable>
    </div>
  );
}

export function RecordsByYearChart({ table }: { table: RecordsByYearTable }) {
  const [data, setData] = useState<RecordsByYearResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let current = true;
    setData(null);
    setError(null);
    getHhdbRecordsByYear(table)
      .then((d) => current && setData(d))
      .catch((err: unknown) => {
        if (current)
          setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      current = false;
    };
  }, [table]);

  const source: { basis: string; note?: string } =
    RECORDS_BY_YEAR_SOURCES[table];
  const rows = data?.rows ?? [];
  const total = rows.reduce((n, r) => n + r.total, 0);

  // Only series with records get a legend entry and a table column.
  const present = COVERAGE_SERIES.filter((s) => rows.some((r) => r[s] > 0));
  const absent = COVERAGE_SERIES.filter(
    (s) => s !== "no_tmk" && !present.includes(s),
  ).map((s) => chartConfig[s].label);

  // A seam would swallow the bars on a century-long axis.
  const seam = rows.length <= 40 ? 2 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Records by year</CardTitle>
          <CardDescription>
            Number of records by {source.basis}, stacked by county.
          </CardDescription>
        </div>
        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Show chart" : "Show table"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive flex h-[320px] items-center justify-center text-sm">
            Failed to load counts: {error}
          </div>
        ) : !data ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">
            {data.undated > 0
              ? `None of the ${fmt(data.undated)} records have a ${source.basis}.`
              : "No frequency counts have been generated for this table yet."}
          </div>
        ) : showTable ? (
          <YearCountsTable rows={rows} series={present} />
        ) : (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <BarChart
              data={rows}
              margin={{ left: 8, right: 8, top: 8 }}
              barCategoryGap="12%"
            >
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                ticks={yearTicks(rows.map((r) => r.period))}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={compact}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(period, payload) => {
                      const r = payload?.[0]?.payload as
                        { total?: number } | undefined;
                      return `${period} · ${fmt(r?.total ?? 0)} records`;
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
              <Legend content={<SeriesLegend series={present} />} />
              {present.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={chartConfig[s].label}
                  stackId="county"
                  fill={`var(--color-${s})`}
                  stroke="var(--background)"
                  strokeWidth={seam}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
        {rows.length > 0 && (
          <p className="text-muted-foreground mt-3 text-xs">
            {fmt(total)} records shown.
            {data && data.undated > 0
              ? ` ${fmt(data.undated)} have no ${source.basis} and are not shown.`
              : ""}
            {data && data.outOfRange > 0
              ? ` ${fmt(data.outOfRange)} dated outside ${data.fromYear}–${data.toYear} are not shown.`
              : ""}
            {absent.length > 0 ? ` No records for ${absent.join(", ")}.` : ""}
            {source.note ? ` ${source.note}` : ""}
            {data?.generatedAt
              ? ` Counts as of ${data.generatedAt.slice(0, 10)}.`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
