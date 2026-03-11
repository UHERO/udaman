"use client";

import type { HhdbHistoricalTaxDetailJSON } from "@catalog/models/hhdb-historical-tax-detail";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const currency = (v: number | null) =>
  v != null ? `$${v.toLocaleString()}` : "";

const columns: ColumnDef<HhdbHistoricalTaxDetailJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: false },
  {
    accessorKey: "historicalTaxSummaryId",
    header: "Summary ID",
    enableSorting: false,
  },
  { accessorKey: "tmk", header: "TMK", enableSorting: false },
  { accessorKey: "taxPeriod", header: "Tax Period", enableSorting: false },
  { accessorKey: "description", header: "Description", enableSorting: false },
  {
    accessorKey: "tax",
    header: "Tax",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "paymentsCredits",
    header: "Payments/Credits",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "penalty",
    header: "Penalty",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "interest",
    header: "Interest",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "other",
    header: "Other",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
];

const DEFAULT_HIDDEN = ["historicalTaxSummaryId"];

interface HistoricalTaxDetailsTableProps {
  data: HhdbHistoricalTaxDetailJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function HistoricalTaxDetailsTable(
  props: HistoricalTaxDetailsTableProps,
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
      disableSearch={true}
    />
  );
}
