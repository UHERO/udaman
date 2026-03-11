"use client";

import type { HhdbAccessoryStructureJSON } from "@catalog/models/hhdb-accessory-structure";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbAccessoryStructureJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "buildingNumber", header: "Bldg #", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  {
    accessorKey: "dimensionsUnits",
    header: "Dimensions/Units",
    enableSorting: true,
  },
  {
    accessorKey: "percentComplete",
    header: "% Complete",
    enableSorting: true,
  },
  {
    accessorKey: "value",
    header: "Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  { accessorKey: "yearBuilt", header: "Year Built", enableSorting: true },
  {
    accessorKey: "scrapedAt",
    header: "Scraped At",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
];

const DEFAULT_HIDDEN = ["scrapedAt"];

interface AccessoryStructuresTableProps {
  data: HhdbAccessoryStructureJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function AccessoryStructuresTable(props: AccessoryStructuresTableProps) {
  return (
    <HhdbDataTable
      columns={columns}
      data={props.data}
      total={props.total}
      page={props.page}
      limit={props.limit}
      search={props.search}
      sort={props.sort}
      order={props.order}
      defaultHiddenColumns={DEFAULT_HIDDEN}
      searchPlaceholder="Search by TMK, building #, description..."
    />
  );
}
