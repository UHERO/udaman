import { SQL } from "bun";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("database");

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
  ...values: any[]
): Promise<T[]>;
function mysql(value: any, ...keys: string[]): any;
function mysql(...args: any[]) {
  const [first] = args;

  // Fragment helper: mysql([1, 2, 3]) or mysql(obj, "col1", "col2")
  if (!first?.raw) {
    return (connection as any)(...args);
  }

  // Tagged template: mysql`SELECT ...`
  const strings = first as TemplateStringsArray;
  const values = args.slice(1);
  const start = performance.now();
  return (connection(strings, ...values) as Promise<any[]>).then((result) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "query");
    return result;
  });
}

/** Execute a raw SQL string with positional `?` parameters (for dynamic queries). */
function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date)[] = [],
): Promise<T[]> {
  const start = performance.now();
  return (connection as any).unsafe(sql, params).then((result: any[]) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "query");
    return result;
  });
}

/** Run a callback inside a database transaction (uses Bun SQL's `sql.begin`).
 *  The transaction is committed if the callback resolves, rolled back if it throws. */
async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  // Bun SQL's .begin() provides a scoped transaction that auto-commits/rollbacks
  const [result] = await connection.begin(async () => {
    const value = await fn();
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
    exec: (sql: string, params?: (string | number | Date)[]) => Promise<any[]>,
  ) => Promise<T>,
): Promise<T> {
  const start = performance.now();
  const [result] = await connection.begin(async (tx: any) => {
    const exec = (sql: string, params: (string | number | Date)[] = []) => {
      const qStart = performance.now();
      return tx.unsafe(sql, params).then((rows: any[]) => {
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

export { mysql, rawQuery, transaction, scopedConnection };
