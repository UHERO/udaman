"use client";

import { useMemo, useState } from "react";

import type { TsdSeries } from "@catalog/utils/tsd-reader";
import { Button } from "@/components/ui/button";
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

interface Props {
  newForecast: TsdSeries[];
  oldForecast: TsdSeries[];
  history: TsdSeries[];
  allDates: string[];
}

function detectFrequency(dates: string[]): "annual" | "quarterly" | "monthly" {
  if (dates.some((d) => /-(02|05|08)-/.test(d))) return "monthly";
  if (dates.some((d) => /-(04|07|10)-/.test(d))) return "quarterly";
  return "annual";
}

function formatDate(date: string, freq: "annual" | "quarterly" | "monthly") {
  if (freq === "annual") return date.substring(0, 4);
  if (freq === "quarterly") {
    const month = parseInt(date.substring(5, 7), 10);
    const q = Math.ceil(month / 3);
    return `${date.substring(0, 4)}Q${q}`;
  }
  return date.substring(0, 7);
}

function defaultRange(
  allDates: string[],
  freq: "annual" | "quarterly" | "monthly",
) {
  const year = new Date().getFullYear();
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

function getSeriesNames(
  newF: TsdSeries[],
  oldF: TsdSeries[],
  hist: TsdSeries[],
): string[] {
  const names = new Set<string>();
  for (const s of newF) names.add(s.name);
  for (const s of oldF) names.add(s.name);
  for (const s of hist) names.add(s.name);
  return [...names].sort();
}

function formatValue(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return val.toFixed(3);
}

export function ForecastSnapshotDataTable({
  newForecast,
  oldForecast,
  history,
  allDates,
}: Props) {
  const freq = useMemo(() => detectFrequency(allDates), [allDates]);
  const defaults = useMemo(
    () => defaultRange(allDates, freq),
    [allDates, freq],
  );

  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const seriesNames = useMemo(
    () => getSeriesNames(newForecast, oldForecast, history),
    [newForecast, oldForecast, history],
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

  // Rows: for each series name → up to 3 rows (new, old, history)
  const rows = useMemo(() => {
    const result: Array<{
      name: string;
      type: "new" | "old" | "history";
      label: string;
      series: TsdSeries;
    }> = [];
    for (const name of seriesNames) {
      const newS = newMap.get(name);
      const oldS = oldMap.get(name);
      const histS = histMap.get(name);
      if (newS) result.push({ name, type: "new", label: `${name} (new)`, series: newS });
      if (oldS) result.push({ name, type: "old", label: `${name} (old)`, series: oldS });
      if (histS)
        result.push({ name, type: "history", label: `${name} (his)`, series: histS });
    }
    return result;
  }, [seriesNames, newMap, oldMap, histMap]);

  const handleExportCsv = () => {
    const header = ["Series", ...filteredDates.map((d) => formatDate(d, freq))];
    const csvRows = rows.map((row) => {
      const vals = filteredDates.map((date) => formatValue(row.series.dataHash.get(date)));
      return [row.label, ...vals];
    });

    const csvContent = [header, ...csvRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forecast_snapshot.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (seriesNames.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No series data found in TSD files.
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">
                Series
              </TableHead>
              {filteredDates.map((date) => (
                <TableHead key={date} className="text-right whitespace-nowrap">
                  {formatDate(date, freq)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} className="odd:bg-muted">
                <TableCell className="sticky left-0 z-10 bg-inherit whitespace-nowrap font-medium">
                  {row.label}
                </TableCell>
                {filteredDates.map((date) => {
                  const val = row.series.dataHash.get(date);
                  return (
                    <TableCell
                      key={date}
                      className="text-right font-mono text-sm whitespace-nowrap"
                    >
                      {formatValue(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
