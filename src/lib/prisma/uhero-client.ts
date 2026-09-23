import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma-uhero/client";

/**
 * Prisma client for the UHERO catalog database (uhero_db).
 *
 * This sits beside, not in place of, the raw-SQL layer in
 * src/lib/mysql/db.ts. Existing queries stay on `mysql\`...\``; reach for
 * this when a new feature wants typed model access. Both share the same
 * DB_* environment, so they always point at the same server.
 *
 * Connections: Prisma 7 needs a driver adapter, and the MariaDB adapter
 * owns its own pool (separate from Bun SQL's). It is created lazily on
 * first use and sized small by default (PRISMA_POOL_MAX, default 5) —
 * MariaDB max_connections is 151 and the Bun pools already take 20 each
 * on web + worker.
 *
 * Timestamps: DATETIME columns hold Hawaii wall-clock (see the HST
 * convention in @catalog/utils/time). Prisma anchors what it reads as
 * UTC, exactly like Bun SQL does, so a `DateTime` field's *UTC* fields
 * are the Hawaii wall-clock. Display through formatHst, convert with
 * hstToInstant, and never write `new Date()` straight into a DATETIME
 * field — it lands 10h ahead of NOW().
 *
 * UDAMAN_READ_ONLY blocks write operations here the same way db.ts blocks
 * write statements.
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
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PSWD ?? "",
    database: process.env.DB_NAME ?? "uhero_db_dev",
    connectionLimit: Number(process.env.PRISMA_POOL_MAX ?? 5),
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

export type UheroPrisma = ReturnType<typeof createClient>;

let _client: UheroPrisma | null = null;

/** Lazily-created singleton. Nothing connects until the first query. */
export function getUheroPrisma(): UheroPrisma {
  if (!_client) _client = createClient();
  return _client;
}

/** Close the pool. Call at the end of CLI runs; the web app never needs to. */
export async function disconnectUheroPrisma(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}
