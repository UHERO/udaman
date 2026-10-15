# Downloaders & Extractors — Phase 1 report (2026-10-14)

Spec: `docs/2026-10-14-downloaders-extractors-spec.md`. This is the
"explore and report" phase, so no code has been written. Counts below come
from the local `uhero_db_dev` and cover enabled loaders only.

## 0. Summary

- **Most of the spec fits cleanly.** The six tables, a source registry, a
  runner, one generic `load_from_extract` and save-time validation can all be
  built alongside today's Downloads and load methods without changing them.
- **The Downloads storage layer is not reusable.** It keeps one file per
  handle, overwritten in place, with no hash and no history (§1.1). Raw
  artifacts need their own content-addressed store; small helpers can be
  reused.
- **The parsing code from the staging Downloaders carries over almost as-is.**
  DOTAX parse, site, config and checks, and the BLS client become the first
  two source modules. The framework around them (`run.ts`, `tidy.ts`,
  `load.ts`, `keys.ts`, the `downloaders` table and the `downloads.downloader_*`
  columns) is what Phase 6 removes.
- **Decisions needed.** §3 lists 13 places where the spec conflicts with the
  code or the two pilot sources, each with a recommendation. Items 1–3, 5 and
  7–8 change the schema or the Phase 3 scope, so I need answers to those before
  Phase 2.

## 1. What exists today

### 1.1 Downloads (legacy, in prod)

| Aspect           | Today                                                                                                                                              | Where                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Storage          | One flat file per handle: `DATA_DIR/rawdata/<handle with @→_>.<ext>`                                                                               | `models/download.ts:81-117`      |
| Versions         | The previous file is overwritten. Superseded copies are kept only when the caller passes `keepSupersededIn`, which only the staging Downloaders do | `download-collection.ts:210-217` |
| Change detection | A byte compare with the old file; **no hash**                                                                                                      | `download-collection.ts:203-208` |
| Write            | `Bun.write`, not atomic, and it rewrites unchanged files (mtime moves on every fetch)                                                              | `:220-221`                       |
| Soft-404 guard   | `looksLikeHtmlPage` (exported, reusable)                                                                                                           | `:495-517`                       |
| Fetch log        | `dsd_log_entries`, one row per download per day per status                                                                                         | `:239-256`                       |
| Date patterns    | `%Y@hiwi.org` → `REGEXP` over concrete handles; each year is its own row and file                                                                  | `:92-120`                        |
| Freshness        | `ensureFresh` at load time (1 h memo, stale file used if the fetch fails)                                                                          | `:286-377`                       |

`load_from_download` runs
`EvalExecutor` → `SeriesCollection.loadFromDownload` (`series-collection.ts:2023`) →
`ensureFresh` → `DownloadProcessor.getData`, which walks the dates and resolves
`row`/`col` positional specs (`header:col:1:…`, `repeat:2:13`) against cached
sheets.

`load_api_bea` / `load_api_bls` fetch live on every eval, with no raw copy
(`wrapApiResult`, `series-collection.ts:2332`).

### 1.2 Downloaders (staging only; migration applied to local DB only)

`src/core/downloaders/` (rev 5, `docs/2026-10-12-downloaders-plan.md`)
already has roughly the spec's Acquire/Extract split, but merged into one
`impl.run()`:

| Spec concept                 | Staging Downloaders equivalent                                                                                   | Gap                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| data_downloaders             | `downloaders` row + `DownloaderImpl` in `registry.ts`                                                            | One row is _both_ fetch and parse. No strategy column; schedules are hard-coded in `scheduler.ts:284-320` |
| raw_artifacts                | Source `downloads` rows (`downloader_role='source'`), plus `superseded/` copies                                  | No hash, no artifact table, file overwritten in place                                                     |
| fetch_runs / extraction_runs | `downloaders.last_*` columns (last run only) + `app_logs` worker rows                                            | No per-run history; CLI runs leave no record                                                              |
| data_extractors              | none (parse is inside `run()`)                                                                                   |                                                                                                           |
| Extract output               | Output `downloads` row, a long CSV (`tidy.ts`)                                                                   | Written in merge/replace mode, with no record of which inputs produced it                                 |
| Skip unchanged               | DOTAX `parseFingerprint` (sha1 of path:size:last_change_at)                                                      | Per-source, not framework                                                                                 |
| Validation                   | DOTAX `checks.ts` with known-issue waivers; `failOnProblems`                                                     | Per-source only                                                                                           |
| load method                  | One method per source (`load_from_bls_api`, `load_from_dotax_*`) with positional args and label-alias resolution | Spec: one `load_from_extract` with named filters                                                          |
| Load-time freshness          | `ensureFreshKey` runs the downloader inline when stale or when a key is missing                                  | Spec: loads read the latest successful extract only                                                       |

