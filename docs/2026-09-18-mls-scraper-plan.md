# MLS listings scraper — architecture and runbook

**Status:** implemented 2026-09-18 (uncommitted). Sections 1–11 are the approved proposal, kept for
the reasoning; **where they disagree with "As built" below, "As built" wins.** Companion to
`mls-handoff.md` (HiCentral feasibility findings).

## As built — what changed from the proposal

- **Column names** are the snake_case form of the site's own keys (`Assd. Val. Land` →
  `assd_val_land`, `Elem. School` → `elem_school`), not the renamed ones in §5. Every surveyed key has
  a column; `src/core/crawlers/mls/columns.ts` is the single source of truth and the DDL, parser,
  loader and UI data dictionary are all generated from / tested against it. Future sites map their
  keys onto these names. (snake_case rather than literal kebab-case: hyphenated MySQL identifiers
  need backticks in every query, and every other hhdb table is snake_case.)
- **Key survey done:** 265 detail pages, all islands / statuses / property types → 66 `<dt>` keys +
  header fields = 81 data columns. Condos add fee columns, leaseholds a lease block, multi-family a
  unit mix. `extra` JSON now only ever holds `Virtual Tour` (and any key the site adds later).
- **Board is constant `HBR`** for HiCentral — neighbor-island listings there carry 9-digit HBR
  numbers too.
- **Daily walk = status 145** (Active + Active Under Contract + Pending; 4,667 on Oahu ≈ 234 pages),
  not 128. Under-contract/pending listings never appear in a 128-only list, so their sale would have
  to be discovered one detail page at a time. One constant in `sites/hicentral/urls.ts` to revert.
- **`off_market` status.** The site answers a removed listing with HTTP 200 and a "no longer
  available" page; `parseDetail` returns `null` for it and the daily run marks the row `off_market`.
- **Page cap is 499**, and the site 302s to an error page past it (the handoff's "498 / empty page
  at 499" did not reproduce with newest-first sort). The walk stops on a redirect *or* an empty page.
- **Backfill keeps HTML; daily doesn't (2026-09-20).** `mls backfill` saves every list and detail
  page to the NAS (`<NAS>/work/scrapes/mls/<site>/…`) — that corpus is what the parsers are tuned
  against, replayed with `mls reparse`, and it refuses to start if the NAS isn't mounted rather than
  write somewhere else. `mls daily` parses and inserts only: its pages go to a per-day local temp dir
  (`$TMPDIR/udaman-mls/<date>/`, override `MLS_TMP_PATH`) so an interrupted run can resume and a page
  that failed to parse can be looked at that day; the next run deletes it. Daily-loaded rows have
  `html_path` NULL. So the daily job needs the DB and the internet, **not the NAS**.
- **Scheduling:** BullMQ job `mls.daily` on the worker's `default` queue, alongside the other jobs —
  hicentral 4:30 AM HST, hres 5:15 AM HST (after, so shared listings are already owned by the richer
  source). Unlocked like `QPUB_REPARSE` (housing DB, not the UHERO workload). Backfills are run by
  hand from a machine that mounts the NAS.
- **What the daily run fetches:** a detail page **once, when a listing first appears** — property
  characteristics don't change — and, on HiCentral only, once more when it leaves the open list (that
  page carries the sold price/date). A listing already on file costs no request: `last_seen_at` is
  bumped and any status / list-price change is recorded from the list row, with a history row. No
  periodic refresh. `hres` never reports sales, so a departed listing there is marked `off_market`
  without a request. `mls reparse` keeps the stored status and list price for open listings, since
  those can be newer than the saved page.
- **Politeness:** one request in flight, 1.5 s + 0–1 s jitter after the previous one *finishes*,
  30 s timeout, 5 s → 20 s → 60 s backoff on 429/5xx (honours `Retry-After`), and a circuit breaker
  that aborts the run after 5 consecutive failed URLs. Cache hits cost nothing.
- **Summary tab** reads `freq_mls_listings`, the same pre-computed EAV table every other hhdb table
  has (changed 2026-09-21 — it was briefly computed live; one pattern is easier to reason about). It
  is a block inside `sp_regenerate_freq_tables` in `hhdb-freq-tables.sql`, so the weekly event
  refreshes it with the rest. To add it to a live server use
  `migrations/2026-09-21-freq-mls-listings.sql` (creates + fills that one table; re-runnable to
  refresh MLS counts on their own) — never source all of `hhdb-freq-tables.sql`, which drops every
  freq table. Then re-create the procedure from the main file (the `DROP PROCEDURE … END //` section
  only) so the weekly event includes MLS. County columns come from `LEFT(tmk,1)`, so Molokai/Lanai
  count under Maui County, and listings with no TMK count toward State only. A test
  (`freq-mls-listings.test.ts`) fails if the Summary fields in the data dictionary and the INSERTs
  drift apart.
