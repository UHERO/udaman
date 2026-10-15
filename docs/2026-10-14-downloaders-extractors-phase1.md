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

## 6. Decisions (2026-10-14, after review)

1. **Many artifacts per downloader.** A downloader has many raw artifacts:
   files, or cached API responses. Each artifact has an `artifact_key`, the
   logical file within the downloader. An artifact has one row per distinct
   content hash. A `final` flag marks keys that are never refetched. Fetch runs
   link to the artifacts they saw through `fetch_run_artifacts`.
2. **BLS.**
   - The IDs come from the load statements that reference the BLS extractor.
   - Requests are still batched (50 IDs), but **each series is cached as its
     own artifact** (`artifact_key` = series ID, plus the year window). The
     hash is per series, so batch composition and `responseTime` don't
     matter.
3. **DOTAX labels are aliased in the extractor.**
   - The raw files keep whatever DOTAX printed, typos and relabels included.
   - The extractor maps every known spelling of a row to **one fixed label**,
     so load statements use a stable name.
   - A spelling no rule recognizes is a parse failure. It does not become a
     new series.
4. **One `dotax` extractor** over the current and archive downloaders, with
   dims `type, tax, source, area`. Extractors can be generic and reused: an
   extractor row names a parser module plus config, and several extractors
   may share one module.
5. **No `legacy_script` strategy.** The `rparsed` sources are ported one at a
   time as real source modules.
6. **No pilot phase.** Sources are ported one by one and compared as they go.
   BLS and DOTAX already have data in the DB, so verification is reloading
   them through `load_from_extract` and checking that vintages were created.
7. **UI.** The staging Downloaders UI is removed, and a new UI is built for
   the new tables.

### Revised phases

- **Phase 2 — schema, models, registry.**
  - Tables: `data_downloaders`, `raw_artifacts`, `fetch_runs`,
    `fetch_run_artifacts`, `data_extractors`, `extractor_inputs`,
    `extraction_runs`.
  - Models and collections for each.
  - The source-module contract and registry.
- **Phase 3 — runner.**
  - fetch → store/hash → record → skip-if-same-inputs → parse → validate →
    write → record.
  - Strategies: `static_url`, `discover_from_page` and `custom`.
  - DOTAX and BLS source modules with stored fixtures.
  - Seed rows, the `ingest` job and CLI, and schedules from
    `data_downloaders.schedule`.
- **Phase 4 — load method.** `load_from_extract`, the executor context
  argument for frequency inference, and save-time validation with
  suggestions.
- **Phase 5 — new UI.** Downloaders, extractors, runs and artifacts, with
  `ingest` permissions.
- **Phase 6 — removal.**
  - Remove the staging Downloaders code, UI, load methods, job and migration.
  - Before removing them, convert the local DOTAX-universe loaders to
    `load_from_extract`.

## 7. Phase 3 status (2026-10-14): runner, strategies, DOTAX and BLS

**Code.** All of it is in `src/core/ingest/`:

- **`run.ts`.** `runFetch` and `runExtract`.
  - Fetch: claim → strategy → store and hash → record the run → release →
    extract the dependent extractors.
  - Extract: claim → input artifacts → skip if the inputs hash matches the
    last ok run → parse → validate → write the extract → record → release.
  - A fetch with any failed key is `failed` and does not trigger
    extraction. Any failed check makes the extraction `failed`, so loads
    keep the last ok output.
  - Nothing enqueues reloads.
- **`strategies.ts`.** Three strategies:
  - `static_url`, with `%Y %y %m %b %B %d %q` patterns over periods.
    Older periods are final, and a 404 for the newest period is a warning.
  - `discover_from_page`, which can follow `via` links first.
  - `custom`.
- **`context.ts` and the `FetchContext` contract (`types.ts`).** `get`,
  `getPage`, `store`, `download` (refuses HTML posing as a data file and
  records `Last-Modified`), `finalKeys`, `markFinal`, `referencedFilters`,
  `state`, `keyFailed` and `warn`.
- **Storage.**
  - `raw-store.ts` stores raw files content-addressed under
    `DATA_DIR/ingest/raw/<downloader>/<sha256[0:2]>/<sha256>.<ext>`, written
    atomically.
  - `extract-file.ts` writes extracts to
    `DATA_DIR/ingest/extracts/<extractor>/<run id>.csv`, sorted for stable
    bytes, and has a cached index reader that Phase 4 will use.
- **`validate.ts`.** The framework checks:
  - Hard: not_empty, columns, dates, values, duplicates.
  - Soft: disappeared (unless `config.checks.allowDisappeared`) and changes
    (`config.checks.maxChange`).
  - Parse can also return its own checks.
- **`references.ts`.** Finds the `load_from_extract("handle", {…})` calls in
  enabled load statements by parsing each eval. BLS uses it to get its
  series IDs.
