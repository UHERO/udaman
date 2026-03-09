import { SQL } from "bun";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("database.hhdb");

let _connection: SQL | null = null;

function getConnection(): SQL {
  if (!_connection) {
    _connection = new SQL({
      adapter: "mysql",
      hostname: process.env.HH_DB_HOST ?? "localhost",
      port: process.env.HH_DB_PORT ?? 3306,
      database: process.env.HH_DB_NAME ?? "hawaii_housing_database",
      username: process.env.HH_DB_USER ?? "root",
      password: process.env.HH_DB_PSWD ?? "",
    });
  }
  return _connection;
}

/** Execute a raw SQL string with positional `?` parameters against the Hawaii Housing database. */
function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date | null)[] = [],
): Promise<T[]> {
  const start = performance.now();
  return (getConnection() as any).unsafe(sql, params).then((result: any[]) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "hhdb query");
    return result;
  });
}

export { rawQuery };
