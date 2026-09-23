import {
  empty,
  join,
  raw,
  sqltag as sql,
  type Sql,
} from "@prisma/client/runtime/client";

import {
  aggregateKey,
  aggregateLabel,
  columnKey,
  FILTER_OPS_BY_KIND,
  ISLAND_CODES,
  LIMITS,
  NUMERIC_ONLY_FNS,
  selectedTables,
  type AggregateSpec,
  type ColumnKind,
  type ColumnMeta,
  type FilterSpec,
  type GroupBySpec,
  type QuerySchema,
  type QuerySpec,
  type TableMeta,
} from "./spec";

/**
 * Compiles a QuerySpec into a parameterised MariaDB SELECT.
 *
 * Safety model: every identifier (table, column) must exist in the QuerySchema
 * and is emitted backtick-quoted via `raw`; every user value goes through a
 * `?` parameter. The compiler never emits anything but a single SELECT, so
 * the worst a bad spec can do is throw a CompileError.
 *
 * Joins are fixed: every non-primary table is LEFT JOINed on `tmk` to the
 * primary table, which is the whole reason the builder can stay simple.
 */

export class CompileError extends Error {}

/** Seconds before MariaDB aborts the statement (SET STATEMENT max_statement_time). */
export const STATEMENT_TIMEOUT_SECONDS = 30;

/** Default column cap when a spec names no columns. */
const DEFAULT_COLUMN_COUNT = 12;

export interface OutputColumn {
  /** Result-set alias; also the sort key. */
  key: string;
  label: string;
  kind: ColumnKind;
  format?: ColumnMeta["format"];
  /** Source table title, for the header hint. Absent for aggregates. */
  tableTitle?: string;
}

export interface CompiledQuery {
  sql: Sql;
  /** The statement with `?` placeholders (what the driver sees). */
  text: string;
  /** The statement with values inlined, for display only. */
  pretty: string;
  outputs: OutputColumn[];
}

// ---------------------------------------------------------------------------
// Identifier resolution
// ---------------------------------------------------------------------------

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(name: string): Sql {
  if (!IDENT.test(name)) throw new CompileError(`Bad identifier: ${name}`);
  return raw(`\`${name}\``);
}

class Resolver {
  private tables = new Map<string, TableMeta>();

  constructor(schema: QuerySchema, selected: string[]) {
    const byName = new Map(schema.tables.map((t) => [t.name, t]));
    for (const name of selected) {
      const t = byName.get(name);
      if (!t) throw new CompileError(`Unknown table: ${name}`);
      this.tables.set(name, t);
    }
  }

  table(name: string): TableMeta {
    const t = this.tables.get(name);
    if (!t) throw new CompileError(`Table ${name} is not part of this query`);
    return t;
  }

  column(
    table: string,
    column: string,
  ): { table: TableMeta; column: ColumnMeta } {
    const t = this.table(table);
    const c = t.columns.find((c) => c.name === column);
    if (!c) throw new CompileError(`Unknown column: ${table}.${column}`);
    return { table: t, column: c };
  }

  /** `\`table\`.\`column\`` after validation. */
  ref(table: string, column: string): Sql {
    this.column(table, column);
    return sql`${ident(table)}.${ident(column)}`;
  }
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

function single(f: FilterSpec): string {
  const v = f.value;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length === 1) return v[0];
  throw new CompileError(`Filter on ${f.column} needs one value`);
}

function pair(f: FilterSpec): [string, string] {
  const v = f.value;
  if (Array.isArray(v) && v.length === 2) return [v[0], v[1]];
  throw new CompileError(`Filter on ${f.column} needs two values`);
}

function list(f: FilterSpec): string[] {
  const v = f.value;
  const items = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[,\n]/)
      : [];
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0)
    throw new CompileError(`Filter on ${f.column} needs at least one value`);
  return cleaned;
}

function coerce(
  kind: ColumnKind,
  text: string,
  column: string,
): string | number {
  const t = text.trim();
  if (kind === "number") {
    const n = Number(t);
    if (t === "" || !Number.isFinite(n))
      throw new CompileError(`"${text}" is not a number (${column})`);
    return n;
  }
  if (kind === "date") {
    if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(t))
      throw new CompileError(
        `"${text}" is not a date (${column}); use YYYY-MM-DD`,
      );
    return t;
  }
  return t;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// ---------------------------------------------------------------------------
