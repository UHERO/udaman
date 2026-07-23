"use client";

import type { HhdbAppealJSON } from "@catalog/models/hhdb-appeal";
import { isoDate } from "@catalog/utils/time";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbAppealJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "year", header: "Year", enableSorting: true },
  {
    accessorKey: "appealTypeValue",
    header: "Appeal Type",
    enableSorting: true,
  },
  {
    accessorKey: "scheduledHearingDateSubjectToChange",
    header: "Scheduled Hearing Date",
    enableSorting: true,
  },
  { accessorKey: "status", header: "Status", enableSorting: true },
  {
    accessorKey: "dateSettled",
    header: "Date Settled",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? isoDate(v) : "";
    },
  },
  {
    accessorKey: "finalValue",
    header: "Final Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  {
    accessorKey: "taxPayerOpinionOfValue",
    header: "Taxpayer Opinion of Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  {
    accessorKey: "taxPayerOpinionOfPropertyClass",
    header: "Taxpayer Opinion of Class",
    enableSorting: true,
  },
  {
    accessorKey: "taxPayerOpinionOfExemptions",
    header: "Taxpayer Opinion of Exemptions",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
];

const DEFAULT_HIDDEN = [
  "taxPayerOpinionOfPropertyClass",
  "taxPayerOpinionOfExemptions",
];

interface AppealsTableProps {
  data: HhdbAppealJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function AppealsTable(props: AppealsTableProps) {
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
      searchPlaceholder="Search by TMK, status..."
    />
  );
}