Local DB: **1,905** DOTAX-universe loaders use `load_from_dotax_archive`
(1,200) / `load_from_dotax_current` (705). No loaders use
`load_from_bls_api` yet.

### 1.3 Load statements

- **Storage.** `data_sources.eval` is VARCHAR(500). `LoaderCollection.reload`
  calls `EvalExecutor.run(eval, universe)`, then `scaledData`, then
  `SeriesCollection.updateData`. Errors go to `last_error` (255 chars).
- **Parser.** It already accepts `{ table: "fuels", county: "Kauai" }`, the
  Ruby `{ :k => v }` form and bare kwargs as an `options` argument
  (`eval-parser.ts:235-262`, `:642-671`). String keys (`"table": …`) are
  **silently dropped**. Phase 4 must make that an error for `load_from_extract`.
- **Dispatch.** `ALLOWED_STATIC_METHODS` → `SeriesCollection[camelName](...args)`
  (`eval-executor.ts:113-132`, `:1218-1234`).
- **No target series context.** `EvalExecutor.run` takes only `(eval,
universe)`, so a static loader cannot see `@HI.M`. Frequency inference needs a
  new optional context argument, passed from `LoaderCollection.reload` (§3.10).
- **No save-time validation.** The client zod check is `min(2)`. The eval is
  never parsed when saved. All create paths meet in `LoaderCollection.create`
  (`loader-collection.ts:128`), but edits go through `update` → `updateFields`
  (`:178-220`), which recomputes nothing. Several writers bypass the controller:
  bulkCreateSeries, duplicateSeries, the upload controllers and
  `databook/apply.ts`.
- **How errors reach the UI.** A thrown error in the server action is
  rethrown, then the client shows `toast.error(error.message)`. Next.js
  production builds normally redact thrown server-action messages, so a "did
  you mean" suggestion should be _returned_, not thrown. I have not confirmed
  the redaction in this repo.

### 1.4 Jobs, scheduling, history

- **Queues.** BullMQ has `default`, `critical`, `heavy` (concurrency 1, MySQL
  heavy lock) and `light`. Processors are registered by job name in
  `processors/index.ts`. Staging's `downloader.run` is on `default`, outside the
  heavy lock, and the same fits here: fetch and extract never write
  `data_points`.
- **Crons.** Code-defined `upsertJobScheduler` calls in `scheduler.ts`, active
  only when `NEXT_PUBLIC_APP_ENV=production`.
- **Job history.** `app_logs` is the only generic history: one
  `category='worker'` row per BullMQ job, with JSON metadata. It has no FK, no
  purge, and CLI runs bypass it. That is **not enough** to answer "which inputs
  produced the latest successful extract", so I recommend keeping dedicated
  `fetch_runs` / `extraction_runs` as the spec allows. Workers keep writing
  `app_logs` as today.
- **Other history tables are specific:** `reload_jobs` (series reloads,
  purged after 7 days) and `dsd_log_entries` (Download fetches).

### 1.5 Schema, DB access, tests

- **Migrations.** Hand-written MySQL in
  `src/lib/prisma/migrations/<ts>_<name>/migration.sql`, mirrored in
  `schema.prisma`, with permission rows seeded in the same file.
- **Runtime DB access.** Raw SQL via the `mysql` tagged template
  (`@/lib/mysql/helpers`), with static Collection classes plus Model classes.
  The Prisma client is unused at runtime for uhero, so the new
  models/collections follow `downloader-collection.ts`.
- **Tests.** `bun test <dir>`, colocated `*.test.ts`, with colocated
  `fixtures/` dirs read via `join(import.meta.dir, "fixtures")` (mls, dcca,
  qpub). No DB mocking layer exists, and the staging downloader tests are pure,
  plus one `mock.module`. The runner tests therefore need either a seam that
  injects the collections, or a test schema. §4 recommends the seam.