- **Sources.**
  - `sources/dotax/`. One module for both downloaders
    (`config.kind` = current or archive) and the `dotax` extractor.
    - It reuses the ported R parser and checks from
      `src/core/downloaders/dotax/`. Phase 6 moves those files here.
    - `canonical.ts` is the fixed label per row: 278 items, generated by
      `scripts/generate-dotax-canonical.ts`, which only adds missing rows.
    - A row with no fixed label is a soft `new_label` failure.
    - Gaps keyed by source labels are listed but never fail the run. There
      are 454 historical holes that `dotax.R` bridged through its series map.
  - `sources/dotax-sheet.ts`. Stores the Sheets API response; a month with
    two amounts is a hard failure.
  - `sources/bls.ts`. Batched requests, one artifact per series and window
    (`<id>/<start>-<end>`). History is walked once, then only the last 20
    years are refetched. Parse reads all vintages and the newest value
    wins.
- **Runtime and seed wiring.**
  - Jobs `ingest.fetch` and `ingest.extract` run on `default`, without the
    heavy lock.
  - `workers/ingest-schedules.ts` creates one scheduler per
    `data_downloaders.schedule`, in production only.
  - CLI: `bun run ingest list | fetch | extract | runs | run | accept |
artifacts | series`.
  - Seeds are in migration `20261014120000_seed_data_ingest`.
  - `extraction_runs.stats` was added to the Phase 2 migration.
- **Tests.**
  - `run.test.ts` covers the runner against `testing/memory-db.ts`, a fake
    HTTP layer and a temp `DATA_DIR`.
  - `sources/sources.test.ts` covers BLS against a fake API, and the sheet.
  - `sources/dotax/dotax-source.test.ts` parses real fixtures (the 2025-06
    archive zip plus the 2025-07 current files) and covers the current-page
    fetch from fake HTML.
  - No test touches the network or MySQL.
  - The fixtures are excluded from the `*.xlsx` gitignore rule.

**Live verification on local `uhero_db_dev`.**

- **`dotax_current`.** 82 files in 116 s, 42 marked final. A re-fetch
  skips those 42.
- **`dotax_archive`.** 283 zips in 392 s, all final. One month that the page
  does not link was found by guessing its URL.
- **`dotax` extract.** 1,448 report files in about 11 s: 1,185 series,
  206,606 rows, 0 open problems and 31 known issues waived.
  - **Parity with the staging Downloaders' outputs:** both have 206,606
    rows, with **0 value differences**.
  - The only label differences are 4 collec rows × 5 areas. The staging
    archive output printed the archive's spelling (e.g. "GE License/Fees")
    and the current output the newer one ("GE Licenses"). The extract now
    prints the fixed name across the whole history.
- **`bls`.** Run with two series via a temporary `extraIds`, since no
  `load_from_extract("bls")` statements exist yet.
  - Full history took 9 requests: CPI back to 1913, 1,971 rows.
  - A re-fetch took 1 request and was `unchanged`, even though the response's
    `responseTime` differs.
- **`dotax_sheet`.** Not run live; it needs the Google credentials.

**Carried into Phase 4.**

- `load_from_extract` and the `EvalExecutor` context argument for frequency
  inference.
- Save-time validation.
- The eval tokenizer counts braces inside quoted strings, so a `}` in a
  filter value breaks parsing.
- The DOTAX-universe loader conversion must use the fixed labels; the 4 row
  names above changed.

## 8. Review round 2 (2026-10-14) and Phase 4

### Answers

- **How R handled DOTAX gaps.** R did not bridge them. `dotax_parse.R`
  checked gaps only for series the series map tied to a UDAMAN id.
  - Each hole it found was waived by hand in `known_issues`, with a note.
    Example: "fund ended; DOTAX dropped the row 2021-07..2022-12".
  - Series without a mapped id were never gap-checked.
  - Those waivers were keyed by UDAMAN id, so the new source-keyed check
    could not apply them. That is why 454 "new" gaps appeared.
  - They are now re-keyed to source keys in
    `sources/dotax/config/known-issues.ts`.
- **Fixed labels.** Load statements break only if DOTAX prints a spelling
  that no label rule recognizes. Even then, what fails is the _extraction_,
  and loads keep reading the last ok extract until a rule is widened.
  - A new spelling that a rule matches maps to the same item, which keeps
    its fixed label.
  - "Latest spelling" was only how the table was seeded on 2026-10-14; the
    table does not follow later spellings.
  - One hole was closed: collec distribution had a catch-all rule
    (`^(.+)$`), so DOTAX's 2006-01 typo "Domestic Viloence/…" had silently
    become its own series.
    - There are now explicit rules for the 19 funds the catch-all covered.
    - The typo now folds into `domestic_violence_fund`.
    - Any new or misspelled fund is now an `unknown_label` failure.
    - Run #6 was accepted for the one disappeared series this caused.

### Changes

