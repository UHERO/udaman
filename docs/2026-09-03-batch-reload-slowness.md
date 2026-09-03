# Batch reload slowness — diagnosis, 2026-09-03

Code-only diagnosis (prod MySQL/Redis are not reachable from the dev
machine, so nothing below is confirmed against live timings — see
"How to confirm" for the exact log lines and queries that will).

## Summary

Nothing in the last two weeks made a single loader's *work* dramatically
slower. What changed is (1) one new per-loader cost that is unbounded on
loaders touching moved HTA handles, (2) global serialization of every
reload behind a MySQL advisory lock, so wall-clock now includes waiting
behind sweeps and the dependency reset, and (3) two correctness fixes that
turned formerly no-op loaders into real work. All of that lands on an
architecture that was already the slow ceiling: the batch reload runs one
loader at a time, in-process, on the same event loop as every other queue,
where Rails fanned each dependency-depth wave out to a Sidekiq pool.

Note the timeline: the 18-hour nightly on the night of 08/31 ran on the
08/27 + 08/31 code. The soft-404 guard, `toAscii` fix, sheet LRU and
depth fix all shipped **after** it. So the 08/31 run cannot be explained
by items 1, 3 or 4 below; it needs the lock-wait numbers from the log
before we can say what it was.

## Production topology

Three hosts: web, worker, and database (MariaDB and Redis together).
`DATA_DIR` is a network mount visible to web and worker. So: the heavy
queue serializes within the one worker process (the MySQL lock is what
serializes against the web host); memory pressure from the worker never
competes with the buffer pool; and every `statSync` / `readFileSync` on a
cached spreadsheet is a network round trip, not a local disk read. The
08/27 runbook's "both run as `uhero` on the same host" (step 4) is stale.

## What one batch reload does now

`reload.batch` (default queue, 19:44 HST) → `heavy()` wrapper takes the
`udaman:heavy` lock for the **whole job**, no yield points
(`processors/index.ts:41-44, 114`). Then `SeriesCollection.batchReload`
(`series-collection.ts:2439-2537`): one depth query per level, then a
strictly sequential `for series → for loader → LoaderCollection.reload`.
`groupSize` only chunks the progress log; it provides no concurrency.

Per loader (`loader-collection.ts:353-452`, `series-collection.ts:1580-1782`):

| Step | Cost | New in window? |
|---|---|---|
| `getEnabledBySeriesId` | 1 SELECT | no |
| `ensureFresh(handle)` | `getByHandle` (or `REGEXP` scan for `%` handles) + HTTP fetch if `last_download_at` > 1 h old | fetch behaviour changed 09/01 (item 1) |
| `getData` → `getCachedSheet` | `statSync`; full `XLSX.read` on miss | LRU added 09/02 |
| each `"NAME".ts` reference in the eval | `getByName` + `loadCurrentData`, 2 SELECTs, no memo | no |
| `updateData` read phase | `SELECT priority`; **all vintages ever written by this loader** with filesort; current points join | no |
| `updateData` write phase | `BEGIN` + batched demote/insert + `repairDataPoints` (anti-join SELECT + 1 UPDATE per orphan) + `COMMIT`, **always**, even with nothing to write | 08/27 |
| `finally` → `LoaderCollection.update` | UPDATE `data_sources` + full `getById` SELECT | no |

Public data points are **not** synced per loader or per series; the job
enqueues one `public.update` at the end (`batch-reload.ts:75`). That
suspicion is not borne out.

## Ranked causes

### 1. Soft-404 handles are re-fetched over HTTP by every loader — new 09/01

`downloadToServer` (`download-collection.ts:153-186`): on HTTP 200 + HTML
body it sets `htmlPage` and skips the whole `else` branch, including the
`UPDATE downloads SET last_download_at`. `ensureFresh` gates on exactly
that column (`:244`, `:263`). So a handle whose URL now serves a 200
not-found page (the hawaiitourismauthority.org → hta.hawaii.gov move,
runbook Addendum 4) is never fresh, and **every loader that references it
does a live fetch with a 120 s timeout**, plus `getById` and the
`dsd_log_entries` dedup SELECT. Before 09/01 the HTML was written to disk
and the timestamp bumped, so only the first loader per hour fetched.