- **Hashing precedent.** `databook/fetch.ts` keeps sha256 per file in
  `hashes.json`. Atomic write helpers (tmp + rename) exist in `tidy.ts`,
  `crawlers/dcca/cache.ts` and `databook/store.ts`.

### 1.6 External scripts (the "legacy" sources)

- **Where the R scripts run.** `DATA_DIR/rprocess/*.R` runs from
  `autorun_{1hr,daily,monthly}.R`, which `setwd("/Volumes/UHEROroot/...")`, i.e.
  **on a workstation with the share mounted, not on the app server**. They post
  errors to Slack.
- **Their output.** Wide CSVs in `rparsed/` whose **column headers are UDAMAN
  series names**: `DATE,LFNS@HI.M,EMPLNS@HI.M,...`.
- **How they are loaded.** 2,887 loaders read them with
  `"X".tsn.load_from "rparsed/<file>.csv"`. The largest users are `qcew_wage`
  (1,164), `womply_d`/`womply_w` (305 each), `sa_tour` (185) and `dotax`
  (80).

## 2. How the spec maps onto the codebase

| Spec element         | Proposed home                                                                                                                                                                                                               | Reuse                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 6 tables             | Migration `20261015000000_create_data_ingest` + `schema.prisma`; models `DataDownloader`, `RawArtifact`, `FetchRun`, `DataExtractor`, `ExtractorInput`, `ExtractionRun` in `src/core/catalog/models`, collections alongside | Pattern of `downloader-collection.ts` (claim/finish)                                     |
| Table names          | Spec names as written. `data_downloaders` avoids the staging `downloaders` table until Phase 6 drops it                                                                                                                     |                                                                                          |
| Source registry      | `src/core/ingest/registry.ts`: `source_key → SourceModule`                                                                                                                                                                  | `downloaders/registry.ts` shape                                                          |
| Source modules       | `src/core/ingest/sources/{dotax,bls}/`                                                                                                                                                                                      | Move `downloaders/dotax/{parse,site,config,checks}.ts` and `api-clients/bls.ts` batching |
| Raw store            | `DATA_DIR/ingest/raw/<downloader handle>/<sha256>.<ext>`, content-addressed, atomic write; retention = one file per distinct hash (spec)                                                                                    | `looksLikeHtmlPage`, fetch UA/timeout from `download-collection.ts`; tmp+rename helper   |
| Extract outputs      | `DATA_DIR/ingest/extracts/<extractor handle>/<run id>.csv` (§3.11)                                                                                                                                                          | CSV writer/reader + mtime/size index cache from `tidy.ts`                                |
| Runner               | `src/core/ingest/run.ts`: claim → fetch → store/hash → record → for each dependent extractor: skip-if-same-inputs → parse → validate → write → record                                                                       | Claim/stale-horizon logic from `run.ts` / `downloader-collection.ts`                     |
| Jobs                 | `ingest.fetch` (a downloader plus its dependent extractors) and `ingest.extract` (re-parse only) on `default`; per-handle jobId dedup                                                                                       | `enqueueDownloaderRun` pattern                                                           |
| `schedule` column    | The worker reads enabled `data_downloaders` at startup and upserts one scheduler per row (`scheduled:ingest-<handle>`), removing orphans; saving a schedule also upserts it                                                 | `scheduler.ts`                                                                           |
| CLI                  | `bun run ingest list                                                                                                                                                                                                        | fetch <h>                                                                                | extract <h> [--force] | show <h>` | `downloaders-cli.ts` (top-level `await`) |
| load method          | `SeriesCollection.loadFromExtract(handle, filters)` + allow-list entry                                                                                                                                                      | `fromDownloader` shape                                                                   |
| Save-time validation | Called from `LoaderCollection.create` / `update` (when `eval` changes) for evals containing `load_from_extract`; walks the AST like `keys.ts findCalls`                                                                     | `keys.ts`                                                                                |
| UI                   | Not in the spec's phases; see §3.13                                                                                                                                                                                         | Staging downloaders pages/components                                                     |

All of this is additive. `load_from_download`, Downloads, `ensureFresh` and
the API loaders stay untouched. The only shared code that changes is the
optional context argument to `EvalExecutor.run` (§3.10), which existing
methods ignore.

