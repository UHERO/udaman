"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TsdSeries } from "@catalog/utils/tsd-reader";
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

import { ForecastSnapshotActions } from "@/components/forecast-snapshots/forecast-snapshot-actions";
import { Button } from "@/components/ui/button";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  newForecast: TsdSeries[];
  oldForecast: TsdSeries[];
  history: TsdSeries[];
  allDates: string[];
  newForecastLabel: string;
  oldForecastLabel: string;
  historyLabel: string;
  initialFrom?: string;
  initialTo?: string;
  displayNames?: Record<string, string>;
  snapshotId: number;
  snapshotName: string;
}

const COLORS = {
  newForecast: "#1D667F", // ublue
  oldForecast: "#F6A01B", // uorange
  history: "#4BACC6", // uteal
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
function niceYDomain(values: number[]): [number, number] | undefined {
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

/** Compute QoQ % change: period-over-period, always lag=1 */
function computeQoq(values: (number | null | undefined)[]): (number | null)[] {
  return values.map((val, idx) => {
    if (idx < 1) return null;
    const prev = values[idx - 1];
    if (val == null || prev == null || prev === 0) return null;
    return ((val - prev) / prev) * 100;
  });
}

/** Compute CAGR (annualized period-over-period): ((val/prev)^periodsPerYear - 1) * 100 */
function computeCagr(
  values: (number | null | undefined)[],
  periodsPerYear: number,
): (number | null)[] {
  return values.map((val, idx) => {
    if (idx < 1) return null;
    const prev = values[idx - 1];
    if (val == null || prev == null || prev <= 0) return null;
    if (val <= 0) return null;
    return (Math.pow(val / prev, periodsPerYear) - 1) * 100;
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
  initialFrom,
  initialTo,
  displayNames = {},
  snapshotId,
  snapshotName,
}: Props) {
  const freq = useMemo(() => detectFrequency(allDates), [allDates]);
  const defaults = useMemo(
    () => defaultRange(allDates, freq),
    [allDates, freq],
  );

  const [dateFrom, setDateFrom] = useState(
    initialFrom && allDates.includes(initialFrom) ? initialFrom : defaults.from,
  );
  const [dateTo, setDateTo] = useState(
    initialTo && allDates.includes(initialTo) ? initialTo : defaults.to,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const [calcMode, setCalcMode] = useState<"yoy" | "qoq" | "cagr">("yoy");

  // Silently update URL search params when date range changes (for permalink)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("sample_from", dateFrom);
    url.searchParams.set("sample_to", dateTo);
    window.history.replaceState(null, "", url.toString());
  }, [dateFrom, dateTo]);

  const toggleAll = useCallback(() => {
    if (!containerRef.current) return;
    const details = containerRef.current.querySelectorAll("details");
    const newState = !allExpanded;
    details.forEach((d) => (d.open = newState));
    setAllExpanded(newState);
  }, [allExpanded]);

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
  const periodsPerYear = freq === "annual" ? 1 : freq === "quarterly" ? 4 : 12;

  const newPctKey =
    calcMode === "yoy" ? "newYoy" : calcMode === "qoq" ? "newQoq" : "newCagr";
  const oldPctKey =
    calcMode === "yoy" ? "oldYoy" : calcMode === "qoq" ? "oldQoq" : "oldCagr";
  const histPctKey =
    calcMode === "yoy"
      ? "histYoy"
      : calcMode === "qoq"
        ? "histQoq"
        : "histCagr";
  const calcLabel =
    calcMode === "yoy" ? "YoY %" : calcMode === "qoq" ? "QoQ %" : "CAGR %";

  const chartConfig = useMemo(
    () =>
      ({
        newForecast: { label: newForecastLabel, color: COLORS.newForecast },
        oldForecast: { label: oldForecastLabel, color: COLORS.oldForecast },
        history: { label: historyLabel, color: COLORS.history },
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
    <div className="space-y-6" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">From:</span>
          <Select value={dateFrom} onValueChange={setDateFrom}>
            <SelectTrigger className="w-24">
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

          <span className="text-sm">To:</span>
          <Select value={dateTo} onValueChange={setDateTo}>
            <SelectTrigger className="w-24">
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

          <span className="text-sm">Bars:</span>
          <TooltipProvider>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={calcMode}
              onValueChange={(v) => {
                if (v) setCalcMode(v as "yoy" | "qoq" | "cagr");
              }}
            >
              <ToggleGroupItem value="yoy" className="h-7 px-2.5 text-xs">
                <TooltipRoot>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">YoY</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-64 space-y-1 px-3 py-2"
                  >
                    <div className="font-mono text-[11px] leading-relaxed">
                      <span>
                        (V<sub>t</sub> &minus; V<sub>t&minus;lag</sub>) / V
                        <sub>t&minus;lag</sub> &times; 100
                      </span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      Year-over-year % change (lag = {yoyLag})
                    </div>
                  </TooltipContent>
                </TooltipRoot>
              </ToggleGroupItem>
              <ToggleGroupItem value="qoq" className="h-7 px-2.5 text-xs">
                <TooltipRoot>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">QoQ</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-64 space-y-1 px-3 py-2"
                  >
                    <div className="font-mono text-[11px] leading-relaxed">
                      <span>
                        (V<sub>t</sub> &minus; V<sub>t&minus;1</sub>) / V
                        <sub>t&minus;1</sub> &times; 100
                      </span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      Period-over-period % change (lag = 1)
                    </div>
                  </TooltipContent>
                </TooltipRoot>
              </ToggleGroupItem>
              <ToggleGroupItem value="cagr" className="h-7 px-2.5 text-xs">
                <TooltipRoot>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">CAGR</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-64 space-y-1 px-3 py-2"
                  >
                    <div className="font-mono text-[11px] leading-relaxed">
                      <span>
                        ((V<sub>t</sub> / V<sub>t&minus;1</sub>)
                        <sup>{periodsPerYear}</sup> &minus; 1) &times; 100
                      </span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      Compound annual growth rate (annualized QoQ)
                    </div>
                  </TooltipContent>
                </TooltipRoot>
              </ToggleGroupItem>
            </ToggleGroup>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="link" size="sm" onClick={toggleAll}>
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
          <ForecastSnapshotActions
            snapshotId={snapshotId}
            snapshotName={snapshotName}
            view="chart"
            newForecast={newForecast}
            oldForecast={oldForecast}
            history={history}
            allDates={allDates}
          />
        </div>
      </div>

      {seriesNames.map((name, chartIndex) => {
        const newS = newMap.get(name);
        const oldS = oldMap.get(name);
        const histS = histMap.get(name);
        const desc = displayNames[name] || name;
        // Build value arrays aligned to filteredDates for YoY computation
        const newVals = filteredDates.map((d) => newS?.dataHash.get(d) ?? null);
        const oldVals = filteredDates.map((d) => oldS?.dataHash.get(d) ?? null);
        const histVals = filteredDates.map(
          (d) => histS?.dataHash.get(d) ?? null,
        );

        const newYoy = computeYoy(newVals, yoyLag);
        const oldYoy = computeYoy(oldVals, yoyLag);
        const histYoy = computeYoy(histVals, yoyLag);
        const newQoq = computeQoq(newVals);
        const oldQoq = computeQoq(oldVals);
        const histQoq = computeQoq(histVals);
        const newCagr = computeCagr(newVals, periodsPerYear);
        const oldCagr = computeCagr(oldVals, periodsPerYear);
        const histCagr = computeCagr(histVals, periodsPerYear);

        // Build chart data rows
        const chartData = filteredDates.map((date, idx) => ({
          date,
          label: formatDate(date, freq),
          newForecast: newS?.dataHash.get(date) ?? undefined,
          oldForecast: oldS?.dataHash.get(date) ?? undefined,
          history: histS?.dataHash.get(date) ?? undefined,
          newYoy: newYoy[idx] ?? undefined,
          oldYoy: oldYoy[idx] ?? undefined,
          newQoq: newQoq[idx] ?? undefined,
          oldQoq: oldQoq[idx] ?? undefined,
          newCagr: newCagr[idx] ?? undefined,
          oldCagr: oldCagr[idx] ?? undefined,
          histYoy: histYoy[idx] ?? undefined,
          histQoq: histQoq[idx] ?? undefined,
          histCagr: histCagr[idx] ?? undefined,
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

        // Build full-width overlapping bar shapes: each bar expands to
        // cover the entire category width so the semi-transparent colors
        // layer on top of each other rather than sitting side-by-side.
        const barOrder = [
          ...(histS ? ["hist" as const] : []),
          ...(oldS ? ["old" as const] : []),
          "new" as const,
        ];
        const barCount = barOrder.length;
        const fullWidthBar =
          (index: number, fillOpacity: number) => (raw: unknown) => {
            const props = raw as Record<string, number | string>;
            if (!Number.isFinite(props.y) || !Number.isFinite(props.height))
              return <rect width={0} height={0} />;
            let y = props.y as number;
            let height = props.height as number;
            if (height < 0) {
              y += height;
              height = -height;
            }
            return (
              <rect
                x={(props.x as number) - index * (props.width as number)}
                y={y}
                width={barCount * (props.width as number)}
                height={height}
                fill={props.fill as string}
                fillOpacity={fillOpacity}
              />
            );
          };

        return (
          <details key={name} className="rounded-md border">
            <summary className="cursor-pointer px-4 py-3 select-none">
              <span className="text-base font-semibold">
                {chartIndex + 1}. {desc}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">{name}</span>
            </summary>
            <div className="px-4 pb-4">
              <ChartContainer config={chartConfig} className="h-96 w-full">
                <ComposedChart
                  data={chartData}
                  barGap={4.4}
                  barCategoryGap="2%"
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
                      value: `${calcLabel} Change in Forecast`,
                      angle: 90,
                      position: "center",
                      dx: 20,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const byKey = new Map<string, number>();
                      for (const p of payload) {
                        if (p.value != null)
                          byKey.set(p.dataKey as string, p.value as number);
                      }
                      const rows: Array<{
                        name: string;
                        color: string;
                        level?: number;
                        pct?: number;
                      }> = [];
                      if (byKey.has("newForecast")) {
                        rows.push({
                          name: newForecastLabel,
                          color: COLORS.newForecast,
                          level: byKey.get("newForecast"),
                          pct: byKey.get(newPctKey),
                        });
                      }
                      if (byKey.has("oldForecast")) {
                        rows.push({
                          name: oldForecastLabel,
                          color: COLORS.oldForecast,
                          level: byKey.get("oldForecast"),
                          pct: byKey.get(oldPctKey),
                        });
                      }
                      if (byKey.has("history")) {
                        rows.push({
                          name: historyLabel,
                          color: COLORS.history,
                          level: byKey.get("history"),
                          pct: byKey.get(histPctKey),
                        });
                      }
                      if (!rows.length) return null;
                      return (
                        <div className="bg-background rounded-md border px-3 py-2 text-xs shadow-md">
                          <div className="mb-1 font-semibold">{label}</div>
                          <table className="border-separate border-spacing-x-2">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left font-medium">
                                  Series
                                </th>
                                <th className="text-right font-medium">
                                  Level
                                </th>
                                <th className="text-right font-medium">
                                  {calcLabel}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.name}>
                                  <td className="flex items-center gap-1">
                                    <span
                                      className="inline-block h-2 w-2 rounded-full"
                                      style={{ backgroundColor: r.color }}
                                    />
                                    {r.name}
                                  </td>
                                  <td className="text-right font-mono">
                                    {r.level != null
                                      ? r.level.toLocaleString(undefined, {
                                          maximumFractionDigits: 2,
                                        })
                                      : ""}
                                  </td>
                                  <td className="text-right font-mono">
                                    {r.pct != null
                                      ? `${r.pct.toFixed(2)}%`
                                      : ""}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
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

                  {/* % change bars behind the lines, color-coded to match */}
                  {histS && (
                    <Bar
                      yAxisId="right"
                      dataKey={histPctKey}
                      name={`${calcLabel} (hist)`}
                      fill={COLORS.history}
                      shape={fullWidthBar(barOrder.indexOf("hist"), 0.2)}
                      legendType="none"
                      isAnimationActive={false}
                    />
                  )}
                  {oldS && (
                    <Bar
                      yAxisId="right"
                      dataKey={oldPctKey}
                      name={`${calcLabel} (old)`}
                      fill={COLORS.oldForecast}
                      shape={fullWidthBar(barOrder.indexOf("old"), 0.2)}
                      legendType="none"
                      isAnimationActive={false}
                    />
                  )}
                  <Bar
                    yAxisId="right"
                    dataKey={newPctKey}
                    name={`${calcLabel} (new)`}
                    fill={COLORS.newForecast}
                    shape={fullWidthBar(barOrder.indexOf("new"), 0.2)}
                    legendType="none"
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
            </div>
          </details>
        );
      })}
    </div>
  );
}
