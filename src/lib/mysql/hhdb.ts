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

/**
 * Execute an INSERT statement and return LAST_INSERT_ID(), guaranteed to
 * run on the same pooled connection so the ID is correct.
 */
async function insertAndGetId(
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const start = performance.now();
  const connection = getConnection();
  const [result] = await connection.begin(async (tx: any) => {
    await tx.unsafe(sql, params);
    const rows = await tx.unsafe("SELECT LAST_INSERT_ID() as insertId");
    return [rows[0].insertId as number];
  });
  const durationMs = +(performance.now() - start).toFixed(2);
  log.debug({ durationMs }, sql);
  return result as number;
}

export { rawQuery, insertAndGetId };
