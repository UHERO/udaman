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

/** Execute a raw SQL string with positional `?` parameters against the Hawaii Housing database. */
async function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date | null)[] = [],
): Promise<T[]> {
  const start = performance.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (getConnection() as any).unsafe(sql, params);
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "hhdb query");
    return result;
  } catch (err) {
    if (isConnectionError(err)) {
      log.warn("HHDB connection lost, reconnecting and retrying query");
      resetConnection();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (getConnection() as any).unsafe(sql, params);
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, rows: result.length }, "hhdb query (retry)");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = getConnection() as any;
    await conn.unsafe(sql, params);
    const rows: { insertId: number }[] = await conn.unsafe(
      "SELECT LAST_INSERT_ID() as insertId",
    );
    const id = Number(rows[0].insertId);
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, insertId: id }, sql);
    return id;
  } catch (err) {
    if (isConnectionError(err)) {
      log.warn("HHDB connection lost, reconnecting and retrying insert");
      resetConnection();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conn = getConnection() as any;
      await conn.unsafe(sql, params);
      const rows: { insertId: number }[] = await conn.unsafe(
        "SELECT LAST_INSERT_ID() as insertId",
      );
      const id = Number(rows[0].insertId);
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, insertId: id }, `${sql} (retry)`);
      return id;
    }
    throw err;
  }
}

export { rawQuery, insertAndGetId };
