"use client";

import Link from "next/link";
import { DataPoint, Measurement, SeriesSummary } from "@shared/types";
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

import { cn, getColor } from "@/lib/utils";
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

export function MetaDataTable({
  metadata,
}: {
  metadata: SeriesMetadata & { measurement: Measurement[] };
}) {
  console.log("MetaDataTable", metadata);
  const rows = [
    { name: "Universe", val: metadata.s_universe },
    {
      name: "Aliases",
      val: metadata.aliases.length > 0 ? metadata.aliases.length : "-",
    },
    {
      name: "Measurements",
      val: (
        <Link
          href={`/measurements/${metadata.measurement[0].id}`}
          className="hover:underline"
        >
          {metadata.measurement.map((m) => m.prefix).join(",")}
        </Link>
      ),
    },
    { name: "Description", val: metadata.s_description },
    { name: "Aremos Desc.", val: metadata.s_name },
    {
      name: "Units",
      val: `${metadata.u_long_label} (${metadata.u_short_label})`,
    },
    { name: "Geography", val: metadata.geo_display_name },
    { name: "Decimals", val: metadata.s_decimals },
    {
      name: "Seasonal Adjustment",
      val: <SAIndicator sa={metadata.xs_seasonal_adjustment} />,
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
      val: numBool(metadata.xs_restricted) ? "True" : "False",
    },
    {
      name: "Quarantined",
      val: numBool(metadata.xs_quarantined) ? "True" : "False",
    },
    { name: "Created at", val: new Date(metadata.s_created_at).toDateString() },
    { name: "Updated at", val: new Date(metadata.s_updated_at).toDateString() },
    { name: "XID (devs only)", val: metadata.xs_id },
    { name: "Internal ID", val: metadata.s_id },
  ];

  return (
    <div className="p-1">
      <div className="mb-2">
        <h2 className="text-xl font-bold opacity-80">{metadata.s_name}</h2>
        <p className="text-primary/80 text-lg font-bold">
          {metadata.s_dataPortalName}
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

export const SeriesDataTable = ({
  data,
  options,
}: {
  data: any;
  options: { decimals: number };
}) => {
  const { decimals } = options;
  /* 
  Table needs to know about
    - series id for link to dp vintages view: /data-points/[id]
    - loaders (source?)
      - to highlight dp w/ loader-color
      - show loader # column if more than 1 loader
  */
  const columns: ColumnDef<DataPoint>[] = [
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
        val = val === null ? "-" : val.toFixed(decimals);
        const color = row.getValue("color");
        return <span className={cn("size-full font-bold")}>{val}</span>;
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
              parseInt(val) >= 0 ? "text-green-800" : "text-red-800"
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
        const val = row.getValue("ytd");
        const displayVal = val === null ? "-" : val.toFixed(1) + "%";
        return (
          <span
            className={cn(
              "text-primary/60 w-full text-end text-xs",
              parseInt(val) >= 0 ? "text-green-800" : "text-red-800"
            )}
          >
            {displayVal}
          </span>
        );
      },
    },
    {
      accessorKey: "lvl_change",
      header: "LVL",
      cell: ({ row }) => {
        const val = row.getValue("lvl_change");
        const displayVal = val === null ? "-" : val.toFixed(1) + "%";
        return (
          <span
            className={cn(
              "text-primary/60 w-full text-end text-xs",
              parseInt(val) >= 0 ? "text-green-800" : "text-red-800"
            )}
          >
            {displayVal}
          </span>
        );
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
    {
      accessorKey: "color",
      header: "color",
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: {
        pseudo_history: false,
        color: false,
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
                <TableHead key={header.id} className="text-end">
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
                className={cn("group", i % 2 === 0 ? "bg-muted" : "bg-none")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "group-hover:bg-muted cursor-default border-b bg-white text-end",
                      cell.column.id === "value" &&
                        getColor(cell.row.getValue("color"))
                    )}
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
