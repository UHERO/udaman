# Prisma integration: where it stands, and what it would take to use it fully

Exploratory survey, 2026-09-22. No code was changed. Everything below was
verified against the local MariaDB 10.11.13 copies of `uhero_db_dev` (fresh
prod backup, latest `app_logs` row 2026-09-19) and `hawaii_housing_database`
(known to lag the NAS copy).

## 1. What Prisma does for us today

**Schema + migration files only. The client is never instantiated.**

| Piece | State |
|---|---|
| `prisma.config.ts` | Prisma 7 config. Schema at `src/lib/prisma/schema.prisma`, migrations at `src/lib/prisma/migrations`, datasource from `DB_MYSQL_URL`. |
| `src/lib/prisma/schema.prisma` | 981 lines, 52 models + 15 enums. **Models the UHERO catalog DB only.** Nothing for hhdb. |
| `src/lib/prisma/migrations/` | `0_init` (introspected Rails baseline) + 22 dated migrations + two seed folders. **No `migration_lock.toml`.** |
| `@prisma/client` imports | 2 files, types only: `src/core/catalog/types/shared.ts` and `series-metadata.ts` import the generated row types (`series`, `xseries`, `data_points`, …). Zero `new PrismaClient(...)` anywhere. |
| Runtime DB access | `src/lib/mysql/db.ts` (Bun `SQL`, mysql adapter, pool of 20) for uhero_db, `src/lib/mysql/hhdb.ts` (Bun `SQL`, single lazy connection) for hhdb, plus `hhdb-local.ts` and `dvw-db.ts`. Auth.js uses a hand-written raw-SQL adapter in `src/lib/auth/mysql-adapter.ts`, not `@auth/prisma-adapter`. |
| hhdb schema management | Plain SQL: `src/lib/hhdb/hhdb-schema.sql` (full rebuild, DROPs everything), `hhdb-views.sql`, `hhdb-freq-tables.sql`, and 22 dated files in `src/lib/hhdb/migrations/` each applied by hand with `mariadb ... < file.sql`. No tracking table. |
| Generated client | `node_modules/.prisma/client` last generated 2026-08-26. It does know `approval_reviews`, `DataRegistry`, `series_dependencies`, so it is only slightly stale. |

Loose ends spotted along the way:

- `package.json` scripts `db:generate`, `db:push`, `db:studio` all pass
  `--schema src/core/database/prisma/schema.prisma`, a path that no longer
  exists. `prisma.config.ts` is what actually works; those three scripts fail.
- `@auth/prisma-adapter` and `@prisma/extension-accelerate` are dependencies
  with no importers.
- `src/core/database/README.md` says it plainly: "Prisma is used for db
  schema and migration management. Client is not used." That matches the code.

## 2. Can the Prisma client run against uhero_db_dev and hhdb?

**Yes for both, with two prerequisites. Neither is in place today.**

### Prerequisite A: a driver adapter (blocks *any* client use)

Prisma 7 removed the built-in Rust query engine from the client. The runtime
throws on construction unless you pass an adapter:

```
PrismaClient requires a driver adapter to connect to your database, but none
was provided. Pass one to the PrismaClient constructor, e.g.
`new PrismaClient({ adapter })`. Learn more: https://pris.ly/d/driver-adapters
```

(Text pulled from `node_modules/@prisma/client/runtime/client.js`.) The
official MySQL/MariaDB adapter is `@prisma/adapter-mariadb` (7.10.0 on the
registry, matching our `prisma`/`@prisma/client` 7.10.0). It wraps the
`mariadb` npm driver, so adopting the client means a **second connection
pool per database** alongside Bun's `SQL` pools. That is fine for a
worker/CLI, and something to size deliberately on the web process where
`db.ts` already comments on `max_connections = 151`.

### Prerequisite B: an hhdb schema (blocks hhdb use)

Prisma is one datasource per schema file. hhdb would need its own schema and
its own generated client. Introspecting the local copy works:

```
bunx prisma db pull --config <scratch config pointing at hawaii_housing_database>
✔ Introspected 52 models ... in 65ms
```

What came back (scratch file, not committed):

- 52 models, all 28 foreign keys mapped to `@relation`, 3 enums
  (`scrape_status.{scrape,parse,load}_status`), 1032 lines.
- Every table has a primary key, no generated columns, no partitions, no
  unsupported column types. Nothing was `@@ignore`d.
