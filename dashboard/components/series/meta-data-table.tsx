"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Measurement } from "@shared/types";
import { SeriesMetadata } from "@shared/types/shared";
import { numBool } from "@shared/utils";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";

import { SAIndicator } from "../common";
import { Table, TableBody, TableCell, TableRow } from "../ui/table";

type MetadataRow = {
  name: string;
  value: React.ReactNode;
};

export function MetaDataTable({
  metadata,
}: {
  metadata: SeriesMetadata & { measurement: Measurement[] };
}) {
  console.log("MetaDataTable", metadata);

  const data: MetadataRow[] = useMemo(
    () => [
      { name: "Universe", value: metadata.s_universe },
      {
        name: "Aliases",
        value: metadata.aliases.length > 0 ? metadata.aliases.length : "-",
      },
      {
        name: "Measurements",
        value: metadata.measurement.map((m) => (
          <Link
            key={`${m.id}`}
            href={`/measurements/${m.id}`}
            className="block hover:underline"
          >
            {m.prefix}
          </Link>
        )),
      },
      { name: "Description", value: metadata.s_description },
      { name: "Aremos Desc.", value: metadata.s_name },
      {
        name: "Units",
        value: `${metadata.u_long_label} (${metadata.u_short_label})`,
      },
      { name: "Geography", value: metadata.geo_display_name },
      { name: "Decimals", value: metadata.s_decimals },
      {
        name: "Seasonal Adjustment",
        value: <SAIndicator sa={metadata.xs_seasonal_adjustment} />,
      },
      {
        name: "Source",
        value: (
          <a className="hover:underline" href={metadata.source_link ?? "#"}>
            {metadata.source_description}
          </a>
        ),
      },
      { name: "Source Details", value: metadata.source_detail_description },
      {
        name: "Restricted",
        value: numBool(metadata.xs_restricted) ? "True" : "False",
      },
      {
        name: "Quarantined",
        value: numBool(metadata.xs_quarantined) ? "True" : "False",
      },
      {
        name: "Created at",
        value: new Date(metadata.s_created_at).toDateString(),
      },
      {
        name: "Updated at",
        value: new Date(metadata.s_updated_at).toDateString(),
      },
      { name: "XID (devs only)", value: metadata.xs_id },
      { name: "Internal ID", value: metadata.s_id },
    ],
    [metadata]
  );

  const columns: ColumnDef<MetadataRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Property",
        meta: {
          className: "w-32",
        },
        cell: ({ cell }) => (
          <span className="font-medium">{cell.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        meta: {
          className: "max-w-64",
        },
        cell: ({ cell }) => cell.getValue() as React.ReactNode,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-1">
      <div className="mb-2">
        <h2 className="text-xl font-bold opacity-80">{metadata.s_name}</h2>
        <p className="text-primary/80 text-lg font-bold">
          {metadata.s_dataPortalName}
        </p>
      </div>

      <Table className="cursor-default">
        <TableBody>
          {table.getRowModel().rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={cn("py-1", index % 2 === 0 ? "bg-muted" : "bg-none")}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.columnDef.meta?.className}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
