"use client";

import type { HhdbLandClassificationJSON } from "@catalog/models/hhdb-land-classification";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbLandClassificationJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  {
    accessorKey: "landClassification",
    header: "Land Classification",
    enableSorting: true,
  },
  {
    accessorKey: "squareFootage",
    header: "Square Footage",
    enableSorting: true,
  },
  { accessorKey: "acreage", header: "Acreage", enableSorting: true },
  {
    accessorKey: "agriculturalUseIndicator",
    header: "Agricultural Use Indicator",
    enableSorting: true,
  },
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

interface LandClassificationsTableProps {
  data: HhdbLandClassificationJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function LandClassificationsTable(props: LandClassificationsTableProps) {
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
      searchPlaceholder="Search by TMK, classification..."
    />
  );
}
