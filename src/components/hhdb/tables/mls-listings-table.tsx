"use client";

import type { HhdbMlsListingJSON } from "@catalog/models/hhdb-mls-listing";
import { formatHst } from "@catalog/utils/time";
import type { ColumnDef } from "@tanstack/react-table";

import { MLS_COLUMNS, type MlsColumnSpec } from "@/core/crawlers/mls/columns";

import { HhdbDataTable } from "../hhdb-data-table";

type Col = ColumnDef<HhdbMlsListingJSON, unknown>;

/** Data columns shown by default, in display order. Everything else starts hidden. */
const DEFAULT_VISIBLE = [
  "list_price",
  "sold_price",
  "tenure",
  "property_type",
  "address",
  "city",
  "island",
  "region",
  "bedrooms",
  "full_baths",
  "living_sf",
  "tmk",
  "list_date",
  "date_sold",
];

const dateTimeCell: Col["cell"] = ({ getValue }) => {
  const v = getValue() as string | null;
  return v ? formatHst(v, "yyyy-MM-dd HH:mm") : "";
};

/** Column definition for one MLS_COLUMNS spec, formatted by its kind. */
function dataColumn(spec: MlsColumnSpec): Col {
  const base = {
    accessorKey: spec.column,
    header: spec.label,
    enableSorting: true,
  };
  switch (spec.kind) {
    case "money":
      return {
        ...base,
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null ? `$${v.toLocaleString()}` : "";
        },
      };
    case "int":
      return {
        ...base,
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null ? v.toLocaleString() : "";
        },
      };
    case "text":
      // Unbounded TEXT columns (remarks, pick lists) are clamped to one line.
      if (spec.length != null) return base;
      return {
        ...base,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <span className="block max-w-80 truncate" title={v}>
              {v}
            </span>
          ) : (
            ""
          );
        },
      };
    default:
      // date ("YYYY-MM-DD") and year render as-is.
      return base;
  }
}

const specs: readonly MlsColumnSpec[] = MLS_COLUMNS;
const visibleSpecs = DEFAULT_VISIBLE.flatMap((name) => {
  const spec = specs.find((s) => s.column === name);
  return spec ? [spec] : [];
});
const hiddenSpecs = specs.filter((s) => !DEFAULT_VISIBLE.includes(s.column));

const columns: Col[] = [
  { accessorKey: "id", header: "ID", enableSorting: true },
  {
    accessorKey: "mls_number",
    header: "MLS #",
    enableSorting: true,
    cell: ({ getValue, row }) => {
      const v = getValue() as string | null;
      const url = row.original.source_url;
      if (!v) return "";
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {v}
        </a>
      ) : (
        v
      );
    },
  },
  { accessorKey: "status", header: "Status", enableSorting: true },
  ...visibleSpecs.map(dataColumn),
  {
    accessorKey: "last_seen_at",
    header: "Last Seen",
    enableSorting: true,
    cell: dateTimeCell,
  },
  {
    accessorKey: "first_seen_at",
    header: "First Seen",
    enableSorting: true,
    cell: dateTimeCell,
  },
  { accessorKey: "mls_board", header: "MLS Board", enableSorting: true },
  { accessorKey: "source_site", header: "Source Site", enableSorting: true },
  ...hiddenSpecs.map(dataColumn),
];

const DEFAULT_HIDDEN = [
  "id",
  "first_seen_at",
  "mls_board",
  "source_site",
  ...hiddenSpecs.map((s) => s.column),
];

interface MlsListingsTableProps {
  data: HhdbMlsListingJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function MlsListingsTable(props: MlsListingsTableProps) {
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
      searchPlaceholder="Search by MLS #, TMK, island, status, type, region, address..."
    />
  );
}
