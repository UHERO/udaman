import { SQL } from "bun";

let _connection: SQL | null = null;

function createConnection(): SQL {
  return new SQL({
    adapter: "mysql",
    hostname: process.env.HH_LOCAL_DB_HOST ?? "localhost",
    port: process.env.HH_LOCAL_DB_PORT ?? 3306,
    database: process.env.HH_LOCAL_DB_NAME ?? "hawaii_housing_rebuild",
    username: process.env.HH_LOCAL_DB_USER ?? "root",
    password: process.env.HH_LOCAL_DB_PSWD ?? "",
  });
}

function getConnection(): SQL {
  if (!_connection) {
    _connection = createConnection();
  }
  return _connection;
}

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

/** Execute a raw SQL string with positional `?` parameters against the local rebuild database. */
async function localRawQuery<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | Date | null)[] = [],
): Promise<T[]> {
  try {
    return await (getConnection() as any).unsafe(sql, params);
  } catch (err) {
    if (isConnectionError(err)) {
      resetConnection();
      return await (getConnection() as any).unsafe(sql, params);
    }
    throw err;
  }
}

/**
 * Execute an INSERT statement and return LAST_INSERT_ID(), guaranteed to
 * run on the same connection so the ID is correct.
 */
async function localInsertAndGetId(
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  try {
    const conn = getConnection() as any;
    await conn.unsafe(sql, params);
    const rows = await conn.unsafe("SELECT LAST_INSERT_ID() as insertId");
    return Number(rows[0].insertId);
  } catch (err) {
    if (isConnectionError(err)) {
      resetConnection();
      const conn = getConnection() as any;
      await conn.unsafe(sql, params);
      const rows = await conn.unsafe("SELECT LAST_INSERT_ID() as insertId");
      return Number(rows[0].insertId);
    }
    throw err;
  }
}

/** Close the local connection (call after rebuild is complete). */
function closeLocalConnection(): void {
  if (_connection) {
    _connection.close();
    _connection = null;
  }
}

export { localRawQuery, localInsertAndGetId, closeLocalConnection };
