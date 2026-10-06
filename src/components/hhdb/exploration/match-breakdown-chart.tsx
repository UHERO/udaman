"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MatchBreakdownResult,
  MatchColumn,
} from "@catalog/types/hhdb-coverage";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { getHhdbMatchBreakdown } from "@/actions/hhdb";
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
 * One segment of a bar: which match values it sums, and its colors.
 * Match tiers use one blue ramp, darkest = most confident (an ordinal ramp,
 * validated light ≤5 steps / dark), so "how good is the TMK" reads as one
 * scale. Unmatched shares are neutral grays: no TMK matches the coverage
 * chart's gray band; "parcel only" (has a TMK, no unit) is lighter.
 */
interface Segment {
  key: string;
  label: string;
  values: readonly string[];
  light: string;
  dark: string;
}

const RAMP5 = {
  light: ["#0d366b", "#1c5cab", "#2a78d6", "#5598e7", "#86b6ef"],
  dark: ["#cde2fb", "#9ec5f4", "#5598e7", "#256abf", "#184f95"],
};
const ramp3 = (i: 0 | 1 | 2) => ({
  light: RAMP5.light[i * 2],
  dark: RAMP5.dark[i * 2],
});
const NO_TMK = { light: "#b4b2ab", dark: "#6b6a64" };
const PARCEL_ONLY = { light: "#e2e0d9", dark: "#45443f" };

/** Segments per table + column, most confident first. */
const SEGMENTS: Record<string, Segment[]> = {
  "renthub_listings.tmk_match": [
    {
      key: "within_addr",
      label: "Point + address agree",
      values: ["within_addr"],
      light: RAMP5.light[0],
      dark: RAMP5.dark[0],
    },
    {
      key: "address",
      label: "Moved by exact address",
      values: ["address"],
      light: RAMP5.light[1],
      dark: RAMP5.dark[1],
    },
    {
      key: "address_far",
      label: "Exact address, far point",
      values: ["address_far"],
      light: RAMP5.light[2],
      dark: RAMP5.dark[2],
    },
    {
      key: "fuzzy",
      label: "Fuzzy street",
      values: ["fuzzy"],
      light: RAMP5.light[3],
      dark: RAMP5.dark[3],
    },
    {
      key: "point",
      label: "Point only",
      values: ["within", "nearest"],
      light: RAMP5.light[4],
      dark: RAMP5.dark[4],
    },
  ],
  "renthub_listings.cpr_match": [
    { key: "unit", label: "Unit number", values: ["unit"], ...ramp3(0) },
    {
      key: "unit_variant",
      label: "Unit spelling variant",
      values: ["unit_variant"],
      ...ramp3(1),
    },
    {
      key: "house_address",
      label: "House address on CPR'd lot",
      values: ["house_address"],
      ...ramp3(2),
    },
  ],
  "insurance.tmk_match": [
    { key: "unit", label: "Condo unit (CPR)", values: ["unit"], ...ramp3(0) },
    {
      key: "address",
      label: "Exact address",
      values: ["address"],
      ...ramp3(1),
    },
    { key: "fuzzy", label: "Fuzzy street", values: ["fuzzy"], ...ramp3(2) },
  ],
};

function segmentsFor(table: string, column: MatchColumn): Segment[] {
  const own =
    SEGMENTS[`${table}.${column}`] ??
    SEGMENTS[
      `${table.startsWith("insurance") ? "insurance" : table}.${column}`
    ];
  const tail: Segment[] = [
    ...(column === "cpr_match"
      ? [
          {
            key: "parcel_only",
            label: "Parcel only (no unit)",
            values: [],
            ...PARCEL_ONLY,
          },
        ]
      : []),
    { key: "no_tmk", label: "No TMK", values: [], ...NO_TMK },
  ];
  return [...(own ?? []), ...tail];
}

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) =>
  `${((100 * n) / Math.max(d, 1)).toFixed(1)}%`;

interface MatchBreakdownChartProps {
  table: string;
  column: MatchColumn;
  title: string;
  description: string;
  note?: string;
}

export function MatchBreakdownChart({
  table,
  column,
  title,
  description,
  note,
}: MatchBreakdownChartProps) {
  const [data, setData] = useState<MatchBreakdownResult | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    getHhdbMatchBreakdown(table, column).then(setData);
  }, [table, column]);

  const segments = useMemo(() => segmentsFor(table, column), [table, column]);
  const rows = useMemo(
    () =>
      (data?.rows ?? []).map((r) => {
        const out: Record<string, number | string> = {
          area: r.area,
          total: r.total,
        };
        for (const s of segments)
          out[s.key] =
            s.key === "no_tmk"
              ? r.noTmk
              : s.key === "parcel_only"
                ? r.parcelOnly
                : s.values.reduce((n, v) => n + (r.counts[v] ?? 0), 0);
        return out;
      }),
    [data, segments],
  );
  // Segments with no rows anywhere are left out of the legend and bars.
  const shown = segments.filter((s) => rows.some((r) => Number(r[s.key]) > 0));
  const config = Object.fromEntries(
    shown.map((s) => [
      s.key,
      { label: s.label, theme: { light: s.light, dark: s.dark } },
    ]),
  ) satisfies ChartConfig;

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
          <div className="flex h-[280px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
            No counts yet: they are written by the upload script after a load.
          </div>
        ) : showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                {shown.map((s) => (
                  <TableHead key={s.key} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.area)}>
                  <TableCell>{r.area}</TableCell>
                  {shown.map((s) => (
                    <TableCell key={s.key} className="text-right tabular-nums">
                      {fmt(Number(r[s.key]))}{" "}
                      <span className="text-muted-foreground">
                        ({pct(Number(r[s.key]), Number(r.total))})
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmt(Number(r.total))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={config} className="h-[280px] w-full">
            <BarChart
              data={rows}
              layout="vertical"
              stackOffset="expand"
              margin={{ left: 8, right: 16 }}
              barCategoryGap={10}
            >
              <CartesianGrid horizontal={false} strokeOpacity={0.4} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <YAxis
                type="category"
                dataKey="area"
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <ChartTooltip
                cursor={{ fillOpacity: 0.08 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as Record<
                    string,
                    number | string
                  >;
                  return (
                    <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">
                        {r.area} · {fmt(Number(r.total))} records
                      </div>
                      {shown.map((s) => (
                        <div key={s.key} className="flex justify-between gap-6">
                          <span className="text-muted-foreground">
                            {s.label}
                          </span>
                          <span className="font-mono tabular-nums">
                            {fmt(Number(r[s.key]))} ·{" "}
                            {pct(Number(r[s.key]), Number(r.total))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              {shown.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="match"
                  fill={`var(--color-${s.key})`}
                  // A surface-colored seam between segments.
                  stroke="var(--background)"
                  strokeWidth={2}
                  radius={i === shown.length - 1 ? [0, 4, 4, 0] : 0}
                  legendType="square"
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
        {note && rows.length > 0 && (
          <p className="text-muted-foreground mt-3 text-xs">
            {note}
            {data?.generatedAt
              ? ` Counts as of ${data.generatedAt.slice(0, 10)}.`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
