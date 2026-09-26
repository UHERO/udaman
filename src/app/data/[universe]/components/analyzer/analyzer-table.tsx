"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  allowMoM,
  analyzerDisplayName,
  analyzerTableDates,
} from "../../lib/analyzer";
import {
  buildAnalyzerCsv,
  buildWideTableTsv,
  downloadCsv,
} from "../../lib/csv";
import type { CsvTableRow } from "../../lib/csv";
import { formatTableDate } from "../../lib/dates";
import { formatNum, seriesDecimals } from "../../lib/format";
import { portalHref } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import { getTransformations, transformationRowLabel } from "../../lib/series";
import type {
  DateEntry,
  ExpandedSeries,
  FreqCode,
  TransformationKey,
} from "../../lib/types";
import { SeriesInfoPopover } from "../category/series-info-popover";
import { CheckToggle } from "../selectors/selectors";
import { CopyButton } from "../ui/copy-button";
import { StatTable } from "../ui/stat-table";
import { transformationDecimals, transformationPoints } from "./analyzer-model";

type RowKey = Exclude<TransformationKey, "level">;

export interface AnalyzerTableRow {
  id: string;
  series: ExpandedSeries;
  label: string;
  isLevel: boolean;
  /** Formatted display values keyed by tableDate. */
  display: Record<string, string>;
  /** Raw values keyed by tableDate (CSV). */
  raw: Record<string, number | null>;
}

const ROW_KEYS: RowKey[] = ["yoy", "ytd", "c5ma", "mom"];
const TOGGLE_LABEL: Record<RowKey, string> = {
  yoy: "Year/Year",
  ytd: "Year-to-Date",
  mom: "Month/Month",
  c5ma: "Annual Change",
};

/** `sa` param for series links (analyzer.formatSeriesForAnalyzer saParam). */
export const saParam = (s: ExpandedSeries) =>
  s.seasonalAdjustment !== "not_seasonally_adjusted";

/**
 * Rows for the analyzer data table (analyzer-table.drawTable): per series a
 * level row (indexed when Index is on) plus the checked transformation rows.
 */
export function buildAnalyzerTableRows(opts: {
  series: ExpandedSeries[];
  rows: Record<RowKey, boolean>;
  indexed: boolean;
  baseDate: string | null;
  universe: string;
}): AnalyzerTableRow[] {
  const { series, rows, indexed, baseDate, universe } = opts;
  const out: AnalyzerTableRow[] = [];
  for (const s of series) {
    const t = getTransformations(s.seriesObservations.transformationResults);
    const make = (
      key: TransformationKey,
      label: string,
      indexBase: string | null,
    ): AnalyzerTableRow => {
      const pts = transformationPoints(t[key], indexBase);
      const decimals =
        key === "level" ? seriesDecimals(s) : transformationDecimals(s, key);
      const display: Record<string, string> = {};
      const raw: Record<string, number | null> = {};
      pts.dates.forEach((d, i) => {
        const td = formatTableDate(d, s.frequencyShort);
        const v = pts.values[i];
        raw[td] = v === null ? null : +v.toFixed(decimals);
        display[td] = formatNum(v, decimals, universe);
      });
      return {
        id: `${s.id}-${key}`,
        series: s,
        label,
        isLevel: key === "level",
        display,
        raw,
      };
    };
    out.push(
      make("level", analyzerDisplayName(s, indexed), indexed ? baseDate : null),
    );
    for (const key of ROW_KEYS) {
      if (rows[key] && t[key]?.dates?.length) {
        out.push(make(key, transformationRowLabel(key, s.percent), null));
      }
    }
  }
  return out;
}

/**
 * Analyzer data table (analyzer-table + analyzer-table-renderer): toggles for
 * transformation rows, CSV download, then series × period table with the
 * newest period first and a sticky series column. Series labels link to the
 * series page and carry an info popover.
 */
export function AnalyzerTable({
  series,
  freq,
  startDate,
  endDate,
  indexed,
  baseDate,
  rows,
  onToggleRow,
}: {
  series: ExpandedSeries[];
  freq: FreqCode | null;
  startDate: string;
  endDate: string;
  indexed: boolean;
  baseDate: string | null;
  rows: Record<RowKey, boolean>;
  onToggleRow: (key: RowKey, checked: boolean) => void;
}) {
  const { config } = usePortalConfig();
  const universe = config.universe;

  const dates: DateEntry[] = useMemo(
    () => analyzerTableDates(series, startDate, endDate),
    [series, startDate, endDate],
  );
  const data = useMemo(
    () => buildAnalyzerTableRows({ series, rows, indexed, baseDate, universe }),
    [series, rows, indexed, baseDate, universe],
  );

  const columns = useMemo<ColumnDef<AnalyzerTableRow, unknown>[]>(
    () => [
      {
        id: "series",
        header: "Series",
        meta: { className: "max-w-[22rem] min-w-[16rem]" },
        cell: ({ row }) => {
          const r = row.original;
          if (!r.isLevel) {
            return (
              <span className="text-muted-foreground pl-4">{r.label}</span>
            );
          }
          return (
            <div className="flex items-center gap-1">
              <Link
                href={portalHref(universe, "series", {
                  id: r.series.id,
                  sa: saParam(r.series),
                })}
                title={r.label}
                className="min-w-0 flex-1 truncate text-(--portal-primary) hover:underline"
              >
                {r.label}
              </Link>
              <SeriesInfoPopover series={r.series} className="size-6" />
            </div>
          );
        },
      },
      ...[...dates]
        .reverse()
        .map<ColumnDef<AnalyzerTableRow, unknown>>((d) => ({
          id: d.tableDate,
          header: d.tableDate,
          cell: ({ row }) => row.original.display[d.tableDate] ?? "",
        })),
    ],
    [dates, universe],
  );

  const onExport = () => {
    const csvRows: CsvTableRow[] = data.map((r) => ({
      label: r.label,
      values: r.raw,
    }));
    const { fileName, csv } = buildAnalyzerCsv({
      config,
      dates,
      rows: csvRows,
    });
    downloadCsv(fileName, csv);
  };

  const toggles = ROW_KEYS.filter((k) =>
    k === "mom"
      ? config.transformations.mom && allowMoM(freq)
      : config.transformations[k],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {toggles.map((k) => (
          <CheckToggle
            key={k}
            id={`analyzer-table-${k}`}
            label={TOGGLE_LABEL[k]}
            checked={rows[k]}
            onChange={(v) => onToggleRow(k, v)}
          />
        ))}
        <CopyButton
          className="ml-auto px-2 text-(--portal-primary)"
          getText={() =>
            buildWideTableTsv({
              columns: dates.map((d) => ({
                key: d.tableDate,
                label: d.tableDate,
              })),
              rows: data.map((r) => ({ label: r.label, values: r.raw })),
            })
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExport}
          className="h-7 rounded-none px-2 text-xs text-(--portal-primary)"
        >
          <Download className="size-3.5" />
          Download CSV
        </Button>
      </div>
      <StatTable
        data={data}
        columns={columns}
        stickyFirstColumn
        getRowId={(r) => r.id}
        rowClassName={(row) =>
          row.original.isLevel ? undefined : "text-muted-foreground text-xs"
        }
        emptyMessage="No data in the selected range."
      />
    </div>
  );
}
