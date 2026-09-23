import { z } from "zod";

/**
 * Query Builder spec: the single description of a query the user builds in
 * the /hhdb/query UI. It lives in React state, round-trips through the URL
 * (`?q=` as base64url JSON), and is compiled to SQL on the server.
 *
 * This module is shared by client and server, so it holds only types, zod
 * validation, and small pure helpers — no Prisma imports.
 */

// ---------------------------------------------------------------------------
// Schema metadata (what the UI shows; built server-side from the Prisma client)
// ---------------------------------------------------------------------------

export type ColumnKind = "string" | "number" | "date" | "boolean" | "enum";

export interface ColumnMeta {
  name: string;
  label: string;
  description?: string;
  kind: ColumnKind;
  format?: "dollar" | "number" | "year" | "text";
  enumValues?: string[];
}

export interface TableMeta {
  /** Prisma model / database table name. */
  name: string;
  title: string;
  /** Sidebar-style grouping used to organise pickers. */
  group: string;
  docs?: string;
  /** At most one row per tmk; joining these never multiplies rows. */
  onePerTmk: boolean;
  /** Millions of rows: the UI nudges the user to filter. */
  large?: boolean;
  columns: ColumnMeta[];
}

export interface QuerySchema {
  tables: TableMeta[];
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const FILTER_OPS = [
  "eq",
  "neq",
  "contains",
  "starts_with",
  "in",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "before",
  "after",
  "is_true",
  "is_false",
  "is_null",
  "not_null",
  "island",
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const FILTER_OPS_BY_KIND: Record<ColumnKind, FilterOp[]> = {
  string: ["eq", "neq", "contains", "starts_with", "in", "is_null", "not_null"],
  number: [
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "between",
    "is_null",
    "not_null",
  ],
  date: ["before", "after", "between", "eq", "is_null", "not_null"],
  boolean: ["is_true", "is_false", "is_null"],
  enum: ["eq", "neq", "in", "is_null", "not_null"],
};

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  eq: "equals",
  neq: "does not equal",
  contains: "contains",
  starts_with: "starts with",
  in: "is one of",
  lt: "less than",
  lte: "at most",
  gt: "greater than",
  gte: "at least",
  between: "between",
  before: "before",
  after: "after",
  is_true: "is true",
  is_false: "is false",
  is_null: "is empty",
  not_null: "is not empty",
  island: "island is one of",
};

/** Ops that take no value input. */
export const VALUELESS_OPS: ReadonlySet<FilterOp> = new Set([
  "is_true",
  "is_false",
  "is_null",
  "not_null",
]);

/** Island codes = leading TMK digit. Mirrors ISLAND_NAMES in types/hhdb.ts. */
export const ISLAND_CODES = ["1", "2", "3", "4"] as const;

// ---------------------------------------------------------------------------
// Aggregates, buckets, limits
// ---------------------------------------------------------------------------

export const AGGREGATE_FNS = [
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
] as const;
export type AggregateFn = (typeof AGGREGATE_FNS)[number];

export const AGGREGATE_LABELS: Record<AggregateFn, string> = {
  count: "Count rows",
  count_distinct: "Count distinct",
  sum: "Sum",
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
};

/** Aggregates that only make sense on numeric columns. */
export const NUMERIC_ONLY_FNS: ReadonlySet<AggregateFn> = new Set([
  "sum",
  "avg",
]);

export const DATE_BUCKETS = ["year", "month"] as const;
export type DateBucket = (typeof DATE_BUCKETS)[number];

export const LIMITS = [100, 500, 1000, 5000] as const;
export type Limit = (typeof LIMITS)[number];

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export interface ColumnRef {
  table: string;
  column: string;
}

export interface FilterSpec extends ColumnRef {
  op: FilterOp;
  /** Raw input text; a pair for `between`; a list for `in` / `island`. */
  value?: string | [string, string] | string[];
}

export interface GroupBySpec extends ColumnRef {
  bucket?: DateBucket;
}

export interface AggregateSpec {
  fn: AggregateFn;
  table?: string;
  column?: string;
}

export interface SummarizeSpec {
  enabled: boolean;
  groupBy: GroupBySpec[];
  aggregates: AggregateSpec[];
}

export interface SortSpec {
  /** An output key (see columnKey / aggregateKey). */
  key: string;
  dir: "asc" | "desc";
}

export interface QuerySpec {
  primary: string;
  tables: string[];
  columns: ColumnRef[];
  filters: FilterSpec[];
  summarize: SummarizeSpec;
  sort?: SortSpec;
  limit: Limit;
}

const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const columnRef = z.object({ table: identifier, column: identifier });

export const querySpecSchema: z.ZodType<QuerySpec> = z.object({
  primary: identifier,
  tables: z.array(identifier).max(12),
  columns: z.array(columnRef).max(60),
  filters: z
    .array(
      columnRef.extend({
        op: z.enum(FILTER_OPS),
        value: z
          .union([
            z.string().max(500),
            z.tuple([z.string().max(500), z.string().max(500)]),
            z.array(z.string().max(500)).max(200),
          ])
          .optional(),
      }),
    )
    .max(30),
  summarize: z.object({
    enabled: z.boolean(),
    groupBy: z
      .array(columnRef.extend({ bucket: z.enum(DATE_BUCKETS).optional() }))
      .max(8),
    aggregates: z
      .array(
        z.object({
          fn: z.enum(AGGREGATE_FNS),
          table: identifier.optional(),
          column: identifier.optional(),
        }),
      )
      .max(12),
  }),
  sort: z
    .object({ key: z.string().max(200), dir: z.enum(["asc", "desc"]) })
    .optional(),
  limit: z.union([
    z.literal(100),
    z.literal(500),
    z.literal(1000),
    z.literal(5000),
  ]),
});

export function defaultSpec(primary = "properties"): QuerySpec {
  return {
    primary,
    tables: [],
    columns: [],
    filters: [],
    summarize: { enabled: false, groupBy: [], aggregates: [] },
    limit: 500,
  };
}

// ---------------------------------------------------------------------------
// Output keys — shared by the compiler (SQL aliases) and the UI (sort options)
// ---------------------------------------------------------------------------

export function columnKey(
  table: string,
  column: string,
  bucket?: DateBucket,
): string {
  return bucket ? `${table}__${column}__${bucket}` : `${table}__${column}`;
}

export function aggregateKey(index: number): string {
  return `agg_${index}`;
}

export function aggregateLabel(
  agg: AggregateSpec,
  columnLabel?: string,
): string {
  if (agg.fn === "count") return "Count";
  const fnLabel = AGGREGATE_LABELS[agg.fn];
  return `${fnLabel} of ${columnLabel ?? agg.column ?? "?"}`;
}

/** All tables a spec reads from, primary first, without duplicates. */
export function selectedTables(spec: QuerySpec): string[] {
  const out = [spec.primary];
  for (const t of spec.tables) if (!out.includes(t)) out.push(t);
  return out;
}

// ---------------------------------------------------------------------------
// URL encoding
// ---------------------------------------------------------------------------

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSpec(spec: QuerySpec): string {
  return toBase64Url(JSON.stringify(spec));
}

/** Decode a `?q=` value; returns null for anything malformed. */
export function decodeSpec(q: string | null | undefined): QuerySpec | null {
  if (!q) return null;
  try {
    const parsed = querySpecSchema.safeParse(JSON.parse(fromBase64Url(q)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
