"use client";

import Link from "next/link";
import { SeriesSummary } from "@shared/types";
import { SeasonalAdjustment, SeriesMetadata } from "@shared/types/shared";
import { numBool } from "@shared/utils";
import { dpAgeCode, uheroDate } from "@shared/utils/time";
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

import { SAIndicator } from "../common";

interface DataTableProps<TData> {
  data: TData[];
}

export function SeriesSummaryTable<TData>({ data }: DataTableProps<TData>) {
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
          <Link href={`/series/${row.original.id}`}>
            {row.getValue("name")}
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
      cell: ({ row }) => (
        <div className="max-w-48 truncate">
          <Link href="#" className="hover:font-medium hover:underline">
            {row.getValue("sourceDescription")}
          </Link>
        </div>
      ),
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

export function MetaDataTable({ metadata }: { metadata: SeriesMetadata }) {
  const rows = [
    { name: "Universe", val: metadata.universe },
    {
      name: "Aliases",
      val: metadata.aliases.length > 0 ? metadata.aliases.length : "",
    },
    {
      name: "Measurements",
      val: (
        <Link
          href={`/measurements/${metadata.measurement.id}`}
          className="hover:underline"
        >
          {metadata.measurement.prefix}
        </Link>
      ),
    },
    { name: "Description", val: metadata.description },
    { name: "Aremos Desc.", val: metadata.name },
    { name: "Units", val: `${metadata.unit_long} (${metadata.unit_short})` },
    { name: "Geography", val: metadata.geo_display_name },
    { name: "Decimals", val: metadata.decimals },
    {
      name: "Seasonal Adjustment",
      val: <SAIndicator sa={metadata.seasonal_adjustment} />,
    },
    {
      name: "Source",
      val: (
        <a className="hover:underline" href={metadata.source_link ?? "#"}>
          {metadata.source_description}
        </a>
      ),
    },
    { name: "Source Details", val: metadata.source_detail_description },
    {
      name: "Restricted",
      val: numBool(metadata.restricted) ? "True" : "False",
    },
    {
      name: "Quarantined",
      val: numBool(metadata.quarantined) ? "True" : "False",
    },
    { name: "Created at", val: new Date(metadata.created_at).toDateString() },
    { name: "Updated at", val: new Date(metadata.updated_at).toDateString() },
    { name: "XID (devs only)", val: metadata.xseries_id },
    { name: "Internal ID", val: metadata.id },
  ];
  return (
    <div className="p-1">
      <div className="mb-2">
        <h2 className="text-xl font-bold opacity-80">{metadata.name}</h2>
        <p className="text-primary/80 text-lg font-bold">
          {metadata.dataPortalName}
        </p>
      </div>
      <Table>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow
              key={`metadata-row-${i}`}
              className={cn("py-1", i % 2 === 0 ? "bg-muted" : "bg-none")}
            >
              <TableCell className="w-32">{r.name}</TableCell>
              <TableCell className="max-w-48">{r.val}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const SeriesDataTable = ({ data }) => {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => uheroDate(row.getValue("date")),
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        let val = row.getValue("value");
        val = val === null ? "-" : val.toFixed(1);
        return <span className="font-bold">{val}</span>;
      },
    },
    {
      accessorKey: "yoy",
      header: "YOY",
      cell: ({ row }) => {
        const val = row.getValue("yoy");
        const displayVal = val === null ? "-" : val.toFixed(1) + "%";

        return (
          <span
            className={cn(
              "text-primary/60 w-full text-end text-xs",
              parseInt(val) > 0 ? "text-green-800" : "text-red-800"
            )}
          >
            {displayVal}
          </span>
        );
      },
    },
    {
      accessorKey: "ytd",
      header: "YTD",
      cell: ({ row }) => {
        let val = row.getValue("ytd");
        val = val === null ? "-" : val.toFixed(1) + "%";
        return (
          <span className="text-primary/60 w-full text-end text-xs">{val}</span>
        );
      },
    },
    {
      accessorKey: "lvl_change",
      header: "LVL",
      cell: ({ row }) => {
        let val = row.getValue("lvl_change");
        val = val === null ? "-" : val.toFixed(3);
        return <span className="text-primary/60 text-xs">{val}</span>;
      },
    },
    {
      accessorKey: "updated_at",
      header: "Age",
      cell: ({ row }) =>
        dpAgeCode(row.getValue("updated_at"), row.getValue("pseudo_history")),
    },
    {
      accessorKey: "pseudo_history",
      header: "pseudo_history",
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: {
        pseudo_history: false,
      },
    },
  });

  return (
    <div>
      <Table className="border-separate border-spacing-1 font-mono">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={cn(i % 2 === 0 ? "bg-muted" : "bg-none")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="border-b bg-white text-end"
                  >
                    {/* {cell.getValue() ?? "-"} */}
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
