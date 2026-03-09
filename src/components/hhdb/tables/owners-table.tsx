"use client";

import type { HhdbOwnerJSON } from "@catalog/models/hhdb-owner";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbOwnerJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "ownerName", header: "Owner Name", enableSorting: true },
  { accessorKey: "ownerType", header: "Owner Type", enableSorting: true },
  { accessorKey: "ownerAddress", header: "Owner Address", enableSorting: true },
  {
    accessorKey: "sequenceOrder",
    header: "Sequence Order",
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
  {
    accessorKey: "createdAt",
    header: "Created At",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
];

const DEFAULT_HIDDEN = ["scrapedAt", "createdAt"];

interface OwnersTableProps {
  data: HhdbOwnerJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function OwnersTable(props: OwnersTableProps) {
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
      searchPlaceholder="Search by TMK, name, type..."
    />
  );
}
