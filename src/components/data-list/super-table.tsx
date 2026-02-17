"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SuperTableData } from "@catalog/types/data-list-table";
import { ArrowLeft, Pencil, RotateCcw } from "lucide-react";
import { Bar, BarChart, Brush, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Sparkline } from "./sparkline";
import {
  computeDerivedData,
  computeStatsForRange,
  type ComputedSeriesData,
  type SeriesStats,
} from "./super-table-stats";

// ─── Constants ───────────────────────────────────────────────────────

const SA_OPTIONS = [
  { value: "all", label: "All" },
  { value: "sa", label: "Seasonally Adjusted" },
  { value: "ns", label: "Not Seasonally Adjusted" },
];

const INDENT_PX: Record<string, number> = {
  indent0: 0,
  indent1: 16,
  indent2: 32,
  indent3: 48,
};

const PERIOD_PRESETS = [6, 12, 24, 60, 120];

const DEBOUNCE_MS = 200;

// ─── Formatting helpers ──────────────────────────────────────────────

function f(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "";
  return value.toFixed(decimals);
}

function perc(value: number | null | undefined): string {
  if (value == null) return "";
  return value.toFixed(2) + "%";
}

function formatDateHeader(dateStr: string, freqCode: string | null): string {
  const parts = dateStr.split("-");
  const year = parts[0];
  const month = parseInt(parts[1]);
  switch (freqCode?.toUpperCase()) {
    case "A":
      return year;
    case "Q":
      return `${year}q${Math.floor(month / 3) + 1}`;
    case "M":
      return `${year}m${parts[1]}`;
    case "S":
      return `${year}s${month <= 6 ? 1 : 2}`;
    default:
      return dateStr.slice(0, 10);
  }
}

// ─── Color helpers ───────────────────────────────────────────────────

function colorClass(value: number | null | undefined): string {
  if (value == null) return "";
  return value < 0 ? "text-red-500" : "text-[#1572B0]";
}

// ─── Debounce hook ──────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  return debounced;
}

// ─── 3-line cell component ──────────────────────────────────────────

type CellLine = [string, number | null | undefined];

