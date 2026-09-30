"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import type { CsvTableRow } from "../../lib/csv";
import {
  formatNum,
  GROWTH_DECIMALS,
  seriesDecimals,
  toNumber,
} from "../../lib/format";
import {
  categoryRowLabel,
  getTransformations,
  transformationRowLabel,
} from "../../lib/series";
import type {
  DateEntry,
  ExpandedSeries,
  TransformationResult,
} from "../../lib/types";
import { AnalyzerToggle } from "../analyzer/analyzer-toggle";
import { StatTable } from "../ui/stat-table";
import { SeriesInfoPopover } from "./series-info-popover";

export type CategoryRowKind = "level" | "yoy" | "ytd" | "c5ma";

export interface CategoryTableItem {
  series: ExpandedSeries;
  /** Passes the SA toggle. */
  display: boolean;
  /** Nothing in the group passes the SA toggle → show the message row. */
  seasonalMessage: boolean;
}

export interface CategoryTableRow {
  key: string;
  kind: CategoryRowKind;
  series: ExpandedSeries;
  label: string;
  /** Numeric values keyed by "YYYY-MM-DD". */
  values: Record<string, number | null>;
  decimals: number;
  seasonalMessage: boolean;
}

const valuesByDate = (t: TransformationResult | undefined) => {
  const out: Record<string, number | null> = {};
  t?.dates?.forEach((d, i) => (out[d] = toNumber(t.values?.[i])));
  return out;
};

/**
 * Rows of the category table (category-table-view.ngOnChanges): a level row
 * per series, followed by optional YOY / YTD / Annual (c5ma) rows. Series
 * that only show the SA message get a level row with no values and no
 * transformation rows. Callers hide YTD at annual frequency.
 */
export function buildCategoryTableRows(
  items: CategoryTableItem[],
  opts: { universe: string; yoy: boolean; ytd: boolean; c5ma: boolean },
): CategoryTableRow[] {
  const rows: CategoryTableRow[] = [];
  for (const { series, display, seasonalMessage } of items) {
    if (!display && !seasonalMessage) continue;
    const t = getTransformations(
      series.seriesObservations.transformationResults,
    );
    const decimals = seriesDecimals(series);
    rows.push({
      key: `${series.id}-level`,
      kind: "level",
      series,
      label: categoryRowLabel(series, opts.universe),
      values: seasonalMessage ? {} : valuesByDate(t.level),
      decimals,
      seasonalMessage,
    });
    if (!display) continue;
    const extra: [Exclude<CategoryRowKind, "level">, boolean][] = [
      ["yoy", opts.yoy],
      ["ytd", opts.ytd],
      ["c5ma", opts.c5ma],
    ];
    for (const [kind, on] of extra) {
      if (!on) continue;
      rows.push({
        key: `${series.id}-${kind}`,
        kind,
        series,
        label: transformationRowLabel(kind, series.percent),
        values: valuesByDate(t[kind]),
        decimals: kind === "c5ma" ? decimals : GROWTH_DECIMALS,
        seasonalMessage: false,
      });
    }
  }
  return rows;
}

/** CSV rows (plain numbers rounded to the displayed decimals). */
export function categoryCsvRows(rows: CategoryTableRow[]): CsvTableRow[] {
  return rows.map((r) => ({
    label: r.label,
    values: Object.fromEntries(
      Object.entries(r.values).map(([d, v]) => [
        d,
        v === null ? null : +v.toFixed(r.decimals),
      ]),
    ),
  }));
}

/**
 * Category table view (category-table-view + category-table-render):
 * series rows × date columns, newest first, sticky series column. Level rows
 * link to the series page and carry the Analyzer toggle + info popover;
 * transformation rows are indented and muted.
 *
 * Props-driven: pass rows from buildCategoryTableRows and the VISIBLE dates
 * (chronological — the table reverses them).
 */
export function CategoryTable({
  rows,
  dates,
  seriesHref,
  universe,
  seasonalMessage,
  maxHeight,
}: {
  rows: CategoryTableRow[];
  /** Visible periods, chronological. */
  dates: DateEntry[];
  seriesHref: (series: ExpandedSeries) => string;
  universe: string;
  /** Text for SA-message rows, e.g. "Data only available as seasonally adjusted." */
  seasonalMessage?: string;
  maxHeight?: string;
}) {
  const columns = useMemo<ColumnDef<CategoryTableRow, unknown>[]>(() => {
    const first: ColumnDef<CategoryTableRow, unknown> = {
      id: "series",
      header: () => <span className="sr-only">Series</span>,
      meta: { className: "min-w-64 max-w-[26rem]" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.kind !== "level") {
          return <span className="pl-5">{r.label}</span>;
        }
        return (
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              {r.seasonalMessage ? (
                <span
                  className="text-muted-foreground block truncate"
                  title={r.label}
                >
                  {r.label}
                </span>
              ) : (
                <Link
                  href={seriesHref(r.series)}
                  title={r.label}
                  className="block truncate underline-offset-2 hover:underline"
                >
                  {r.label}
                </Link>
              )}
              {r.seasonalMessage && seasonalMessage && (
                <span className="text-muted-foreground block truncate text-xs italic">
                  {seasonalMessage}
                </span>
              )}
            </div>
            <AnalyzerToggle seriesId={r.series.id} />
            <SeriesInfoPopover series={r.series} />
          </div>
        );
      },
    };
    const dateCols: ColumnDef<CategoryTableRow, unknown>[] = [];
    for (let i = dates.length - 1; i >= 0; i--) {
      const { date, tableDate } = dates[i];
      dateCols.push({
        id: date,
        header: tableDate,
        meta: { className: "min-w-20" },
        cell: ({ row }) =>
          formatNum(row.original.values[date], row.original.decimals, universe),
      });
    }
    return [first, ...dateCols];
  }, [dates, seriesHref, universe, seasonalMessage]);

  return (
    <StatTable
      data={rows}
      columns={columns}
      stickyFirstColumn
      maxHeight={maxHeight}
      getRowId={(r) => r.key}
      rowClassName={(row) =>
        row.original.kind !== "level"
          ? "text-muted-foreground text-xs"
          : row.original.seasonalMessage
            ? "bg-neutral-50"
            : undefined
      }
      emptyMessage="Current selections do not return any data, please try a different combination."
    />
  );
}
