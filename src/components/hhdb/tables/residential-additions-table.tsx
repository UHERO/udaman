"use client";

import type { HhdbResidentialAdditionJSON } from "@catalog/models/hhdb-residential-addition";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbResidentialAdditionJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "card", header: "Card", enableSorting: true },
  { accessorKey: "line", header: "Line", enableSorting: true },
  { accessorKey: "lower", header: "Lower", enableSorting: true },
  { accessorKey: "first", header: "First", enableSorting: true },
  { accessorKey: "second", header: "Second", enableSorting: true },
  { accessorKey: "third", header: "Third", enableSorting: true },
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

interface ResidentialAdditionsTableProps {
  data: HhdbResidentialAdditionJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function ResidentialAdditionsTable(
  props: ResidentialAdditionsTableProps,
) {
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
      searchPlaceholder="Search by TMK, card..."
    />
  );
}
