import { createLogger } from "@/core/observability/logger";
import { getHhdbPrisma } from "@/lib/prisma/hhdb-client";

import {
  CompileError,
  compileQuery,
  STATEMENT_TIMEOUT_SECONDS,
  type OutputColumn,
} from "../utils/hhdb-query-builder/compile";
import { getQueryBuilderSchema } from "../utils/hhdb-query-builder/schema";
import type { QuerySpec } from "../utils/hhdb-query-builder/spec";

const log = createLogger("hhdb.query-builder");

/** JSON-safe cell value after normalisation. */
export type CellValue = string | number | boolean | null;

export interface QueryResult {
  columns: OutputColumn[];
  rows: Record<string, CellValue>[];
  /** True when the row cap was hit; more rows likely exist. */
  truncated: boolean;
  durationMs: number;
  /** Display SQL with values inlined. */
  sql: string;
}

/** Thrown for anything the user can fix by changing the query. */
export class QueryBuilderError extends Error {}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Prisma hands back JS types the wire can't carry (bigint, Decimal, Date).
 * DATE columns arrive as midnight UTC, so a zero time-of-day becomes a bare
 * date; DATETIME columns hold HST wall-clock stored as UTC (see
 * timezone-conventions), so their UTC parts are printed verbatim.
 */
export function normalizeCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return v;
  if (typeof v === "bigint") {
    return v >= BigInt(Number.MIN_SAFE_INTEGER) &&
      v <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(v)
      : v.toString();
  }
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const date = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    const hasTime =
      v.getUTCHours() ||
      v.getUTCMinutes() ||
      v.getUTCSeconds() ||
      v.getUTCMilliseconds();
    return hasTime
      ? `${date} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`
      : date;
  }
  if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  // Prisma Decimal (decimal.js) and anything else with a sensible toString.
  const s = String(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n : s;
}

function isTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /max_statement_time|execution was interrupted|query execution was interrupted|1969|3024/i.test(
    msg,
  );
}

export async function runQuery(spec: QuerySpec): Promise<QueryResult> {
  const schema = getQueryBuilderSchema();
  let compiled;
  try {
    compiled = compileQuery(spec, schema);
  } catch (e) {
    if (e instanceof CompileError) throw new QueryBuilderError(e.message);
    throw e;
  }

  const start = performance.now();
  let raw: Record<string, unknown>[];
  try {
    raw = await getHhdbPrisma().$queryRaw<Record<string, unknown>[]>(
      compiled.sql,
    );
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    if (isTimeout(e)) {
      log.warn({ durationMs, sql: compiled.text }, "query builder timeout");
      throw new QueryBuilderError(
        `The query ran longer than ${STATEMENT_TIMEOUT_SECONDS} seconds and was stopped. Add a filter (island, year, TMK) or lower the row limit.`,
      );
    }
    log.error({ err: e, sql: compiled.text }, "query builder failed");
    const msg = e instanceof Error ? e.message : String(e);
    throw new QueryBuilderError(
      `The database rejected the query: ${msg.split("\n")[0]}`,
    );
  }
  const durationMs = Math.round(performance.now() - start);

  const keys = compiled.outputs.map((o) => o.key);
  const rows = raw.map((r) => {
    const out: Record<string, CellValue> = {};
    for (const k of keys) out[k] = normalizeCell(r[k]);
    return out;
  });

  log.info(
    { durationMs, rows: rows.length, tables: [spec.primary, ...spec.tables] },
    "query builder run",
  );

  return {
    columns: compiled.outputs,
    rows,
    truncated: rows.length >= spec.limit,
    durationMs,
    sql: compiled.pretty,
  };
}