- 86 `BigInt` fields (all the `UNSIGNED BIGINT` ids) and 38 `Decimal` fields.
  In the client those surface as JS `bigint` and `Decimal.js` values, not
  numbers. The existing `hhdb-*.ts` models return plain numbers, so a
  client-based path would need conversions at the boundary.
- The two views (`v_condo_projects`, `v_properties_current`) were skipped.
  Introspecting views needs `previewFeatures = ["views"]`.
- One warning: 26 tables carry column/table comments, which Prisma "does not
  yet fully support" for *migrations*. Harmless for the client; it means a
  Prisma-generated migration would not carry comments through.
- `freq_*` tables are `utf8mb4_general_ci` while everything else is
  `utf8mb4_unicode_ci`. Prisma preserves that per-table, no problem.

Wiring it up would be a second schema (say `src/lib/hhdb/schema.prisma`)
with `generator client { output = "..." }` pointing at a distinct directory,
a second `prisma.config.ts` (Prisma 7 configs hold one schema; the CLI takes
`--config`), and two `bunx prisma generate --config ...` steps. Both clients
would then coexist as separate packages.

### Is it worth it?

Honest read: the app has a mature raw-SQL layer with HST timestamp handling,
heavy-lock reservations, read-only guards, and transaction helpers that all
live in `db.ts`. The Prisma client would sit beside that, not replace it.
The concrete win is typed queries for new code and for hhdb, where the
hand-maintained `src/core/catalog/types/hhdb.ts` types drift from the SQL.
The cost is a second driver, a second pool, and BigInt/Decimal friction.
Nothing here is a blocker; it is a choice about where new query code goes.

## 3. What it takes to use Prisma's migration runner going forward

Short version: **the existing migration history is already almost
replayable, the live DB is already almost in sync, and no destructive step
is required.** The work is bookkeeping, not schema surgery.

### 3a. How far is the live DB from `schema.prisma`?

`prisma migrate diff --from-config-datasource --to-schema ... --script`
against the fresh backup produced exactly this:

```sql
ALTER TABLE `approval_reviews` DROP FOREIGN KEY `fk_approval_reviews_approval`;
CREATE TABLE `public_sync_watermarks` (...);      -- migration 20260827140000
CREATE TABLE `series_dependencies` (...);         -- migration 20260903120000
ALTER TABLE `approval_reviews` ADD CONSTRAINT `fk_approval_reviews_approval`
  FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
```

So, three things, and one is an operational surprise:

1. **Two tables from August/September migrations are missing from the
   9/19 prod backup**: `public_sync_watermarks` and `series_dependencies`.
   Either they were never applied to prod or the backup predates it (the
   `app_logs` max timestamp says the backup is from 9/19, after both
   migrations). `series-collection.ts`, `loader-collection.ts`, and
   `data-point-collection.ts` all query `series_dependencies`. Worth
   confirming on the VPS before anything else.
2. `approval_reviews` FK: schema says `onUpdate: Cascade` (the Prisma
   default when unspecified), the migration and the live DB say
   `ON UPDATE RESTRICT`. One-word fix in the schema: add
   `onUpdate: Restrict` to that relation.
3. The reverse diff (schema → DB) adds one more item: five `Json` fields
   (`app_logs.metadata`, `approvals.form_data`, `oauth_clients.redirect_uris`
   / `grant_types` / `response_types`) show up as `longtext`. See 3c.

Views (`clipboards`, `portal_v`, `portal_all_v`, `series_v`, `series_all_v`)
and the Rails leftovers (`schema_migrations`, `ar_internal_metadata`) are
invisible to the diff because they are either ignored (views, no preview
flag) or already modeled in the schema. They do not count as drift.

### 3b. Does the migration folder replay from empty?

Tested by copying the folder to scratch, adding a `migration_lock.toml`, and
running `migrate diff --from-migrations` with a throwaway shadow DB (created
and dropped locally during this survey). Result:

- **`migration_lock.toml` is missing.** Prisma refuses `--from-migrations`
  and `migrate dev` without it. Three lines, `provider = "mysql"`.
- **The two seed folders break `migrate deploy`.** `data-registry-seed/`
  and `factbook-seed/` contain `seed.ts`/`seed.sql` but no `migration.sql`.
  Prisma treats every subdirectory as a migration and fails with P3015
  ("Could not find the migration file at migration.sql"). They need to move
  out of the migrations folder, e.g. to `src/lib/prisma/seeds/`. Nothing in
  `package.json`, `docs/`, or `src/` references their current path.