- **Missing periods** (`ParseResult.missing`, written to
  `<run>.missing.csv`). Every period without a value inside a series'
  range is one of:
  - `blank`: printed with no value.
  - `absent`: the file was read, but the row is not in it.
  - `failed`: the period could not be read, and a known issue waived it.
    Unwaived read failures fail the run.

  The DOTAX extract now has 39 blank, 381 absent (74 of them with
  known-issue notes) and 163 failed periods.
  - The failed ones are fuels 2026-05: the allocation table was pasted as
    text, so 73 county fuel series are unreadable.
  - And liqtob 2012-10: the zip holds the November file, so 90 county
    liquor and tobacco series have no value.

  BLS reports "-" and "(NA)" values as blank.

- **One file layout for every source.** `sources/<source_key>/` holds
  `index.ts`, `fetch.ts` and `parse.ts`, with `fetch-*.ts` / `parse-*.ts`
  helpers, plus optional `checks.ts`, `config/`, `fixtures/` and
  `<source_key>.test.ts`. See `src/core/ingest/README.md`.
  - The DOTAX parser, label rules and checks moved here from
    `src/core/downloaders/dotax/`. The old paths re-export them until
    Phase 6, so the 1,905 local `load_from_dotax_*` loaders keep working.
    The R series-id checks stay with the staging code.
  - `google-sheets.ts` moved to `src/core/ingest/`, and `bun run ingest
google-auth` was added.

### Phase 4: load method and save-time validation

- **`Series.load_from_extract("handle", { dim: "value" })`.**
  - `SeriesCollection.loadFromExtract` is backed by
    `src/core/ingest/load.ts`.
  - Filter keys must be declared dimensions. Values match exactly after
    whitespace and quote normalization.
  - Zero matches → an error naming the filter and the closest labels.
    More than one → an error listing the dimensions that still vary.
  - A `frequency` dimension is taken from the target series name, and the
    target's frequency must match the source's. DOTAX and the sheet declare
    `M`.
- **`EvalExecutor.run(eval, universe, { seriesName })`.** The context goes
  through an `AsyncLocalStorage`, and only `loadFromExtract` reads it.
  `LoaderCollection.reload` passes the series name, but only for evals that
  contain `load_from_extract`.
- **Save time.**
  - `LoaderCollection.create` and `update` run `checkLoadStatement` for
    evals that call `load_from_extract`, so every writer path is covered.
  - Errors throw `LoadStatementError`. The loader actions return it as an
    `ActionResult` `{ ok: false, error }`, because Next redacts thrown
    messages, and the three loader forms toast it.
  - Warnings are returned and toasted. Example: a BLS series id not fetched
    yet, which the next `bls` fetch will pick up.
- **Verified on local.**
  - 300 DOTAX-universe series, rewritten as `load_from_extract` and run
    through `EvalExecutor`, equal their current data points: 77,026 points,
    0 differences.
  - The save-time messages were checked for a typo, an unknown key, an
    ambiguous filter, string keys, an unknown extractor, a frequency
    mismatch and a BLS new id.
- **Not changed.**
  - The eval tokenizer still counts braces inside quoted strings. No label
    contains `}`, and evals are moving to config objects.
  - No load statements were converted. The universe scripts come after
    this process.

### Found, not fixed

- Bun SQL connections run with `@@session.time_zone = +00:00` locally
  (bun 1.4.4). So `NOW()` written through the app's `mysql` helper is
  UTC, not HST.
  - This affects every NOW()-stamped column, including the staging
    `downloaders` rows.
  - It is pre-existing and needs a decision, e.g. `SET time_zone = 'SYSTEM'`
    on connect.

## 9. Time zone fix and Phase 5 (UI), 2026-10-14

### Session time zone

**The problem.** Bun 1.4.4's MySQL driver runs `SET time_zone = '+00:00'`
on every connection. Bun 1.4.0, which prod runs, does not. Bun has no
per-connection hook, so the fix is per statement.

**The fix.** `src/lib/mysql/session-tz.ts` prefixes every DML statement
with MariaDB's `SET STATEMENT time_zone = 'SYSTEM' FOR …`.

- It is applied in `db.ts` (tagged templates, `rawQuery`, transactions,
  `scopedConnection`, `insertAndGetId`) and in `dvw-db.ts`.
- On Bun 1.4.0 it is a no-op. On 1.4.4, `NOW()` and TIMESTAMP reads are HST
  again; this was verified for each helper.
- It is not applied to hhdb (NAS), whose server time zone is unverified.

### Phase 5: the Ingest UI

The UI lives at `/udaman/[universe]/ingest`. The sidebar item "Ingest" is
gated by the `ingest` permission resource (admin/dev); its rows are in the
seed migration.

- **Overview.** Two tables:
  - Downloaders: strategy, schedule, keys / vintages / bytes stored, last
    fetch, which extractors it feeds, and a "fetch" button.
  - Extractors: inputs, dimensions, the run loads read, last run, and an
    "extract" button.
- **Downloader page** (`ingest/downloaders/<handle>`):
  - Fetch now / Force fetch / Full refetch, plus Release run claim.
  - Config and state.
  - Fetch runs; `?run=` shows a run's failed keys, warnings and the
    artifacts it stored or saw.
  - Stored files: the newest version per key, with version counts, a final
    flag, a link to the source URL and a download link
    (`/api/ingest/artifacts/<id>`).
