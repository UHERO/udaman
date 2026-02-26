"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbYardImprovementJSON } from "@catalog/models/hhdb-yard-improvement";
import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbYardImprovementJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  { accessorKey: "quantity", header: "Quantity", enableSorting: true },
  { accessorKey: "yearBuilt", header: "Year Built", enableSorting: true },
  { accessorKey: "area", header: "Area", enableSorting: true },
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

interface YardImprovementsTableProps {
  data: HhdbYardImprovementJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function YardImprovementsTable(props: YardImprovementsTableProps) {
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