function CellStack({ lines }: { lines: CellLine[] }) {
  return (
    <div className="flex flex-col items-end text-xs leading-snug whitespace-nowrap">
      {lines.map(([text, value], i) => (
        <span
          key={i}
          className={
            value !== undefined ? colorClass(value) : "text-muted-foreground"
          }
        >
          {text || "\u00A0"}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

interface SuperTableProps {
  data: SuperTableData;
}

export function SuperTable({ data }: SuperTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    series,
    allDates,
    geographies,
    availableFrequencies,
    filters,
    dataList,
  } = data;
  const freqCode = filters.freq;

  // Date range slider — initially show last 12 periods
  // sliderRange is the immediate value (updates the display label instantly)
  // debouncedRange drives the table/stats recomputation
  const initialStart = Math.max(0, allDates.length - 12);
  const [sliderRange, setSliderRange] = useState<[number, number]>([
    initialStart,
    allDates.length - 1,
  ]);
  const debouncedRange = useDebouncedValue(sliderRange, DEBOUNCE_MS);

  // Visible dates based on debounced slider
  const visibleDates = useMemo(() => {
    if (!allDates.length) return [];
    const [start, end] = debouncedRange;
    return allDates.slice(
      Math.max(0, start),
      Math.min(allDates.length, end + 1)
    );
  }, [allDates, debouncedRange]);

  // Pre-compute derived data (yoy, yoyDiff, ytd) for all series
  const derivedMap = useMemo(() => {
    const map = new Map<number, ComputedSeriesData>();
    for (const entry of series) {
      map.set(entry.seriesId, computeDerivedData(entry));
    }
    return map;
  }, [series]);

  // Compute stats for the visible date range (recomputes when debounced slider moves)
  const statsMap = useMemo(() => {
    const map = new Map<number, SeriesStats | null>();
    for (const entry of series) {
      const computed = derivedMap.get(entry.seriesId);
      if (computed) {
        map.set(entry.seriesId, computeStatsForRange(computed, visibleDates));
      }
    }
    return map;
  }, [series, derivedMap, visibleDates]);

  // Filter sparkline data to visible date range
  const visibleSparklineData = useMemo(() => {
    const dateSet = new Set(visibleDates);
    const map = new Map<number, [string, number][]>();
    for (const entry of series) {
      map.set(
        entry.seriesId,
        entry.data.filter(([d]) => dateSet.has(d))
      );
    }
    return map;
  }, [series, visibleDates]);

  // Brush data — one entry per date with a formatted label for tick display
  const brushData = useMemo(
    () =>
      allDates.map((d) => ({
        label: formatDateHeader(d, freqCode),
        v: 0,
      })),
    [allDates, freqCode]
  );

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const resetFilters = useCallback(() => {
    setSliderRange([Math.max(0, allDates.length - 12), allDates.length - 1]);
    router.push(pathname);
  }, [router, pathname, allDates.length]);

  const setPeriodsBack = useCallback(
    (n: number) => {
      const end = allDates.length - 1;
      const start = Math.max(0, end - n + 1);
      setSliderRange([start, end]);
    },
    [allDates.length]
  );

  return (
    <div className="min-w-0 space-y-3">
      {/* Action buttons — inline */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/udaman/${dataList.universe}/data-list`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/udaman/${dataList.universe}/data-list/${dataList.id}/edit`}
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          <RotateCcw className="mr-1.5 size-4" />
          Reset
        </Button>
        <span className="text-muted-foreground ml-2 text-sm">
          {series.length} series &middot; {allDates.length} periods
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Geography
          </label>
          <Select
            value={filters.geo}
            onValueChange={(v) => updateFilter("geo", v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {geographies.map((g) => (
                <SelectItem key={g.handle} value={g.handle}>
                  {g.handle}
                  {g.displayName ? ` — ${g.displayName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Frequency
          </label>
          <Select
            value={filters.freq}
            onValueChange={(v) => updateFilter("freq", v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFrequencies.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.code} — {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground text-xs font-medium">
            Seasonal Adjustment
          </label>
          <Select
            value={filters.sa}
            onValueChange={(v) => updateFilter("sa", v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range brush + presets */}
        {allDates.length > 1 && (
          <div className="max-w-xl flex-1 space-y-1.5">
            <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
              <span>Date Range</span>
              <span>
                {formatDateHeader(allDates[sliderRange[0]] ?? "", freqCode)}
                {" \u2013 "}
                {formatDateHeader(allDates[sliderRange[1]] ?? "", freqCode)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={36}>
              <BarChart data={brushData}>
                <Bar dataKey="v" fill="transparent" isAnimationActive={false} />
                <Brush
                  dataKey="label"
                  height={28}
                  stroke="#666"
                  fill="#f4f4f5"
                  startIndex={sliderRange[0]}
                  endIndex={sliderRange[1]}
                  onChange={(range) => {
                    if (range.startIndex != null && range.endIndex != null) {
                      setSliderRange([range.startIndex, range.endIndex]);
                    }
                  }}
                  tickFormatter={(val) => String(val)}
                  alwaysShowText={false}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Periods:</span>
              {PERIOD_PRESETS.map((n) => (
                <Button
                  key={n}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setPeriodsBack(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setSliderRange([0, allDates.length - 1])}
              >
                All
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {series.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No series found for the selected filters.
        </p>
      ) : (
        <ScrollArea className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-background sticky left-0 z-20 min-w-[220px]">
                  Series
                </TableHead>
                <TableHead className="bg-background sticky left-[220px] z-20 min-w-[130px]">
                  &nbsp;
                </TableHead>
                <TableHead className="text-right align-bottom">
                  <CellStack
                    lines={[
                      ["Last Obs", undefined],
                      ["date", undefined],
                      ["YTD %chg", undefined],
                    ]}
                  />
                </TableHead>
                <TableHead className="text-right align-bottom">
                  <CellStack
                    lines={[
                      ["Min Obs", undefined],
                      ["date", undefined],
                      ["Last - Min", undefined],
                    ]}
                  />
                </TableHead>
                <TableHead className="text-right align-bottom">
                  <CellStack
                    lines={[
                      ["Max Obs", undefined],
                      ["date", undefined],
                      ["Last - Max", undefined],
                    ]}
                  />
                </TableHead>
                <TableHead className="text-right align-bottom">
                  <CellStack
                    lines={[
                      ["%chg fr first", undefined],
                      ["%chg fr min", undefined],
                      ["%chg fr max", undefined],
                    ]}
                  />
                </TableHead>
                <TableHead className="text-right align-bottom">
                  <CellStack
                    lines={[
                      ["Max - Min", undefined],
                      ["Last-Min/Max-Min", undefined],
                      ["Last-Max/Max-Min", undefined],
                    ]}
                  />
                </TableHead>
                {visibleDates.map((d) => (
                  <TableHead key={d} className="text-right text-xs">
                    {formatDateHeader(d, freqCode)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((entry) => {
                const stats = statsMap.get(entry.seriesId);
                const derived = derivedMap.get(entry.seriesId);
                const indentPx = INDENT_PX[entry.indent] ?? 0;

                return (
                  <TableRow key={entry.seriesId} className="odd:bg-muted/50">
                    {/* Series name — sticky */}
                    <TableCell
                      className="bg-muted sticky left-0 z-10 min-w-[220px] border-r-1 align-top"
                      style={{ paddingLeft: `${8 + indentPx}px` }}
                    >
                      <div className="max-w-[210px]">
                        <Link
                          href={`/udaman/${dataList.universe}/series/${entry.seriesId}`}
                          className="text-primary font-mono text-xs hover:underline"
                        >
                          {entry.seriesName}
                        </Link>
                        {(entry.dataPortalName || entry.unitShortLabel) && (
                          <div className="text-muted-foreground text-[10px] text-pretty">
                            {entry.dataPortalName}
                            {entry.unitShortLabel &&
                              ` (${entry.unitShortLabel})`}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Sparkline — sticky */}
                    <TableCell className="bg-background sticky left-[220px] z-10 p-1">
                      <Sparkline
                        data={
                          visibleSparklineData.get(entry.seriesId) ?? entry.data
                        }
                      />
                    </TableCell>

                    {/* Last Obs / date / YTD %chg */}
                    <TableCell className="text-right">
                      <CellStack
                        lines={[
                          [
                            f(stats?.lastObs?.value, entry.decimals),
                            stats?.lastObs?.value ?? null,
                          ],
                          [
                            stats?.lastObs
                              ? formatDateHeader(stats.lastObs.date, freqCode)
                              : "",
                            undefined,
                          ],
                          [
                            perc(stats?.lastObs?.ytdPctChg),
                            stats?.lastObs?.ytdPctChg ?? null,
                          ],
                        ]}
                      />
                    </TableCell>

                    {/* Min Obs / date / Last - Min */}
                    <TableCell className="text-right">
                      <CellStack
                        lines={[
                          [
                            f(stats?.minObs?.value, entry.decimals),
                            stats?.minObs?.value ?? null,
                          ],
                          [
                            stats?.minObs
                              ? formatDateHeader(stats.minObs.date, freqCode)
                              : "",
                            undefined,
                          ],
                          [
                            f(stats?.minObs?.lastMinusMin, entry.decimals),
                            stats?.minObs?.lastMinusMin ?? null,
                          ],
                        ]}
                      />
                    </TableCell>

                    {/* Max Obs / date / Last - Max */}
                    <TableCell className="text-right">
                      <CellStack
                        lines={[
                          [
                            f(stats?.maxObs?.value, entry.decimals),
                            stats?.maxObs?.value ?? null,
                          ],
                          [
                            stats?.maxObs
                              ? formatDateHeader(stats.maxObs.date, freqCode)
                              : "",
                            undefined,
                          ],
                          [
                            f(stats?.maxObs?.lastMinusMax, entry.decimals),
                            stats?.maxObs?.lastMinusMax ?? null,
                          ],
                        ]}
                      />
                    </TableCell>

                    {/* %chg fr first / %chg fr min / %chg fr max */}
                    <TableCell className="text-right">
                      <CellStack
                        lines={[
                          [
                            perc(stats?.pctChange.fromFirst),
                            stats?.pctChange.fromFirst ?? null,
                          ],
                          [perc(stats?.pctChange.fromMin), undefined],
                          [
                            perc(stats?.pctChange.fromMax),
                            stats?.pctChange.fromMax ?? null,
                          ],
                        ]}
                      />
                    </TableCell>

                    {/* Max-Min / Last-Min/Max-Min / Last-Max/Max-Min */}
                    <TableCell className="text-right">
                      <CellStack
                        lines={[
                          [
                            f(stats?.range.maxMinusMin, entry.decimals),
                            stats?.range.maxMinusMin ?? null,
                          ],
                          [perc(stats?.range.lastMinOverRange), undefined],
                          [
                            perc(stats?.range.lastMaxOverRange),
                            stats?.range.lastMaxOverRange ?? null,
                          ],
                        ]}
                      />
                    </TableCell>

                    {/* Date columns: value / yoy% / yoyDiff */}
                    {visibleDates.map((d) => {
                      const val = derived?.dataMap.get(d) ?? null;
                      const yoy = derived?.yoyMap.get(d) ?? null;
                      const yoyDiff = derived?.yoyDiffMap.get(d) ?? null;
                      return (
                        <TableCell key={d} className="text-right">
                          <CellStack
                            lines={[
                              [f(val, entry.decimals), val],
                              [perc(yoy), yoy],
                              [f(yoyDiff, entry.decimals), yoyDiff],
                            ]}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
