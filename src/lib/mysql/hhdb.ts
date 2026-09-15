import { SQL } from "bun";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("database.hhdb");

let _connection: SQL | null = null;

function createConnection(): SQL {
  return new SQL({
    adapter: "mysql",
    hostname: process.env.HH_DB_HOST ?? "localhost",
    port: process.env.HH_DB_PORT ?? 3306,
    database: process.env.HH_DB_NAME ?? "hawaii_housing_database",
    username: process.env.HH_DB_USER ?? "root",
    password: process.env.HH_DB_PSWD ?? "",
  });
}

function getConnection(): SQL {
  if (!_connection) {
    _connection = createConnection();
  }
  return _connection;
}

/** Reset the cached connection so the next call to getConnection() creates a fresh one. */
function resetConnection(): void {
  _connection = null;
}

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("connection closed") ||
    msg.includes("connection lost") ||
    msg.includes("connection refused") ||
    msg.includes("econnreset") ||
    msg.includes("epipe")
  );
}

/** First keyword of a statement, e.g. "insert" — used to label queries in logs. */
function sqlVerb(sql: string): string {
  return sql.trim().split(/\s+/, 1)[0].toLowerCase();
}

/**
 * Build the log payload for a completed query.
 *
 * `result.length` is 0 for every non-SELECT, so it says nothing about whether
 * a write did anything. Bun's result array carries `affectedRows` (rows the
 * server actually changed — 0 for an UPDATE whose values already matched), so
 * report that for writes and the row count for SELECTs.
 */
function queryLog(
  sql: string,
  result: unknown[] & { affectedRows?: number },
  start: number,
): Record<string, unknown> {
  const verb = sqlVerb(sql);
  const durationMs = +(performance.now() - start).toFixed(2);
  return verb === "select" || verb === "show"
    ? { verb, durationMs, rows: result.length, sql }
    : { verb, durationMs, affectedRows: result.affectedRows ?? 0, sql };
}

/** Execute a raw SQL string with positional `?` parameters against the Hawaii Housing database. */
async function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date | null)[] = [],
): Promise<T[]> {
  const start = performance.now();
  try {
    const result = await (getConnection() as any).unsafe(sql, params);
    log.debug(queryLog(sql, result, start), "hhdb query");
    return result;
  } catch (err) {
    if (isConnectionError(err)) {
      log.warn("HHDB connection lost, reconnecting and retrying query");
      resetConnection();
      const result = await (getConnection() as any).unsafe(sql, params);
      log.debug(queryLog(sql, result, start), "hhdb query (retry)");
      return result;
    }
    throw err;
  }
}

/**
 * Execute an INSERT statement and return LAST_INSERT_ID(), guaranteed to
 * run on the same connection so the ID is correct.
 *
 * Uses sequential queries instead of an explicit transaction because
 * LAST_INSERT_ID() is session-scoped in MySQL/MariaDB — it persists until
 * the next INSERT on the same connection, so a transaction isn't required.
 */
async function insertAndGetId(
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const start = performance.now();
  try {
    const conn = getConnection() as any;
    await conn.unsafe(sql, params);
    const rows = await conn.unsafe("SELECT LAST_INSERT_ID() as insertId");
    const id = Number(rows[0].insertId);
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, insertId: id }, sql);
    return id;
  } catch (err) {
    if (isConnectionError(err)) {
      log.warn("HHDB connection lost, reconnecting and retrying insert");
      resetConnection();
      const conn = getConnection() as any;
      await conn.unsafe(sql, params);
      const rows = await conn.unsafe("SELECT LAST_INSERT_ID() as insertId");
      const id = Number(rows[0].insertId);
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, insertId: id }, `${sql} (retry)`);
      return id;
    }
    throw err;
  }
}

export { rawQuery, insertAndGetId };
