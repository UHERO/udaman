"use client";

import type { HhdbCommercialDetailJSON } from "@catalog/models/hhdb-commercial-detail";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbCommercialDetailJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  { accessorKey: "card", header: "Card", enableSorting: true },
  { accessorKey: "section", header: "Section", enableSorting: true },
  { accessorKey: "floor", header: "Floor", enableSorting: true },
  { accessorKey: "usage", header: "Usage", enableSorting: true },
  { accessorKey: "area", header: "Area", enableSorting: true },
  { accessorKey: "perimeter", header: "Perimeter", enableSorting: true },
  { accessorKey: "exteriorWall", header: "Exterior Wall", enableSorting: true },
  { accessorKey: "wallHeight", header: "Wall Height", enableSorting: true },
  { accessorKey: "occupancy", header: "Occupancy", enableSorting: true },
  { accessorKey: "construction", header: "Construction", enableSorting: true },
  { accessorKey: "condoStyle", header: "Condo Style", enableSorting: true },
  { accessorKey: "condoType", header: "Condo Type", enableSorting: true },
  { accessorKey: "condoUnit", header: "Condo Unit", enableSorting: true },
  { accessorKey: "floorLevel", header: "Floor Level", enableSorting: true },
  { accessorKey: "view", header: "View", enableSorting: true },
  { accessorKey: "project", header: "Project", enableSorting: true },
  { accessorKey: "description", header: "Description", enableSorting: true },
  {
    accessorKey: "commercialImprovementId",
    header: "Improvement ID",
    enableSorting: true,
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

const DEFAULT_HIDDEN = [
  "condoUnit",
  "floorLevel",
  "view",
  "project",
  "description",
  "commercialImprovementId",
  "scrapedAt",
];

interface CommercialDetailsTableProps {
  data: HhdbCommercialDetailJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function CommercialDetailsTable(props: CommercialDetailsTableProps) {
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
      searchPlaceholder="Search by TMK, usage, construction..."
    />
  );
}