For date-sensitive `%` handles this multiplies: `ensureFresh:241-259`
loops every download `findByPattern` returns and fetches each stale one —
up to N files × M loaders per night, where it used to be N per hour.
`tour_ocup` is excluded from the nightly, but any other HTA-hosted handle
in the UHERO universe is not.

This is latency-bound, so it produces exactly the observed shape: hours
of wall clock while CPU and the DB look idle.

### 2. Heavy-lock serialization; waiting counts as job time — 08/27, 09/01, 09/02

- `heavy()` wraps `reload.batch`, all `reload.*` targeted reloads,
  `admin.dependency-reset`, `reload-job.process`; `public.update` takes the
  lock itself. All strictly one-at-a-time across web + worker
  (`processors/index.ts:97-127`). Reloads receive **no `yieldPoint`**
  (`heavy` discards `ctx`), so a batch reload holds the lock for hours and
  cannot be pre-empted; a priority upload arriving at night waits 30 min
  and then fails.
- A job waiting for the lock still occupies a default-worker slot (2
  total) and a reserved pool connection. `processBatchReload` enqueues
  `public.update` **while still holding the lock**, so that sweep takes
  the other default slot and sits in `GET_LOCK` — the default queue is
  then fully blocked for the rest of the night. `enqueueUpdatePublic` now
  allows two stacked sweeps (`base` + `-chaser`, `enqueue.ts:46-65`).
- `admin.dependency-reset` runs at 18:09 under `heavy()`, 95 min before
  the batch. Since ddec1777 (09/02) fixed the JSON-vs-YAML `LIKE`,
  `assignDependencyDepth`'s loop iterates once per real depth level, and
  each iteration is a correlated leading-wildcard `LIKE` over
  `t_series × t_datasources` (`series-collection.ts:2122-2141`) — no index
  possible, ~|series|×|loaders| comparisons per level. If it overruns
  19:44 the batch starts by waiting.
- Roughly 10 sweeps/day (4 scheduled + one after each targeted reload).
  Each sweep after a reload is effectively a full pass because
  `LoaderCollection.reload`'s `finally` stamps `data_sources.updated_at`
  on every loader it touched, so `chunkHasActivity` can't skip.
  Weekday mornings (06:00 BEA → sweep → 06:30 BLS; 10:00 SA → 10:20 BLS
  → sweep → 11:01 sweep) now run as a queue, and each job's BullMQ
  duration includes the wait.
- `GET_LOCK` wake-up is not FIFO; a waiter has no queue position.

None of this slows a loader, but it turns overlapping runs into a serial
chain and makes "the job took N hours" include hours of waiting.

### 3. Correctness fixes that turned no-op loaders into real work — 09/01, 09/02

- `toAscii` now maps ‘ ’ ʻ → `'` (`download-processor.ts:1008-1015`).
  Per Addendum 4a, affected header lookups had failed **every month since
  the port**; date-sensitive misses are swallowed (`:711-716`, `:740-747`)
  and `updateData` bailed on empty data. Those loaders now parse every
  workbook and backfill years of vintages. Correct, and large — the first
  post-fix reload is effectively a from-scratch load for those families.
- `dependency_depth` was zero for every series until 09/02; the nightly
  ran as one flat bucket. It now runs `maxDepth+1` ordered passes. Same
  loader count, but a pre-fix vs post-fix comparison is not apples to apples.

### 4. Smaller regressions in the window

- **Unconditional transaction per loader** (`series-collection.ts:1736`):
  `BEGIN`/`COMMIT` + a pool checkout for every loader, including the common
  nightly case with nothing to write, and `repairDataPoints` moved inside
  it so its per-orphan UPDATEs hold row locks for the whole tx. With
  `innodb_flush_log_at_trx_commit = 2` (runbook §8) per-statement commits
  were not fsyncing anyway, so the claimed "1,000 fsyncs → 1" win is mostly
  illusory; the extra round trips are real. ~1.1–1.3×.
- **Sheet LRU is 32 entries** (`download-processor.ts:953`). Fine for
  single-file handles shared by hundreds of loaders (a big win there), but
  a date-sensitive loader that walks ~98 monthly files cycles a 98-key scan
  through a 32-entry LRU: ~0 % hit rate, the case the comment cites. It
  also pins up to 32 parsed workbooks for the life of a worker that
  Addendum 3 records dying of JSC allocator failure at 6 GB RSS. And the
  cache key omits `date` while `readXlsFile` resolves `sheet_name:M3`
  from it (`:960` vs `:486-497`) — pre-existing, but now process-wide.
