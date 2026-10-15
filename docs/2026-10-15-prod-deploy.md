# Prod deploy runbook — week of 2026-10-06 → 2026-10-15

Covers what changed this week:

- ingest framework: downloaders/extractors, `load_from_extract`, Ingest UI
- DOTAX and DATABOOK universes
- FRED, BEA, EIA and e-Stat sources
- universe privacy
- approvals review-by date
- `APP_ENV`
- package updates

Nothing below has been run against prod. Steps marked **check** are
questions only the server can answer.

## 0. Before you start (local)

1. **Commit everything.** The working tree has uncommitted work from several
   sessions:
   - the databook port
   - `app-env.ts`
   - the fred/bea/eia/estatjp sources and their migrations
   - the Prisma seed-folder move
   - `migration_lock.toml`
   - `bun.lock`: it dropped prettier and added `cron-parser`, matching
     `package.json`

   Then run:

   ```bash
   bun install
   bun run check-types && bun run lint
   find src -name "*.test.ts" -o -name "*.test.tsx" | grep -v migrate-interpolate-to-disaggregate | xargs bun test
   bun run build
   ```

   Expect 2 test failures, the existing hicentral MLS ones. Plain `bun test`
   exits early, because one test imports a script that calls
   `process.exit`.

2. **Copy the DATABOOK manifest.** It is `data-dir/databook/manifest/` (22 MB,
   not in git), and it freezes the DATABOOK series names. Copy it to the
   server's `DATA_DIR/databook/manifest/`. Without it, prod still builds,
   but the names are assigned fresh and won't match local.

## 1. Window and backup

- **Pick a quiet window** (see `2026-08-27-heavy-job-deploy.md` §1 for the
  cron times to avoid). The DATABOOK extraction peaks at about 1.8 GB, and
  the host has 7.6 GB with a MariaDB OOM history, so don't run it beside a
  DVW upload or a public sweep.
- **Back up uhero_db**, at least `data_sources`, `series`, `measurements`,
  `universe`, `downloads` and `role_permissions`. Better, take a full dump.

## 2. Check prod state (SQL, read-only)

```sql
-- Prisma runner baselined? (if this table is missing, apply migrations by hand, §4A)
SHOW TABLES LIKE '_prisma_migrations';
-- The 9/19 prod backup lacked these two (8/27, 9/3 migrations):
SHOW TABLES LIKE 'public_sync_watermarks';
SHOW TABLES LIKE 'series_dependencies';
-- This week's schema, presumably absent:
SHOW COLUMNS FROM approvals LIKE 'review_by_date';
SHOW COLUMNS FROM universe LIKE 'internal_only';
SHOW TABLES LIKE 'data_downloaders';
-- The staging Downloaders migration (20261013000000_create_downloaders) was
-- committed on 10/14 and later deleted. If prod ever ran it, clean up (§4C):
SHOW TABLES LIKE 'downloaders';
SHOW COLUMNS FROM downloads LIKE 'downloader_id';
```

## 3. Environment (`.env.prod` on the server, read by BOTH web and worker units)

| Variable                                                                            | Action                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV=production`                                                                | **Required.** A production build without it throws at startup (`src/lib/app-env.ts`). It also replaces `NEXT_PUBLIC_APP_ENV` as the cron gate, which no code reads any more. Staging gets `APP_ENV=staging`. See the note below.                                                                                                                                   |
| `API_KEY_BEA`, `API_KEY_FRED`, `API_KEY_EIA`, `API_KEY_ESTATJP`, `API_KEY_1_BLS_V2` | Already in your local `.env.prod`; confirm they are on the server.                                                                                                                                                                                                                                                                                                 |
| `GOOGLE_SHEETS_REFRESH_TOKEN`                                                       | **New, needed for `dotax_sheet`.** The client id/secret fall back to `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, which prod already has. Copy the token from `.env.local` if it was minted with the same OAuth client. Otherwise run `bun run ingest google-auth` on the server. Without it, the sheet fetch fails and 18 DOTAX series miss their preliminary months. |
| `DATA_DIR`                                                                          | Unchanged. The new `DATA_DIR/ingest/` needs about 0.5–1 GB (raw files plus extract history: databook 250 MB raw, DOTAX archive 30 MB). Web and worker must see the same `DATA_DIR`.                                                                                                                                                                                |

**Turning on crons.** Your local `.env.prod` copy has
`NEXT_PUBLIC_APP_ENV='local'`. If the server's file says the same, prod's
crons have not been firing. Setting `APP_ENV=production` turns all of them
on at the next worker start: nightly reloads, sweeps, BEA/BLS, and the ingest
schedules. Confirm which state is intended before restarting.

## 4. Code + migrations

```bash
git pull
bun install
bun run build
```

### 4A. Migrations, by hand (if `_prisma_migrations` doesn't exist)

Apply in this order. Run any earlier one that §2 showed missing first
(`20260827140000_public_sync_watermarks`, `20260903120000_series_dependencies`).

```bash
cd src/lib/prisma/migrations
for m in \
  20261006000000_approvals_review_by_date \
  20261008000000_approval_reviews_drop_not_started \
  20261013120000_universe_internal_only \
  20261014000000_create_data_ingest \
  20261014120000_seed_data_ingest \
  20261015000000_seed_databook_ingest \
  20261015120000_seed_fred_ingest \
  20261015130000_seed_api_ingest
do mysql --defaults-extra-file=~/.my.cnf uhero_db < "$m/migration.sql"; done
```

- The seeds are idempotent (`INSERT IGNORE`). The DDL ones are not, so don't
  rerun them.
