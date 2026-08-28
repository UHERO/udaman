"use client";

import type { HhdbAccessoryImprovementJSON } from "@catalog/models/hhdb-accessory-improvement";
import { formatHst } from "@catalog/utils/time";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbAccessoryImprovementJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  {
    accessorKey: "buildingNumber",
    header: "Building Number",
    enableSorting: true,
  },
  { accessorKey: "description", header: "Description", enableSorting: true },
  { accessorKey: "dimensions", header: "Dimensions", enableSorting: true },
  { accessorKey: "quantity", header: "Quantity", enableSorting: true },
  { accessorKey: "yearBuilt", header: "Year Built", enableSorting: true },
  { accessorKey: "area", header: "Area", enableSorting: true },
  {
    accessorKey: "percentComplete",
    header: "Percent Complete",
    enableSorting: true,
  },
  { accessorKey: "value", header: "Value", enableSorting: true },
  {
    accessorKey: "lastYearObserved",
    header: "Last Year Observed",
    enableSorting: true,
  },
  {
    accessorKey: "scrapedAt",
    header: "Scraped At",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? formatHst(v, "yyyy-MM-dd HH:mm") : "";
    },
  },
];

const DEFAULT_HIDDEN = ["scrapedAt"];

interface AccessoryImprovementsTableProps {
  data: HhdbAccessoryImprovementJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function AccessoryImprovementsTable(props: AccessoryImprovementsTableProps) {
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
      searchPlaceholder="Search by TMK, description..."
    />
  );
}