- `readCsvFile` reads each CSV twice (`:400-402`); `readXlsFile` reuses
  its buffer and is fine.
- **`LOG_LEVEL=debug` in `.env.prod`**, and `db.ts` logs every query at
  debug with its SQL text through a synchronous `writeSync` to fd 1
  (`logger.ts:97-103`, rewritten 08/14). That is ~10 sync writes per
  loader × ~15k loaders per night into the journald pipe. Confirm the
  worker unit actually loads that value; if it does, set `info`.

### 5. Pre-existing ceiling (not a regression, but why any of this hurts)

- Fully sequential: one loader at a time since 2026-02-21. Rails ran each
  depth wave through Sidekiq's thread pool
  (`tmp/lib/series_reload_manager.rb:16-34`).
- Synchronous `XLSX.read` on the one event loop shared by `default` (2),
  `critical` (1) and `light` (2) workers. A clipboard-deps job running
  beside the nightly halves both, and heap growth (Addendum 3) makes GC
  pauses everyone's problem.
- Per loader: the unbounded all-vintages SELECT with filesort (no
  `(xseries_id, data_source_id)` index), and UPDATE + full re-SELECT in
  `finally`. Per eval reference: 2 SELECTs with no memoization, so an
  upstream series is re-read for every dependent that names it.
- Pool `max` is unset (Bun default 10) with up to 3 long-lived
  reservations (lock holders) plus per-loader transaction checkouts. Not
  a stall at today's numbers, but no headroom.

## How to confirm (do this first)

Worker log (`journalctl -u udaman-worker`):

```
# Lock wait vs hold per job. If waitMs is small and heldMs grew, the cause
# is inside the job (items 1, 3, 4). If waitMs is large, it's item 2.
grep '"name":"database.lock"' | grep -E 'reload\.batch#|reload\.(bls|bea|sa)#' | grep -E 'acquired|released'

# Item 1: one line per soft-404 fetch. Count per night.
grep -c 'got an HTML page instead of a' 
grep 'got an HTML page instead of a' | sed 's/.*\[download\] \([^:]*\):.*/\1/' | sort | uniq -c | sort -rn

# Item 2: dependency reset overrunning 19:44
grep 'admin.dependency-reset#' | grep -E 'acquired|released'

# Per-loader: the nightly's own progress heartbeat
grep 'series reloaded ('
```

DB:

```sql
-- Handles that are never fresh (item 1). Anything older than a day here
-- is being re-fetched by every loader that names it.
SELECT handle, url, last_download_at
FROM downloads WHERE url IS NOT NULL AND freeze_file = 0
ORDER BY last_download_at LIMIT 40;

-- Which loaders eat the night (runtime is seconds, stamped on every reload)
SELECT id, series_id, runtime, last_run_at, LEFT(eval, 80) eval
FROM data_sources WHERE reload_nightly = 1
ORDER BY runtime DESC LIMIT 50;

-- Is the DB itself the bottleneck (runbook §8 open question)
SHOW GLOBAL STATUS LIKE 'Memory_used';
SELECT table_name, ROUND((data_length+index_length)/1073741824,2) gb
FROM information_schema.tables WHERE table_name = 'data_points';
```

Redis: BullMQ keeps `processedOn`/`finishedOn` per job; the batch job log
has `batch_reload: N series, maxDepth=…` and the 500-series heartbeat.

## Proposed fixes (not implemented)

Ordered by payoff / risk.

1. **Bump `last_download_at` on `htmlPage` too**, keeping `last_change_at`
   untouched. One line; kills the per-loader fetch storm. Then fix the HTA
   URLs (runbook Addendum 4 follow-up 1).
2. **Give the lock its own queue.** Add `udaman/heavy` with concurrency 1
   and route every `heavy()` job there. BullMQ then does the serialization
   in FIFO order, the MySQL lock becomes a cross-process safety net that
   is almost never contended, and a waiting heavy job no longer eats a
   `default` slot or a pool connection. Keep `default` for downloads and
   exports, `light` for interactive. Consider `udaman/sweep` (concurrency
   1) for `public.update` so sweeps never sit ahead of a reload in the
   same queue.
3. **Pass `yieldPoint` into `batchReload`** and call it between groups, so
   a priority upload at night gets the lock within a minute instead of
   failing at 30 min.
