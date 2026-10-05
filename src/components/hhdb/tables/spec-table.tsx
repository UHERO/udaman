"use client";

import {
  INSURANCE_CLAIMS_LIST,
  INSURANCE_POLICIES_LIST,
  RENTHUB_LIST,
  type SpecTableColumn,
  type SpecTableDef,
  type SpecTableRow,
} from "@catalog/models/hhdb-spec-table";
import type { ColumnDef } from "@tanstack/react-table";

import { HhdbDataTable } from "../hhdb-data-table";

type Col = ColumnDef<SpecTableRow, unknown>;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function cellFor(c: SpecTableColumn): Col["cell"] {
  switch (c.display) {
    case "money":
      return ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? money.format(v) : "";
      };
    case "number":
      return ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString("en-US") : "";
      };
    case "flag":
      return ({ getValue }) => {
        const v = getValue() as number | null;
        return v == null ? "" : v ? "Y" : "N";
      };
    case "longtext":
      return ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <span className="block max-w-80 truncate" title={v}>
            {v}
          </span>
        ) : (
          ""
        );
      };
    default:
      // text, plain, decimal, date and datetime render as serialized.
      return ({ getValue }) => {
        const v = getValue() as string | number | null;
        return v == null ? "" : String(v);
      };
  }
}

function buildColumns(def: SpecTableDef): {
  columns: Col[];
  hidden: string[];
} {
  const byName = new Map(def.columns.map((c) => [c.column, c]));
  const visible = def.defaultVisible.flatMap((n) => byName.get(n) ?? []);
  const rest = def.columns.filter(
    (c) => !def.defaultVisible.includes(c.column),
  );
  const columns = [...visible, ...rest].map((c): Col => ({
    accessorKey: c.column,
    header: c.label,
    enableSorting: def.sortable.includes(c.column),
    cell: cellFor(c),
  }));
  return { columns, hidden: rest.map((c) => c.column) };
}

interface SpecTableProps {
  data: SpecTableRow[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

function makeTable(def: SpecTableDef) {
  const { columns, hidden } = buildColumns(def);
  return function SpecTable(props: SpecTableProps) {
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
        defaultHiddenColumns={hidden}
        searchPlaceholder={def.searchPlaceholder}
      />
    );
  };
}

export const RentListingsTable = makeTable(RENTHUB_LIST);
export const InsurancePoliciesTable = makeTable(INSURANCE_POLICIES_LIST);
export const InsuranceClaimsTable = makeTable(INSURANCE_CLAIMS_LIST);
