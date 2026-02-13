"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SeriesSummary } from "@catalog/types";
import { SeasonalAdjustment } from "@catalog/types/shared";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";

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

export function SeriesListTable({ data }: DataTableProps<SeriesSummary>) {
  const { universe } = useParams();
  const columns: ColumnDef<SeriesSummary>[] = [
    {
      accessorKey: "name",
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
      header: "SA",
      cell: ({ row }) => {
        const sa = row.getValue("seasonalAdjustment");
        return <SAIndicator sa={sa as SeasonalAdjustment} />;
      },
    },
    {
      accessorKey: "portalName",
      header: "Portal Name",
    },
    {
      accessorKey: "unitShortLabel",
      header: "Units",
      cell: ({ row }) => row.getValue("unitShortLabel") ?? "-",
    },
    {
      accessorKey: "minDate",
      header: "First",
      cell: ({ row }) => {
        const date = row.getValue<Date | null>("minDate");
        return date ? format(date, "yyyy-MM-dd") : "-";
      },
    },
    {
      accessorKey: "maxDate",
      header: "Last",
      cell: ({ row }) => {
        const date = row.getValue<Date | null>("maxDate");
        return date ? format(date, "yyyy-MM-dd") : "-";
      },
    },
    {
      accessorKey: "sourceDescription",
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md bg-white">
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