4. **Move `admin.dependency-reset` earlier** (or right after the nightly)
   and rewrite the depth loop: `dependencies` is JSON, so build a
   `(series_id, dep_name)` temp table once with `JSON_TABLE` and join on
   it instead of the correlated `LIKE`.
5. **Skip the transaction when there is nothing to write** (all three
   lists empty), and keep `repairDataPoints` outside it.
6. **Parallelism inside a depth level.** `p-limit`-style, 3–4 loaders at a
   time within `batchReload`. Because XLSX parsing is synchronous, real
   gains need either a second worker process for reloads or moving the
   parse into a worker thread; the DB and network waits still overlap
   fine in one process, which is where item 1's latency lives.
7. **Sheet cache**: raise the LRU to cover the largest date-sensitive
   working set, or key eviction by bytes; add `date` to the key when
   `sheetSpec` is date-dependent.
8. `LOG_LEVEL=info` in prod; add `max` and `idleTimeout` to the pool;
   read the CSV once.

## Rails comparison

Rails (`tmp/lib/series_reload_manager.rb`, `tmp/models/data_point.rb:100-181`):
cron → rake → `SeriesReloadManager#batch_reload`, one `perform_async` per
series per depth wave onto Sidekiq (multi-threaded), polling a log table as
the barrier between waves. `update_public_data_points` ran 4×/day plus
once after the nightly. No locks anywhere; a wall-clock "busy hours"
check and a `status = 'processing'` column were the only coordination.
The TS port kept the wave ordering and dropped the fan-out.

## What shipped — 2026-09-03

Small changes only; parallelism within a depth level is deferred until
these have been observed for a few nights.

| Change | Where |
|---|---|
| `ensureFresh` remembers each download it *attempted* in this process (any outcome) and won't retry it for an hour. A 404 or soft-404 handle is now fetched once per hour per process instead of once per loader (and per monthly file). Mirrors Rails' `DownloadsCache` memo. `last_download_at` semantics unchanged: still only written on a real 200. | `collections/download-collection.ts` |
| New `udaman/heavy` queue, worker concurrency 1. Every `heavy()` job (batch + targeted reloads, `public.update`, dependency reset, `reload-job.process`, api-dvw reload, universe archive/purge) enqueues and schedules there. BullMQ now serializes them FIFO; the MySQL lock is only contended by uploads (priority) and the web process. Waiting heavies no longer occupy `default` slots or pool connections. Scheduler removes the moved keys from `default` on startup so the old copies can't double-fire. | `workers/queues.ts`, `enqueue.ts`, `scheduler.ts`, `worker.ts` |
| `heavy()` passes the lock context through; `batchReload` takes a `yieldPoint` and calls it between groups, so an upload arriving during a multi-hour reload gets the lock within one group instead of failing at 30 min. `reload-job.process` yields per series and passes `yieldPoint` into its inline sweep. | `processors/index.ts`, `batch-reload.ts`, `targeted-reload.ts`, `reload-job.ts`, `series-collection.ts` |
| `updateData` skips `BEGIN`/`COMMIT` and the pool checkout when there is nothing to demote, promote or insert (the common nightly case). The repair pass still runs. | `series-collection.ts` |
| CSV files are read once, not twice. Sheet cache key includes the month for `sheet_name:M3` specs, which resolve to a different sheet per date. `getData` memoises sheets per call so the LRU's `statSync` validation runs once per file per loader rather than once per date — `DATA_DIR` is a network mount in prod, so each of those was a metadata round trip. | `utils/download-processor.ts` |
| Admin worker panel lists all four queues (it was missing `light` too). Loader "reload" status poll now checks `light`, where the job actually goes, then `default`. | `actions/workers.ts`, `actions/data-loaders.tsx` |

Not changed, on purpose: the 32-entry sheet LRU (memory pressure is the
open risk; revisit with RSS numbers), the dependency-depth `LIKE` loop
(its per-level cost is the same as the first level, which already ran
before the fix), pool size.

### Deploy

Restart web and worker together: the web process enqueues onto `heavy`
and only the new worker consumes it. Jobs already sitting on `default`
from before the restart are still drained by the default worker (the
dispatch table is unchanged). Nothing to run by hand — the scheduler
migrates its own keys. Verify after restart:

