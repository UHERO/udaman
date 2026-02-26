"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbAssessmentJSON } from "@catalog/models/hhdb-assessment";
import { HhdbDataTable } from "../hhdb-data-table";

const currency = (v: number | null) =>
  v != null ? `$${v.toLocaleString()}` : "";

const columns: ColumnDef<HhdbAssessmentJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "taxYear", header: "Tax Year", enableSorting: true },
  { accessorKey: "propertyClass", header: "Class", enableSorting: true },
  {
    accessorKey: "assessedLandValue",
    header: "Land Value",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "assessedBuildingValue",
    header: "Building Value",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "totalPropertyAssessedValue",
    header: "Total Assessed",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "totalPropertyExemption",
    header: "Exemption",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "totalNetTaxableValue",
    header: "Net Taxable",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
  {
    accessorKey: "totalMarketValue",
    header: "Market Value",
    enableSorting: true,
    cell: ({ getValue }) => currency(getValue() as number | null),
  },
];

const DEFAULT_HIDDEN = [
  "totalPropertyExemption",
  "totalNetTaxableValue",
  "dedicatedUseValue",
];

interface AssessmentsTableProps {
  data: HhdbAssessmentJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function AssessmentsTable(props: AssessmentsTableProps) {
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
      searchPlaceholder="Search by TMK, class, tax year..."
    />
  );
}
