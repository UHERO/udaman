"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbPropertyJSON } from "@catalog/models/hhdb-property";
import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbPropertyJSON, unknown>[] = [
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "islandCode", header: "Island", enableSorting: true },
  { accessorKey: "locationAddress", header: "Address", enableSorting: true },
  { accessorKey: "propertyClass", header: "Class", enableSorting: true },
  { accessorKey: "zoning", header: "Zoning", enableSorting: true },
  { accessorKey: "zip", header: "ZIP", enableSorting: true },
  { accessorKey: "projectName", header: "Project", enableSorting: true },
  {
    accessorKey: "landAreaSqft",
    header: "Land (sqft)",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? v.toLocaleString() : "";
    },
  },
  { accessorKey: "neighborhoodCode", header: "Neighborhood", enableSorting: true },
  { accessorKey: "livingUnits", header: "Units", enableSorting: true },
  { accessorKey: "parcelNumber", header: "Parcel #", enableSorting: true },
];

const DEFAULT_HIDDEN = ["neighborhoodCode", "livingUnits", "parcelNumber"];

interface PropertiesTableProps {
  data: HhdbPropertyJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function PropertiesTable(props: PropertiesTableProps) {
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
      searchPlaceholder="Search by TMK, address, class, zoning..."
    />
  );
}
