"use client";

import type { HhdbParcelJSON } from "@catalog/models/hhdb-parcel";
import { formatHst } from "@catalog/utils/time";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

const columns: ColumnDef<HhdbParcelJSON, unknown>[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  { accessorKey: "tmk", header: "TMK", enableSorting: true },
  {
    accessorKey: "scrapedAt",
    header: "Scraped At",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? formatHst(v, "yyyy-MM-dd HH:mm") : "";
    },
  },
  { accessorKey: "parcelNumber", header: "Parcel Number", enableSorting: true },
  {
    accessorKey: "locationAddress",
    header: "Location Address",
    enableSorting: true,
  },
  { accessorKey: "addressOther", header: "Address Other", enableSorting: true },
  { accessorKey: "projectName", header: "Project Name", enableSorting: true },
  {
    accessorKey: "legalInformation",
    header: "Legal Information",
    enableSorting: true,
  },
  {
    accessorKey: "propertyClass",
    header: "Property Class",
    enableSorting: true,
  },
  {
    accessorKey: "landAreaSqft",
    header: "Land Area (sqft)",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? v.toLocaleString() : "";
    },
  },
  {
    accessorKey: "landAreaAcres",
    header: "Land Area (acres)",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? v.toLocaleString() : "";
    },
  },
  {
    accessorKey: "neighborhoodCode",
    header: "Neighborhood Code",
    enableSorting: true,
  },
  { accessorKey: "zoning", header: "Zoning", enableSorting: true },
  { accessorKey: "parcelNote", header: "Parcel Note", enableSorting: true },
  { accessorKey: "damage", header: "Damage", enableSorting: true },
  { accessorKey: "reentryZone", header: "Reentry Zone", enableSorting: true },
  { accessorKey: "zoneColor", header: "Zone Color", enableSorting: true },
  {
    accessorKey: "nonTaxableStatus",
    header: "Non-Taxable Status",
    enableSorting: true,
  },
  { accessorKey: "livingUnits", header: "Living Units", enableSorting: true },
  {
    accessorKey: "createdAt",
    header: "Created At",
    enableSorting: true,
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? formatHst(v, "yyyy-MM-dd HH:mm") : "";
    },
  },
];

const DEFAULT_HIDDEN = [
  "legalInformation",
  "parcelNote",
  "addressOther",
  "scrapedAt",
  "createdAt",
  "reentryZone",
  "zoneColor",
  "nonTaxableStatus",
];

interface ParcelsTableProps {
  data: HhdbParcelJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function ParcelsTable(props: ParcelsTableProps) {
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
      searchPlaceholder="Search by TMK, address, class, zoning..."
    />
  );
}
