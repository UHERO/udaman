"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { HhdbImprovementJSON } from "@catalog/models/hhdb-improvement";
import { HhdbDataTable } from "../hhdb-data-table";

const residentialColumns: ColumnDef<HhdbImprovementJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "buildingNumber", header: "Bldg #", enableSorting: true },
  { accessorKey: "yearBuilt", header: "Year Built", enableSorting: true },
  { accessorKey: "effYearBuilt", header: "Eff Year", enableSorting: true },
  { accessorKey: "livingArea", header: "Living Area", enableSorting: true },
  { accessorKey: "bedrooms", header: "Beds", enableSorting: true },
  { accessorKey: "fullBath", header: "Full Bath", enableSorting: false },
  { accessorKey: "halfBath", header: "Half Bath", enableSorting: false },
  { accessorKey: "occupancy", header: "Occupancy", enableSorting: true },
  { accessorKey: "framing", header: "Framing", enableSorting: true },
  { accessorKey: "grade", header: "Grade", enableSorting: true },
  {
    accessorKey: "buildingValue",
    header: "Bldg Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
  { accessorKey: "totalRoomCount", header: "Rooms", enableSorting: false },
];

const commercialColumns: ColumnDef<HhdbImprovementJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "buildingNumber", header: "Bldg #", enableSorting: true },
  { accessorKey: "yearBuilt", header: "Year Built", enableSorting: true },
  { accessorKey: "improvementName", header: "Name", enableSorting: true },
  { accessorKey: "propertyClass", header: "Class", enableSorting: true },
  { accessorKey: "structureType", header: "Structure", enableSorting: true },
  { accessorKey: "units", header: "Units", enableSorting: true },
  { accessorKey: "buildingSquareFootage", header: "Sq Ft", enableSorting: true },
  { accessorKey: "buildingType", header: "Bldg Type", enableSorting: false },
  {
    accessorKey: "value",
    header: "Value",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? `$${v.toLocaleString()}` : "";
    },
  },
];

const RESIDENTIAL_HIDDEN = ["effYearBuilt", "fullBath", "halfBath", "totalRoomCount"];
const COMMERCIAL_HIDDEN = ["buildingType"];

interface ImprovementsTableProps {
  data: HhdbImprovementJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
  type: "residential" | "commercial";
}

export function ImprovementsTable(props: ImprovementsTableProps) {
  const isResidential = props.type === "residential";
  return (
    <HhdbDataTable
      columns={isResidential ? residentialColumns : commercialColumns}
      data={props.data}
      total={props.total}
      page={props.page}
      limit={props.limit}
      search={props.search}
      sort={props.sort}
      order={props.order}
      defaultHiddenColumns={isResidential ? RESIDENTIAL_HIDDEN : COMMERCIAL_HIDDEN}
      searchPlaceholder={
        isResidential
          ? "Search by TMK, occupancy, framing..."
          : "Search by TMK, name, class, structure..."
      }
    />
  );
}
