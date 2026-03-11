"use client";

import type {
  HhdbCondoProjectJSON,
  HhdbCondoUnitJSON,
} from "@catalog/models/hhdb-condo";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const dateFmt = (v: unknown) => {
  const s = v as string | null;
  return s ? new Date(s).toLocaleDateString() : "";
};

const projectColumns: ColumnDef<HhdbCondoProjectJSON, unknown>[] = [
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "projectName", header: "Project", enableSorting: true },
  { accessorKey: "developer", header: "Developer", enableSorting: true },
  { accessorKey: "unitCount", header: "Units", enableSorting: true },
  { accessorKey: "dccaLink", header: "DCCA Link", enableSorting: false },
  { accessorKey: "zoning", header: "Zoning", enableSorting: true },
  { accessorKey: "address", header: "Address", enableSorting: true },
  { accessorKey: "city", header: "City", enableSorting: true },
  { accessorKey: "projectNumber", header: "Project #", enableSorting: true },
  { accessorKey: "commercial", header: "Commercial", enableSorting: false },
  { accessorKey: "toolSheds", header: "Tool Sheds", enableSorting: false },
  { accessorKey: "ohana", header: "Ohana", enableSorting: false },
  { accessorKey: "residential", header: "Residential", enableSorting: false },
  { accessorKey: "parking", header: "Parking", enableSorting: false },
  { accessorKey: "converted", header: "Converted", enableSorting: false },
  { accessorKey: "agricultural", header: "Agricultural", enableSorting: false },
  { accessorKey: "other", header: "Other", enableSorting: false },
  { accessorKey: "buildings", header: "Buildings", enableSorting: true },
  { accessorKey: "floors", header: "Floors", enableSorting: true },
  { accessorKey: "landOwnership", header: "Ownership", enableSorting: false },
  {
    accessorKey: "preliminaryDate",
    header: "Preliminary",
    enableSorting: false,
    cell: ({ getValue }) => dateFmt(getValue()),
  },
  {
    accessorKey: "contingentFinalDate",
    header: "Contingent Final",
    enableSorting: false,
    cell: ({ getValue }) => dateFmt(getValue()),
  },
  {
    accessorKey: "finalDate",
    header: "Final Date",
    enableSorting: true,
    cell: ({ getValue }) => dateFmt(getValue()),
  },
  {
    accessorKey: "biennialRegistrationDate",
    header: "Biennial Reg",
    enableSorting: false,
    cell: ({ getValue }) => dateFmt(getValue()),
  },
];

const unitColumns: ColumnDef<HhdbCondoUnitJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "parentTmk", header: "Parent TMK", enableSorting: true },
  { accessorKey: "unitNumber", header: "Unit #", enableSorting: true },
  { accessorKey: "ownerName", header: "Owner", enableSorting: true },
];

const PROJECT_HIDDEN = [
  "dccaLink",
  "projectNumber",
  "commercial",
  "toolSheds",
  "ohana",
  "residential",
  "parking",
  "converted",
  "agricultural",
  "other",
  "landOwnership",
  "preliminaryDate",
  "contingentFinalDate",
  "biennialRegistrationDate",
];

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