- **Extractor page** (`ingest/extractors/<handle>`):
  - Extract now / Force re-parse.
  - Inputs, dimensions, and a load-statement template.
  - Extraction runs; `?run=` shows the checks with details, stats and the
    missing periods (blank / not reported / unreadable, with the waiver
    note).
  - An **Accept** button when every failure is soft, and download links for
    the extract and missing CSVs (`/api/ingest/extractions/<id>`).
- **Forms** create and edit downloaders and extractors: strategy, source
  module, schedule (cron, checked), JSON config, inputs with roles. There is
  no delete; rows with history are disabled instead. A schedule edit
  re-registers schedules in production.
- **Actions** (`src/actions/ingest-actions.ts`) return `ActionResult`, so
  validation and permission messages survive Next's production redaction.
  "Fetch now" and "Extract now" enqueue jobs, so a worker must be running.
- **Verified.**
  - The controller was exercised directly against the local DB: overview,
    both detail pages, forms, every validation message, and a create/edit
    round trip.
  - The pages were not opened in a browser.

## 10. Phase 6: removing the staging Downloaders (2026-10-14)

### Local DOTAX loaders converted first

A one-off script rewrote the local DOTAX loaders. It is not committed,
because it depended on the code removed below.

- **Coverage.** All 1,907 loaders (1,905 enabled) moved from
  `load_from_dotax_current` / `load_from_dotax_archive` to
  `Series.load_from_extract("dotax", { type, tax, source, area })`.
- **How each call was rewritten.**
  - The old arguments (any spelling) went through the staging resolver to
    the parser key.
  - The key was printed as the extract's fixed labels.
  - Each filter was checked to match exactly one series of the live
    extract.
  - Only the call was rewritten; chains such as `.trim(...)` were kept.
- **Saving.** Every loader was saved through `LoaderCollection.update`, so
  the save-time validation ran on all of them.
- **Relabeled.** 20 loaders now use a different label: the archive
  spellings of 4 collec rows that DOTAX renamed, now under their fixed
  labels. Example: "GE License/Fees" → "GE Licenses".
- **Backup.** Old and new evals are in
  `data-dir/backup/dotax-loaders-before-load_from_extract-*.csv`.
- **Verified.** Every enabled converted loader, evaluated with its scale,
  equals its series' current data points: 1,905 loaders, 339,481 points,
  0 differences, 0 errors. No reload was run.

### Removed

- **Code:** `src/core/downloaders/` (framework, BLS, DOTAX shims, tests),
  the `Downloader` model and collection, the `downloaders` controller and
  actions, and the Downloaders pages and components.
- **Load methods:** `load_from_bls_api` and `load_from_dotax_*`.
- **Jobs and CLI:** the `downloader.run` job, processor, enqueue helper and
  crons; `bun run downloaders` (`google-auth` now lives in
  `bun run ingest`); `scripts/convert-dotax-loaders.ts`.
- **Schema:** the `20261013000000_create_downloaders` migration (it was
  never applied outside the local DB) and its `schema.prisma` parts.
- **Downloads:** every Downloads file the Downloaders had changed was
  restored to its pre-Downloaders version (`23396923`): model, collection,
  controller, list / detail / form, and the detail page.
- **Sidebar:** the "Downloaders" entry.

### Changed

- **Loader type.** `load_from_extract` loaders are typed "download" (loader
  colours, by-type queries).
- **Loader description.** Reads "loaded from extract <handle> with filters
  shown".
- **Docs.** The loader-actions docs page documents `load_from_extract`.
- **Kept.** The BLS batch-history client functions stay: the existing
  `load_api_bls` batch reload uses them.

### Local DB cleanup

- Deleted the 369 Downloader-owned `downloads` rows and their 370
  `dsd_log_entries`, and the 28 `downloader` permission rows.
- Dropped the `downloaders` table and the three `downloads` columns, so
  `downloads` is back to its original columns.
- Moved the staging files, not deleted, to
  `data-dir/backup/staging-downloaders-2026-10-14/`: 369 `rawdata` files
  and `data-dir/downloaders/`.

### Checks

- **Static checks:** typecheck, lint and 398 tests pass.
- **Extract stability:** a forced `dotax` re-extract after the removal
  wrote byte-identical output (same `output_hash` as the run loads read).

### Still open

- ~~`scripts/create-dotax-universe.ts` still creates the original
  `dotax.csv` file loaders.~~ Done in §11.
- The DOTAX series map that traced UDAMAN names to DOTAX rows
  (`dotax/loaders.ts`) was removed with the staging code; it is in git
  history (`2128abbb`).
- No `load_api_bls` → `load_from_extract("bls")` migration for
  UHERO's 462 BLS loaders has been done.
- Deploying requires applying `20261014000000_create_data_ingest` and
  `20261014120000_seed_data_ingest` on the server.

