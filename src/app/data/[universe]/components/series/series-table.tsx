"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { PortalConfig } from "../../lib/config";
import type { FreqCode, SeriesTableRow } from "../../lib/types";
import { StatTable } from "../ui/stat-table";

/** Table columns for a series (single-series-table.createTableColumns). */
export function seriesTableColumns(
  config: PortalConfig,
  freq: FreqCode,
  percent?: boolean,
) {
  return config.seriesTable
    .filter((c) => !(c.key === "formattedYtd" && freq === "A"))
    .map((c) => ({
      key: c.key,
      label: percent && c.percentLabel ? c.percentLabel : c.label,
    }));
}

/**
 * Single-series data table (single-series-table.component): Date + level +
 * transformation columns per config.seriesTable, rows within the selected
 * range, newest first; the Date header toggles the sort like Angular's
 * p-sortIcon.
 */
export function SeriesTable({
  rows,
  columns,
  startIndex,
  endIndex,
}: {
  /** Full table (buildSeriesTable) on the series' date grid. */
  rows: SeriesTableRow[];
  columns: { key: keyof SeriesTableRow; label: string }[];
  startIndex: number;
  endIndex: number;
}) {
  const [newestFirst, setNewestFirst] = useState(true);

  const data = useMemo(() => {
    const slice = rows.slice(startIndex, endIndex + 1);
    return newestFirst ? slice.reverse() : slice;
  }, [rows, startIndex, endIndex, newestFirst]);

  const defs = useMemo<ColumnDef<SeriesTableRow, unknown>[]>(
    () => [
      {
        id: "tableDate",
        accessorKey: "tableDate",
        header: () => (
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="hover:text-foreground inline-flex items-center gap-1 uppercase"
            aria-label={newestFirst ? "Sort oldest first" : "Sort newest first"}
          >
            Date
            {newestFirst ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUp className="size-3" />
            )}
          </button>
        ),
        meta: { className: "w-32" },
      },
      ...columns.map((c): ColumnDef<SeriesTableRow, unknown> => ({
        id: c.key,
        accessorKey: c.key,
        header: c.label,
        cell: (ctx) => {
          const text = (ctx.getValue() as string) || "–";
          // Pseudo-history levels: muted italic, keyed above the table.
          if (c.key !== "formattedValue" || !ctx.row.original.pseudo)
            return text;
          return (
            <span
              className="text-muted-foreground italic"
              title="Pseudo history"
            >
              {text}
            </span>
          );
        },
      })),
    ],
    [columns, newestFirst],
  );

  const hasPseudo = data.some((r) => r.pseudo);

  return (
    <>
      {hasPseudo && (
        <p
          className="text-muted-foreground mb-2 text-[11px]"
          title="Pseudo history: values estimated by UHERO outside the source data"
        >
          <span className="italic">Italic</span> levels are pseudo history.
        </p>
      )}
      <StatTable
        data={data}
        columns={defs}
        stickyFirstColumn
        maxHeight="70vh"
        getRowId={(r) => r.date}
      />
    </>
  );
}
