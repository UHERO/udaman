"use client";

import { useEffect, useMemo, useState } from "react";
import type { TransactionsByMonthRow } from "@catalog/collections/hhdb-dashboard-collection";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { getHhdbTransactionsByMonth } from "@/actions/hhdb";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const chartConfig: ChartConfig = {
  count: { label: "Records", color: "#1D667F" },
};

/** Leading TMK digit → county. */
const COUNTIES: Record<string, string> = {
  "1": "Honolulu",
  "2": "Maui",
  "3": "Hawaii",
  "4": "Kauai",
};

type Bucket = "month" | "quarter" | "year";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

const fmt = (n: number) => n.toLocaleString("en-US");

/** "2024-03" → the bucket key: "2024-03", "2024-Q1" or "2024". */
function bucketKey(period: string, bucket: Bucket): string {
  if (bucket === "month") return period;
  const year = period.slice(0, 4);
  if (bucket === "year") return year;
  return `${year}-Q${Math.ceil(Number(period.slice(5)) / 3)}`;
}

function periodLabel(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key))
    return `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
  if (/^\d{4}-Q\d$/.test(key)) return `${key.slice(5)} ${key.slice(0, 4)}`;
  return key;
}

/** Re-bucket the monthly rows (already sorted) into months, quarters or years. */
function rebucket(rows: TransactionsByMonthRow[], bucket: Bucket) {
  const out: { period: string; count: number }[] = [];
  for (const r of rows) {
    const key = bucketKey(r.period, bucket);
    const last = out[out.length - 1];
    if (last?.period === key) last.count += r.count;
    else out.push({ period: key, count: r.count });
  }
  return out;
}

export function TransactionsByPeriodChart() {
  const [county, setCounty] = useState<string>("all");
  const [bucket, setBucket] = useState<Bucket>("month");
  const [data, setData] = useState<TransactionsByMonthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getHhdbTransactionsByMonth(county === "all" ? undefined : county)
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [county]);

  const rows = useMemo(
    () => (data ? rebucket(data, bucket) : []),
    [data, bucket],
  );
  const total = rows.reduce((n, r) => n + r.count, 0);
  const last = data?.[data.length - 1]?.period;

  // One tick per year: January / Q1 for sub-annual buckets.
  const ticks =
    bucket === "year"
      ? undefined
      : rows
          .map((r) => r.period)
          .filter((p) => p.endsWith(bucket === "month" ? "-01" : "-Q1"));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Records per {bucket}</CardTitle>
            <CardDescription>
              Recorded documents by recording date,{" "}
              {county === "all"
                ? "statewide"
                : `${COUNTIES[county]} County (TMK ${county}-…)`}
              . All document types, any conveyance amount.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={bucket}
              onValueChange={(v) => v && setBucket(v as Bucket)}
            >
              <ToggleGroupItem value="month" className="px-2 text-xs">
                Month
              </ToggleGroupItem>
              <ToggleGroupItem value="quarter" className="px-2 text-xs">
                Quarter
              </ToggleGroupItem>
              <ToggleGroupItem value="year" className="px-2 text-xs">
                Year
              </ToggleGroupItem>
            </ToggleGroup>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Statewide</SelectItem>
                {Object.entries(COUNTIES).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-destructive flex h-[320px] items-center justify-center text-sm">
            Failed to load transactions: {error}
          </div>
        ) : !data ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart data={rows} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  ticks={ticks}
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
                      labelFormatter={(p) => periodLabel(String(p))}
                      formatter={(value) => `${fmt(Number(value))} records`}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={bucket === "month" ? 0 : [2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
            <p className="text-muted-foreground mt-3 text-xs">
              {fmt(total)} records
              {county === "all"
                ? ", including documents with no parcel (blank or 9-9-9 TMK)"
                : ""}
              .
              {last
                ? ` Data runs through ${periodLabel(last)}, which may be partial.`
                : ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
