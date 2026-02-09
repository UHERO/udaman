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

function mysql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]>;
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
function rawQuery<T = Record<string, unknown>>(sql: string, params: (string | number | Date)[] = []): Promise<T[]> {
  const start = performance.now();
  return (connection as any).unsafe(sql, params).then((result: any[]) => {
    const durationMs = +(performance.now() - start).toFixed(2);
    log.debug({ durationMs, rows: result.length }, "query");
    return result;
  });
}

export { mysql, rawQuery };
