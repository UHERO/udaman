import {
  aggregateKey,
  aggregateLabel,
  columnKey,
  defaultSpec,
  selectedTables,
  type ColumnMeta,
  type ColumnRef,
  type QuerySchema,
  type QuerySpec,
  type TableMeta,
} from "@catalog/utils/hhdb-query-builder/spec";

/** Client-side lookups and spec manipulation shared by the builder panels. */

export function findTable(
  schema: QuerySchema,
  name: string,
): TableMeta | undefined {
  return schema.tables.find((t) => t.name === name);
}

export function findColumn(
  schema: QuerySchema,
  table: string,
  column: string,
): ColumnMeta | undefined {
  return findTable(schema, table)?.columns.find((c) => c.name === column);
}

export interface ColumnChoice {
  table: TableMeta;
  column: ColumnMeta;
  /** `table.column`, the Select value. */
  value: string;
}

/** Every column of every table in the query, primary first. */
export function columnChoices(
  schema: QuerySchema,
  spec: QuerySpec,
): ColumnChoice[] {
  const out: ColumnChoice[] = [];
  for (const name of selectedTables(spec)) {
    const table = findTable(schema, name);
    if (!table) continue;
    for (const column of table.columns) {
      out.push({ table, column, value: refValue(name, column.name) });
    }
  }
  return out;
}

export function refValue(table: string, column: string): string {
  return `${table}.${column}`;
}

export function parseRef(value: string): ColumnRef {
  const i = value.indexOf(".");
  return { table: value.slice(0, i), column: value.slice(i + 1) };
}

/** Bookkeeping columns nobody wants in a default result. */
const NOISE = new Set([
  "id",
  "scraped_at",
  "created_at",
  "updated_at",
  "parsed_at",
  "fetched_at",
]);

/** tmk plus the first documented columns, so a fresh query shows something useful. */
export function defaultColumnsFor(table: TableMeta, max = 8): ColumnRef[] {
  const refs: ColumnRef[] = [];
  if (table.columns.some((c) => c.name === "tmk")) {
    refs.push({ table: table.name, column: "tmk" });
  }
  const documented = table.columns.filter(
    (c) => c.name !== "tmk" && !NOISE.has(c.name) && c.description,
  );
  const pool = documented.length
    ? documented
    : table.columns.filter((c) => c.name !== "tmk");
  for (const c of pool) {
    if (refs.length >= max) break;
    refs.push({ table: table.name, column: c.name });
  }
  return refs;
}

export function initialSpec(schema: QuerySchema): QuerySpec {
  const primary = schema.tables[0];
  const spec = defaultSpec(primary?.name ?? "properties");
  if (primary) spec.columns = defaultColumnsFor(primary);
  return spec;
}

/**
 * Drop every reference to a table that is no longer part of the query, and
 * re-point island filters at the (possibly new) primary table.
 */
export function pruneSpec(spec: QuerySpec, schema: QuerySchema): QuerySpec {
  const tables = new Set(selectedTables(spec));
  const valid = (ref: ColumnRef) =>
    tables.has(ref.table) && !!findColumn(schema, ref.table, ref.column);

  const filters = spec.filters
    .map((f) =>
      f.op === "island" ? { ...f, table: spec.primary, column: "tmk" } : f,
    )
    .filter(valid);

  const next: QuerySpec = {
    ...spec,
    tables: spec.tables.filter(
      (t) => t !== spec.primary && findTable(schema, t),
    ),
    columns: spec.columns.filter(valid),
    filters,
    summarize: {
      ...spec.summarize,
      groupBy: spec.summarize.groupBy.filter(valid),
      aggregates: spec.summarize.aggregates.filter(
        (a) =>
          a.fn === "count" ||
          (a.table && a.column && valid({ table: a.table, column: a.column })),
      ),
    },
  };

  const keys = new Set(describeOutputs(next, schema).map((o) => o.key));
  if (next.sort && !keys.has(next.sort.key)) delete next.sort;
  return next;
}

export interface OutputChoice {
  key: string;
  label: string;
}

/** Mirrors the compiler's output aliases so the UI can offer sort keys. */
export function describeOutputs(
  spec: QuerySpec,
  schema: QuerySchema,
): OutputChoice[] {
  const out: OutputChoice[] = [];
  if (spec.summarize.enabled) {
    for (const g of spec.summarize.groupBy) {
      const col = findColumn(schema, g.table, g.column);
      const label = col?.label ?? g.column;
      out.push({
        key: columnKey(g.table, g.column, g.bucket),
        label: g.bucket ? `${label} (${g.bucket})` : label,
      });
    }
    spec.summarize.aggregates.forEach((a, i) => {
      const col =
        a.table && a.column ? findColumn(schema, a.table, a.column) : undefined;
      out.push({ key: aggregateKey(i), label: aggregateLabel(a, col?.label) });
    });
    return out;
  }
  const columns =
    spec.columns.length > 0
      ? spec.columns
      : (findTable(schema, spec.primary)?.columns ?? [])
          .slice(0, 12)
          .map((c) => ({ table: spec.primary, column: c.name }));
  for (const c of columns) {
    const col = findColumn(schema, c.table, c.column);
    out.push({
      key: columnKey(c.table, c.column),
      label: col?.label ?? c.column,
    });
  }
  return out;
}

/** Number of joined tables that can repeat per tmk; 2+ multiplies rows. */
export function fanOutCount(spec: QuerySpec, schema: QuerySchema): number {
  return selectedTables(spec).filter(
    (t) => findTable(schema, t)?.onePerTmk === false,
  ).length;
}