- **One migration hard-fails on a fresh DB.**
  `20260413000000_create_timeline_events` opens with
  `DROP TABLE timeline_events;` (no `IF EXISTS`). It only ever worked because
  the table already existed when it was written. Every other DROP in the
  history uses `IF EXISTS`, including the `data_lists_series_clean` drop,
  which is preceded by its own CREATE.
- With those three fixed, **all 22 migrations replay cleanly on top of
  `0_init`**, including the data-bearing ones (`seed_hhf_series`, the
  role_permissions seeds, the `mcp-only` ENUM widen). The replayed shape
  differs from `schema.prisma` only by the FK rule in 3a(2) and the JSON
  columns in 3c.

Prisma checksums migration files, so the `IF EXISTS` edit changes that
migration's checksum. That is fine as long as the baseline step (3d) is run
*after* the edit, since `migrate resolve --applied` records the checksum of
the file as it is at that moment.

### 3c. The MariaDB JSON wrinkle (permanent, cosmetic, decide once)

MariaDB has no native JSON type. `JSON` in DDL becomes
`longtext ... CHECK (json_valid(col))`. Prisma's MySQL connector introspects
that as `longtext`, so a `Json` field in the schema is reported as drift in
the schema → DB direction forever, and `migrate dev` would propose
`MODIFY metadata JSON` on every run. It never actually changes anything
(MariaDB accepts the statement and stores longtext again).

Options, cheapest first:

- Change the five fields to `String @db.LongText` in the schema. The client
  is not used, so nothing loses `Json` typing today. The `json_valid` CHECK
  constraints stay on the tables regardless. This makes the diff clean.
- Keep `Json` and accept a permanent no-op diff. Fine if you only ever run
  `migrate deploy` (which does no drift check) and write migrations by hand.
- Wait for Prisma's MariaDB-aware introspection. Not on any roadmap I can
  point to.

### 3d. The actual cutover, per database

Nothing here drops or rewrites a table. The only writes are to a new
`_prisma_migrations` table.

1. Repo prep (one PR):
   - add `src/lib/prisma/migrations/migration_lock.toml`;
   - move `data-registry-seed/` and `factbook-seed/` out of the migrations
     folder and wire `migrations.seed` in `prisma.config.ts` if you want
     `prisma db seed` to run them;
   - `DROP TABLE IF EXISTS` in the timeline_events migration;
   - `onUpdate: Restrict` on `approval_reviews.approval`;
   - pick a JSON option from 3c;
   - fix or delete the three dead `db:*` scripts in `package.json`;
   - optionally drop `@auth/prisma-adapter` and
     `@prisma/extension-accelerate`.
2. Baseline each live DB (local first, then prod). For every migration
   directory whose DDL is already present, mark it applied without running
   it:
   ```bash
   for m in $(ls src/lib/prisma/migrations | grep -v migration_lock); do
     bunx prisma migrate resolve --applied "$m"
   done
   ```
   That creates `_prisma_migrations` and writes 23 rows with checksums. It
   never executes SQL from the files. On prod, the two missing tables from
   3a(1) are the exception: leave those two out of the loop and let step 3
   create them, *after* confirming on the VPS that they really are absent.
3. `bunx prisma migrate status` should report "Database schema is up to
   date" (or exactly two pending). Then `bunx prisma migrate deploy` applies
   whatever is pending, in order, recording each.
4. Going forward, each schema change is: edit `schema.prisma`, generate the
   SQL with `migrate diff --from-config-datasource --to-schema ... --script`
   (or `migrate dev --create-only` against a *local copy*), review the
   file, commit, `migrate deploy` on each environment. `migrate deploy` has
   no drift detection and no shadow DB, so it is the right tool for the VPS.

Things to never run against a real DB: `migrate dev` (it may offer to reset,
and reset drops the whole database) and `migrate reset`. `db push` is safe
only in the sense that it prompts before data loss; it still bypasses the
migration history.

### 3e. hhdb under the same regime

hhdb has no Prisma history at all, so the path is different and shorter:

1. `prisma db pull` into `src/lib/hhdb/schema.prisma` (what the scratch run
   did), then `migrate diff --from-empty --to-schema ... --script` becomes
   `0_init/migration.sql` for a second migrations folder.
2. Baseline with `migrate resolve --applied 0_init` on the NAS instance and
   on the local copy.
3. The 22 hand-applied SQL files in `src/lib/hhdb/migrations/` stay as
   history; they are already folded into whatever `db pull` sees. Only new
   changes become Prisma migrations.

