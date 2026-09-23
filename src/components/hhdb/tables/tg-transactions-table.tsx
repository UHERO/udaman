"use client";

import {
  TG_SORTABLE_COLUMNS,
  TG_TRANSACTION_COLUMNS,
  type HhdbTgTransactionJSON,
  type TgColumnSpec,
} from "@catalog/models/hhdb-tg-transaction";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

type Col = ColumnDef<HhdbTgTransactionJSON, unknown>;

/** Columns shown by default, in display order. Everything else starts hidden. */
const DEFAULT_VISIBLE = [
  "recDate",
  "docType",
  "tmk",
  "conveyanceAmount",
  "considerationAmount",
  "taxClass",
  "neighborhood",
  "firstPartyName",
  "secondPartyName",
  "mailingState",
  "mortgageType",
];

const sortable = new Set(TG_SORTABLE_COLUMNS);

/** Column definition for one spec, formatted by its kind. */
function dataColumn(spec: TgColumnSpec): Col {
  const base = {
    accessorKey: spec.column,
    header: spec.label,
    enableSorting: sortable.has(spec.column),
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
      return {
        ...base,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <span className="block max-w-72 truncate" title={v}>
              {v}
            </span>
          ) : (
            ""
          );
        },
      };
    default:
      // date ("YYYY-MM-DD") renders as-is.
      return base;
  }
}

const specs: readonly TgColumnSpec[] = TG_TRANSACTION_COLUMNS;
const visibleSpecs = DEFAULT_VISIBLE.flatMap((name) => {
  const spec = specs.find((s) => s.column === name);
  return spec ? [spec] : [];
});
const hiddenSpecs = specs.filter((s) => !DEFAULT_VISIBLE.includes(s.column));

const columns: Col[] = [...visibleSpecs, ...hiddenSpecs].map(dataColumn);

const DEFAULT_HIDDEN = hiddenSpecs.map((s) => s.column);

interface TgTransactionsTableProps {
  data: HhdbTgTransactionJSON[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export function TgTransactionsTable(props: TgTransactionsTableProps) {
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
      searchPlaceholder="Starts with: TMK (1-2-3-…), tax key (123…) or neighborhood name"
    />
  );
}
