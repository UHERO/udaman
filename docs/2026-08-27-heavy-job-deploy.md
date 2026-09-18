# Heavy-Job Deploy Runbook — 2026-08-27

The 8/27 12:58 DVW upload and the 1:01 PM public-datapoint sweep ran on top of each other from two uncoordinated processes (web + worker) and thrashed MySQL for an hour (CPU pinned, disk at 1.2–1.5 GB/s, memory idle). Five code changes now serialize heavy DB work, move uploads off the web process, and shrink every statement. This doc is what has to happen by hand when it ships.

## What changed

| Task | Change | Where |
|---|---|---|
| 1 · Lock | One MySQL advisory lock (`udaman:heavy`, via `GET_LOCK` on a reserved connection) wraps every bulk-write job. Works across web and worker because it lives in the DB. `update-public` gets a deterministic job id so sweeps can't stack. BLS morning reload moved 06:00 → 06:30 so it no longer fires alongside BEA. | `src/lib/mysql/db-lock.ts`, `workers/processors/index.ts`, `enqueue.ts`, `scheduler.ts` |
| 2 · Uploads → worker | The `/stream` routes now only write chunks to disk under `DATA_DIR/<dvw_files\|dbedt_files>/staging/<uploadId>/`. Finalize enqueues the existing `critical`-queue job; all SQL runs in the worker. Upload panel polls row status. Stale-upload cutoff raised 30 min → 4 h. | `app/api/uploads/*/stream/route.ts`, `upload-session-store.ts`, `processors/{dvw,dbedt}-upload.ts`, `upload-panel.tsx` |
| 3 · Incremental sync | `updatePublicDataPoints` runs its three statements per chunk of 500 series and skips chunks whose `data_sources`/`series` rows haven't been touched since the last watermark. Full pass on first run, when passed `{ full: true }`, or once every 24 h. Post-upload sync is always full. | `collections/data-point-collection.ts`, new migration |
| 4 · Gentle uploads | DVW loads into `*_new` staging tables and swaps with one atomic `RENAME TABLE` — live tables are never empty, and each upload is a complete rebuild (nothing from the previous load survives the swap). DBEDT wipe deletes in bounded `LIMIT 5000` loops. Batch sleeps are adaptive (1.5× the last batch's duration, clamped 50 ms–2 s). `SET FOREIGN_KEY_CHECKS` now runs on the same connection as the statements it guards (it was a no-op before). | `controllers/dvw-upload.ts`, `dbedt-upload.ts`, `utils/adaptive-throttle.ts` |
| 5 · Reload transactions | Each loader's data-point writes happen in one transaction with batched demotes and multi-row inserts — roughly 1,000 fsyncs → 1 for a typical series. `transaction()` in `db.ts` was fixed to actually run the callback on the transaction's connection. | `collections/series-collection.ts`, `lib/mysql/db.ts` |
| Nav | Sidebar "Uploads" and "Data Tools" now link straight to their default child (`href` on `RouteEntry`) instead of an index page that only server-redirects — that redirect-inside-a-client-navigation was what threw the error page. `path` is unchanged so access checks and tabs still work. | `lib/auth/route-access.ts`, `components/app-sidebar.tsx`, `nav-main.tsx` |
| Chunk errors | Upload chunk POSTs now check the response content-type before parsing and retry transient gateway failures (502/504/dropped connection) at 1 s / 3 s / 9 s — chunk writes are idempotent by index so this is safe. A real failure is logged as `Chunk N of M failed after K attempts: HTTP 504 Gateway Time-out` instead of `Unexpected token '<'`. | `components/uploads/upload-panel.tsx` |

Verified locally: `bun run check-types` clean apart from the four known pre-existing errors; eslint clean; 1,480 tests pass across `src/core` and `src/lib`. Nothing has been exercised end-to-end against a production-sized DB — that is step 7.

## Deploy sequence

Order matters: the migration must exist before the new code runs, and web and worker must flip together.

### 1. Pick a quiet window

No sweep or reload should be mid-flight. Avoid 03:00, 06:00–07:30, 10:00–10:30, 11:01, 13:01, 15:01, 16:15, 17:01 and 19:40–22:00 HST. Confirm the worker is idle (BullMQ dashboard, or `redis-cli --scan --pattern 'udaman:*:active'` returns nothing).

### 2. Grant DDL on the DVW database

The staging swap needs `CREATE`, `DROP` and `ALTER` on `dbedt_visitor_dw`, not just DML. The app's DVW user is `DVW_DB_USER` in `.env.prod`.

```sql
SHOW GRANTS FOR 'dvw_user'@'%';
GRANT CREATE, DROP, ALTER ON dbedt_visitor_dw.* TO 'dvw_user'@'%';
FLUSH PRIVILEGES;
```

### 3. Apply the watermark migration

A single small table; no `data_points` DDL and no new index. Until it exists every public sync throws, so run it before restarting anything.

```sql
CREATE TABLE `public_sync_watermarks` (
  `universe`       VARCHAR(10)  NOT NULL,
  `synced_at`      DATETIME(0)  NULL,
  `full_synced_at` DATETIME(0)  NULL,
  PRIMARY KEY (`universe`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Or from the app checkout: `bunx prisma migrate deploy` (migration `20260827140000_public_sync_watermarks`).

### 4. Check the shared data directory

Web and worker must see the same `DATA_DIR`, and the worker must be able to write `DATA_DIR/dvw_files/staging` and `DATA_DIR/dbedt_files/staging` (the web process creates them on first upload). Both run as `uhero` on the same host today, so this is a confirmation, not a change — check the worker's systemd unit loads the same `EnvironmentFile` as the web unit.

### 5. Optional env overrides

All have defaults; set only to tune.

| Variable | Default | Meaning |
|---|---|---|
| `HEAVY_DB_LOCK_TIMEOUT_MS` | 1800000 | How long a heavy job waits for the lock before failing (30 min). |
| `HEAVY_DB_LOCK_NAME` | `udaman:heavy` | Lock name; change only if two app instances share one MySQL. |
| `UPLOAD_THROTTLE_FACTOR` | 1.5 | Sleep between upload batches as a multiple of the last batch's duration. |
| `UPLOAD_THROTTLE_MIN_MS` / `_MAX_MS` | 50 / 2000 | Clamp on that sleep. |

### 6. Restart web and worker together

The versions are not mix-compatible: the new upload panel expects `queued` from finalize, and the new worker expects `stagedDir` on the job. Restart any long-lived CLI or scraper process that imports `db.ts` as well.

```bash
sudo systemctl restart udaman udaman-worker
```

### 7. Smoke test, in this order

- **Lock:** trigger an update-public from the admin UI, then `SELECT IS_USED_LOCK('udaman:heavy');` — non-NULL while it runs, NULL after. Expect this first run to take as long as the old sweep (it's a full pass, just chunked); the next scheduled one should be seconds.
- **DVW upload on staging first:** upload `TourismDW_upload.xlsx`. Watch the worker log for `RENAME TABLE`; afterwards `SHOW TABLES LIKE '%\_new'` and `'%\_old'` should both be empty.
- **DBEDT upload:** confirm the finalize request returns immediately and the panel's "Process" step completes from polling.
- **Watch the VM graph** during the DVW upload: disk throughput should stay well under the 1.2 GB/s plateau from 8/27.

### 8. Server-side check (not code)

Checked 2026-08-27 (MariaDB): `innodb_buffer_pool_size` = 3 GB, `innodb_flush_log_at_trx_commit` = 2, `innodb_lock_wait_timeout` = 50 s — all reasonable, so server config is not the cause. The open question is whether `data_points` fits in the pool at all:

```sql
SELECT table_name,
       ROUND(data_length/1024/1024/1024, 2)  AS data_gb,
       ROUND(index_length/1024/1024/1024, 2) AS index_gb
FROM information_schema.tables
WHERE table_schema IN ('uhero_db_dev', 'dbedt_visitor_dw')
ORDER BY data_length + index_length DESC
LIMIT 8;
```

If `data_points` data+index exceeds ~2.5 GB, the old universe-wide sweep could never be memory-resident and the chunked sync + lock are the real fix rather than more RAM. If the server is still sluggish after an incident, `SHOW FULL PROCESSLIST` shows lingering queries and the `History list length` line of `SHOW ENGINE INNODB STATUS\G` shows purge lag (millions = still catching up).

## Things to know after it ships

- **DVW tables lose their foreign keys after the first swap.** `CREATE TABLE … LIKE` copies indexes but not FK constraints. If the visitor-data portal relies on them, re-add after the first successful upload; otherwise nothing to do. The old load ran with FK checks off anyway, so behaviour is unchanged.
- **Heavy jobs are now strictly one-at-a-time.** A scheduled sweep that queues behind a very long job waits up to 30 min and then fails visibly rather than piling on. If that turns out to be noisy on nightly-reload days, raise `HEAVY_DB_LOCK_TIMEOUT_MS`.
- **A hung (not dead) process can hold the lock.** A crash releases it automatically (the lock dies with the connection), but a wedged worker holds it until MySQL's 8 h `wait_timeout`. To free it manually: `SELECT IS_USED_LOCK('udaman:heavy');` returns the connection id → `KILL <id>;`
- Data written outside a loader (manual point edits, direct SQL) reaches `public_data_points` on the daily full pass, not the incremental one. If a UI edit path needs to be public immediately, call `updatePublicDataPointsForSeries` there.
- If an upload dies between the swap and the drop, `*_old` tables linger (doubling DVW disk use) until the next upload's init cleans them up.
- DBEDT still holds all rows in memory before its insert — now in the worker rather than the web process, which was the goal, but the footprint is unchanged.
- Two pre-existing callers of `transaction()` (`export-collection.ts:246`, `actions/series-actions.ts:443`) run their inner queries through the pool, outside the transaction. They compile unchanged; worth a follow-up.
- `src/lib/auth/mysql-adapter.test.ts › getUser` is flaky against the dev DB (random id collides with a real user) — unrelated to this work.

## Rollback

`git revert` the commit and restart both processes. The `public_sync_watermarks` table is harmless to leave behind. The DVW database keeps whatever the last swap produced — the live tables are complete either way. No `data_points` schema changed.

## Addendum — first production run, 2026-08-27 15:17

Upload 185 (DVW) ran under the new code and failed. What the logs show, in order:

1. Worker acquired the heavy lock in 3 ms, created staging tables, loaded dimensions, and inserted 50,000 rows in 4 s — everything working as designed.
2. At ~15:17:41 MariaDB (uhero12) stopped answering. Trivial `UPDATE`s took 20–37 s at 15:22. At 15:25:34 the kernel OOM-killer killed `mariadbd` (`anon-rss: 6,657,600 kB` on a 7,665 MB host). Same signature as the Jul 31 kill (6.2 GB RSS). systemd restarted it at 15:27:40.
3. Every pooled connection reported `Connection closed` at 15:27:32. `executeUpload`'s own fail-stamp could not run (DB was down), and an unguarded `conn.release()` in `db-lock.ts` threw out of a `finally`, which exited the worker process. systemd restarted it 10 s later.

Server config is not the cause: buffer pool 3 GB, per-thread buffers at defaults (`sort_buffer_size` 2 MB, `join_buffer_size` 256 KB, `tmp_table_size`/`max_heap_table_size` 16 MB, `max_connections` 151), `performance_schema` off. `Memory_used` after restart = 3.54 GB, i.e. pool + ~0.5 GB. The gap between that and the 6.6 GB RSS at the kill is unexplained from the client side; see "open question" below.

**Code fixes added after this run** (all uncommitted with the rest):

| Fix | Where |
|---|---|
| `db-lock.ts`: guard `conn.release()` so a dead connection can never throw out of `finally`. | `src/lib/mysql/db-lock.ts` |
| Worker installs `unhandledRejection` / `uncaughtException` handlers that log instead of exiting — a lost DB connection must not cost a restart plus every in-flight job. | `src/core/workers/worker.ts` |
| `uploadGuard` around both upload processors: any throw before/outside `executeUpload` stamps the row `fail`. | `src/core/workers/processors/index.ts` |
| `upload-status.ts`: on the BullMQ `failed` event, stamp the upload row with retries (2 s → 2 min backoff) so it lands once the DB is back; on worker startup, reconcile every row still `processing` against its BullMQ job and stamp `fail` if the job is failed or gone. The UI should never sit on "Processing" for a job the worker knows has failed. | `src/core/workers/upload-status.ts`, `worker.ts`, `universe-upload-collection.ts` (`listProcessingIds`) |

**Open question — why mariadbd reaches 6.6 GB RSS with `Memory_used` ≈ 3.5 GB.** Two things to measure next time load is on it:

```bash
# RSS vs MariaDB's own accounting. A large gap points at glibc malloc arena
# fragmentation (common on MariaDB 10.x); fix is MALLOC_ARENA_MAX=2 in the
# mariadb.service environment, or jemalloc.
ps -o rss= -p "$(pidof mariadbd)"
mysql -e "SHOW GLOBAL STATUS LIKE 'Memory_used'"
```

If RSS tracks `Memory_used` and both climb during an upload, it's real usage and the buffer pool should drop to ~2 GB on a 7.6 GB box until it's understood. Either way the old universe-wide public sweeps, whose derived joins exceeded `tmp_table_size` (16 MB) and spilled to on-disk temp tables, are the likely source of the sustained 1.2 GB/s disk at 13:00 — the chunked sync removes that.

Recovery for upload 185: plain re-upload. The swap never ran, so the live DVW tables are the previous dataset; the next upload's init drops the orphaned `*_new` tables.

## Addendum 2 — 2026-08-31: light queue for interactive jobs

Clipboard actions stalled in prod: a heavy job **waiting** on the DB lock still occupies a default-worker slot, so two queued heavies (e.g. the 10:00 SA + 10:20 BLS reloads) block the default queue entirely for up to the lock timeout — a starvation mode introduced by the lock change. Fix: new `udaman/light` queue with its own worker (concurrency 2); `clipboard.action`, `clipboard.loader-reload` and `series.reload` now enqueue there. These are short single-series jobs, safe to run beside a locked heavy job. Deploy: restart web + worker together (web enqueues to the new queue; only the new worker consumes it). Jobs already sitting on the default queue from before the restart will still be drained by the default worker.

## Addendum 3 — 2026-08-31: worker SIGILL crashes = JS-heap OOM

Worker (uhero13) crashed with SIGILL repeatedly (restart counter 12; core dumps 08:11, 11:48, 12:55), each time failing active clipboard jobs as "stalled". Decoded bun.report traces: `pas_allocation_result_zero` → `bmalloc zeroedMalloc` → JSC GC sweep — the JavaScriptCore allocator failing under memory pressure. Peak worker RSS was 6.04 / 5.72 GB on an 8.09 GB machine, reached while a clipboard-deps batch processed 3,141 series at depth 0. In short: the dependency-reload path balloons the JS heap until Bun 1.3.11 dies mid-GC.

- Bun upgraded to 1.4 on the server (may fail more gracefully; does not remove the pressure).
- The durable fix is bounding memory in the dependency processing path (`series-collection.ts` clipboard-deps / depth-level batches): process depth levels in bounded chunks and drop Series references between chunks. Not yet implemented.
- The light queue (Addendum 2) is unrelated to this crash but still worth deploying: it isolates interactive jobs from heavy-job lock waits.

## Addendum 4 — 2026-08-31: soft-404 guard for downloads (HTA domain move)

hawaiitourismauthority.org moved to hta.hawaii.gov; the old URLs now serve a not-found page. Where that page comes back as **HTTP 200 + HTML**, the old code saved it over the cached spreadsheet, and SheetJS then parsed the HTML into a "workbook", surfacing as `Cannot find header "Island of Hawai'i"` instead of the real error. (On a clean non-200, `ensureFresh` already kept and used the cached file — that path was fine.)

Changes:
- `downloadToServer` sniffs a 200 body: HTML where a data file is expected (any `filename_ext` except html/htm) → `htmlPage: true`, cached file kept, timestamps not bumped, `dsd_log_entries` still records status + content-type as evidence.
- `ensureFresh` treats `htmlPage` like a failed fetch: warns `an HTML page instead of a data file (soft 404 — has the site moved?)`, keeps using the cached file; throws only if no cached file exists.
- `readXlsFile` / `readCsvFile` refuse to parse a file whose content is HTML, with an error naming the real problem — this covers files already overwritten before the guard existed.

Manual follow-ups:
1. Update the `downloads.url` values for HTA handles to the hta.hawaii.gov equivalents.
2. Audit for already-overwritten files: any cached download that is secretly HTML now fails loudly at parse time; `file $DATA_DIR/<...>/*.xls*` (look for "HTML document") finds them wholesale. Those months need re-fetching from the new site.
3. tour_ocup reload slowness is separate: date-sensitive evals re-parse each monthly workbook per series (~2.5 s × files × series) because the parse cache is per-loader. A bounded cross-loader LRU is the fix — proposed, not yet implemented.

### Addendum 4a — root cause of the header misses

The `Cannot find header "Island of Hawai'i"` failures were not 404-related at all: the cached workbooks are fine. The file headers use U+2018 (‘) while the evals use ASCII apostrophes, and the ported `toAscii` only stripped combining accents — Rails' stringex `to_ascii` also transliterates typographic quotes to ASCII, so this matched in Rails and silently failed **every month** in the port (date-sensitive skips are non-fatal). Fixed by extending `toAscii` in `download-processor.ts` to map ‘ ’ ʻ ′ → ', “ ” ″ → ", – — → -. Replayed against all 98 local TOUR_OCUP monthly workbooks: 98/98 headers now match. Affected series (OCUP%NS@HAW.M, PRMNS@HAW.M, RMRVNS@HI.M, …) will backfill their missing months on the next reload.