```
# once, on startup
grep 'from default queue (now on heavy)'
# then
redis-cli --scan --pattern 'udaman:heavy:*' | head
```

### Verified locally

`bun run check-types` clean; eslint clean on touched files. Tests run
per directory (`bun test <dir>`): catalog 13, crawlers 213, timeseries
1,356, workers 87, lib 24 pass — 1,693 pass, 1 fail, the fail being the
known-flaky `src/lib/auth/mysql-adapter.test.ts › getUser` (random id
collides with a real dev-DB user; noted in the 08/27 runbook).
Note: `src/core/scripts/migrate-interpolate-to-disaggregate.test.ts`
imports a script whose top-level `main()` runs a dry run against the dev
DB and calls `process.exit(0)`, which ends a whole-tree `bun test` run
early with exit 0 and no summary — pre-existing, worth guarding with
`if (import.meta.main)`.

## Proposed next steps — 2026-09-03

Ordered by payoff per unit of risk. A and B are the ones to do next; C is
the structural change worth making regardless; D and E wait on numbers.

### A. Cheap fixes to do alongside parallelism

1. **Record durations.** `batch-reload` already writes one `app_logs`
   row at completion; add `{ waitMs, heldMs, perDepth: [{depth, count,
   seconds}] }` to its metadata and write one row per depth level. Every
   decision below needs a trend line, and today the only timing is the
   BullMQ job pane in Redis.
2. **Stamp `data_sources.updated_at` only when data changed.** The
   incremental sweep keys off it, and `LoaderCollection.reload`'s
   `finally` bumps it on every loader, so the post-nightly sweep is
   always a full pass. Keep `last_run_at` / `runtime` as they are; touch
   `updated_at` only when `inserted > 0` or a demote/promote happened.
   The daily full pass still catches everything else.
3. **Drop the re-SELECT in `LoaderCollection.update`.** It does an
   UPDATE and then `getById`; the reload path never uses the returned
   row. One round trip per loader.
4. **Set the pool explicitly**: `max: 20`, `idleTimeout` — required by B
   anyway (each in-flight loader can hold a transaction connection).

### B. Parallelism within a depth level

Series in one depth level are independent by construction (every input
lives at a higher depth and has already been reloaded), so this is safe
to parallelize *across series*. Two rules keep it correct:

- **Sequential within a series.** A series' loaders are ordered by
  priority and `updateData` depends on that order. Run one series'
  loaders in sequence; run different series concurrently.
- **Bounded.** `RELOAD_CONCURRENCY`, default 4. The wins come from
  overlapping DB round trips and HTTP fetches (~10 queries per loader,
  plus the occasional soft-404 fetch); above ~6 the single event loop
  and InnoDB gain nothing, and memory grows linearly.

Shape: inside `batchReload`, per group of `groupSize`, run a
concurrency-limited map over the group's series (a 15-line limiter, no
dependency needed), then `job.log` the heartbeat and `yieldPoint()` as
now. Expect 2–4× on the DB-bound majority; no change for loaders that
are pure XLSX parse, because `XLSX.read` is synchronous and serializes
on the event loop regardless.