- List-page cache dirs are named by status set (`active` / `any`), not `s128`.
- Sold rows on list pages show the *sold* price, so `ListRow.listPrice` is null for them.
- Agent phone/email and open-house access notes are deliberately not captured.

## Runbook

```bash
# 0. One time, by hand, against the remote hhdb (command is in the file header):
#    src/lib/hhdb/migrations/2026-09-18-create-mls-listings.sql
#    Until then the UI shows an empty table rather than erroring.

# 1. Smoke test from any machine (local cache dir, nothing written):
MLS_NAS_PATH=/tmp/mls bun run mls daily --island lanai --dry-run

# 2. Phase 1 — once, from a machine with the NAS mounted. ~500 list + ~10k detail
#    requests at ~2 s each ≈ 6 hours. Resumable: rerun after any interruption.
bun run mls backfill                 # all islands
bun run mls backfill --island oahu   # or one at a time

# 3. Phase 2 — nothing to do; the worker runs `mls.daily` for each site every morning once deployed.
#    No NAS needed. By hand: bun run mls daily [--site hres]

# After a parser fix or promoting a key to a column (ALTER + columns.ts): no refetch needed
bun run mls reparse
```

**List walks end on the site's own result count, never on one empty-looking page** (`walk.ts`). The
first production backfill (2026-09-20) stopped at 46 of ~520 list pages and reported success: HiCentral
302'd one list request to its error page mid-walk, and a redirect was being read as "past the last
page". Now a redirect / empty / unparseable page before the expected last page is retried after 30 s,
2 min and 5 min (bypassing the cache), then skipped and recorded while the walk carries on; three bad
pages in a row abort the walk. The summary's `walks` shows listings read vs the site's count per island
(`oahu 9980/20610 (page cap)`) and `incompleteWalks` names any skipped pages — check `walks` after a run.

**A database outage pauses a run; it doesn't kill it** (`db-retry.ts`). The first hres backfill died at
02:14 HST, 4,200 listings in, when the nightly backup took hhdb offline. Every pipeline DB call now
waits out a lost connection (1, 5, 15, 30, 45 min) before giving up. **Restarting a backfill resumes:**
listings already in the table are skipped (no request); only the list pages are re-walked, since their
cache is per day.

