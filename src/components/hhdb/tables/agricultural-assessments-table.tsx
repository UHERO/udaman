"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbAgriculturalAssessmentJSON } from "@catalog/models/hhdb-agricultural-assessment";
import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbAgriculturalAssessmentJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "agriculturalType", header: "Type", enableSorting: true },
  { accessorKey: "useDescription", header: "Use", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  { accessorKey: "acres", header: "Acres", enableSorting: true },
  {
    accessorKey: "acresInProduction",
    header: "In Production",
    enableSorting: true,
  },
  {
    accessorKey: "agriculturalValue",
    header: "Ag Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  {
    accessorKey: "assessedValue",
    header: "Assessed Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
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

const DEFAULT_HIDDEN = ["scrapedAt"];

interface AgriculturalAssessmentsTableProps {
  data: HhdbAgriculturalAssessmentJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function AgriculturalAssessmentsTable(
  props: AgriculturalAssessmentsTableProps,
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
      searchPlaceholder="Search by TMK, type, description..."
    />
  );
}
