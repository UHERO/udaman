"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  CategoricalDrilldown as CategoricalDrilldownData,
  FieldCategory,
  NumericDrilldown as NumericDrilldownData,
  OverviewData,
  OverviewRow,
  TemporalDrilldown as TemporalDrilldownData,
  TextDrilldown as TextDrilldownData,
} from "@catalog/types/hhdb";
import { COUNTY_NAMES } from "@catalog/types/hhdb";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  getHhdbProfileCategoricalDrilldown,
  getHhdbProfileNumericDrilldown,
  getHhdbProfileTemporalDrilldown,
  getHhdbProfileTextDrilldown,
} from "@/actions/hhdb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

import {
  formatNumber,
  formatNumericValue,
  formatPercent,
} from "./format-helpers";

// ---------------------------------------------------------------------------
// Category colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  identifier: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "low-cardinality":
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "high-cardinality":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "large-dollar":
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "small-dollar":
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  year: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  area: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  count: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  date: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  blob: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function getDrilldownType(
  cat: FieldCategory,
): "categorical" | "numeric" | "text" | "temporal" | null {
  switch (cat) {
    case "low-cardinality":
      return "categorical";
    case "large-dollar":
    case "small-dollar":
    case "year":
    case "area":
    case "count":
      return "numeric";
    case "identifier":
    case "high-cardinality":
      return "text";
    case "date":
      return "temporal";
    case "blob":
      return null;
  }
}

// ===========================================================================
// ProfileOverviewTable — rendered when no field is selected
// ===========================================================================

interface ProfileOverviewTableProps {
  overview: OverviewData;
  basePath: string;
}

