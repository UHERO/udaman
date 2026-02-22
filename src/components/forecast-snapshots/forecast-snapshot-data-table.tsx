"use client";

import { Fragment, useMemo, useState } from "react";
import type { TsdSeries } from "@catalog/utils/tsd-reader";

import { ForecastSnapshotActions } from "@/components/forecast-snapshots/forecast-snapshot-actions";
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
  displayNames: Record<string, string>;
  seriesIds: Record<string, number>;
  snapshotId: number;
  snapshotName: string;
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

function getOrderedSeriesNames(
  histSeries: TsdSeries[],
  newSeries: TsdSeries[],
  oldSeries: TsdSeries[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of histSeries) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      ordered.push(s.name);
    }
  }
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

function formatValue(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  // Use commas + 1 decimal for clean display
  return val.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return val.toFixed(1);
}

export function ForecastSnapshotDataTable({
  newForecast,
  oldForecast,
  history,
  allDates,
  displayNames,
  seriesIds,
  snapshotId,
  snapshotName,
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

  const filteredDates = useMemo(
    () => allDates.filter((d) => d >= dateFrom && d <= dateTo),
    [allDates, dateFrom, dateTo],
  );

  const yoyLag = freq === "annual" ? 1 : freq === "quarterly" ? 4 : 12;

  if (seriesNames.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No series data found in TSD files.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ForecastSnapshotActions
            snapshotId={snapshotId}
            snapshotName={snapshotName}
            view="table"
            newForecast={newForecast}
            oldForecast={oldForecast}
            history={history}
            allDates={allDates}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="bg-background sticky left-0 z-10 pr-4 text-left font-normal" />
              {filteredDates.map((date) => (
                <th
                  key={date}
                  className="text-ublue text-md px-3 pb-1 text-center font-bold whitespace-nowrap"
                >
                  {formatDate(date, freq)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seriesNames.map((name) => {
              const series = newMap.get(name);
              if (!series) return null;
              const label = displayNames[name] || name;
              const sid = seriesIds[name];
              const portalUrl = sid
                ? `https://data.uhero.hawaii.edu/#/series?id=${sid}`
                : undefined;

              // Build value array for YoY
              const vals = filteredDates.map(
                (d) => series.dataHash.get(d) ?? null,
              );
              const pctChange = vals.map((val, idx) => {
                if (idx < yoyLag) return null;
                const prev = vals[idx - yoyLag];
                if (val == null || prev == null || prev === 0) return null;
                return ((val - prev) / prev) * 100;
              });

              return (
                <Fragment key={name}>
                  {/* Value row */}
                  <tr>
                    <td className="bg-background sticky left-0 z-10 pt-2 pr-4 align-baseline font-medium whitespace-nowrap">
                      {label}{" "}
                      {portalUrl ? (
                        <a
                          href={portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          ({name})
                        </a>
                      ) : (
                        <span className="text-muted-foreground">({name})</span>
                      )}
                    </td>
                    {vals.map((val, idx) => (
                      <td
                        key={filteredDates[idx]}
                        className="px-3 pt-2 text-right font-mono whitespace-nowrap"
                      >
                        {formatValue(val)}
                      </td>
                    ))}
                  </tr>
                  {/* % Change row */}
                  <tr>
                    <td className="text-muted-foreground bg-background sticky left-0 z-10 pr-4 pb-1 pl-4 align-baseline text-xs whitespace-nowrap">
                      % Change
                    </td>
                    {pctChange.map((pct, idx) => (
                      <td
                        key={filteredDates[idx]}
                        className="text-muted-foreground px-3 pb-1 text-right font-mono text-xs whitespace-nowrap"
                      >
                        {formatPct(pct)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