## 11. DOTAX universe rebuilt on the extract (2026-10-14)

`scripts/create-dotax-universe.ts` now builds DOTAX from the `dotax`
extract and creates `load_from_extract` loaders. It no longer reads
`dotax.csv`. `dotax_series_info.csv` is still read, but only for
descriptions and notes, and it is optional. On the local DB the old
universe was archived, dropped and rebuilt.

### How the script works

- **Series map.** `SERIES_CSV` lists the collections-report rows and the
  rows that stitch several reports, e.g. `TRLINS` for counties: collec
  through 2017-12, then liqtob, then liq. `FAMILIES` generates the
  regular report tables from code tables (stem + line code). Each map row
  becomes one loader with the extract's printed labels, trimmed to the
  row's window. A series exists where the extract has data.
- **Checks.**
  - A map row the parser doesn't know fails the run.
  - An extract series no loader reads is reported. There are none.
  - Duplicate names, mixed units, and portal-name clashes within a list
    fail the run.
- **Priorities.** Loaders at 100. These sit at 90 as fills:
  - TGB/TGR ITO = IT + OT, and SI from SW.
  - The collections-table district column under the county surcharge
    distribution (`TRHSNS@county`).
  - The 2018 Honolulu surcharge row.
  - `TRMTNS@HI.M` = TRMTVR + TRMTRV.
- **Sheet loaders.** The 18 Collections Portal series get a
  `load_from_extract("dotax_sheet", { type, source })` loader at 100 (the
  rest step down 10). They are only added once `dotax_sheet` has output,
  because save-time validation needs an extract. `dotax_sheet` has never
  run, so they are left out for now; rerun the script after its first
  extraction.

### Naming

T + R (collections/revenue) or D (distribution/allocation) + a line code:
two letters for one word, else initials (max 3), leaving out
Fund / Special Fund / and / &. A clash adds the first word's second
letter. UHERO names are kept. Monthly names end in NS; measurement
prefixes drop it.

| Report                          | Stem                 | Examples                                                                                                                                                                                     |
| ------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collections (source of revenue) | TR                   | TREN Environmental, TRFE Fuel & Environmental, TRIF Insurance Fees, TRFUE Fuel (TRFU taken), TRCS / TRHCS county surcharge rows                                                              |
| Distribution                    | TD                   | TD total, TDST state-funds subtotal, TDADF, TDCR, TDCOR (clash), TDCHC, TDDVC, TDEC, TDEVC, TDEMS, TDES, TDESD, TDHR, TDHFS, TDLD, TDLC, TDMT, TDPL, TDSMR, TDTA, TDTE, TDTRS (clash), TDTBC |
| GE base / collections           | TGB / TGR            | subtotals TGB4 (4%), TGBLR (lower rate)                                                                                                                                                      |
| GE by filing period             | TGFB / TGFL          | TGFBRT, TGFLUA                                                                                                                                                                               |
| TAT by filing period            | TTFB / TTFL          | TTFBTA, TTFLTS                                                                                                                                                                               |
| Fuel collections                | TRFU / TRFUS / TRFUC | total / state / county × GA DH DO LH LO AV BG BD OF EP EF, FT and ER subtotals                                                                                                               |
| Fuel quantities                 | TQFU                 | TQFUGA, TQFUEP (barrels), TQFUEF (MMBtu)                                                                                                                                                     |
| Fuel allocation                 | TDFU / TDFUT         | amount / total-tax column × HW AP BO GF EV ES ESD ADF EVC HFS CT CTMA CTMO CTLA FT                                                                                                           |
| Liquor, tobacco                 | TRLI / TRTB          | TRLITC, TRLIWH; TRTBCG, TRTBEL                                                                                                                                                               |
| Tobacco allocations             | TDTB                 | TDTBCR, TDTBTRS                                                                                                                                                                              |

The liquor and tobacco reports split in July 2019 (liqtob through
2019-06, liq/tob from 2019-07, no overlap). Each line is now one series
with a loader per report.

### Result (local DB)

- **Backups.** `UniverseCollection.archiveToCsv` wrote
  `data-dir/backup/20261015-DOTAX-archive/` before
  `deleteUniverse("DOTAX")`. The universe's `data_portal_url` was restored
  after the rebuild.
- **Created.** 260 measurements and 1,094 monthly + 2,188 quarterly/annual
  series. 3,401 loaders (3,383 at 100, 18 fills at 90). 17 data lists.
  None of the loaders have run.
- **Rerun.** A second run is a no-op (0 created).
- **Before** (old universe): 277 measurements, 1,167 monthly series.
  The difference is the merged 2019 liquor/tobacco pairs (77 series) and
  the dropped "Viloence" typo series (the extract folds it into
  TDDVC).

### Verified against the old data

The new monthly loaders were evaluated (scaled, highest priority wins)
and compared with the old universe's current monthly data points (old
names mapped through their loaders' filters, 806 renamed):

