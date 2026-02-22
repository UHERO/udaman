import "server-only";

import { SQL } from "bun";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("database.dvw");

const READ_ONLY = process.env.UDAMAN_READ_ONLY === "true";
const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REPLACE|SET)\b/i;

function assertNotReadOnly(sql: string): void {
  if (READ_ONLY && WRITE_PATTERN.test(sql)) {
    throw new Error(
      "UDAMAN_READ_ONLY is enabled — write operations are blocked",
    );
  }
}

let _connection: SQL | null = null;

function getConnection(): SQL {
  if (!_connection) {
    _connection = new SQL({
      adapter: "mysql",
      hostname: process.env.DVW_DB_HOST ?? process.env.DB_HOST ?? "localhost",
      port: process.env.DVW_DB_PORT ?? process.env.DB_PORT ?? 3306,
      database: process.env.DVW_DB_NAME ?? "dbedt_visitor_dw",
      username: process.env.DVW_DB_USER ?? process.env.DB_USER ?? "root",
      password: process.env.DVW_DB_PSWD ?? process.env.DB_PSWD ?? "",
    });
  }
  return _connection;
}

/** Execute a raw SQL string with positional `?` parameters against the DVW database. */
function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date | null)[] = [],
): Promise<T[]> {
  assertNotReadOnly(sql);
  const start = performance.now();
  return (getConnection() as any).unsafe(sql, params).then((result: any[]) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "dvw query");
    return result;
  });
}

export { rawQuery };
