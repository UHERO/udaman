import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/lib/prisma/schema.prisma",
  migrations: {
    path: "src/lib/prisma/migrations",
  },
  datasource: {
    url: env("DB_MYSQL_URL"),
  },
});