export function ProfileOverviewTable({
  overview,
  basePath,
}: ProfileOverviewTableProps) {
  const { rows, totalRows, countyTotals } = overview;
  const hasCounty = !!countyTotals;

  return (
    <div>
      <p className="text-muted-foreground mb-4 text-sm">
        {totalRows.toLocaleString()} total rows &middot; {rows.length} columns
        {hasCounty && (
          <>
            {" "}
            &middot;{" "}
            {COUNTY_NAMES.map(
              (c, i) =>
                `${c} ${formatNumber(countyTotals[c])}${i < COUNTY_NAMES.length - 1 ? ", " : ""}`,
            )}
          </>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pr-4 pb-2 font-medium">Field</th>
              {hasCounty &&
                COUNTY_NAMES.map((c) => (
                  <th key={c} className="pr-4 pb-2 text-right font-medium">
                    {c}
                  </th>
                ))}
              <th className="pr-4 pb-2 text-right font-medium">Null %</th>
              <th className="pb-2 text-right font-medium">Distinct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.columnName} className="border-b last:border-0">
                <td className="py-1.5 pr-4">
                  <Link
                    href={`${basePath}/${row.columnName}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {row.label}
                  </Link>
                </td>
                {hasCounty &&
                  COUNTY_NAMES.map((c) => {
                    const nonNull = row.countyNonNull?.[c] ?? 0;
                    const countyTotal = countyTotals[c];
                    const isZero = nonNull === 0 && countyTotal > 0;
                    return (
                      <td
                        key={c}
                        className={cn(
                          "py-1.5 pr-4 text-right tabular-nums",
                          isZero && "text-muted-foreground/50",
                        )}
                      >
                        {isZero ? "-" : formatNumber(nonNull)}
                      </td>
                    );
                  })}
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {row.nullPercent > 0 ? formatPercent(row.nullPercent) : ""}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {row.distinctCount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// ProfileFieldDrilldown — rendered when a field is selected
// ===========================================================================

interface ProfileFieldDrilldownProps {
  tableName: string;
  field: OverviewRow;
}

export function ProfileFieldDrilldown({
  tableName,
  field,
}: ProfileFieldDrilldownProps) {
  const drillType = getDrilldownType(field.fieldCategory);

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <div>
        <h3 className="text-lg font-semibold">{field.label}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={CATEGORY_COLORS[field.fieldCategory] ?? ""}
          >
            {field.fieldCategory}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {formatNumber(field.nonNullCount)} non-null &middot;{" "}
            {field.nullPercent > 0
              ? `${formatPercent(field.nullPercent)} null`
              : "no nulls"}{" "}
            &middot; {formatNumber(field.distinctCount)} distinct
          </span>
        </div>
      </div>

      {drillType === "categorical" && (
        <CategoricalContent tableName={tableName} column={field.columnName} />
      )}
      {drillType === "numeric" && (
        <NumericContent tableName={tableName} column={field.columnName} />
      )}
      {drillType === "text" && (
        <TextContent tableName={tableName} column={field.columnName} />
      )}
      {drillType === "temporal" && (
        <TemporalContent tableName={tableName} column={field.columnName} />
      )}
      {drillType === null && (
        <p className="text-muted-foreground text-sm">
          No detailed profiling is available for blob fields.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorical content
// ---------------------------------------------------------------------------

const catChartConfig: ChartConfig = {
  count: { label: "Count", color: "#2563eb" },
};

function CategoricalContent({
  tableName,
  column,
}: {
  tableName: string;
  column: string;
}) {
  const [data, setData] = useState<CategoricalDrilldownData | null>(null);

  useEffect(() => {
    getHhdbProfileCategoricalDrilldown(tableName, column).then(setData);
  }, [tableName, column]);

  if (!data) {
    return <Spinner />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {formatNumber(data.distinctCount)} distinct values &middot; Mode:
        &ldquo;{data.mode}&rdquo; &middot; {formatNumber(data.totalNonNull)}{" "}
        non-null &middot; {formatNumber(data.totalNull)} null
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Top {Math.min(data.values.length, 20)} Values
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={catChartConfig} className="h-[300px] w-full">
            <BarChart data={data.values.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="value"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  String(v).length > 15
                    ? `${String(v).slice(0, 15)}...`
                    : String(v)
                }
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tickFormatter={(v) => formatNumber(v)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pr-4 pb-2 font-medium">Value</th>
              <th className="pr-4 pb-2 text-right font-medium">Count</th>
              <th className="pr-4 pb-2 text-right font-medium">%</th>
              <th className="pb-2 text-right font-medium">Cumulative %</th>
            </tr>
          </thead>
          <tbody>
            {data.values.map((v) => (
              <tr key={v.value} className="border-b last:border-0">
                <td className="max-w-48 py-1.5 pr-4 break-words">{v.value}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {formatNumber(v.count)}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {formatPercent(v.percent)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatPercent(v.cumulative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Numeric content
// ---------------------------------------------------------------------------

const numChartConfig: ChartConfig = {
  count: { label: "Count", color: "#16a34a" },
};

function NumericContent({
  tableName,
  column,
}: {
  tableName: string;
  column: string;
}) {
  const [data, setData] = useState<NumericDrilldownData | null>(null);

  useEffect(() => {
    getHhdbProfileNumericDrilldown(tableName, column).then(setData);
  }, [tableName, column]);

  if (!data) {
    return <Spinner />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Min",
            value: formatNumericValue(data.min, data.fieldCategory),
          },
          {
            label: "Median",
            value: formatNumericValue(data.median, data.fieldCategory),
          },
          {
            label: "Max",
            value: formatNumericValue(data.max, data.fieldCategory),
          },
          {
            label: "Avg",
            value: formatNumericValue(data.avg, data.fieldCategory),
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        {data.zeroCount > 0 && (
          <Badge variant="secondary">
            {formatNumber(data.zeroCount)} zeros
          </Badge>
        )}
        {data.negativeCount > 0 && (
          <Badge variant="destructive">
            {formatNumber(data.negativeCount)} negatives
          </Badge>
        )}
        {data.nullCount > 0 && (
          <Badge variant="outline">
            {formatNumber(data.nullCount)} nulls (
            {formatPercent(
              (data.nullCount / (data.nonNullCount + data.nullCount)) * 100,
            )}
            )
          </Badge>
        )}
      </div>

      {data.histogram.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={numChartConfig}
              className="h-[300px] w-full"
            >
              <BarChart data={data.histogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickFormatter={(v) => formatNumber(v)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Text quality content
// ---------------------------------------------------------------------------

const textChartConfig: ChartConfig = {
  count: { label: "Count", color: "#9333ea" },
};

function TextContent({
  tableName,
  column,
}: {
  tableName: string;
  column: string;
}) {
  const [data, setData] = useState<TextDrilldownData | null>(null);

  useEffect(() => {
    getHhdbProfileTextDrilldown(tableName, column).then(setData);
  }, [tableName, column]);

  if (!data) {
    return <Spinner />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {formatNumber(data.totalCount)} total &middot;{" "}
        {formatNumber(data.distinctCount)} distinct &middot;{" "}
        {formatNumber(data.duplicateCount)} duplicates &middot;{" "}
        {formatNumber(data.nullCount)} nulls ({formatPercent(data.nullPercent)})
      </p>
      <p className="text-muted-foreground text-sm">
        Length: min {data.minLength}, avg {data.avgLength.toFixed(1)}, max{" "}
        {data.maxLength}
      </p>

      {data.formatConformance && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  data.formatConformance.matchCount ===
                  data.formatConformance.totalCount
                    ? "default"
                    : "destructive"
                }
              >
                {formatPercent(
                  (data.formatConformance.matchCount /
                    data.formatConformance.totalCount) *
                    100,
                )}{" "}
                match
              </Badge>
              <span className="text-sm">
                Pattern:{" "}
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                  {data.formatConformance.pattern}
                </code>
                &ensp;({formatNumber(data.formatConformance.matchCount)} /{" "}
                {formatNumber(data.formatConformance.totalCount)})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Top 25 Values
        </h4>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pr-4 pb-2 font-medium">Value</th>
                <th className="pb-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.topValues.map((v) => (
                <tr key={v.value} className="border-b last:border-0">
                  <td className="max-w-72 py-1.5 pr-4 font-mono text-xs break-words">
                    {v.value}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatNumber(v.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.lengthDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              String Length Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={textChartConfig}
              className="h-[250px] w-full"
            >
              <BarChart data={data.lengthDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="length"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Length",
                    position: "insideBottom",
                    offset: -5,
                    style: { fontSize: 11 },
                  }}
                />
                <YAxis tickFormatter={(v) => formatNumber(v)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Temporal content
// ---------------------------------------------------------------------------

const yearConfig: ChartConfig = {
  count: { label: "Records", color: "#dc2626" },
};

const monthConfig: ChartConfig = {
  count: { label: "Records", color: "#ea580c" },
};

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function TemporalContent({
  tableName,
  column,
}: {
  tableName: string;
  column: string;
}) {
  const [data, setData] = useState<TemporalDrilldownData | null>(null);

  useEffect(() => {
    getHhdbProfileTemporalDrilldown(tableName, column).then(setData);
  }, [tableName, column]);

  if (!data) {
    return <Spinner />;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {data.minDate} to {data.maxDate}
        {data.nullCount > 0 && ` · ${formatNumber(data.nullCount)} nulls`}
      </p>

      {data.gaps.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">
                {data.gaps.length} gap{data.gaps.length !== 1 ? "s" : ""}
              </Badge>
              <p className="text-sm">
                Missing years:{" "}
                {data.gaps.length <= 20
                  ? data.gaps.join(", ")
                  : `${data.gaps.slice(0, 20).join(", ")}... and ${data.gaps.length - 20} more`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.yearCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Records by Year</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={yearConfig} className="h-[300px] w-full">
              <BarChart data={data.yearCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatNumber(v)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {data.monthlyCounts && data.monthlyCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={monthConfig} className="h-[250px] w-full">
              <BarChart
                data={data.monthlyCounts.map((m) => ({
                  ...m,
                  monthName: MONTH_NAMES[m.month] ?? String(m.month),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatNumber(v)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center pt-12">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  );
}
