import type { RuntimeDataModel } from "@prisma/client/runtime/client";

import * as HhdbEnums from "@/generated/prisma-hhdb/enums";
import { getHhdbPrisma } from "@/lib/prisma/hhdb-client";

import {
  getDictionaryFields,
  getTableDocs,
} from "../../types/hhdb-data-dictionary";
import type { ColumnKind, ColumnMeta, QuerySchema, TableMeta } from "./spec";

/**
 * Builds the Query Builder's table/column metadata from the generated Prisma
 * client's runtime data model (names and scalar types), merged with the
 * hand-written data dictionary (labels, descriptions, display formats).
 *
 * Only tables keyed by `tmk` are exposed; the freq_* summaries, backup and
 * bookkeeping tables are not. Order here is the order in the UI.
 */
const EXPOSED_TABLES: Omit<TableMeta, "columns" | "docs">[] = [
  {
    name: "properties",
    title: "Properties",
    group: "Property",
    onePerTmk: true,
  },
  { name: "parcels", title: "Parcels", group: "Property", onePerTmk: false },
  { name: "owners", title: "Owners", group: "Property", onePerTmk: false },
  { name: "sales", title: "Sales", group: "Property", onePerTmk: false },
  { name: "permits", title: "Permits", group: "Property", onePerTmk: false },
  {
    name: "assessments",
    title: "Assessments",
    group: "Property",
    onePerTmk: false,
  },
  {
    name: "residential_improvements",
    title: "Residential Improvements",
    group: "Improvements",
    onePerTmk: false,
  },
  {
    name: "residential_additions",
    title: "Residential Additions",
    group: "Improvements",
    onePerTmk: false,
  },
  {
    name: "accessory_improvements",
    title: "Accessory Improvements",
    group: "Improvements",
    onePerTmk: false,
  },
  {
    name: "commercial_improvements",
    title: "Commercial Improvements",
    group: "Improvements",
    onePerTmk: false,
  },
  {
    name: "commercial_improvement_details",
    title: "Commercial Improvement Details",
    group: "Improvements",
    onePerTmk: false,
  },
  {
    name: "condominium_projects",
    title: "Condo Projects",
    group: "Condo",
    onePerTmk: true,
  },
  {
    name: "condominium_units",
    title: "Condo Units",
    group: "Condo",
    onePerTmk: true,
  },
  {
    name: "current_tax_bills",
    title: "Current Tax Bills",
    group: "Tax",
    onePerTmk: false,
  },
  {
    name: "historical_tax_summary",
    title: "Historical Tax Summary",
    group: "Tax",
    onePerTmk: false,
    large: true,
  },
  {
    name: "historical_tax_details",
    title: "Historical Tax Details",
    group: "Tax",
    onePerTmk: false,
    large: true,
  },
  {
    name: "historical_tax_payments",
    title: "Historical Tax Payments",
    group: "Tax",
    onePerTmk: false,
    large: true,
  },
  {
    name: "historical_tax_credits",
    title: "Historical Tax Credits",
    group: "Tax",
    onePerTmk: false,
  },
  { name: "appeals", title: "Appeals", group: "Tax", onePerTmk: false },
  {
    name: "home_exemptions",
    title: "Home Exemptions",
    group: "Tax",
    onePerTmk: false,
  },
  {
    name: "land_classifications",
    title: "Land Classifications",
    group: "Land",
    onePerTmk: false,
  },
  {
    name: "agricultural_assessments",
    title: "Agricultural Assessments",
    group: "Land",
    onePerTmk: false,
  },
  {
    name: "dedications",
    title: "Dedications",
    group: "Land",
    onePerTmk: false,
  },
  {
    name: "tg_transactions",
    title: "Transactions (TG)",
    group: "Title Guaranty",
    onePerTmk: false,
    large: true,
  },
  {
    name: "mls_listings",
    title: "MLS Listings",
    group: "MLS",
    onePerTmk: false,
  },
];

/** Columns that are internal plumbing or huge blobs; never useful in a result. */
const HIDDEN_COLUMNS = new Set(["extra", "html_path", "map_url", "sketch_url"]);

const KIND_BY_PRISMA_TYPE: Record<string, ColumnKind> = {
  String: "string",
  Int: "number",
  BigInt: "number",
  Float: "number",
  Decimal: "number",
  DateTime: "date",
  Boolean: "boolean",
};

/**
 * The generated client keeps its data model on the (private) instance; the
 * `$extends` proxy forwards unknown properties to the original client. No
 * database connection is opened by reading it.
 */
function readRuntimeDataModel(): RuntimeDataModel {
  const client = getHhdbPrisma() as unknown as {
    _runtimeDataModel?: RuntimeDataModel;
    _originalClient?: { _runtimeDataModel?: RuntimeDataModel };
  };
  const model =
    client._runtimeDataModel ?? client._originalClient?._runtimeDataModel;
  if (!model) {
    throw new Error(
      "hhdb Prisma client exposes no runtime data model; regenerate with `bun run db:generate`",
    );
  }
  return model;
}

function enumValues(typeName: string): string[] | undefined {
  const table = (HhdbEnums as Record<string, unknown>)[typeName];
  if (!table || typeof table !== "object") return undefined;
  return Object.values(table as Record<string, string>);
}

function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSchema(): QuerySchema {
  const dm = readRuntimeDataModel();
  const tables: TableMeta[] = [];

  for (const meta of EXPOSED_TABLES) {
    const model = dm.models[meta.name];
    if (!model) continue;
    const dictionary = new Map(
      (getDictionaryFields(meta.name) ?? []).map((f) => [f.key, f]),
    );

    const columns: ColumnMeta[] = [];
    for (const field of model.fields) {
      if (HIDDEN_COLUMNS.has(field.name)) continue;
      let kind: ColumnKind | undefined;
      let values: string[] | undefined;
      if (field.kind === "scalar") {
        kind = KIND_BY_PRISMA_TYPE[field.type];
      } else if (field.kind === "enum") {
        kind = "enum";
        values = enumValues(field.type);
      }
      if (!kind) continue;

      const dict = dictionary.get(field.name);
      columns.push({
        name: field.name,
        label: dict?.label ?? humanize(field.name),
        description: dict?.description,
        kind,
        format: dict?.format,
        enumValues: values,
      });
    }

    if (!columns.some((c) => c.name === "tmk")) continue;
    tables.push({
      ...meta,
      docs: getTableDocs(meta.name) ?? undefined,
      columns,
    });
  }

  return { tables };
}

let _schema: QuerySchema | null = null;

/** Memoised per process; the data model never changes at runtime. */
export function getQueryBuilderSchema(): QuerySchema {
  if (!_schema) _schema = buildSchema();
  return _schema;
}