- 210,085 old points compared, 0 different.
- 517 old points not produced. All are in the 18 Collections-Portal
  series (2000–2002 months before the report files, and 2026 preliminary
  months) that the old `dotax.csv` took from the sheet. They come back
  with the `dotax_sheet` loaders.
- 848 new points: TRLITC/TRTBTC for the counties are now complete
  (liqtob + liq/tob; the old liqtob slugs stopped at 2017-12 because
  TRLI/TRTB claimed the later months), TRHCS now includes 2018, and
  TRLIPI for each county gains the one 2019-07 liq month.

## 12. DATABOOK on the ingest framework (2026-10-15)

The standalone Data Book pipeline (`bun run databook fetch|extract|propose|match`,
`Series.load_from_databook("NAME")` reading `latest.json`) now runs as an
ingest source. The local DATABOOK universe was converted in place, so its
2002–2024 edition vintages stay.

### Source `databook` (`src/core/ingest/sources/databook/`)

- **Downloader `databook`** (custom fetch, `{"firstEdition": 2002}`, schedule
  `30 3 15 * *`: 03:30 on the 15th of each month). It stores each edition's 24 section workbooks under
  `db<YYYY>/section<NN>`.
  - It tries the current location first, then the archive.
  - Editions older than the newest are final.
  - The newest edition is refetched every run, in case DBEDT revises it in
    place. No revision has been observed: the 2025 files fetched on Oct 10
    and Oct 14 hash the same.
  - The next edition is probed each run; its absence is not a failure.
  - First live fetch: 576 workbooks in 6 minutes.
- **Extractor `databook`**, config
  `{"baseEdition": 2025, "checks": {"maxDate": "2100-01-01"}}` (the
  population projections run to 2050).
  - **Parse:** both adapters on every edition. The 2025 edition defines the
    series (`propose`, with geography taken out of the labels).
    `matchEditions` links every other edition, and the newest edition that
    prints a date wins.
  - **Dimensions:** `section, table, name, geo, unit`.
    - `table` is the 2025 table number, the table's stable id.
    - `name` is the measurement's labels without geography
      (panel > row > column), or the table title when only geography is
      left. "≥" is spelled ">=" (latin1 eval column).
    - Every (table, name, geo) is one series, which is a hard check.
  - **Run:** 31 s and about 1.8 GB peak; 33,634 series, 265,744 rows.
- **Moved from `src/core/databook/`:** `adapters/`, `ir`, `geo`,
  `geoassign`, `labels`, `panels`, `meta`, `naming`, `manifest` (propose
  only) and `match`. `extract.ts` became `edition.ts`.
- **Seed migration:** `20261015000000_seed_databook_ingest` (applied
  locally).

### Universe side (`src/core/databook/`, `bun run databook`)

