"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle } from "lucide-react";

import { analyzerDisplayName } from "../../lib/analyzer";
import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { calculateSummaryStats, getTransformations } from "../../lib/series";
import type { ExpandedSeries, SummaryStats } from "../../lib/types";
import { StatTable } from "../ui/stat-table";
import { transformationPoints } from "./analyzer-model";
import { saParam } from "./analyzer-table";

interface StatsRow extends SummaryStats {
  series: ExpandedSeries;
  label: string;
}

const STAT_COLUMNS: { key: keyof SummaryStats; label: string }[] = [
  { key: "range", label: "Date Range" },
  { key: "minValue", label: "Minimum Value" },
  { key: "maxValue", label: "Maximum Value" },
  { key: "percChange", label: "% Change" },
  { key: "levelChange", label: "Change" },
  { key: "total", label: "Total" },
  { key: "avg", label: "Avg" },
  { key: "cagr", label: "CAGR" },
];

/**
 * Summary statistics per analyzer series over the selected range
 * (analyzer-table summary grid + analyzer-stats-renderer). Level values,
 * indexed when Index is on. Series with gaps at the range ends get N/A and
 * are listed in a footnote.
 */
export function AnalyzerStatsTable({
  series,
  startDate,
  endDate,
  indexed,
  baseDate,
}: {
  series: ExpandedSeries[];
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
}) {
  const { config } = usePortalConfig();
  const universe = config.universe;

  const data = useMemo<StatsRow[]>(
    () =>
      series.map((s) => {
        const level = getTransformations(
          s.seriesObservations.transformationResults,
        ).level;
        const pts = transformationPoints(level, indexed ? baseDate : null);
        const points = pts.dates.map((date, i) => ({
          date,
          value: pts.values[i],
        }));
        return {
          ...calculateSummaryStats(s, points, startDate, endDate),
          series: s,
          label: analyzerDisplayName(s, indexed),
        };
      }),
    [series, startDate, endDate, indexed, baseDate],
  );

  const columns = useMemo<ColumnDef<StatsRow, unknown>[]>(
    () => [
      {
        id: "series",
        header: "Series",
        meta: { className: "max-w-[22rem] min-w-[16rem]" },
        cell: ({ row }) => (
          <Link
            href={portalHref(universe, "series", {
              id: row.original.series.id,
              sa: saParam(row.original.series),
            })}
            title={row.original.label}
            className="block truncate text-(--portal-primary) hover:underline"
          >
            {row.original.label}
          </Link>
        ),
      },
      ...STAT_COLUMNS.map<ColumnDef<StatsRow, unknown>>((c) => ({
        id: c.key,
        header: c.label,
        cell: ({ row }) => {
          const v = row.original[c.key];
          return v === null ? "N/A" : String(v);
        },
      })),
    ],
    [universe],
  );

  const missing = data.filter((r) => r.missing);

  return (
    <div className="space-y-2">
      <StatTable
        data={data}
        columns={columns}
        stickyFirstColumn
        getRowId={(r) => String(r.series.id)}
      />
      {missing.length > 0 && (
        <div className="text-muted-foreground flex gap-2 text-xs">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p>
              The following series contain N/As due to missing values included
              in the selected range:
            </p>
            <ul className="mt-1 list-disc pl-4">
              {missing.map((r) => (
                <li key={r.series.id}>{r.label}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