- `seed_data_ingest` also adds the `ingest` permission rows (dev and admin
  only) that the sidebar needs.

### 4B. Or baseline Prisma first

This is the `docs/2026-09-22-prisma-integration.md` §3d path. The repo prep
is done in the working tree: seeds moved out, `migration_lock.toml`,
`DROP TABLE IF EXISTS`.

1. Mark every migration prod already has as applied:
   `bunx prisma migrate resolve --applied <name>`.
2. Then run `bunx prisma migrate deploy`, which applies the rest in order.

Never run `migrate dev` or `migrate reset` on prod.

### 4C. Only if §2 found the staging Downloaders tables

```sql
DELETE l FROM dsd_log_entries l JOIN downloads d ON d.id = l.download_id WHERE d.downloader_id IS NOT NULL;
DELETE FROM downloads WHERE downloader_id IS NOT NULL;
ALTER TABLE downloads DROP COLUMN downloader_id, DROP COLUMN downloader_role, DROP COLUMN historical;
DROP TABLE downloaders;
DELETE FROM role_permissions WHERE resource = 'downloader';
```

- Check the `dsd_log_entries` join column against prod's schema before
  running.
- This undoes the staging migration. The files it wrote to
  `DATA_DIR/rawdata` and `DATA_DIR/downloaders` can be moved aside.

## 5. Restart

```bash
sudo systemctl restart udaman udaman-worker
```

- The worker log should show `Registered ingest schedules: …` (production
  only).
- Check `/udaman/uhero/ingest`: the 9 downloaders, with Next runs.

## 6. First ingest runs (on the server, as `uhero`, env loaded)

Each `fetch` extracts its extractors when it stores something new.

```bash
bun run ingest fetch dotax_current     # ~82 xlsx, 1 s apart
bun run ingest fetch dotax_archive     # ~283 zips, ~5–10 min
bun run ingest fetch dotax_sheet       # needs the Google token (§3)
bun run ingest fetch databook          # 576 workbooks, ~6 min; extract ~30 s, ~1.8 GB peak
bun run ingest runs dotax && bun run ingest runs databook   # expect "ok"
```

- BLS, FRED, BEA, EIA and e-Stat have nothing to fetch yet. Their fetch
  lists come from `load_from_extract` load statements, and prod has none.
- They will run on schedule and record empty runs, which is harmless.

## 7. Universes

### DOTAX (new on prod)

```bash
bun run scripts/create-dotax-universe.ts --dry-run   # expect: 260 measurements, 1,094 monthly series (+ sheet loaders if dotax_sheet ran)
bun run scripts/create-dotax-universe.ts
```

- **Universe row:** set `data_portal_url`, and `internal_only` if it should be
  login-only (UI, or
  `UPDATE universe SET data_portal_url = '…', internal_only = 1 WHERE name = 'DOTAX'`).
- **Load data:** reload the DOTAX series from the app. Do the monthly ones
  first; the quarterly and annual aggregates read them.
- **No automatic refresh:** the nightly batch reload covers UHERO only, and
  ingest runs never trigger reloads. Decide how DOTAX gets reloaded after
  each month's fetch.
- **Rerun later:** rerun the script after `dotax_sheet` first extracts, to add
  the 18 sheet loaders.

### DATABOOK (new on prod)

```bash
bun run databook sync                 # uses the copied manifest; keeps names
bun run databook apply --execute      # universe, geographies, units, categories, 18.5k series, loaders
bun run databook history --execute    # every edition as a vintage, then full public sync (~minutes)
redis-cli --scan --pattern '*u=databook*' | xargs -r redis-cli del
```

- `history` needs `public_sync_watermarks` (§2).
- DATABOOK loaders have `reload_nightly = 0`. A new edition goes through
  `bun run databook annual --edition Y --execute` after the monthly fetch
  picks it up.
- Set the universe row as for DOTAX.

## 8. UHERO load statements

None need migrating. Every existing load method (`load_api_bls`, FRED, BEA,
file loads, …) is unchanged. The four `load_from_extract("bls", …)` loaders
in the local DB (CPI@US.M and three others) are local experiments; don't
copy them. Moving UHERO's API loaders to `load_from_extract` is a later,
per-source step, verified by diff.

## 9. After

- **Ingest page:** every run ok, and the Next times look right (the DATABOOK
  downloader runs at 03:30 on the 15th).
- **Portals:** the DOTAX / DATABOOK portal pages load, and are login-only if
  `internal_only` is set.
- **Mail:** comms and pre-release mailers now key on `APP_ENV`, so prod sends
  real mail and staging redirects to `DEV_MAIL_RECIPIENT`.

## Older items to verify (not this week, still open in notes)

- **hhdb hand-applied migrations** (`src/lib/hhdb/migrations/`), last noted as
  not applied on the remote:
  - `2026-09-18-create-mls-listings` and its backfill
  - `2026-09-22-widen-condo-land-ownership`
  - `2026-10-05-create-insurance-tables` + `freq-insurance`
  - `2026-10-05-create-renthub-listings` + `freq-renthub-listings`
  - `2026-10-06-renthub-cpr-building-type-strays`
- **`migrate-interpolate-to-disaggregate.ts`** (8/27): still finds loaders
  to rewrite in the local DB. Run it on prod only once it has been run and
  verified locally.
- **Bun version:** prod runs Bun 1.4.0. The session time-zone fix
  (`session-tz.ts`) is correct on both 1.4.0 and 1.4.4, so no upgrade is
  needed.
