import { SQL } from "bun";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("database");

const READ_ONLY = process.env.UDAMAN_READ_ONLY === "true";
const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REPLACE)\b/i;

function assertNotReadOnly(sql: string): void {
  if (READ_ONLY && WRITE_PATTERN.test(sql)) {
    throw new Error(
      "UDAMAN_READ_ONLY is enabled — write operations are blocked",
    );
  }
}

const connection = new SQL({
  adapter: "mysql",
  hostname: process.env.DB_HOST ?? "localhost",
  port: process.env.DB_PORT ?? 3306,
  database: process.env.DB_NAME ?? "uhero_db_dev",
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PSWD ?? "",
});

function mysql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]>;
function mysql(value: unknown, ...keys: string[]): unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mysql(...args: unknown[]) {
  const [first] = args;

  // Fragment helper: mysql([1, 2, 3]) or mysql(obj, "col1", "col2")
  if (!(first as TemplateStringsArray)?.raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (connection as any)(...args);
  }

  // Tagged template: mysql`SELECT ...`
  const strings = first as TemplateStringsArray;
  const values = args.slice(1);
  const query = strings.join("?");
  assertNotReadOnly(query);
  const start = performance.now();
  return (connection(strings, ...values) as Promise<unknown[]>).then(
    (result) => {
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, rows: result.length }, query);
      return result;
    },
  );
}

/** Execute a raw SQL string with positional `?` parameters (for dynamic queries). */
function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date)[] = [],
): Promise<T[]> {
  assertNotReadOnly(sql);
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (connection as any).unsafe(sql, params).then((result: T[]) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, sql);
    return result;
  });
}

/**
 * Query executor bound to a single transaction connection. Supports the same
 * tagged-template form as `mysql\`...\`` plus `.unsafe(sql, params)`.
 */
export type TxExecutor = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  unsafe<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTxExecutor(tx: any): TxExecutor {
  const exec = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    assertNotReadOnly(query);
    const start = performance.now();
    return (tx(strings, ...values) as Promise<unknown[]>).then((result) => {
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, rows: result.length }, query);
      return result;
    });
  }) as TxExecutor;
  exec.unsafe = (sql: string, params: unknown[] = []) => {
    assertNotReadOnly(sql);
    const start = performance.now();
    return tx.unsafe(sql, params).then((result: unknown[]) => {
      const durationMs = +(performance.now() - start).toFixed(2);
      log.debug({ durationMs, rows: result.length }, sql);
      return result;
    });
  };
  return exec;
}

/**
 * Run a callback inside a database transaction (uses Bun SQL's `sql.begin`).
 * The transaction is committed if the callback resolves, rolled back if it throws.
 *
 * The callback receives a `TxExecutor` bound to the transaction's connection.
 * Queries issued through the module-level `mysql`/`rawQuery` inside the
 * callback go through the pool and are NOT part of the transaction — use
 * the provided executor for anything that must commit/rollback atomically.
 */
async function transaction<T>(fn: (tx: TxExecutor) => Promise<T>): Promise<T> {
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await connection.begin(async (tx: any) => {
    const value = await fn(makeTxExecutor(tx));
    return [value];
  });
  const durationMs = +(performance.now() - start).toFixed(2);
  log.debug({ durationMs }, "transaction");
  return result as T;
}

/**
 * Run a callback with a transaction-scoped raw SQL executor.
 * All queries share the same underlying connection, so temporary tables
 * created inside the callback are visible to subsequent queries.
 */
async function scopedConnection<T>(
  fn: (
    exec: (
      sql: string,
      params?: (string | number | Date)[],
    ) => Promise<Record<string, unknown>[]>,
  ) => Promise<T>,
): Promise<T> {
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await connection.begin(async (tx: any) => {
    const exec = (sql: string, params: (string | number | Date)[] = []) => {
      const qStart = performance.now();
      return tx.unsafe(sql, params).then((rows: Record<string, unknown>[]) => {
        const durationMs = +(performance.now() - qStart).toFixed(2);
        log.debug({ durationMs, rows: rows.length }, "scoped query");
        return rows;
      });
    };
    const value = await fn(exec);
    return [value];
  });
  const durationMs = +(performance.now() - start).toFixed(2);
  log.debug({ durationMs }, "scoped connection");
  return result as T;
}

/**
 * Execute an INSERT statement and return LAST_INSERT_ID(), guaranteed to
 * run on the same pooled connection so the ID is correct.
 */
async function insertAndGetId(
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  assertNotReadOnly(sql);
  const start = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await connection.begin(async (tx: any) => {
    await tx.unsafe(sql, params);
    const rows: { insertId: number }[] = await tx.unsafe(
      "SELECT LAST_INSERT_ID() as insertId",
    );
    return [rows[0].insertId];
  });
  const durationMs = +(performance.now() - start).toFixed(2);
  log.debug({ durationMs }, sql);
  return result as number;
}

/**
 * Pull a dedicated connection out of the pool. The caller MUST call
 * `.release()` when done. Used for session-scoped state (GET_LOCK, SET
 * session variables) that must live on one connection.
 */
function reserveConnection() {
  return connection.reserve();
}

export {
  mysql,
  rawQuery,
  transaction,
  scopedConnection,
  insertAndGetId,
  reserveConnection,
};
