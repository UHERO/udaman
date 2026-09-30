"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, Row } from "@tanstack/react-table";

import { cn } from "@/lib/utils";

/**
 * Classic statistical-abstract table on top of TanStack Table.
 *
 * Look: heavy rule above the header and below the last row, hairline rules
 * between rows, small uppercase muted headers, right-aligned tabular-nums
 * numbers, no zebra, no rounded borders. Optional sticky first column (the
 * "Series" column) for wide date tables that scroll horizontally.
 *
 * Column meta (ColumnDef.meta):
 *   - align: "left" | "right" (default: left for first column, right otherwise)
 *   - className: extra classes for header + cells in the column
 *
 * Row-level styling: `rowClassName(row)` — e.g. indent transformation rows
 * (YOY/YTD under a level row) with "text-muted-foreground [&>td:first-child]:pl-6".
 *
 *   <StatTable data={rows} columns={cols} stickyFirstColumn
 *              rowClassName={(r) => r.original.isTransform ? "…" : undefined} />
 *
 * Newest-first date columns: build the column array reversed (Angular
 * scrolled right-to-left); exports stay chronological (csv.ts).
 */
export interface StatColumnMeta {
  align?: "left" | "right";
  className?: string;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData, TValue> extends StatColumnMeta {}
}

export function StatTable<T>({
  data,
  columns,
  stickyFirstColumn = false,
  rowClassName,
  caption,
  emptyMessage = "No data for the current selection.",
  className,
  maxHeight,
  getRowId,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  stickyFirstColumn?: boolean;
  rowClassName?: (row: Row<T>) => string | undefined;
  caption?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  className?: string;
  /** e.g. "70vh" — enables vertical scroll with a sticky header. */
  maxHeight?: string;
  getRowId?: (row: T, index: number) => string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  const alignOf = (index: number, meta?: StatColumnMeta) =>
    (meta?.align ?? (index === 0 ? "left" : "right")) === "right"
      ? "text-right"
      : "text-left";

  const sticky = (index: number) =>
    stickyFirstColumn && index === 0
      ? "sticky left-0 z-10 bg-card after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border"
      : "";

  return (
    <div
      className={cn("relative w-full overflow-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-sm">
        {caption && (
          <caption className="text-muted-foreground caption-bottom pt-2 text-left text-xs">
            {caption}
          </caption>
        )}
        <thead
          className={cn(
            "bg-card border-foreground/80 border-t-2 border-b",
            maxHeight && "sticky top-0 z-20",
          )}
        >
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-border border-b">
              {hg.headers.map((header, i) => {
                const meta = header.column.columnDef.meta;
                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      "text-muted-foreground px-3 py-2 align-bottom text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase",
                      alignOf(i, meta),
                      sticky(i),
                      stickyFirstColumn && i === 0 && "z-30",
                      meta?.className,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="border-foreground/80 border-b-2">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="text-muted-foreground px-3 py-6 text-center"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-border/70 hover:bg-muted/40 border-b last:border-b-0",
                  rowClassName?.(row),
                )}
              >
                {row.getVisibleCells().map((cell, i) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-1.5 whitespace-nowrap",
                        alignOf(i, meta),
                        alignOf(i, meta) === "text-right" && "tabular-nums",
                        sticky(i),
                        meta?.className,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
