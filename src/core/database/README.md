# Database

## Mariadb / MYSQL

Primary database is a MariaDB 10.11 instance (`uhero_db`). The Hawaii Housing
Database (`hawaii_housing_database`, "hhdb") is a second MariaDB instance on
the NAS.

## Prisma

Prisma is used for schema files, migrations, and (since 2026-09-22) optional
typed clients. Most queries are still raw SQL through `src/lib/mysql/`.

| | uhero_db | hhdb |
|---|---|---|
| Schema | `src/lib/prisma/schema.prisma` | `src/lib/prisma/hhdb/schema.prisma` (introspected from the NAS) |
| Config | `prisma.config.ts` (root) | `src/lib/prisma/hhdb/prisma.config.ts` (pass with `--config`) |
| Migrations | `src/lib/prisma/migrations/` | `src/lib/prisma/hhdb/migrations/` (empty, lock file only) |
| Generated client | `src/generated/prisma-uhero/` | `src/generated/prisma-hhdb/` |
| App module | `src/lib/prisma/uhero-client.ts` → `getUheroPrisma()` | `src/lib/prisma/hhdb-client.ts` → `getHhdbPrisma()` |

Generated code is gitignored and rebuilt by `bun run db:generate`, which also
runs on `postinstall`. `bun run db:pull:hhdb` re-introspects the NAS after a
hand-applied hhdb migration.

Prisma 7 needs a driver adapter; both clients use `@prisma/adapter-mariadb`
with their own small pool (`PRISMA_POOL_MAX`, `PRISMA_HHDB_POOL_MAX`). They are
lazy singletons, so importing a client module opens nothing.

DATETIME values come back with their UTC fields equal to the Hawaii
wall-clock, the same convention documented in `@catalog/utils/time`.

See `docs/2026-09-22-prisma-integration.md` for the migration-runner
baseline plan.