## 3. Conflicts and decisions

Each item gives the conflict and then my recommendation (**Rec**).

### 3.1 A downloader yields many files, not one (affects the schema)

**Conflict.** The spec has one artifact per vintage and
`fetch_runs.raw_artifact_id` (singular). Both pilots fetch _sets_:

- DOTAX current lists about 82 XLSX files (one per report per month).
- DOTAX archive is about 280 zips.
- BLS sends 457 distinct series IDs in 50-ID batches, across several year
  windows.

A row per file does not work for DOTAX, because the files are discovered and a
new one appears every month.

**Rec.**

- Add a generic `artifact_key` column to `raw_artifacts`: the logical file
  within the downloader, e.g. `collec/2025-12`, `zip/2019-01`, or a URL-derived
  name for single-file downloaders.
- Make it unique on `(downloader_id, artifact_key, content_hash)`.
- Replace `fetch_runs.raw_artifact_id` with a `fetch_run_artifacts` join
  (`fetch_run_id, raw_artifact_id, changed`).
- An extractor's input set is then **the latest artifact for each
  `artifact_key`** of each input downloader, by default.
- A source can ask for every retained vintage instead (BLS, §3.3).

### 3.2 Files that never change ("historical")

**Conflict.** DOTAX archive zips and closed-year current files must not be
refetched: about 280 requests at 1 s each, plus a 10 s page delay. Staging
uses `downloads.historical` for this.

**Rec.** Add a `final` flag on `raw_artifacts`. The source sets it through
`ctx`, and the strategy skips keys whose latest artifact is final, unless
`--full`.

### 3.3 BLS doesn't fit "one response = one raw file" cleanly

There are three problems:

**a) The hash changes on every request.**

- The v2 JSON includes `responseTime` and `message`, so a raw-byte hash makes
  a new "vintage" every run.
- **Rec:** the source module may supply `hashContent(bytes)` (for BLS, hash the
  `Results` part only). The file is still stored unchanged.

**b) Which IDs to fetch.**

- Today the IDs come from the load statements that reference the source
  (`keys.ts`).
- The alternative is an explicit ID list in `data_downloaders.config`.
- **Rec:** keep deriving them from load statements, via a framework helper
  `ctx.referencedFilters(extractorHandle)`, plus an optional `extra_ids`
  config. This is filter values, not series names, so it doesn't violate the
  principle, and adding a BLS loader keeps "just working" after the next fetch.

**c) Incremental windows.**

- Full history is fetched once per ID; after that only the last 20 years are
  fetched.
- **Rec:** keep one artifact per request, with `artifact_key` set to the batch
  and window, and give BLS parse every retained artifact.
- Its rule is "the newest artifact that contains (series, date) wins", which
  is still a pure function of the stored files.
- The responses are small, and distinct-hash retention keeps the growth to
  real revisions.
- Extract dims: `series_id, frequency`, so
  `load_from_extract("bls", { series_id: "CUSR0000SA0" })` infers M from
  `@US.M`.

### 3.4 The Phase 3 strategies don't cover the pilots

**Conflict.** Phase 3 lists `static_url`, `discover_from_page` and
`legacy_script`.

- DOTAX discovers **many** files across two pages, with politeness delays and
  zip-name guessing for unlinked months.
- BLS is a batched POST API.
- Both need `custom`.

**Rec.** Phase 3 implements `static_url`, `discover_from_page`, `custom` and
`legacy_script`.

- DOTAX and BLS start as `custom`.
- BLS moves to `api` when that strategy exists.
- `ctx` provides `get`, `findLinks`, `download(url, artifactKey)` and
  `sleep`/politeness.

### 3.5 DOTAX relabels vs "zero matches is an error" (affects load behavior)

**Today.** Load arguments and output rows both resolve through
`config/labels` to an internal key, so an old spelling in a load statement
still finds the series. The output prints each series under its **latest**
spelling.

**Under the spec.** Filters must match the extract exactly. That removes the
alias layer, so a DOTAX relabel will:

1. fail the "no series disappeared" check (the old label vanishes), and keep
   the previous extract live;
2. need a person to update the affected load statements.

That is the spec's intended "fail loudly", but it needs an **acknowledge
path**, or the extractor is stuck on the old output forever.

**Rec.**

- The extractor emits one label per series, the latest printed spelling (as
  now).
