"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TsdSeries } from "@catalog/utils/tsd-reader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  newForecast: TsdSeries[];
  oldForecast: TsdSeries[];
  history: TsdSeries[];
  allDates: string[];
  newForecastLabel: string;
  oldForecastLabel: string;
  historyLabel: string;
}

const COLORS = {
  newForecast: "#1D667F", // ublue
  oldForecast: "#F6A01B", // uorange
  history: "#4BACC6", // uteal
  yoyBar: "#737373",
};

/** Detect date frequency from a list of dates */
function detectFrequency(dates: string[]): "annual" | "quarterly" | "monthly" {
  if (dates.some((d) => /-(02|05|08)-/.test(d))) return "monthly";
  if (dates.some((d) => /-(04|07|10)-/.test(d))) return "quarterly";
  return "annual";
}

/** Format a date string for display based on frequency */
function formatDate(date: string, freq: "annual" | "quarterly" | "monthly") {
  if (freq === "annual") return date.substring(0, 4);
  if (freq === "quarterly") {
    const month = parseInt(date.substring(5, 7), 10);
    const q = Math.ceil(month / 3);
    return `${date.substring(0, 4)}Q${q}`;
  }
  return date.substring(0, 7);
}

/** Compute default date range based on frequency */
function defaultRange(
  allDates: string[],
  freq: "annual" | "quarterly" | "monthly",
) {
  const now = new Date();
  const year = now.getFullYear();

  let yearsPast: number, yearsFut: number, endMonth: number;
  if (freq === "monthly") {
    yearsPast = 3;
    yearsFut = 1;
    endMonth = 12;
  } else {
    yearsPast = 10;
    yearsFut = 5;
    endMonth = freq === "quarterly" ? 10 : 1;
  }

  const defaultFrom = `${year - yearsPast}-01-01`;
  const defaultTo = `${year + yearsFut}-${endMonth.toString().padStart(2, "0")}-01`;

  const from =
    allDates.find((d) => d >= defaultFrom) ?? allDates[0] ?? defaultFrom;
  const to =
    [...allDates].reverse().find((d) => d <= defaultTo) ??
    allDates[allDates.length - 1] ??
    defaultTo;

  return { from, to };
}

/**
 * Get ordered series names based on the history file order.
 * Rails iterates history first, so chart order follows that file's series order.
 */
function getOrderedSeriesNames(
  histSeries: TsdSeries[],
  newSeries: TsdSeries[],
  oldSeries: TsdSeries[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  // History order first
  for (const s of histSeries) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      ordered.push(s.name);
    }
  }
  // Then any series only in old/new
  for (const s of oldSeries) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      ordered.push(s.name);
    }
  }
  for (const s of newSeries) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      ordered.push(s.name);
    }
  }
  return ordered;
}

/**
 * Compute a nice Y-axis domain with rounded min/max and ~5 evenly spaced ticks.
 * Rounds to a "nice" interval based on magnitude (e.g. 10000 for values ~300k).
 */
function niceYDomain(
  values: number[],
): [number, number] | undefined {
  if (!values.length) return undefined;
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || Math.abs(rawMax) || 1;

  // Pick a nice tick interval: find magnitude, then round to 1/2/5 × 10^n
  const roughInterval = range / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const residual = roughInterval / mag;
  let niceInterval: number;
  if (residual <= 1.5) niceInterval = mag;
  else if (residual <= 3.5) niceInterval = 2 * mag;
  else if (residual <= 7.5) niceInterval = 5 * mag;
  else niceInterval = 10 * mag;

  const niceMin = Math.floor(rawMin / niceInterval) * niceInterval;
  const niceMax = Math.ceil(rawMax / niceInterval) * niceInterval;
  return [niceMin, niceMax];
}

/** Compute YoY % change: (val - val_lag) / val_lag * 100 */
function computeYoy(
  values: (number | null | undefined)[],
  lag: number,
): (number | null)[] {
  return values.map((val, idx) => {
    if (idx < lag) return null;
    const prev = values[idx - lag];
    if (val == null || prev == null || prev === 0) return null;
    return ((val - prev) / prev) * 100;
  });
}

