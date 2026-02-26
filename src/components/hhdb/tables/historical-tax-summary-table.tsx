"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbHistoricalTaxSummaryJSON } from "@catalog/models/hhdb-historical-tax-summary";
import { HhdbDataTable } from "../hhdb-data-table";

const currency = (v: number | null) =>
  v != null ? `$${v.toLocaleString()}` : "";

const columns: ColumnDef<HhdbHistoricalTaxSummaryJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: false },
  { accessorKey: "tmk", header: "TMK", enableSorting: false },
  { accessorKey: "year", header: "Year", enableSorting: false },
  {
    accessorKey: "tax",
    header: "Tax",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "paymentsAndCredits",
    header: "Payments & Credits",
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
  {
    accessorKey: "amountDue",
    header: "Amount Due",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxDetailsTotalTax",
    header: "Details Total Tax",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxDetailsTotalPaymentsCredits",
    header: "Details Total Payments/Credits",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxDetailsTotalPenalty",
    header: "Details Total Penalty",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxDetailsTotalInterest",
    header: "Details Total Interest",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxDetailsTotalOther",
    header: "Details Total Other",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxPaymentsTotalTax",
    header: "Payments Total Tax",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxPaymentsTotalPenalty",
    header: "Payments Total Penalty",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxPaymentsTotalInterest",
    header: "Payments Total Interest",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxPaymentsTotalOther",
    header: "Payments Total Other",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxCreditsTotalAmount",
    header: "Credits Total Amount",
    enableSorting: false,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
];

const DEFAULT_HIDDEN = [
  "taxDetailsTotalTax",
  "taxDetailsTotalPaymentsCredits",
  "taxDetailsTotalPenalty",
  "taxDetailsTotalInterest",
  "taxDetailsTotalOther",
  "taxPaymentsTotalTax",
  "taxPaymentsTotalPenalty",
  "taxPaymentsTotalInterest",
  "taxPaymentsTotalOther",
  "taxCreditsTotalAmount",
];

interface HistoricalTaxSummaryTableProps {
  data: HhdbHistoricalTaxSummaryJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function HistoricalTaxSummaryTable(
  props: HistoricalTaxSummaryTableProps,
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
