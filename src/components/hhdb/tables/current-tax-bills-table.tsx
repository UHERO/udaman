"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbCurrentTaxBillJSON } from "@catalog/models/hhdb-current-tax-bill";
import { HhdbDataTable } from "../hhdb-data-table";

const currency = (v: number | null) =>
  v != null ? `$${v.toLocaleString()}` : "";

const columns: ColumnDef<HhdbCurrentTaxBillJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "taxPeriod", header: "Tax Period", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  {
    accessorKey: "originalDueDate",
    header: "Original Due Date",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
  {
    accessorKey: "taxesAssessment",
    header: "Taxes Assessment",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "taxCredits",
    header: "Tax Credits",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "netTax",
    header: "Net Tax",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "penalty",
    header: "Penalty",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "interest",
    header: "Interest",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "other",
    header: "Other",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "amountDue",
    header: "Amount Due",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
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

const DEFAULT_HIDDEN = ["taxCredits", "interest", "other", "scrapedAt"];

interface CurrentTaxBillsTableProps {
  data: HhdbCurrentTaxBillJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function CurrentTaxBillsTable(props: CurrentTaxBillsTableProps) {
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
      searchPlaceholder="Search by TMK, period, description..."
    />
  );
}
