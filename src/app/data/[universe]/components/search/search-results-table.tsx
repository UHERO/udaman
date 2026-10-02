"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import type { PortalSeries } from "../../lib/types";
import { AnalyzerToggle } from "../analyzer/analyzer-toggle";
import { StatTable } from "../ui/stat-table";

interface ResultRow {
  id: number;
  series: string;
  region: string;
  frequency: string;
  seasonality: string;
}

type SortKey = Exclude<keyof ResultRow, "id">;

/** Angular search-results.createTableData. */
function toRow(s: PortalSeries): ResultRow {
  return {
    id: s.id,
    series: s.title,
    region: s.geography?.shortName ?? s.geography?.name ?? "",
    frequency: s.frequency,
    seasonality: s.seasonalAdjustment?.split("_").join(" ") || "Not Applicable",
  };
}

/**
 * Every series matching the search term (GET /search/series, ≤ 50) —
 * Angular search-results: sortable Series / Region / Frequency / Seasonally
 * Adjusted table; series names link to the series page.
 */
export function SearchResultsTable({ results }: { results: PortalSeries[] }) {
  const { config } = usePortalConfig();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    null,
  );

  const rows = useMemo(() => {
    const data = results.map(toRow);
    if (!sort) return data;
    const dir = sort.desc ? -1 : 1;
    return [...data].sort(
      (a, b) =>
        dir *
        a[sort.key].localeCompare(b[sort.key], undefined, { numeric: true }),
    );
  }, [results, sort]);

  const columns = useMemo<ColumnDef<ResultRow, unknown>[]>(() => {
    const header = (key: SortKey, label: string) => {
      function SortHeader() {
        const active = sort?.key === key;
        const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
        return (
          <button
            type="button"
            className="hover:text-foreground inline-flex items-center gap-1 uppercase"
            onClick={() =>
              setSort((s) =>
                s?.key === key
                  ? s.desc
                    ? null
                    : { key, desc: true }
                  : { key, desc: false },
              )
            }
            aria-sort={
              active ? (sort.desc ? "descending" : "ascending") : undefined
            }
          >
            {label}
            <Icon className={active ? "size-3" : "size-3 opacity-40"} />
          </button>
        );
      }
      return SortHeader;
    };
    return [
      {
        id: "series",
        accessorKey: "series",
        header: header("series", "Series"),
        meta: { className: "whitespace-normal min-w-64" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link
              href={portalHref(config.universe, "series", {
                id: row.original.id,
                sa: row.original.seasonality === "seasonally adjusted",
              })}
              className="text-[var(--portal-primary)] hover:underline"
            >
              {row.original.series}
            </Link>
            <AnalyzerToggle seriesId={row.original.id} className="size-6" />
          </div>
        ),
      },
      {
        id: "region",
        accessorKey: "region",
        header: header("region", "Region"),
        meta: { align: "left" },
      },
      {
        id: "frequency",
        accessorKey: "frequency",
        header: header("frequency", "Frequency"),
        meta: { align: "left" },
      },
      {
        id: "seasonality",
        accessorKey: "seasonality",
        header: header("seasonality", "Seasonally Adjusted"),
        meta: { align: "left", className: "capitalize" },
      },
    ];
  }, [config.universe, sort]);

  return (
    <StatTable
      data={rows}
      columns={columns}
      getRowId={(r) => String(r.id)}
      emptyMessage="No matching series."
    />
  );
}
