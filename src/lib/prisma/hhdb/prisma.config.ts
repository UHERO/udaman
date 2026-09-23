import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma config for the Hawaii Housing Database (hhdb). Prisma 7 configs hold
// one schema, so every hhdb CLI command takes this file explicitly:
//
//   bunx prisma generate --config src/lib/prisma/hhdb/prisma.config.ts
//   bunx prisma db pull  --config src/lib/prisma/hhdb/prisma.config.ts
//
// The datasource is built from the same HH_DB_* variables src/lib/mysql/hhdb.ts
// uses, so the CLI and the app always point at the same server.
const host = process.env.HH_DB_HOST ?? "localhost";
const port = process.env.HH_DB_PORT ?? "3306";
const database = process.env.HH_DB_NAME ?? "hawaii_housing_database";
const user = encodeURIComponent(process.env.HH_DB_USER ?? "root");
const password = encodeURIComponent(process.env.HH_DB_PSWD ?? "");

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: `mysql://${user}:${password}@${host}:${port}/${database}`,
  },
});