// Clauses
// ---------------------------------------------------------------------------

function whereClause(f: FilterSpec, r: Resolver, primary: string): Sql {
  if (f.op === "island") {
    const codes = list(f);
    for (const c of codes) {
      if (!(ISLAND_CODES as readonly string[]).includes(c))
        throw new CompileError(`Unknown island code: ${c}`);
    }
    // `tmk LIKE '4%'` is a range scan on the tmk index; LEFT(tmk, 1) is not,
    // and a Kauai lookup would walk every Oahu/Maui/Hawaii row first.
    const tmk = r.ref(primary, "tmk");
    const likes = codes.map((c) => sql`${tmk} LIKE ${`${c}%`}`);
    return likes.length === 1 ? likes[0] : sql`(${join(likes, " OR ")})`;
  }

  const { column } = r.column(f.table, f.column);
  if (!FILTER_OPS_BY_KIND[column.kind].includes(f.op))
    throw new CompileError(
      `Operator "${f.op}" does not apply to ${column.kind} column ${f.column}`,
    );
  const col = r.ref(f.table, f.column);
  const kind = column.kind;
  const one = () => coerce(kind, single(f), f.column);

  switch (f.op) {
    case "eq":
      return sql`${col} = ${one()}`;
    case "neq":
      return sql`${col} <> ${one()}`;
    case "lt":
    case "before":
      return sql`${col} < ${one()}`;
    case "lte":
      return sql`${col} <= ${one()}`;
    case "gt":
    case "after":
      return sql`${col} > ${one()}`;
    case "gte":
      return sql`${col} >= ${one()}`;
    case "between": {
      const [a, b] = pair(f);
      return sql`${col} BETWEEN ${coerce(kind, a, f.column)} AND ${coerce(kind, b, f.column)}`;
    }
    case "contains":
      return sql`${col} LIKE ${`%${escapeLike(single(f))}%`}`;
    case "starts_with":
      return sql`${col} LIKE ${`${escapeLike(single(f))}%`}`;
    case "in":
      return sql`${col} IN (${join(list(f).map((v) => coerce(kind, v, f.column)))})`;
    case "is_true":
      return sql`${col} = 1`;
    case "is_false":
      return sql`${col} = 0`;
    case "is_null":
      return sql`${col} IS NULL`;
    case "not_null":
      return sql`${col} IS NOT NULL`;
    default:
      throw new CompileError(`Unsupported operator: ${String(f.op)}`);
  }
}

function groupExpr(g: GroupBySpec, r: Resolver): Sql {
  const { column } = r.column(g.table, g.column);
  const col = r.ref(g.table, g.column);
  if (!g.bucket) return col;
  if (column.kind !== "date")
    throw new CompileError(`Only date columns can be bucketed (${g.column})`);
  return g.bucket === "year"
    ? sql`YEAR(${col})`
    : sql`DATE_FORMAT(${col}, '%Y-%m')`;
}

function aggregateExpr(a: AggregateSpec, r: Resolver): Sql {
  if (a.fn === "count") return sql`COUNT(*)`;
  if (!a.table || !a.column) throw new CompileError(`${a.fn} needs a column`);
  const { column } = r.column(a.table, a.column);
  if (NUMERIC_ONLY_FNS.has(a.fn) && column.kind !== "number")
    throw new CompileError(`${a.fn} needs a numeric column (${a.column})`);
  const col = r.ref(a.table, a.column);
  switch (a.fn) {
    case "count_distinct":
      return sql`COUNT(DISTINCT ${col})`;
    case "sum":
      return sql`SUM(${col})`;
    case "avg":
      return sql`AVG(${col})`;
    case "min":
      return sql`MIN(${col})`;
    case "max":
      return sql`MAX(${col})`;
    default:
      throw new CompileError(`Unsupported aggregate: ${String(a.fn)}`);
  }
}