- Load-time alias resolution goes away.
- A failed run whose only failures are _soft_ checks (disappeared series,
  large jumps) can be **accepted** from the CLI or UI. That records who
  accepted it and publishes the output.
- Hard failures (columns, duplicates, non-numeric values, dates) cannot be
  accepted.
- Save-time validation suggests the new label.

### 3.6 DOTAX checks use UDAMAN series IDs

**Conflict.** `checks.ts` `mapSeries`, `fillLegacy` and `checkGaps` key on
`config/series` (item → `TGBRTNS@HI.M`-style IDs, with month ranges) and run
the duplicate-ID and gap checks on those IDs. This violates "extractors never
reference internal series names".

**Rec.**

- Drop `config/series` from the extractor.
- Re-express the gap check on source dimensions (type/tax/source/area).
- Keep the source-only checks: districts sum to the state, header month equals
  file month, known-issue waivers.
- The continuity fills are already arithmetic loaders, so nothing is lost.
- The duplicate-ID check moves to the side-by-side diff in Phase 5.

### 3.7 DOTAX: one extractor or several, and dimension names

The spec's example uses `dotax_current` with dims
`table, measure, item, county`. The rev-5 design you approved yesterday uses
`type, tax, source, area`, and the Google Sheet headers were renamed to
match.

`area` also takes `State` and `Unknown`, so `county` is inaccurate.

**Rec.**

- Keep `type, tax, source, area`.
- Use **one `dotax` extractor with two inputs** (`dotax_current` and
  `dotax_archive` downloaders). The source's existing month ranking
  (`pickPerMonth`: revision marker, then file date) picks one file per
  (report, month) across both.
- That matches `dotax.R`'s single `dotax.csv`, and most series go back to one
  `load_from_extract` loader instead of the archive/current pair.
- The Google Sheet stays a separate `dotax_sheet` extractor: it has its own
  labels and is State only.

### 3.8 `legacy_script` (affects the Phase 3 scope)

**Facts.** The R scripts run on a workstation against
`/Volumes/UHEROroot`, not on the server. I don't know if the server has R and
the tidyverse. Their outputs use UDAMAN names as column headers.

**Options.**

- **(a) Run `Rscript`** on the worker host and capture the files it writes as
  raw artifacts. This needs R on the server, plus a per-script declaration of
  its output files.
- **(b) Ingest the existing `rparsed/<file>.csv`** as the raw artifact,
  watched by hash. A generic `wide_csv` extractor then emits dims
  `{column}` + date + value.

**Either way** the dimension values are UDAMAN names. That's unavoidable for
legacy mode and should be accepted as transitional; the source is replaced by
a real extractor when it's ported.

**Rec.** (b) first: no server dependency, and it gives every rparsed source
run history and failure visibility right away. Do (a) later if the server gets
R.

### 3.9 Load-time freshness and new series

**Conflict.** Staging runs a fetch inline at load time when the output is
stale or a key is missing. The spec's layering says loads read the latest
successful extract only.

**Rec.**

- No fetch at load time.
- Schedule and manual runs only.
- A new BLS ID gets data after the next fetch.
- Save-time validation says "not in the latest extract — it will be fetched
  on the next run (Run now?)" for sources whose fetch is driven by load
  statements, instead of rejecting the statement.

### 3.10 Frequency inference needs the target series

**Rec.**

- Add an optional third argument, `EvalExecutor.run(eval, universe, { seriesName })`.
- `LoaderCollection.reload` passes it, and only `loadFromExtract` reads it.
- An explicit frequency filter always wins.
- When the frequency is ambiguous and there is no series name (e.g. the
  console), it's an error.

### 3.11 Extract output format

**Rec.** CSV, using the spec's column order and sorted for byte-stable
hashes. There is no Parquet library in the dependencies and Bun has none
built in; the largest expected extract (DOTAX archive and current, about
100k rows) is a few MB.

**Retention.**

- Keep every successful output: they are small, and they are what "previous
  vintage" checks diff against.
- Prune failed outputs after 30 days.

### 3.12 Normalization and matching rules (minor)

**Rec.**

- The extractor normalizes labels: trim, collapse whitespace, strip footnote
  markers, and curly quotes → ASCII (the same as `DownloadProcessor`'s
  `to_ascii`).
