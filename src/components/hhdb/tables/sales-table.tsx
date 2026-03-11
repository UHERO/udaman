"use client";

import type { HhdbSaleJSON } from "@catalog/models/hhdb-sale";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbSaleJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  {
    accessorKey: "saleDate",
    header: "Sale Date",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
  {
    accessorKey: "saleAmount",
    header: "Sale Amount",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  { accessorKey: "instrument", header: "Instrument", enableSorting: true },
  { accessorKey: "instrumentType", header: "Type", enableSorting: true },
  {
    accessorKey: "instrumentDescription",
    header: "Description",
    enableSorting: true,
  },
  { accessorKey: "validSale", header: "Valid", enableSorting: true },
  {
    accessorKey: "dateOfRecording",
    header: "Recorded",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
  { accessorKey: "documentType", header: "Doc Type", enableSorting: true },
  {
    accessorKey: "landCourtDocumentNumber",
    header: "Land Court Doc #",
    enableSorting: false,
  },
  { accessorKey: "cert", header: "Certificate", enableSorting: false },
  { accessorKey: "bookPage", header: "Book/Page", enableSorting: false },
  {
    accessorKey: "conveyanceTax",
    header: "Conv. Tax",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
];

const DEFAULT_HIDDEN = [
  "instrumentDescription",
  "dateOfRecording",
  "documentType",
  "landCourtDocumentNumber",
  "cert",
  "bookPage",
  "conveyanceTax",
];

interface SalesTableProps {
  data: HhdbSaleJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function SalesTable(props: SalesTableProps) {
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
      searchPlaceholder="Search by TMK, instrument..."
    />
  );
}