function aggregateKind(a: AggregateSpec, r: Resolver): ColumnKind {
  if (
    a.fn === "count" ||
    a.fn === "count_distinct" ||
    a.fn === "sum" ||
    a.fn === "avg"
  )
    return "number";
  return r.column(a.table!, a.column!).column.kind;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/** Inline parameters into the `?` text. Raw parts never contain `?`. */
function prettify(text: string, values: readonly unknown[]): string {
  let i = 0;
  return text.replace(/\?/g, () => literal(values[i++]));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function compileQuery(
  spec: QuerySpec,
  schema: QuerySchema,
): CompiledQuery {
  if (!(LIMITS as readonly number[]).includes(spec.limit))
    throw new CompileError(`Limit must be one of ${LIMITS.join(", ")}`);
  if (spec.tables.includes(spec.primary))
    throw new CompileError("The primary table cannot also be a joined table");

  const tables = selectedTables(spec);
  const r = new Resolver(schema, tables);
  const primary = r.table(spec.primary);

  const selectParts: Sql[] = [];
  const groupParts: Sql[] = [];
  const outputs: OutputColumn[] = [];

  if (spec.summarize.enabled) {
    if (spec.summarize.aggregates.length === 0)
      throw new CompileError("Summarize needs at least one aggregate");
    for (const g of spec.summarize.groupBy) {
      const { table, column } = r.column(g.table, g.column);
      const key = columnKey(g.table, g.column, g.bucket);
      selectParts.push(sql`${groupExpr(g, r)} AS ${ident(key)}`);
      groupParts.push(groupExpr(g, r));
      outputs.push({
        key,
        label: g.bucket ? `${column.label} (${g.bucket})` : column.label,
        kind: g.bucket
          ? g.bucket === "year"
            ? "number"
            : "string"
          : column.kind,
        format: g.bucket ? undefined : column.format,
        tableTitle: table.title,
      });
    }
    spec.summarize.aggregates.forEach((a, i) => {
      const key = aggregateKey(i);
      selectParts.push(sql`${aggregateExpr(a, r)} AS ${ident(key)}`);
      const colLabel =
        a.table && a.column
          ? r.column(a.table, a.column).column.label
          : undefined;
      const source =
        a.table && a.column ? r.column(a.table, a.column).column : undefined;
      outputs.push({
        key,
        label: aggregateLabel(a, colLabel),
        kind: aggregateKind(a, r),
        format:
          a.fn === "count" || a.fn === "count_distinct"
            ? "number"
            : source?.format,
      });
    });
  } else {
    const columns =
      spec.columns.length > 0
        ? spec.columns
        : primary.columns
            .slice(0, DEFAULT_COLUMN_COUNT)
            .map((c) => ({ table: primary.name, column: c.name }));
    const seen = new Set<string>();
    for (const c of columns) {
      const key = columnKey(c.table, c.column);
      if (seen.has(key)) continue;
      seen.add(key);
      const { table, column } = r.column(c.table, c.column);
      selectParts.push(sql`${r.ref(c.table, c.column)} AS ${ident(key)}`);
      outputs.push({
        key,
        label: column.label,
        kind: column.kind,
        format: column.format,
        tableTitle: table.title,
      });
    }
  }
  if (selectParts.length === 0)
    throw new CompileError("Select at least one column");

  const joins = spec.tables.map((t) => {
    r.column(t, "tmk");
    return sql` LEFT JOIN ${ident(t)} ON ${r.ref(t, "tmk")} = ${r.ref(spec.primary, "tmk")}`;
  });

  const where = spec.filters.map((f) => whereClause(f, r, spec.primary));

  let orderBy: Sql = empty;
  if (spec.sort) {
    if (!outputs.some((o) => o.key === spec.sort!.key))
      throw new CompileError(
        `Cannot sort by ${spec.sort.key}: it is not in the result`,
      );
    orderBy = sql` ORDER BY ${ident(spec.sort.key)} ${raw(spec.sort.dir === "desc" ? "DESC" : "ASC")}`;
  }

  const statement = sql`SET STATEMENT max_statement_time=${raw(String(STATEMENT_TIMEOUT_SECONDS))} FOR SELECT ${join(selectParts, ", ")} FROM ${ident(spec.primary)}${joins.length ? join(joins, "") : empty}${
    where.length ? sql` WHERE ${join(where, " AND ")}` : empty
  }${groupParts.length ? sql` GROUP BY ${join(groupParts, ", ")}` : empty}${orderBy} LIMIT ${raw(String(spec.limit))}`;

  return {
    sql: statement,
    text: statement.sql,
    pretty: prettify(statement.sql, statement.values),
    outputs,
  };
}
