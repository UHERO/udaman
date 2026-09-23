import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma-hhdb/client";

/**
 * Prisma client for the Hawaii Housing Database (hhdb) on the NAS.
 *
 * Schema: src/lib/prisma/hhdb/schema.prisma, introspected from the NAS
 * with `bunx prisma db pull --config src/lib/prisma/hhdb/prisma.config.ts`.
 * Model and field names are the database's own: snake_case everywhere
 * except tg_transactions, whose columns are camelCase because the Title
 * Guaranty feed is. The freq_* tables are one model each.
 *
 * This sits beside the raw-SQL helpers in src/lib/mysql/hhdb.ts and uses
 * the same HH_DB_* environment. Same lazy pool and read-only rules as
 * uhero-client.ts; the pool is smaller still (PRISMA_HHDB_POOL_MAX,
 * default 3) because the NAS instance is shared with the scrapers.
 *
 * Types worth knowing: UNSIGNED BIGINT ids and amounts come back as JS
 * `bigint`, DECIMAL columns as Prisma `Decimal`. The hand-written models
 * in src/core/catalog/models/hhdb-*.ts return plain numbers, so convert
 * at the boundary when mixing the two.
 */

const READ_ONLY = process.env.UDAMAN_READ_ONLY === "true";
const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

function createClient() {
  const adapter = new PrismaMariaDb({
    host: process.env.HH_DB_HOST ?? "localhost",
    port: Number(process.env.HH_DB_PORT ?? 3306),
    user: process.env.HH_DB_USER ?? "root",
    password: process.env.HH_DB_PSWD ?? "",
    database: process.env.HH_DB_NAME ?? "hawaii_housing_database",
    connectionLimit: Number(process.env.PRISMA_HHDB_POOL_MAX ?? 3),
  });
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        $allOperations({ operation, query, args }) {
          if (READ_ONLY && WRITE_OPERATIONS.has(operation)) {
            throw new Error(
              "UDAMAN_READ_ONLY is enabled — write operations are blocked",
            );
          }
          return query(args);
        },
      },
    },
  });
}

export type HhdbPrisma = ReturnType<typeof createClient>;

let _client: HhdbPrisma | null = null;

/** Lazily-created singleton. Nothing connects until the first query. */
export function getHhdbPrisma(): HhdbPrisma {
  if (!_client) _client = createClient();
  return _client;
}

/** Close the pool. Call at the end of CLI runs; the web app never needs to. */
export async function disconnectHhdbPrisma(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}
