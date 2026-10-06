"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SeriesSummary } from "@catalog/types";
import { SeasonalAdjustment } from "@catalog/types/shared";
import { isoDate } from "@catalog/utils/time";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SAIndicator } from "../common";

interface DataTableProps<TData> {
  data: TData[];
  options?: { decimals: number };
}

const Restricted = () => (
  <span
    className="text-destructive ml-1 text-lg font-semibold"
    title="Restricted"
  >
    &#x2298;
  </span>
);

// Nullable columns map null → undefined so `sortUndefined: "last"` keeps
// empty cells at the bottom in both sort directions.
const nullsLast = <K extends keyof SeriesSummary>(key: K) => ({
  id: key,
  accessorFn: (row: SeriesSummary) => row[key] ?? undefined,
  sortUndefined: "last" as const,
});

export function SeriesListTable({ data }: DataTableProps<SeriesSummary>) {
  const { universe } = useParams();
  const columns: ColumnDef<SeriesSummary>[] = [
    {
      accessorKey: "name",
      sortingFn: "alphanumeric",
      header: () => (
        <>
          <span>Name</span>{" "}
          <span className="text-xs no-underline opacity-70">name@geo.freq</span>
        </>
      ),
      cell: ({ row }) => {
        return (
          <Link href={`/udaman/${universe}/series/${row.original.id}`}>
            {row.getValue("name")}
            {row.original.restricted && <Restricted />}
          </Link>
        );
      },
    },
    {
      accessorKey: "seasonalAdjustment",
      sortingFn: "text",
      header: "SA",
      cell: ({ row }) => {
        const sa = row.getValue("seasonalAdjustment");
        return <SAIndicator sa={sa as SeasonalAdjustment} />;
      },
    },
    {
      ...nullsLast("portalName"),
      sortingFn: "text",
      header: "Portal Name",
    },
    {
      ...nullsLast("unitShortLabel"),
      sortingFn: "text",
      header: "Units",
      cell: ({ row }) => row.getValue("unitShortLabel") ?? "-",
    },
    {
      ...nullsLast("minDate"),
      sortingFn: "datetime",
      header: "First",
      cell: ({ row }) => {
        const date = row.getValue<Date | null>("minDate");
        return date ? isoDate(date) : "-";
      },
    },
    {
      ...nullsLast("maxDate"),
      sortingFn: "datetime",
      header: "Last",
      cell: ({ row }) => {
        const date = row.getValue<Date | null>("maxDate");
        return date ? isoDate(date) : "-";
      },
    },
    {
      ...nullsLast("sourceDescription"),
      sortingFn: "text",
      header: "Source",
      cell: ({ row }) => {
        const desc = row.getValue("sourceDescription");
        if (!desc) return "-";
        return (
          <div className="max-w-48 truncate">
            <Link href="#" className="hover:font-medium hover:underline">
              {desc as string}
            </Link>
          </div>
        );
      },
    },
  ];

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    // Click cycles asc → desc → asc; never back to unsorted.
    sortDescFirst: false,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md bg-white">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-1 select-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="text-muted-foreground size-3" />
                        )}
                      </button>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={i % 2 === 0 ? "bg-muted" : "bg-none"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
