import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma config for the UHERO catalog database (uhero_db). The hhdb
// database has its own config at src/lib/prisma/hhdb/prisma.config.ts.
//
// The datasource prefers DB_MYSQL_URL and otherwise assembles one from the
// DB_* variables src/lib/mysql/db.ts uses, so `prisma generate` (which never
// connects) still works in an environment with no database settings at all.
function urlFromParts(): string {
  const host = process.env.DB_HOST ?? "localhost";
  const port = process.env.DB_PORT ?? "3306";
  const database = process.env.DB_NAME ?? "uhero_db_dev";
  const user = encodeURIComponent(process.env.DB_USER ?? "root");
  const password = encodeURIComponent(process.env.DB_PSWD ?? "");
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: "src/lib/prisma/schema.prisma",
  migrations: {
    path: "src/lib/prisma/migrations",
  },
  datasource: {
    url: process.env.DB_MYSQL_URL ?? urlFromParts(),
  },
});