export function ForecastSnapshotCharts({
  newForecast,
  oldForecast,
  history,
  allDates,
  newForecastLabel,
  oldForecastLabel,
  historyLabel,
}: Props) {
  const freq = useMemo(() => detectFrequency(allDates), [allDates]);
  const defaults = useMemo(
    () => defaultRange(allDates, freq),
    [allDates, freq],
  );

  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const seriesNames = useMemo(
    () => getOrderedSeriesNames(history, newForecast, oldForecast),
    [history, newForecast, oldForecast],
  );

  const newMap = useMemo(
    () => new Map(newForecast.map((s) => [s.name, s])),
    [newForecast],
  );
  const oldMap = useMemo(
    () => new Map(oldForecast.map((s) => [s.name, s])),
    [oldForecast],
  );
  const histMap = useMemo(
    () => new Map(history.map((s) => [s.name, s])),
    [history],
  );

  const filteredDates = useMemo(
    () => allDates.filter((d) => d >= dateFrom && d <= dateTo),
    [allDates, dateFrom, dateTo],
  );

  const yoyLag = freq === "annual" ? 1 : freq === "quarterly" ? 4 : 12;

  const chartConfig = useMemo(
    () =>
      ({
        newForecast: { label: newForecastLabel, color: COLORS.newForecast },
        oldForecast: { label: oldForecastLabel, color: COLORS.oldForecast },
        history: { label: historyLabel, color: COLORS.history },
        newYoy: { label: "%ch", color: COLORS.yoyBar },
      }) satisfies ChartConfig,
    [newForecastLabel, oldForecastLabel, historyLabel],
  );

  if (seriesNames.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No series data found in TSD files.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">From:</span>
          <Select value={dateFrom} onValueChange={setDateFrom}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allDates.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatDate(d, freq)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">To:</span>
          <Select value={dateTo} onValueChange={setDateTo}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allDates.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatDate(d, freq)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {seriesNames.map((name, chartIndex) => {
        const newS = newMap.get(name);
        const oldS = oldMap.get(name);
        const histS = histMap.get(name);
        const desc =
          newS?.description || oldS?.description || histS?.description || name;

        // Build value arrays aligned to filteredDates for YoY computation
        const newVals = filteredDates.map(
          (d) => newS?.dataHash.get(d) ?? null,
        );
        const oldVals = filteredDates.map(
          (d) => oldS?.dataHash.get(d) ?? null,
        );

        const newYoy = computeYoy(newVals, yoyLag);
        const oldYoy = computeYoy(oldVals, yoyLag);

        // Build chart data rows
        const chartData = filteredDates.map((date, idx) => ({
          date,
          label: formatDate(date, freq),
          newForecast: newS?.dataHash.get(date) ?? undefined,
          oldForecast: oldS?.dataHash.get(date) ?? undefined,
          history: histS?.dataHash.get(date) ?? undefined,
          newYoy: newYoy[idx] ?? undefined,
          oldYoy: oldYoy[idx] ?? undefined,
        }));

        const hasData = chartData.some(
          (d) =>
            d.newForecast !== undefined ||
            d.oldForecast !== undefined ||
            d.history !== undefined,
        );
        if (!hasData) return null;

        // Compute nice Y-axis domain with rounded tick boundaries
        const allLineVals: number[] = [];
        for (const d of chartData) {
          if (d.newForecast !== undefined) allLineVals.push(d.newForecast);
          if (d.oldForecast !== undefined) allLineVals.push(d.oldForecast);
          if (d.history !== undefined) allLineVals.push(d.history);
        }
        const yDomain = niceYDomain(allLineVals);

        // Vertical reference lines in the forecast region
        // Find last history date (last date with a non-null history value)
        let lastHistDate: string | null = null;
        if (histS) {
          for (let di = filteredDates.length - 1; di >= 0; di--) {
            if (histS.dataHash.get(filteredDates[di]) != null) {
              lastHistDate = filteredDates[di];
              break;
            }
          }
        }

        const plotLineLabels: string[] = [];
        if (lastHistDate) {
          plotLineLabels.push(formatDate(lastHistDate, freq));
          // Add lines at 5-year boundaries from last history date onward
          for (const date of filteredDates) {
            if (date <= lastHistDate) continue;
            const yr = parseInt(date.substring(0, 4), 10);
            if (yr % 5 !== 0) continue;
            if (freq === "annual") {
              plotLineLabels.push(formatDate(date, freq));
            } else {
              // Quarterly/Monthly: only at January (month 01)
              if (date.substring(5, 7) === "01") {
                plotLineLabels.push(formatDate(date, freq));
              }
            }
          }
        }

        return (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {chartIndex + 1}. {desc}
              </CardTitle>
              <p className="text-muted-foreground text-xs">{name}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 48, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    type="number"
                    tick={{ fontSize: 11 }}
                    width={70}
                    domain={yDomain}
                    allowDataOverflow
                    tickFormatter={(v: number) => v.toLocaleString()}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    width={50}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    label={{
                      value: "% Change in Forecast",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    formatter={(value: number, dataKey: string) => {
                      if (dataKey === "newYoy" || dataKey === "oldYoy") {
                        return [`${value.toFixed(2)}%`, "%ch"];
                      }
                      return [value.toLocaleString(undefined, { maximumFractionDigits: 2 }), undefined];
                    }}
                  />
                  <Legend />

                  {/* Vertical dashed reference lines in forecast region */}
                  {plotLineLabels.map((label) => (
                    <ReferenceLine
                      key={`ref-${label}`}
                      x={label}
                      yAxisId="left"
                      stroke="#ADADAD"
                      strokeWidth={1}
                      strokeDasharray="8 4"
                    />
                  ))}

                  {/* YoY bar columns behind the lines */}
                  <Bar
                    yAxisId="right"
                    dataKey="newYoy"
                    name="%ch (new)"
                    fill={COLORS.yoyBar}
                    opacity={0.3}
                    isAnimationActive={false}
                  />

                  {/* Lines: new forecast solid, old + history dashed */}
                  {newS && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="newForecast"
                      name={newForecastLabel}
                      stroke={COLORS.newForecast}
                      dot={false}
                      strokeWidth={2.5}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                  {oldS && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="oldForecast"
                      name={oldForecastLabel}
                      stroke={COLORS.oldForecast}
                      strokeDasharray="8 4"
                      dot={false}
                      strokeWidth={2.5}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                  {histS && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="history"
                      name={historyLabel}
                      stroke={COLORS.history}
                      strokeDasharray="8 4"
                      dot={false}
                      strokeWidth={2.5}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