Two hhdb-specific cautions. The local copy lags the NAS (it still has
`accessory_structures`, dropped by the 2026-08-14 migration), so the
`0_init` baseline must be pulled from the NAS, not from local. And
`hhdb-schema.sql` / `hhdb-freq-tables.sql` are full-rebuild scripts that
DROP and recreate tables; once Prisma owns the history they become
dangerous to source wholesale, so they would need to be retired or
scoped to the rebuild database only.

## 4. Summary of decisions to make

| Decision | Default I'd suggest |
|---|---|
| Adopt the client at all? | Optional. Raw SQL layer is solid; the client mainly buys typed queries for new code and hhdb. Needs `@prisma/adapter-mariadb` either way. |
| JSON fields | `String @db.LongText`, since the client is unused. |
| Seed folders | Move to `src/lib/prisma/seeds/`. |
| Baseline uhero_db | `migrate resolve --applied` for every migration; verify the two 8/27 and 9/3 tables on prod first. |
| Baseline hhdb | `db pull` from the NAS, `0_init`, resolve as applied. |
| Runner on prod | `migrate deploy` only. Never `migrate dev`/`reset` there. |

## 5. Implemented 2026-09-22: clients for both databases

Done in the working tree (not committed):

- `@prisma/adapter-mariadb@7.10.0` added. Prisma 7 refuses to construct a
  client without a driver adapter.
- uhero schema switched from `prisma-client-js` to `prisma-client` with
  `output = "../../generated/prisma-uhero"`. The two files that imported row
  types from `@prisma/client` now import from
  `@/generated/prisma-uhero/client`.
- hhdb gets its own Prisma setup under `src/lib/prisma/hhdb/`: a
  `prisma.config.ts` that builds the datasource URL from the same `HH_DB_*`
  variables the app uses, a `schema.prisma` introspected from the NAS
  (54 models, 28 relations, 3 enums), and an empty migrations folder with a
  lock file. The `src/lib/hhdb/migrations/` folder of hand SQL is untouched
  and deliberately not Prisma's migrations path (Prisma would choke on
  non-`migration.sql` files there).
- Two lazy singleton modules, `src/lib/prisma/uhero-client.ts` and
  `src/lib/prisma/hhdb-client.ts`, each with its own small pool and the
  same `UDAMAN_READ_ONLY` write guard `db.ts` enforces.
- `bun run db:generate` regenerates both; it runs on `postinstall`, so a
  fresh `bun install` produces `src/generated/` (gitignored, eslint- and
  prettier-ignored). `bun run db:pull:hhdb` re-introspects the NAS.
- Root `prisma.config.ts` no longer throws when `DB_MYSQL_URL` is unset; it
  falls back to the `DB_*` parts, so `prisma generate` works anywhere.

Smoke-tested against the local copies: `universe.findMany`, `series.count`,
`app_logs.findFirst`, `properties.count`, `tg_transactions.findFirst`,
`parcels.findFirst` all return correct rows. `tsc --noEmit` and eslint are
clean.

### Things learned along the way

- **The NAS view `v_properties_current` is a stand-in, not a view.** Its
  definition is `SELECT 1 AS tmk, 1 AS island_code, ...` (every column an
  int constant). That is the placeholder `mysqldump` emits before the real
  `CREATE VIEW`, so a restore was interrupted or the real definition failed
  to apply. Nothing in `src/` queries it, but anyone using it by hand gets
  rows of 1s. The real definition is in `src/lib/hhdb/hhdb-views.sql`.
  `v_condo_projects` exists locally but not on the NAS. Because the
  introspected block was garbage, the hhdb schema has no `view` blocks and
  the `views` preview flag is off; turn it back on after the NAS view is
  recreated.
- **Stored procedures are invisible to Prisma.** `sp_regenerate_freq_tables`
  stays a hand-managed SQL object; call it with `$executeRaw` if needed.
- **DateTime semantics match the HST convention.** For a stored
  `2026-09-22 15:38:12`, Prisma returns a Date whose UTC fields are
  `15:38:12`. On this HST-zoned Mac, Bun SQL returned the same row as
  `01:38:12Z` (it applied the machine time zone), 10 hours apart from
  Prisma. The `@catalog/utils/time` doc describes the Prisma behaviour as
  the norm; worth checking which one production's Bun SQL actually does,
  since the server's TZ decides.
- `BigInt` shows up more than expected on the uhero side too:
  `app_logs.id` is a `bigint` in the client.