A run exits non-zero / fails its job when any list page had to be skipped (everything that was listed
is still loaded — rerun to fill the gap), when parse failures exceed max(5, 2 %) or when an island's open
walk is incomplete or under half of what we hold as open (the departed check is skipped for that
island, so one bad page load can't mark thousands as gone).

**Adding a site:** `sites/<name>/` exporting a `SiteAdapter` (URLs + two pure parsers that emit
`columns.ts` names and the issuing `mlsBoard`), one line in `registry.ts`, one scheduler entry. Give
it a `priority`; when two sites carry the same `(mls_board, mls_number)` the higher one's field
values win and the lower one only bumps `last_seen_at`.

**Verified 2026-09-18** against a local MariaDB + local cache: 383 tests; reparse of the 265-page
survey corpus (265 inserted, 0 parse failures); backfill resume (25 known → 0 fetches); daily run
exercising price change → `price` history row, departed → `sold` with sold price, and vanished →
`off_market`. Not verified: anything in a browser, the remote DB, or the NAS mount on the worker.

---

# Original proposal

## 1. Shape of the thing

```
site adapter ──► [fetch] ──► raw HTML on NAS ──► [parse] ──► normalized listing ──► [load] ──► hhdb.mls_listings ──► /hhdb UI
 (hicentral)      polite,      work/scrapes/mls/      pure fn,       common schema        upsert on
                  cached                              no network                          (mls_board, mls_number)
```

Three stages, each separately re-runnable, same split as qpub (scrape → HTML on NAS → parse → load)
but with none of qpub's machinery: no Playwright, no `scrape_status` claim queue, no local-rebuild
DB, no status page. Fetch is plain `fetch`; parse uses `node-html-parser` (already a dependency and
what qpub's parser uses — the handoff suggests `HTMLRewriter`, but a DOM is easier for a `dt`/`dd`
pair-walk and keeps the parser unit-testable outside Bun).

Everything site-specific lives behind one interface. The pipeline, NAS cache, table, and UI know
nothing about HiCentral.

## 2. Code layout

```
src/core/crawlers/mls/
  types.ts            NormalizedListing, ListPageResult, SiteAdapter, ListingStatus
  registry.ts         { hicentral: hicentralAdapter }  ← add a site = add one line here
  nas-cache.ts        path builders + read/write for the NAS HTML cache
  fetcher.ts          polite fetch: UA, delay, retry/backoff on 429/5xx, cache-through
  normalize.ts        shared value parsers: money, "33,018", long dates, "--" → null, tenure
  pipeline.ts         backfill() / daily() / reparse() — site-agnostic orchestration
  load.ts             upsert into mls_listings + history rows
  sites/hicentral/
    urls.ts           segment-array URL builder (page, sort, status bitmask, island seeds)
    parse-list.ts     list HTML  → { mlsNumbers, rows: [{mls, price?, status?}], totalCount }
    parse-detail.ts   detail HTML → NormalizedListing
    index.ts          the SiteAdapter
    fixtures/ + *.test.ts
src/core/workers/mls-cli.ts          `bun run mls <backfill|daily|reparse|stats>`
src/lib/hhdb/mls_listings.sql        canonical DDL (like tg_transactions.sql)
src/lib/hhdb/migrations/2026-09-18-create-mls-listings.sql
```

### The adapter contract

```ts
interface SiteAdapter {
  site: string;                       // "hicentral" — NAS dir name + source_site value
  priority: number;                   // tie-break when two sites carry the same listing
  islands: IslandKey[];
  statuses: { active: StatusSet; backfill: StatusSet };
  maxPage: number;                    // 498 for hicentral
  listUrl(q: { island; status; page; sort }): string;
  detailUrl(mlsNumber: string): string;
  parseList(html: string): ListPageResult;       // pure
  parseDetail(html: string): NormalizedListing;  // pure; must set mlsBoard + mlsNumber
}
```

A second site is: a new `sites/<name>/` dir implementing this, plus one registry line. It gets the
cache, politeness, dedup, history, CLI, and UI for free.

## 3. Dedup key: `(mls_board, mls_number)`

Your instinct about a compound key is right, with one twist: the second half of the key should be
the **MLS board that issued the number, not the website we scraped it from**.

Hawaii has three MLS systems — HBR/HiCentral (Oahu; 9-digit `2024xxxxx` numbers), Hawaii
Information Service (Hawaii Island, Kauai, Molokai; 6-digit), and Realtors Association of Maui
(6-digit). Numbers are unique only within a board, and the two 6-digit systems can collide.

- Key on `(site, mls_number)` → the same listing scraped from two sites is two rows. Wrong.
- Key on `mls_number` alone → a HIS and a RAM listing can overwrite each other. Wrong.
- Key on `(mls_board, mls_number)` → same listing from two sites collapses to one row; different
  boards never collide. Each adapter's `parseDetail` declares the board (constant for HiCentral:
  `HBR`; a multi-board aggregator would read it off the page).

When two sites carry the same key, `priority` decides whose field values win; `source_site`
records who wrote the row. A property dual-listed on two *boards* legitimately has two MLS numbers
and stays two rows — `tmk` is the join for anyone who wants to collapse those analytically. I would
not enforce that in the table.

## 4. Upsert, not delete-and-reinsert

I'd push back gently on delete + reinsert. It does dedupe, but it destroys the two things that make
a daily listings scrape worth more than a one-time one:

- `first_seen_at` — resets every day, so you can't compute our own days-on-market.
- change detection — you can't tell that the price dropped or the status flipped if the old row is
  gone before the new one lands.

Proposed instead: `INSERT … ON DUPLICATE KEY UPDATE` on the unique key, which keeps `id` and
`first_seen_at` stable and bumps `last_seen_at`. Before the upsert, compare status + list price +
sold price against the existing row; if any differ, append one row to `mls_listing_history`. That
table is tiny (a listing changes a handful of times in its life) and gives you price-cut and
active→contract→sold timelines for free. If you'd rather not have it, it drops out cleanly — the
main table doesn't depend on it.

## 5. Tables

Both are **remote-only durable tables**, like `tg_transactions`: DDL in `migrations/` + a
standalone `.sql`, and deliberately **not** in `hhdb-schema.sql` or `ALL_DATA_TABLES`. I checked
`qpub-db-sync.ts` — the dump names `ALL_DATA_TABLES` explicitly, so a table left out of that list
is never dropped by a qpub rebuild.

`mls_listings` — typed columns for everything analytically useful, from a real detail page I pulled
(MLS 202426768, 52 `dt`/`dd` pairs, plus header fields that are *not* in the `dl`s):