- **`sync`** replaces `propose` + `match`. It parses the extractor's stored
  workbooks (`source.ts`, through `resolveInputs`), refreshes the manifest
  while keeping the frozen names, records editions, observations and
  interpolate per series, and writes `match-report.csv`. The manifest
  measurements now carry `dims` (the extract's labels).
- **`apply`** writes `load_from_extract("databook", { table, name, geo })`
  loaders, plus `.fill_missing_linear` for pseudo-history. A label holding a
  double quote is single-quoted. The load statement is checked against the
  500-character eval column. Geography names are copied from UHERO where
  UHERO has the handle, and existing rows are updated; the islands UHERO
  lacks are named "<X> Island".
- **`history`** gets each edition from the same match and finds a series by
  its loader's filters.
- **`annual --edition Y`** is now sync, then apply, then history for Y.
- **Removed:** `fetch`, `extract`, `propose`, `match`, `store.ts`'s
  vintage/latest files, `SeriesCollection.loadFromDatabook` and its
  eval-executor entry. `data-dir/databook/{raw,ir,vintages.csv,latest.json}`
  are no longer read and can be deleted.

### Parser fixes found by the extract's checks

- **Dates before 1800.** The hard date check failed on 26 rows dated
  1709–1760. Legacy wide tables read a data row whose values look like
  years as a new header row of periods: Hawaii County deaths "1801 1767 …"
  in 2022's 02.17, parole counts "1753 1798 1769" in 2004's 04.22. The old
  pipeline loaded those points into the database.
  - Years now start at 1800.
  - A year header under a row label must be evenly spaced, so "2019 2020
    2021" qualifies and "1801 1767 1832" does not.
  - `PARSER_VERSION` is 2.

### Units (`meta.ts`)

New rules, after the existing ones (label parentheticals, percent, headnote
"In …"):

- **Measure words.** A measure word starting or ending a label: "Pounds
  landed of commercial fish", "Acreage owned", "… square feet", "… km2",
  "Square miles". Excluded are an abbreviation at the start ("Ft.
  DeRussey"), time words ("18 to 64 years") and "Degrees" without
  Fahrenheit.
- **Mid-label units.** A single unit parenthetical in mid-label: "Mail
  (U.S. tons): incoming".
- **Headnotes.** A headnote that is only a unit ("[Million gallons per
  day]"). "Numbers in $1,000 unless otherwise noted" means Thousands of
  Dollars except named counts.
- **Rank, years and rates.** Rank, "number of years" → Years, "per 100,000"
  → Rate per 100,000.
- **Counts,** as UHERO names them. "Number of X" / "No. of X" → Number of X;
  a label ending in a counted noun ("Paid employees") → Number of Paid
  Employees; population → Persons; housing units → Units; employment →
  Jobs; then the table title ("Number of U.S. Post Offices …").
  - A ratio or money word in the same or a more specific label (per,
    ratio, rate, payroll, wages, receipts, value …) blocks a count.

|                                           | Before           | After |
| ----------------------------------------- | ---------------- | ----- |
| 2025 measurements unit "Number" (extract) | 14,902 of 26,309 | 5,926 |
| DATABOOK measurements unit "Number" (DB)  | 8,490 of 14,416  | 3,927 |

Of the 2025 measurements whose unit changed, only 6 already had a unit
other than Number, and all 6 are corrections ("Payroll ($1,000)", "index
rank"). Table 20.04 is now "Number of Commercial Fishermen" and "Pounds".
DATABOOK has 299 units (was 72).

### Local conversion and checks

- **Conversion.** 22,796 loaders (4,278 pseudo) were rewritten from
  `load_from_databook("NAME")` to the extract filters through each series'
  2025 locator. Every one passed save-time validation. Backup:
  `data-dir/backup/databook-loaders-before-load_from_extract-*.csv`.
- **Before the parser fixes,** the extract matched `latest.json` exactly for
  all 33,634 series.
- **After the fixes,** each observed loader's new values against its
  current data points:
  - 18,434 of 18,518 series are identical.
  - 84 differ:
    - 216 real points recovered (e.g. 07.39 2000–2013, 02.05 2001–2003,
      02.17 2018);
    - 56 points no longer produced, all misread "years" except one (DB1309R32@HI.A 1995,
      from the 2002 edition only);
    - 2 values changed.
  - The bogus points stay in the database until those series are reloaded
    with clear-before-load or deleted.
- **Apply.** `apply --execute` updated 14,416 measurements and 18,518
  series. It created 1 loader: a pseudo loader for a series that is
  interpolated now. Five old pseudo loaders whose series are no longer
  flagged remain.
- **History.** The `history` dry run finds the series and their editions.
- **Static checks.** Typecheck and lint are clean. 2,504 tests pass; the 2
  failures are the existing hicentral MLS ones.
  `src/core/scripts/migrate-interpolate-to-disaggregate.test.ts` (commit
  903dcf2e) imports a script that runs and calls `process.exit(0)`, which
  ends `bun test` early. Run the other test files explicitly.

### Still open

- The worker runs the extraction at about 1.8 GB peak.
- `match-report.csv` is the only review output for low match rates (2002:
  41% of cells, 2024: 70%).
- Deploy: apply `20261015000000_seed_databook_ingest`, fetch, extract,
  `sync`, `apply`, `history`.

## 13. API sources: FRED, BEA, EIA, e-Stat (2026-10-15)

Four source modules on the BLS pattern: the fetch list comes from the
`load_from_extract("<handle>", …)` load statements, requests are batched
as far as each API allows, and every series is stored as its own artifact
so a hash depends on that series alone. Not committed. Seeds
`20261015120000_seed_fred_ingest` and `20261015130000_seed_api_ingest` are
applied locally only.

| Source  | Load statement filters                                        | Requests (current loaders)                                                              | Artifact key                            |
| ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| fred    | series_id, frequency, aggregation (avg default)               | 1 per series/freq/agg: 66 (no multi-series endpoint)                                    | `<id>/<freq>/<agg>`                     |
| bea     | dataset, table, line, geo (`-` for NIPA), frequency           | 1 per Regional table×geo (LineCode=ALL), 1 per NIPA table (A,Q,M): ~40 for 1021 loaders | `<dataset>/<table>/<line>/<geo>/<freq>` |
| eia     | route, scenario (`-` for steo), series_id, frequency          | 1 per route×frequency, every id and scenario: 2 for 8 loaders                           | `<route>/<scenario>/<id>/<freq>`        |
| estatjp | stats_data_id, tab, cat01, cat02, cat03, area (`-` if absent) | 1 per table, codes unioned into comma lists: 3 for 6 loaders                            | `<statsDataId>/<class>=<code>,…`        |

Frequency may be left out of every load statement: it comes from the target
series' name.

### Framework changes

- `referencedFilters` now fills `frequency` from the target series' name,
  the same rule the load uses. FRED, BEA and EIA need the frequency to
  fetch.
- A downloader's `config.extraFilters` is appended to
  `ctx.referencedFilters()`. Use it to fetch series no load statement asks
  for yet.
- `HttpError` masks API-key query params (`api_key`, `UserID`, `appId`, …)
  and carries the first 300 characters of the body, where the APIs put
  their error message.

### What each stored body leaves out

Stored bodies are a normalized subset of the response. Otherwise unchanged
data would hash as new every run:

- **FRED:** `realtime_start`/`realtime_end`, which are today's date on every
  response and observation.
- **BEA:** the `Request` echo, which holds the key in plaintext, and
  `UTCProductionTime`.
- **EIA:** the request echo and `apiVersion`.
- **e-Stat:** `RESULT.DATE` and the table's `UPDATED_DATE`. `UPDATED_DATE`
  moves for every series on each release, so it goes in the metadata
  instead.

### Rejected requests

A request rejected as invalid is a warning, not a failed key, so one bad
load statement does not block extraction for every other series. This is
the same policy as a BLS series with no data. Rejected means FRED 400 or
BEA code 40.

BEA also has these protections:

- Requests are paced by response size, at about 80 MB/minute.
- The run stops after 5 API errors in a row (BEA locks you out for an hour
  at 30 errors/minute).

### Live check against the legacy loaders

`extraFilters` was set to each legacy eval's filters and the configs were
reset afterwards. Each extract was compared with the loaders' current
points, scale applied:

- **e-Stat:** 2,238 of 2,250 equal. The rest are the 2 newest months, which
  the stale local DB lacks.
- **EIA:** 1,038 of 1,074 equal. All 36 differences are STEO, which is
  revised monthly.
- **FRED:** dates line up. The differences are revisions (ANFCI, PCEPI, …)
  and loaders not run since 2022. SP500 history is short because FRED only
  serves 10 years.
- **BEA:** 44,959 of 55,230 points equal. Every difference traced was one of:
  - Legacy zeros. In Sep 2023, before flagged points were skipped, the
    legacy loader stored BEA `(NA)`/`(D)` points as `0`. For example,
    SQINC4 pre-2010, and CAINC5N lines for Hawaii county that are
    suppressed every year.
  - The 2026 annual revision.
  - T20805, last written in 2018 under an old scale.

### Found along the way

- **BEA dropped MARPI** (real personal income by MSA) from the API. The 3
  legacy loaders have failed with the same error since at least 2026-08-01.
  MAIRPD (deflators) is the nearest table; there is no direct replacement.
- **AEO 2026 is published, with new scenario names.** It has no `ref2026`,
  `lowprice` or `highprice`; it has `cb2026`, `highogs`/`lowogs`, `hm2026`,
  … The loaders stay on `aeo/2025`.
- **FRED has an "API v2".** It is one endpoint, `release/observations`, a
  whole release per call with no frequency or aggregation parameters. It
  doesn't fit; v1 per series stays.
- **Legacy `estat-jp.ts`** reads `@time` with slice(0,4)+slice(-2). That
  would read a quarterly code (`2026000709`) as September. The ingest parser
  uses the strict monthly form `YYYY00MMMM`. The legacy client is
  unchanged.

### Load errors (follow-up)

A load_from_extract error now has two forms:

- **The loader's error** is plain English in the legacy style, for example
  `No BLS data returned for CUSR0000SA0 (did you mean series_id "CUSR0000SA0"?)`
  or `3 DOTAX series match collec / Refunds; also filter by tax and area`.
  It does not repeat the load statement, which the UI shows right below it.
- **The full account** goes to `app_logs` (category `loader`, name
  `loader.reload_error`, subject `data_sources`). It holds the call, the
  closest labels and the extract run id.

A load of a series that has never been fetched now fetches it first. This
applies to sources whose fetch list comes from the load statements (BLS,
FRED, BEA, EIA, e-Stat). The load calls `runFetch(handle, { only: [filters],
triggeredBy: "load" })`, which fetches only that series and then extracts,
and then it matches again. So a new load statement works on its first load
and doesn't wait for the schedule. For ID-keyed sources there is no "did you
mean" suggestion, because a nearby ID is a different series.

The loader description reads like this:

```
Loaded CUURS35DSA0 from <a href="https://data.bls.gov/timeseries/CUURS35DSA0">BLS</a> (cached <a href="/udaman/UHERO/ingest/extractors/bls">Oct 15, 2026</a>)
```

The series name comes from the source's `nameDimensions` (or from
`describeSeries` when one column can't name it; BEA and e-Stat use this).
The source name links to the series' public page (`sourceUrl`): BLS
timeseries, FRED series, the e-Stat DB view, the EIA API browser, BEA
iTable. These links never point at an API URL, so no key leaks; the legacy
API descriptions linked the raw URL with the key in it. The date is the
extract's run date and links to the extractor page. In-app links open in
place.

Each source module names itself (`label`) and can render a series in plain
words (`describeSeries`). Save-time validation uses the same plain messages.

### Still open

- **No loaders converted yet.** `load_api_fred/bea/eia_*/estatjp` →
  `load_from_extract` is the same open item as BLS. The translation used
  for the live check is mechanical.
- **Deploy:** apply both seeds.
