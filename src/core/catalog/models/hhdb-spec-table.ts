import { getDictionaryFields } from "@/core/catalog/types/hhdb-data-dictionary";
import {
  CLAIM_COLUMNS,
  CLAIM_INSERT_COLUMNS,
  POLICY_COLUMNS,
  POLICY_INSERT_COLUMNS,
  type FicohColumnSpec,
} from "@/core/crawlers/ficoh/columns";
import {
  RENTHUB_COLUMNS,
  RENTHUB_INSERT_COLUMNS,
  type RenthubColumnSpec,
} from "@/core/crawlers/renthub/columns";

/**
 * List-view definitions for the HHDB tables whose columns come from a loader
 * spec — renthub_listings, insurance_policies, insurance_claims — so one
 * collection and one table component serve all three. Columns, labels and
 * display formats are derived from the loaders' column specs and the data
 * dictionary, never hand-copied.
 *
 * Pure data + functions: safe to import from client components.
 */

export type DisplayKind =
  /** Short text. */
  | "text"
  /** Free text, clamped to one line with the full value on hover. */
  | "longtext"
  /** Integer shown without separators: ids, codes, years. */
  | "plain"
  /** Number with thousands separators. */
  | "number"
  /** Dollars. */
  | "money"
  /** Coordinates and other decimals, shown as stored. */
  | "decimal"
  /** "YYYY-MM-DD". */
  | "date"
  /** "YYYY-MM-DD HH:MM:SS.sss" as stored — NOT reinterpreted as HST. */
  | "datetime"
  /** 1 / 0 → Y / N. */
  | "flag";

export interface SpecTableColumn {
  column: string;
  label: string;
  display: DisplayKind;
}

export interface SpecTableDef {
  /** DB table. */
  table: string;
  /** Primary key: the tie-break that keeps pagination stable. */
  key: string;
  /** Selected and displayed columns, in order. */
  columns: SpecTableColumn[];
  /** Columns shown before the user picks; the rest start hidden. */
  defaultVisible: string[];
  /**
   * Indexed columns only (mirrors the KEY list in the table's .sql). A sort
   * on anything else falls back to defaultSort: these tables are hundreds of
   * thousands of rows, and an unindexed ORDER BY is a full filesort.
   */
  sortable: string[];
  defaultSort: string;
  /**
   * The ONE indexed column a search term is prefix-matched against, chosen
   * from the term's shape (as tg_transactions does): one index range scan.
   */
  searchColumn: (term: string) => string;
  searchPlaceholder: string;
}

const LONG_TEXT = new Set([
  "description",
  "address",
  "tmk_address",
  "loss_address",
  "company",
]);
const PLAIN = new Set([
  "id",
  "unit_id",
  "property_id",
  "year_built",
  "coord_decimals",
  "location_no",
  "policy_id",
  "company_code",
  "agency_number",
  "construction_type",
]);

function renthubDisplay(spec: RenthubColumnSpec): DisplayKind {
  if (spec.column === "rent_price") return "money";
  if (PLAIN.has(spec.column)) return "plain";
  switch (spec.kind) {
    case "flag":
      return "flag";
    case "buildingType":
      return "text";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "int":
      return "number";
    case "decimal":
      return spec.column === "baths" ? "number" : "decimal";
    case "text":
      return LONG_TEXT.has(spec.column) ? "longtext" : "text";
  }
}

function ficohDisplay(spec: FicohColumnSpec): DisplayKind {
  if (spec.column === "deductible") return "money";
  if (PLAIN.has(spec.column)) return "plain";
  switch (spec.kind) {
    case "money":
      return "money";
    case "int":
      return "number";
    case "excelDate":
    case "ymdDate":
      return "date";
    case "text":
    case "zip":
      return LONG_TEXT.has(spec.column) ? "longtext" : "text";
  }
}

/** Display kinds of the loader-owned columns shared by these tables. */
const LOADER_DISPLAY: Record<string, DisplayKind> = {
  id: "plain",
  batch: "text",
  tmk: "text",
  tmk_match: "text",
  tmk_distance_m: "number",
  tmk_address: "longtext",
  cpr_match: "text",
  coord_decimals: "plain",
  policy_base: "text",
  location_no: "plain",
  policy_id: "plain",
  policy_match: "text",
};

function buildColumns(
  table: string,
  insertColumns: readonly string[],
  displayOf: (column: string) => DisplayKind,
): SpecTableColumn[] {
  const labels = new Map(
    (getDictionaryFields(table) ?? []).map((f) => [f.key, f.label]),
  );
  return insertColumns.map((column) => ({
    column,
    label: labels.get(column) ?? column,
    display: displayOf(column),
  }));
}