| group | columns |
|---|---|
| identity | `id` PK, `mls_board`, `mls_number`, UNIQUE(`mls_board`,`mls_number`), `source_site`, `source_url` |
| header (not in `dl`) | `status` (from `#…divListStatus`), `list_price`, `sold_price`, `tenure` (FS/LH, split out of `"$18,500,000 (FS)"`), `address`, `city`, `state`, `zip`, `remarks` TEXT |
| location | `island`, `region`, `neighborhood`, `tmk` (indexed — same `1-3-5-059-010-0000` format as qpub, so it joins to `properties`/`parcels`) |
| dates | `list_date`, `sold_date` |
| property | `property_type`, `bedrooms`, `full_baths`, `half_baths`, `land_area_sf`, `living_sf`, `lanai_sf`, `other_sf`, `parking_stalls` (int, from `"8 - 3 Car+, …"`), `parking_desc`, `year_built`, `year_remodeled`, `zoning`, `furnished`, `stories`, `building_style`, `property_condition` |
| financial | `assessed_land`, `assessed_improvements`, `assessed_total`, `tax_year`, `monthly_taxes`, `home_exemption`, plus condo fee fields as they turn up in the key survey (see below) |
| schools | `elem_school`, `middle_school`, `high_school` |
| multi-value text | `frontage`, `view`, `pool`, `amenities`, `inclusions`, `security`, `construction`, `roofing`, `floor_covering`, `lot_description`, `topography`, `easements`, `land_recorded` |
| catch-all | `extra` JSON — any key the parser has no column for, verbatim |
| bookkeeping | `first_seen_at`, `last_seen_at`, `fetched_at`, `parsed_at`, `html_path` (HST wall-clock per house convention) |

Low-value keys (`Disclosures`, `Possession`, `Terms Accept.`, `Set-Backs`, `Exclusions`, fee
inclusions) go to `extra` rather than getting columns. Indexes: the unique key, `tmk`,
`(island, status)`, `list_date`, `sold_date` — mindful of the `tg_transactions` lesson about
unindexed aggregates.