- Filter matching is exact on those normalized values, **case-sensitive**.
- Save-time suggestions use case-insensitive edit distance.
- Filter keys must be declared dimensions, and unknown keys are an error.
- `load_from_extract` rejects string-keyed hashes, which the parser silently
  drops today (§1.3).

### 3.13 Phase 6 removal, the local DOTAX loaders, and the UI

**The removal itself is clean.**

- Staging is ahead of prod, and the `20261013000000_create_downloaders`
  migration was only applied locally.
- Phase 6 can **delete that migration folder** instead of shipping a drop
  migration.
- It then drops `downloaders` and the three `downloads` columns locally with a
  one-off script.

**But two things depend on that code.**

- **The 1,905 local DOTAX loaders** call `load_from_dotax_*`. They must be
  converted to `load_from_extract` (rerunning `convert-dotax-loaders.ts`,
  retargeted) and diffed **before** Phase 6. Otherwise they start failing. The
  original `dotax.csv` loaders are still there, disabled at priority 10, as a
  fallback.
- **The UI.** Phase 6 would delete the only UI. **Rec:** retarget the staging
  Downloaders pages to the new tables as part of Phase 6, with list, detail,
  runs, artifacts, Run now and Accept, rather than leaving the feature
  CLI-only.

## 4. Proposed adjustments to the phases

- **Phase 2:**
  - The six tables plus `fetch_run_artifacts`, `raw_artifacts.artifact_key`
    and `raw_artifacts.final`.
  - `extraction_runs.accepted_by` / `accepted_at` (§3.5).
  - Seeds for `dotax_current`, `dotax_archive`, `dotax_sheet`, `bls` and the
    extractors.
  - `role_permissions` rows for a new `ingest` resource (admin/dev).
- **Phase 3:**
  - The runner with the four strategies (§3.4).
  - A store/collection seam so runner tests use fixture artifacts and an
    in-memory store, with no DB and no network.
  - Fixture files: a handful of the cached DOTAX XLSX files (current
    plus one archive zip) and two recorded BLS responses, copied into
    `src/core/ingest/sources/*/fixtures/`.
  - Port DOTAX and BLS as source modules here, since they are the runner's
    real test cases.
- **Phase 4:**
  - `load_from_extract`, the executor context argument and save-time
    validation.
  - Validation returns warnings and suggestions to the loader dialogs. It does
    not throw.
- **Phase 5 pilots:**
  - **Legacy:** one `rparsed` file via §3.8(b). `hiwi_lf.csv` (24 loaders)
    is small and self-contained.
  - **Full split:**
    - UHERO's 361 `load_from_download("tax_GE%Y_%m@hawaii.gov" /
"tax_collec%Y_%m@hawaii.gov", …)` loaders. These are positional
      `header_range` row specs plus `.shift_by(-12)` prior-year tricks:
      exactly the brittle case.
    - They move onto the `dotax` extractor, diffed against current values.
    - The DOTAX-universe conversion (§3.13) can run in the same phase.
- **Phase 6:**
  - Remove `src/core/downloaders`, the `load_from_bls_api` /
    `load_from_dotax_*` methods, the `downloader.run` job and its crons, the
    migration folder and the `downloads.downloader_*` / `historical` columns.
  - Retarget the UI.
  - `docs/2026-10-12-downloaders-plan.md` gets a "superseded" header.

## 5. Questions for you

1. **Multi-file downloaders:** are `artifact_key`, `final` and a
   `fetch_run_artifacts` join OK (§3.1–3.2)?
2. **BLS:** should the IDs come from load statements (as now) or from an
   explicit config list? Is a content hash over `Results` only OK (§3.3)?
3. **DOTAX relabels:** OK to drop the alias layer, with an "accept" action on
   soft validation failures (§3.5)?
4. **DOTAX shape:** one `dotax` extractor over current and archive, with dims
   `type, tax, source, area` (§3.7)?
5. **legacy_script:** ingest the `rparsed` outputs (b) or run `Rscript` on the
   server (a)? Does the server have R (§3.8)?
6. **Pilots:** is `hiwi_lf` the legacy pilot and the UHERO `tax_*@hawaii.gov`
   loaders the full split (§4)?
7. **UI:** retarget the Downloaders pages in Phase 6, or leave the new system
   CLI-only for now (§3.13)?
