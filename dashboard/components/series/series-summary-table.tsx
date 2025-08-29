"use client";

import { SeriesSummary } from "@shared/types";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

const saMap = {
  not_seasonally_adjusted: "NS",
  seasonally_adjusted: "SA",
  not_applicable: "NA",
};

const saVariant = {
  seasonally_adjusted: "text-green-600",
  not_seasonally_adjusted: "text-orange-600",
  not_applicable: "text-primary",
};

export function SeriesSummaryTable<TData, TValue>({
  data,
}: DataTableProps<TData, TValue>) {
  const columns: ColumnDef<SeriesSummary>[] = [
    {
      accessorKey: "name",
      header: "name@geo.freq",
    },
    {
      accessorKey: "seasonalAdjustment",
      header: "SA",
      cell: ({ row }) => {
        const sa = row.getValue("seasonalAdjustment");
        return <span className={cn(saVariant[sa])}>{saMap[sa]}</span>;
      },
    },
    {
      accessorKey: "Portal Name",
      header: "portalName",
    },
    {
      accessorKey: "unitShortLabel",
      header: "Units",
    },
    {
      accessorKey: "minDate",
      header: "First",
      cell: ({ row }) => {
        const date = row.getValue("minDate");
        return format(date, "yyyy-MM-dd");
      },
    },
    {
      accessorKey: "maxDate",
      header: "Last",
      cell: ({ row }) => {
        const date = row.getValue("maxDate");
        return format(date, "yyyy-MM-dd");
      },
    },
    {
      accessorKey: "sourceDescription",
      header: "Source",
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
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