**Key survey first.** One sold single-family home isn't the schema. Step one of implementation is
fetching ~200 detail pages stratified across property types/islands/statuses (condos will add
maintenance-fee / unit / floor keys this page doesn't have), tallying every key with its fill rate,
and only then freezing the DDL. The `extra` column means an unanticipated key is never lost, and —
because raw HTML is kept — promoting a key to a real column later is `ALTER` + `mls reparse`, no
refetch.

`mls_listing_history`: `id`, `mls_board`, `mls_number`, `observed_at`, `status`, `list_price`,
`sold_price`, `source_site`.

## 6. NAS cache layout

```
/Volumes/UHEROroot/work/scrapes/mls/
  hicentral/
    list/{YYYY-MM-DD}/{island}/s{status}/p{0001}.html       ← per-run; pages drift, so never reused across days
    detail/{mls[0:6]}/{mls}/{YYYY-MM-DD}.html               ← dated snapshots; latest = current
```

- Root comes from the existing NAS-path autodetect in `qpub/config.ts` (I'd lift `findNASPath` to a
  shared module rather than import from qpub), overridable with `MLS_NAS_PATH` so parser work and
  tests run against a local dir — which matters, since the NAS isn't mounted on this laptop now.
- Sharding by the first 6 digits keeps directories to ≤1,000 entries (NAS listing cost).
- Detail snapshots are dated rather than overwritten: we only refetch a listing when something
  changed, so there are few per listing, and the old HTML is the audit trail for the history table.
  Backfill is ~10k × 39 KB ≈ 400 MB; growth after that is small.
- Whole-file reads only — 39 KB pages don't need head-reads, which sidesteps the byte-cap trap.
- Dev iteration: within a day, the fetcher serves from cache unless `--refetch`.

## 7. The two phases

**Backfill (`bun run mls backfill --site hicentral`, run once).** Per island: status `401`, sort
`d` (newest — more stable under drift than price sort), pages 1→498 or until an empty page. Collect
MLS numbers (deduped), then fetch every detail page not already cached, parse, upsert. Sequential,
1 s delay, identifiable User-Agent: ~500 list + ~10k detail requests ≈ 3 hours for Oahu.
Resumable for free — a rerun skips anything already on the NAS.

**Daily (`bun run mls daily`).**

1. Walk all *active* (`128`) list pages per island (~182 for Oahu, ~3 min).
2. **New** MLS numbers → fetch detail, insert.
3. **Still active, already known** → bump `last_seen_at`; refetch detail only if the list row's
   price differs from the stored one, or the row hasn't been refetched in N days (default 14) as a
   safety net.
4. **Departed** — rows we hold as active that are no longer in today's active set → refetch their
   detail page directly by MLS number. **This is the step an active-only scrape can't skip:** a
   listing that sells just vanishes from the active list, and without this we'd hold it as "Active"
   forever and never capture sold price/date. Detail URLs are addressable by MLS number regardless
   of status, so it costs one request per departure.
5. Guardrail: if today's active count for an island is < 50% of yesterday's, treat the list walk as
   broken, skip step 4, and fail loudly — otherwise one bad page load marks thousands as departed.

Typical daily volume: ~200 list pages + maybe 100–300 detail pages. Roughly 10 minutes at 1 req/s.

Every run ends with a one-line summary (pages, new, changed, departed, parse failures, rows
written) and a non-zero exit if parse failures exceed a threshold — the qpub lesson that load bugs
never throw.

## 8. Scheduling — needs your call

The job needs the NAS mounted *and* hhdb access. Per the README that describes **scraper-worker**,
not the BullMQ worker box (which reaches the NAS by rsync, not a mount). Options:

- **A (recommended): launchd/cron on scraper-worker** running `bun run mls daily` at a fixed HST
  time. Decoupled from the qpub runner's captcha sleeps and halts; a CLI entrypoint with top-level
  `await` (the Bun fire-and-forget lesson). I'd ship the plist/cron line in the docs.
- **B: hook into `scrape-runner.ts`'s daily cycle** (e.g. right after the nightly parse+load). No
  new scheduler, but MLS then inherits qpub's failure modes — if the runner halts on captchas, MLS
  stops too.
- **C: BullMQ scheduled job on the heavy queue** — consistent with `scheduler.ts` and visible in
  the jobs UI, but only works if the worker machine mounts the NAS, and would hold the heavy lock
  for ~10 min of mostly sleeping.

## 9. hhdb UI

The table pages are config-driven, so this is small:

- `nav-hhdb.tsx`: third `SECTIONS` entry, label **"MLS"**, leaf "Listings" → `/hhdb/tables/mls-listings`.
- `hhdb-table-config.ts`: `"mls-listings": { title: "MLS Listings", fieldsTable: "mls_listings", defaultSort: "list_date" }`.
- `hhdb-data-dictionary.ts`: field defs + descriptions for `mls_listings` (drives columns, filters,
  the summary/profile tabs). Unlike TG (`fieldsTable: null`, exploration-only), this gets the full
  table view.
- Source attribution + caveats on the About page: Oahu-weighted coverage, ~2024 backfill horizon,
  the 9,960-row cap.
- Not in v1: an exploration tab (inventory / median list price / DOM by region). Natural follow-up
  once there's a few weeks of history.

## 10. Open items

- **Non-Oahu seed URLs are suspect** (handoff §9: Kauai 33, Hawaii 200 — suspiciously round). The
  key survey will check what those region codes actually select. Doesn't block Oahu.
- **List-row contents**: I've confirmed the detail page shape but not that list rows expose price.
  If they don't, step 3 falls back to the N-day refresh alone.
- **Terms of use**: robots.txt is permissive, but I haven't read HiCentral's ToS regarding
  republication of MLS data. Internal research use is one thing; if `mls_listings` flows to the
  datashare CSV dump or public series, that's worth a look. I've left it out of `qpub-dump-csv` for now.
- `HotSheet` search type as a cheaper daily delta feed — worth 20 minutes of investigation during
  the key survey, but the design above doesn't depend on it.

## 11. Implementation split (after approval)

Contract first, then parallel agents against it:

0. **Me, serial:** `types.ts` + adapter interface; key survey (≈200 polite fetches into a local
   cache) → freeze DDL.
1. **Agent A — fetch/cache:** `fetcher.ts`, `nas-cache.ts`, shared NAS-path module, hicentral `urls.ts`, tests.
2. **Agent B — parsers:** `normalize.ts`, `parse-list.ts`, `parse-detail.ts`, fixtures from the survey cache, tests.
3. **Agent C — DB/load:** migration + `.sql`, `load.ts` (upsert, history diff, priority rule), tests.
4. **Agent D — UI:** nav, table config, data dictionary, About copy.
5. **Me, serial:** `pipeline.ts` + `mls-cli.ts` wiring, end-to-end dry run against a local cache dir
   and local DB (`--dry-run` prints would-be writes), typecheck, review. The migration gets applied
   to the remote by hand, by you, as with the others. The real backfill is yours to kick off.
