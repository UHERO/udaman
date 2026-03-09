"use client";

import type { HhdbHistoricalTaxCreditJSON } from "@catalog/models/hhdb-historical-tax-credit";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const currency = (v: number | null) =>
  v != null ? `$${v.toLocaleString()}` : "";

const columns: ColumnDef<HhdbHistoricalTaxCreditJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  {
    accessorKey: "historicalTaxSummaryId",
    header: "Summary ID",
    enableSorting: true,
  },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "period", header: "Period", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  {
    accessorKey: "amount",
    header: "Amount",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
];

const DEFAULT_HIDDEN = ["historicalTaxSummaryId"];

interface HistoricalTaxCreditsTableProps {
  data: HhdbHistoricalTaxCreditJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function HistoricalTaxCreditsTable(
  props: HistoricalTaxCreditsTableProps,
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
      searchPlaceholder="Search by TMK, period, description..."
    />
  );
}
