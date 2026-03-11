"use client";

import type { HhdbDedicationJSON } from "@catalog/models/hhdb-dedication";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbDedicationJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "taxYear", header: "Tax Year", enableSorting: true },
  {
    accessorKey: "numberOfDedications",
    header: "Number of Dedications",
    enableSorting: true,
  },
];

const DEFAULT_HIDDEN: string[] = [];

interface DedicationsTableProps {
  data: HhdbDedicationJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function DedicationsTable(props: DedicationsTableProps) {
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
      searchPlaceholder="Search by TMK..."
    />
  );
}