function specDisplay<S extends { column: string }>(
  specs: readonly S[],
  map: (s: S) => DisplayKind,
) {
  const byColumn = new Map(specs.map((s) => [s.column, s]));
  return (column: string): DisplayKind => {
    const spec = byColumn.get(column);
    return spec ? map(spec) : (LOADER_DISPLAY[column] ?? "text");
  };
}

const DASHED_TMK = /^\d-[\d-]*$/;

export const RENTHUB_LIST: SpecTableDef = {
  table: "renthub_listings",
  key: "id",
  columns: buildColumns(
    "renthub_listings",
    RENTHUB_INSERT_COLUMNS,
    specDisplay(RENTHUB_COLUMNS, renthubDisplay),
  ),
  defaultVisible: [
    "id",
    "scraped_at",
    "rent_price",
    "beds",
    "baths",
    "sqft",
    "building_type",
    "address",
    "city",
    "zip",
    "tmk",
    "tmk_match",
    "cpr_match",
    "availability_status",
    "company",
  ],
  sortable: [
    "id",
    "batch",
    "tmk",
    "scraped_at",
    "date_posted",
    "zip",
    "neighborhood",
    "unit_id",
    "property_id",
  ],
  defaultSort: "scraped_at",
  searchColumn: (term) =>
    DASHED_TMK.test(term)
      ? "tmk"
      : /^\d{3,5}$/.test(term)
        ? "zip"
        : /^\d{4}-\d{2}-\d{2}_/.test(term)
          ? "batch"
          : "neighborhood",
  searchPlaceholder:
    "Search by TMK (1-2-3-…), ZIP, delivery (2025-01-08_…) or Oahu neighborhood…",
};

export const INSURANCE_POLICIES_LIST: SpecTableDef = {
  table: "insurance_policies",
  key: "id",
  columns: buildColumns(
    "insurance_policies",
    POLICY_INSERT_COLUMNS,
    specDisplay(POLICY_COLUMNS, ficohDisplay),
  ),
  defaultVisible: [
    "policy_number",
    "location_no",
    "effective_date",
    "form_type",
    "address",
    "city",
    "zip",
    "tmk",
    "tmk_match",
    "cov_a_limit",
    "cov_c_limit",
    "tiv",
    "premium",
    "year_built",
  ],
  sortable: [
    "id",
    "policy_number",
    "policy_base",
    "tmk",
    "effective_date",
    "zip",
  ],
  defaultSort: "effective_date",
  searchColumn: (term) =>
    DASHED_TMK.test(term)
      ? "tmk"
      : /^\d{3,5}$/.test(term)
        ? "zip"
        : "policy_number",
  searchPlaceholder:
    "Search by policy number (HPX…/FSP…), TMK (1-2-3-…) or ZIP…",
};

export const INSURANCE_CLAIMS_LIST: SpecTableDef = {
  table: "insurance_claims",
  key: "claim_number",
  columns: buildColumns(
    "insurance_claims",
    CLAIM_INSERT_COLUMNS,
    specDisplay(CLAIM_COLUMNS, ficohDisplay),
  ),
  defaultVisible: [
    "claim_number",
    "date_of_loss",
    "loss_cause",
    "loss_address",
    "loss_city",
    "paid_loss",
    "incurred_loss",
    "tmk",
    "tmk_match",
    "policy_number",
    "policy_match",
  ],
  sortable: [
    "claim_number",
    "policy_id",
    "policy_number",
    "date_of_loss",
    "tmk",
  ],
  defaultSort: "date_of_loss",
  searchColumn: (term) =>
    DASHED_TMK.test(term)
      ? "tmk"
      : /^\d/.test(term)
        ? "claim_number"
        : "policy_number",
  searchPlaceholder:
    "Search by claim number (2023…), policy number (HPX…/FSP…) or TMK (1-2-3-…)…",
};

export type SpecTableRow = Record<string, string | number | null>;

/** DB value → JSON value for one column, by display kind. */
export function serializeCell(
  display: DisplayKind,
  v: unknown,
): string | number | null {
  if (v == null || v === "") return null;
  switch (display) {
    case "plain":
    case "number":
    case "money":
    case "decimal":
    case "flag": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      // The driver anchors DATEs at UTC midnight.
      return v instanceof Date
        ? v.toISOString().slice(0, 10)
        : String(v).slice(0, 10);
    case "datetime":
      // Stored wall-clock (vendor clock for renthub): the Date's UTC fields.
      return v instanceof Date
        ? v.toISOString().slice(0, 23).replace("T", " ")
        : String(v);
    default:
      return String(v);
  }
}
