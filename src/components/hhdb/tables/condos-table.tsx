"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbCondoProjectJSON, HhdbCondoUnitJSON } from "@catalog/models/hhdb-condo";
import { HhdbDataTable } from "../hhdb-data-table";

const projectColumns: ColumnDef<HhdbCondoProjectJSON, unknown>[] = [
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "projectName", header: "Project", enableSorting: true },
  { accessorKey: "developer", header: "Developer", enableSorting: true },
  { accessorKey: "unitCount", header: "Units", enableSorting: true },
  { accessorKey: "zoning", header: "Zoning", enableSorting: true },
  { accessorKey: "address", header: "Address", enableSorting: true },
  { accessorKey: "city", header: "City", enableSorting: true },
  { accessorKey: "buildings", header: "Buildings", enableSorting: true },
  { accessorKey: "floors", header: "Floors", enableSorting: true },
  { accessorKey: "landOwnership", header: "Ownership", enableSorting: false },
  {
    accessorKey: "finalDate",
    header: "Final Date",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? new Date(v).toLocaleDateString() : "";
    },
  },
  { accessorKey: "projectNumber", header: "Project #", enableSorting: true },
];

const unitColumns: ColumnDef<HhdbCondoUnitJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "parentTmk", header: "Parent TMK", enableSorting: true },
  { accessorKey: "unitNumber", header: "Unit #", enableSorting: true },
  { accessorKey: "ownerName", header: "Owner", enableSorting: true },
];

const PROJECT_HIDDEN = ["landOwnership", "projectNumber"];

interface CondoProjectsTableProps {
  data: HhdbCondoProjectJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function CondoProjectsTable(props: CondoProjectsTableProps) {
  return (
    <HhdbDataTable
      columns={projectColumns}
      data={props.data}
      total={props.total}
      page={props.page}
      limit={props.limit}
      search={props.search}
      sort={props.sort}
      order={props.order}
      defaultHiddenColumns={PROJECT_HIDDEN}
      searchPlaceholder="Search by TMK, project name, developer..."
    />
  );
}

interface CondoUnitsTableProps {
  data: HhdbCondoUnitJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function CondoUnitsTable(props: CondoUnitsTableProps) {
  return (
    <HhdbDataTable
      columns={unitColumns}
      data={props.data}
      total={props.total}
      page={props.page}
      limit={props.limit}
      search={props.search}
      sort={props.sort}
      order={props.order}
      searchPlaceholder="Search by TMK, unit #, owner..."
    />
  );
}