Things to know: the process-wide sheet cache is safe under this (the
parse is synchronous, so two loaders can't interleave a miss); the
repair anti-join is scoped to one `xseries_id`; and if `dependency_depth`
is ever wrong again, a same-level read-after-write race becomes
possible where today it is merely a stale read — the depth fix on 09/02
is what makes B safe, so keep the reset job ahead of the nightly.

### C. Run the heavy queue in its own process

Same code, one env var (`WORKER_QUEUES=heavy` vs `default,critical,light`)
and a second systemd unit on the worker host. Gains:

- A multi-hour reload's synchronous parsing and GC pauses stop stalling
  uploads and clipboard jobs, which share the event loop today.
- A JS-heap death in the reload process (Addendum 3) no longer fails
  every in-flight upload as "stalled".
- Memory budgets become per-process and observable.

Constraints: exactly one heavy process, concurrency 1 (the MySQL lock
still guards against the web host, but not against a second heavy
worker); schedule registration should run in one process only.

### D. Dependency edge table

`assignDependencyDepth`, `getAllDependencies`, and the clipboard
"reload with deps" path all parse `data_sources.dependencies` JSON with
`LIKE`. `setAllDependencies` already computes the names in TypeScript,
so write a `(series_id, depends_on_series_id)` table at the same time
and make depth assignment an iterative join. Removes the O(depth × N²)
scan, makes dependency expansion an indexed lookup, and gives the UI a
real graph. Medium change; touches the 18:09 job and two collections.

### E. Only if profiling says so

- **Parse off the event loop.** If per-depth timings show parse-heavy
  levels dominating after B, move `XLSX.read` into a Bun `Worker` pool.
  Structured-clone of a large `CellValue[][]` is not free; measure.
- **`data_points` index `(xseries_id, data_source_id, date)`.** The
  read phase of `updateData` scans every vintage the loader ever wrote,
  with a filesort. Real win, but DDL on the largest table — do it as an
  online schema change in a window, not as a migration in a deploy.
- **Bound the clipboard-deps path** (Addendum 3): process depth levels
  in chunks and release Series references between them. Still the
  open cause of the worker's RSS growth; C limits the blast radius but
  does not remove it.

## What shipped — 2026-09-03, second round (A–D)

| # | Change | Where |
|---|---|---|
| A1 | Batch reload writes durations to `app_logs`: the `loader.batch_reload` row now carries `lockWaitMs`, `elapsedSec`, `failed`, `perDepth[]`; plus one `loader.batch_reload.depth` row per level. `withHeavyDbLock` exposes `ctx.waitMs`. | `batch-reload.ts`, `db-lock.ts`, `series-collection.ts` |
| A2 | `data_sources.updated_at` is stamped only when a reload changed data points (insert, demote, promote, or a clear). `updateData` returns `changed`; `LoaderCollection.updateFields` takes `touchUpdatedAt`. The post-nightly sweep is now incremental for real. | `loader-collection.ts`, `series-collection.ts` |
| A3 | The reload's `finally` no longer re-SELECTs the loader row (`updateFields` instead of `update`). | `loader-collection.ts` |
| A4 | Pool: `max` 20 (`DB_POOL_MAX`), `idleTimeout` 300 s (`DB_POOL_IDLE_SEC`). | `db.ts` |
| B | `batchReload` runs `RELOAD_CONCURRENCY` (default 4) series at a time within a depth level; a series' own loaders stay sequential. Heartbeat and `yieldPoint` still per group. `ensureFresh` dedups in-flight fetches per download id so two loaders sharing a handle can't race a half-written file on the mount. | `series-collection.ts`, `download-collection.ts` |
| C | `WORKER_QUEUES` selects which queues a worker process consumes (default: all). `WORKER_SCHEDULES=0/1` overrides where cron schedules register (default: the process consuming `default`). Upload-row reconciliation runs only where `critical` is consumed. | `worker.ts` |
| D | New `series_dependencies` table (loader → dependency *name*, keyed by name across universes as before). Rebuilt atomically by `setAllDependencies` for all universes; maintained on loader create / recompute / delete (best-effort). `assignDependencyDepth` joins it via a temp snapshot instead of the correlated `LIKE`; `getAllDependencies` reads it, falling back to the JSON scan until it has rows. `setAllDependencies` rewrites the `dependencies` column only when it changed and no longer touches `updated_at`. | `loader-collection.ts`, `series-collection.ts`, `prisma/migrations/20260903120000_series_dependencies`, `schema.prisma` |

### Deploy (in this order)

1. **Migration first**, on the DB host or from a checkout:
   `bunx prisma migrate deploy` (creates `series_dependencies`). Until it
   exists: dependency reset fails loudly; `getAllDependencies` logs a
   warning and uses the old scan; loader create/delete log a warning and
   continue.
2. **Restart web and worker together** (web enqueues onto the queues the
   new worker layout expects).
3. **Split the worker** (optional now, recommended): two systemd units on
   the worker host from the same checkout and `EnvironmentFile`, e.g.
   ```
   # udaman-worker.service        Environment=WORKER_QUEUES=default,critical,light
   # udaman-worker-heavy.service  Environment=WORKER_QUEUES=heavy
   ```
   One `heavy` process only. Without `WORKER_QUEUES` a single process
   consumes everything, as before.
4. **Run the dependency reset once** (admin UI → dependency reset, or
   wait for 18:09) so the edge table is populated before the nightly.
   Check `SELECT COUNT(*) FROM series_dependencies` afterwards; expect
   roughly the number of loader→name references (tens of thousands).
5. **Tune if needed**: `RELOAD_CONCURRENCY` (4), `DB_POOL_MAX` (20).
   Watch the nightly's `perDepth` rows in `app_logs` and worker RSS in
   the `Job completed` lines; if RSS climbs with concurrency, lower it.

### Verified locally

`bun run check-types` clean. eslint clean on touched code (the
`no-explicit-any` errors in `src/lib/mysql/hhdb.ts` and the unused
directive at `db.ts:42` predate this work). Tests: catalog 13, workers
87, timeseries 1,356, crawlers 213, lib 24 pass; 1 fail, the known-flaky
`getUser`. Not exercised against a production-sized DB.

### Addendum — 2026-09-03 12:50 HST: first public sweep after deploy failed

The first `public.update` after the round-two deploy died on the UHERO
universe with `connection must be a MySQLConnection` out of Bun's
transaction handler. Cause: the `idleTimeout: 300` added to the pool in
A4. Bun applies the idle timeout to **reserved** connections as well as
pooled ones; the heavy lock's reserved connection is idle for most of a
job, so once it sat still long enough it was closed underneath the lock
holder, and the next query on it (the sweep's `yieldPoint`) failed.
Reproduced locally on Bun 1.4.0 with a 2 s timeout: reserved connection
→ `Connection closed`; pool query and `begin()` after the same idle →
fine. Closing that connection also releases the advisory lock server-side
without any log line.

Fix: `idleTimeout` removed (back to Bun's default of none); `max: 20`
stays. `withHeavyDbLock` now pings its reserved connection every 60 s
while the job runs and logs an error if the ping fails, so a lock lost
to MySQL's own `wait_timeout` (8 h) is at least visible. Redeploy the
worker before the 19:44 nightly — with the idle timeout in place the
nightly would lose its lock connection in the first group that takes
longer than five minutes.

### Addendum — 2026-09-03: no implicit sweeps from targeted reloads

Targeted reloads (BEA, both BLS runs, VAP, UIC) no longer enqueue a
`public.update` when they finish; their scheduler entries carry
`updatePublic: false`. Sweeps now run on a fixed schedule only — 07:15
(new, publishes the 06:00 BEA and 06:30 BLS before the workday), 11:01,
13:01, 15:01, 17:01 — plus the one the nightly batch enqueues and any
clipboard reload job where the user asked for it. This matches Rails
(4×/day + after the nightly) and takes about four lock-holding jobs a
day off the heavy queue. The `updatePublic` flag still works on job data,
so a manual targeted reload can request a sweep. Scheduler keys:
`scheduled:update-public` (07:15) and `scheduled:update-public-afternoon`
(the four later runs); both upsert on worker start.

## /admin/perf — 2026-09-03

Admin → Performance (`src/app/admin/perf`, admin/dev roles). Everything on
it comes from rows the app already writes plus two new ones:

- **`app_logs` category `worker`** — one row per finished job from
  `worker.ts` (`completed` / `failed` events): `{queue, jobId, worker,
  status, waitMs, runMs, rssMB, heapMB, result|err}`. `waitMs` is BullMQ
  enqueue → pickup; `runMs` is pickup → finish. This is the backbone.
- **`app_logs` name `loader.public_sweep`** — one row per universe per
  sweep: `{universe, mode, elapsedSec, updated, inserted, deleted, skipped}`.
- Existing: `loader.batch_reload` (with `perDepth`, `lockWaitMs`),
  `data_sources.runtime` / `last_error_at`, `downloads.last_download_at`.

What it shows: headline tiles (last nightly + lock wait, last UHERO
sweep, failed jobs, loaders erroring in 24 h, downloads with no
successful fetch in 24 h); one small duration chart per scheduled/heavy
job, each on its own scale, failed runs marked; the nightly's per-depth
seconds as stacked bars with a run table; longest queue wait per day per
queue; worker RSS after each job per worker; tables for sweeps, failed
jobs, slowest loaders, loader errors, stale downloads. Period 7/30/90 d.

Charts use a validated categorical palette (light/dark pairs, checked
with the dataviz validator against the app's surfaces) rather than the
theme's `--chart-*` tokens, which fail the colorblind-separation and
contrast checks in light mode. Every chart has a table under it.

The page fills in as the new worker build runs jobs; before that only
the loader/download tables have data. Not yet rendered against
production data — check label collisions on the small multiples once a
week of runs exists.
