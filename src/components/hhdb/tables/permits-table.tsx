"use client";

import type { HhdbPermitJSON } from "@catalog/models/hhdb-permit";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbPermitJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  {
    accessorKey: "permitDate",
    header: "Date",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
  { accessorKey: "permitNumber", header: "Permit #", enableSorting: true },
  { accessorKey: "reason", header: "Reason", enableSorting: true },
  {
    accessorKey: "permitAmount",
    header: "Amount",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
];

interface PermitsTableProps {
  data: HhdbPermitJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function PermitsTable(props: PermitsTableProps) {
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
      searchPlaceholder="Search by TMK, permit #, reason..."
    />
  );
}
