# Downloaders — design (rev 5, 2026-10-13)

A **Downloader** is code that fetches data from an outside source, using
batching, scraping and caching as needed. It keeps its **source files** as
Downloads, which can be marked _historical_ so they are never refetched. It
writes one parsed **output** Download, and it has its own **load method**,
whose arguments mirror the source:

```
Series.load_from_bls_api("CUSR0000SA0", "M")
Series.load_from_dotax_sheet("Collection", "General Excise", "General Excise & Use")
Series.load_from_dotax_current("collec", "Income-Ind.", "Refunds", "State")
Series.load_from_dotax_archive("ge", "Base", "Retailing", "Maui")
```

Load statements use parentheses (JavaScript-style calls). The Ruby-style
paren-less form still parses, but new loaders should not use it.

The R scripts in `DATA_DIR/rprocess` (output in `DATA_DIR/rparsed`) are
interim getters, and Downloaders replace them one at a time. This revision
covers the framework, BLS, and the three DOTAX Downloaders split out of the
`dotax.R` rebuild (`data-dir/dotax downloader R/`).

## 1. The four Downloaders

| Handle          | Load method                                        | Source                                                                               | Output Download                          | Refetch policy                                                                                                                                |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bls_api`       | `load_from_bls_api(seriesId, freq)`                | BLS v2 POST API (50 IDs per request)                                                 | `BLS_API@bls.gov` (merge)                | New series: full 20-year-window walk, once. Known series: last `refetchYears` (20) only.                                                      |
| `dotax_sheet`   | `load_from_dotax_sheet(type, tax, source)`         | "DOTAX Collections Portal Export Data" Google Sheet, Sheet1!A:F                      | `DOTAX_SHEET@docs.google.com` (replace)  | Whole sheet each run (one API call).                                                                                                          |
| `dotax_current` | `load_from_dotax_current(type, tax, source, area)` | tax.hawaii.gov/stats → "Current Monthly Tax Reports" (one XLSX per report per month) | `DOTAX_CURRENT@tax.hawaii.gov` (replace) | Each XLSX is a source Download. Files for months before the current year (`liveYears`: 1) are marked **historical** after a successful fetch. |
| `dotax_archive` | `load_from_dotax_archive(type, tax, source, area)` | "Archived Full Monthly Reports By Year" (one zip per month)                          | `DOTAX_ARCHIVE@tax.hawaii.gov` (replace) | Each zip is a source Download, marked historical on its first fetch. Revised months get a new zip name.                                       |

**DOTAX series and their loaders.** A **state** DOTAX series typically has
three loaders: archive, then current, then sheet, in increasing priority. The
sheet's preliminary statewide numbers win where present, which replaces
`dotax_collec_supersede` in `dotax.R`. A **county** series has two loaders:
archive and current.

Two `dotax.R` behaviors move into UDAMAN:

- **Continuity fills** (TGR/TGB ITONS = ITNS + OTNS; SINS ← SWNS) become
  arithmetic loaders in UDAMAN.
- **Month ranges** in `dotax_series.csv` (e.g. TRMTNS until 2020-02) are
  handled in the evals with `.trim`.

## 2. The DOTAX output shape and load-method arguments

All three DOTAX Downloaders write the same flat CSV, shaped like the
source data:

```
date,type,tax,source,area,amount,fiscal_year
2025-12-01,collec,Conveyance,Conveyance,State,13228391.75,2026
2025-12-01,collec,Income-Ind.,Refunds,State,-8920004.78,2026
2025-12-01,collec,Distribution of Collections,State General Fund,State,884747038.41,2026
2026-05-01,liab_ge,Liability,Hotel Rentals,Maui,6160757.230944,2026
2026-05-01,fuels,Gallons,Gasoline,Kauai,2472988,2026
```

The load methods take the same columns, `(type, tax, source, area)`, with
`area` optional (default `State`):

- **type**: for the report files, the report from the file name (`collec`,
  `ge`, `liab_ge`, `liab_tat`, `fuels`, `liq`, `tob`, `liqtob`). For the
  sheet, its type column (`Collection`, `Distribution`).
- **tax**: the heading a row sits under. A row with no heading is its own
  tax (tax = source).
  - collec:
    - `Income-Corp.` and `Income-Ind.` (the indented rows under them).
    - `Distribution of Collections`, `County Surcharges`,
      `Other County Revenue`.
    - Every other Source of Revenue row is its own tax, e.g.
      `("collec", "Conveyance", "Conveyance")`.
    - The `TOTAL - <month>` row is `("collec", "Source of Revenue", "TOTAL")`.
      The final TOTAL is `("collec", "TOTAL", "TOTAL")`.
    - The COUNTY SURCHARGES heading's own total is
      `("collec", "County Surcharges", "TOTAL")`.
  - ge / liab_ge / liab_tat: `Collections`, `Base`, `Liability`.
  - fuels: the value column, which is `Gallons`, `State Tax`, `County Tax`,
    `Total Tax`, `Allocation Amount` or `Allocation Total`. The county
    block is the area.
  - liq / tob / liqtob: `Liquor`, `Tobacco`.
- **source**: the row label as printed, in its latest spelling. A label that
  repeats within a table is numbered (`SUB-TOTAL 1`, `SUB-TOTAL 2`).
- **area**: `State`, `Honolulu`, `Maui`, `Hawaii`, `Kauai`, `Unknown`.
  Printed forms work too: `Oahu`, `All Districts`, `First District`,
  `C&C of Honolulu`, and so on.
- **fiscal_year**: the fiscal year ending June 30. The sheet's own column is
  passed through.

**Edge cases are still mapped.** Load-statement arguments and output rows
both resolve to the parser's internal coordinates
(`report|section|sub|item|geo`), and that is the lookup key:

- Tax and area resolve through alias tables in `dotax/args.ts`.
- Source labels resolve through the parser's label rules
  (`config/labels`). So `"General Excise and Use"`, `"Payment W/Returns"`
  and other old DOTAX spellings find the same series, and a row DOTAX
  relabels stays one series in the output, printed under its latest label.
- `buildReport` checks that every printed row resolves back to its own
  series and that no two series print the same. A failure is an
  `output_label` problem.

**The sheet** has the same columns. Its headers are
`date (yyyy-mm-dd) | type | tax | source | amount | fiscal year`, found by
name; the original `Date | Source Type | Tax Type | ...` headers still
work. A date cell may be a real date or `yyyy-mm-dd` text. Area is always
State. Sheet arguments match the sheet's text after normalizing case and
whitespace; there are no spelling rules, because the sheet is maintained by
hand and kept consistent.

### Converting the DOTAX universe

`bun run scripts/convert-dotax-loaders.ts [--apply] [--verbose] [--only NAME,...]`
replaces the universe's `"<name>".tsn.load_from("dotax/dotax.csv")` loaders.
The mapping lives in `src/core/downloaders/dotax/loaders.ts`. Each series
name is traced back to its DOTAX rows:

- UDAMAN ids go through `config/series`, the same item → id map dotax.R
  used. A month range in the map becomes `.trim(...)`.
- Slug names are split into report type, section and item. Months the
  series map claims for an id are trimmed off.

Each row gets an archive loader and a current loader, for whichever
outputs have the row. Then:

- The dotax.R continuity fills become lower-priority loaders: TGR/TGB
  ITONS = ITNS + OTNS, and SINS from SWNS.
- The 18 statewide series the sheet superseded (`dotax_collec_supersede`)
  get a sheet loader.

Priorities follow the UDAMAN convention: a series' strongest loader is 100
and each weaker kind steps down by 10, in the order sheet, current,
archive, current fill, archive fill. Most series get current 100 and
archive 90; a sheet-superseded one gets sheet 100, current 90, archive 80.

The arguments are read from the outputs, so run the three downloaders
first. Rerun the script after `dotax_sheet` has run to add the sheet
loaders.

Old loaders are disabled and moved to priority 10, not deleted. Their data
points stay until a reload overwrites them; delete the old loaders once the
new ones check out.

## 3. Framework

- **Tables:**
  - `downloaders`: handle, config, state, enabled, `reload_on_change` (created
    but unused), `max_age_minutes` (default 1440), the run claim, last-run and
    error columns, and stats.
  - `downloads` gets three new columns: `downloader_id`,
    `downloader_role ('source'|'output')` and `historical`.
  - Migration: `src/lib/prisma/migrations/20261013000000_create_downloaders`.
    It also seeds the four rows.
- **`src/core/downloaders/`:**
  - `types.ts`, `registry.ts`
  - `tidy.ts`: the output CSV, sorted, with atomic writes and
    merge/replace. Columns come from the Downloader's `layout`: the default
    is `key,date,value,freq` (BLS), and DOTAX uses the flat shape in §2.
    `indexKey` maps a printed row to the key its load method resolves to.
  - `keys.ts`: finds keys referenced in evals via the EvalParser AST.
  - `run.ts`: the lifecycle. Claim the run, call `impl.run`, write the output,
    record status and stats, release the claim. It never enqueues reloads.
  - `sources.ts`: upsert, fetch and mark historical for source Downloads.
    Fetching goes through `downloadToServer`, which can now keep a superseded
    copy of the old file.
  - `load.ts`: `loadFromDownloader` + `ensureFreshKey`. If the output is
    stale, it runs the Downloader inline (deduplicated). If a key is missing
    and the Downloader supports keyed runs, it fetches just that key.
  - `bls-api.ts`, `dotax/` (shared parser, checks and config used by
    current and archive, plus `sheet.ts`, `current.ts` and `archive.ts`).
- **Load methods:** a thin, explicit method on `SeriesCollection` for each
  Downloader, plus its entry in `ALLOWED_STATIC_METHODS`.
- **Worker:**
  - `downloader.run` on the default queue, outside the heavy lock.
  - `enqueueDownloaderRun` deduplicates manual runs.
  - A "Downloaders" section in `scheduler.ts`.
  - CLI: `bun run downloaders`.

## 4. DOTAX port notes

- **Parsing** ports `dotax_parse.R` 1:1:
  - Column roles come from header text, and the header month must equal the
    file month.
  - The same label rules, item slugs and section walk.
  - Sheets are read with SheetJS into a text matrix, mimicking
    `readxl(col_types = "text")`: leading blank rows and columns trimmed,
    numbers as plain strings, whitespace squished, ’ → '.
- **Checks** (`dotax_validate`, the gap check with its legacy fills, and the
  duplicate-id check), **known issues** (waive/accept), and the **series map**
  are ported. The series map is used for the checks and to annotate keys.
  - By default (`failOnProblems`), any problem not waived fails the run, and
    the output is left unchanged.
  - Problems are listed in `last_stats` and written to
    `DATA_DIR/downloaders/<handle>/problems.csv`.
- **Config** (`labels`, `series`, `known_issues`) lives in
  `src/core/downloaders/dotax/config/*.ts` as `String.raw` copies of the R
  CSVs, so it bundles with Next and can be diffed against the R originals. A
  new DOTAX spelling is fixed by editing the CSV text.
- **Inventory:** one file per (report, month) within each Downloader. Ranked by
  source date, then revision marker (`_rev`, `_revN`, `_corr`), then file
  date, as in `dotax_inventory`.
- **Politeness:** 10 s between tax.hawaii.gov page requests (its crawl
  delay), 1 s between file requests.
- **Sheet auth:** the sheet is shared only with specific Google accounts, so
  either:
  - a service account the sheet is shared with
    (`GOOGLE_SERVICE_ACCOUNT_KEY_FILE`), or
  - an OAuth refresh token for an account that can see it
    (`GOOGLE_SHEETS_REFRESH_TOKEN`, using `GOOGLE_SHEETS_CLIENT_ID/SECRET`, or
    `AUTH_GOOGLE_ID/SECRET` by default). `bun run downloaders google-auth`
    mints one.

## 5. UI (mirrors Downloads)

- **`/udaman/[universe]/downloaders`:** a list with status.
- **`[id]`:** status and stats, problems, the output Download, source
  Downloads with historical toggles, BLS history state, referencing loaders,
  and **Run now / Force full refetch** buttons.
- **`new`, `[id]/edit`:** forms. Delete goes through a confirm dialog.
- **Downloads pages:**
  - The list hides Downloader-owned rows by default (toggle).
  - The detail page links to the owning Downloader and shows a historical
    toggle.
  - The edit form gets a historical checkbox.

## 6. Later

- Migrate `load_api_bls` → `load_from_bls_api` (a rename).
- Create the DOTAX loaders from `dotax_series.csv` and `dotax_series_info.csv`.
- Retire `rprocess/dotax.R` and `rparsed/dotax.csv`.
- Use `reload_on_change`.

## 7. Status (2026-10-13) and operating notes

**Built:** everything in §1–§5. The migration has been applied to the local
`uhero_db_dev` only. Staging and production still need:

1. Apply `src/lib/prisma/migrations/20261013000000_create_downloaders/migration.sql`.
   It creates the table, adds the columns, seeds the 4 downloaders and seeds
   the `downloader` permission rows.
2. Restart the worker so it registers the new schedules.
3. For `dotax_sheet`, provide Google credentials, using either:
   - `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`, after sharing the sheet with the
     service account; or
   - `GOOGLE_SHEETS_REFRESH_TOKEN`, minted by `bun run downloaders google-auth`
     while signed in as an account the sheet is shared with.
4. Run `dotax_archive` once by hand. It fetches about 280 zips at 1 s each,
   then marks them historical.

**CLI** (runs in-process, not on the queue):

```
bun run downloaders list
bun run downloaders run bls_api [--keys ID,ID] [--force] [--full]
bun run downloaders refs dotax_current     # load statements + the key each resolves to
```

**Rev 5 (flat DOTAX shape) verification:**

- Over the 82 cached current files and 14 archive samples, every printed
  row resolved back to its own series, with 0 `output_label` problems.
- A live `dotax_current --force` run rewrote the output in the new shape:
  699 series and 8,439 values, the same totals as before.
- Through `EvalExecutor`, paren-style loads work for collec (with
  headings, old spellings and both TOTALs), ge subtotals, liab_ge by
  county, fuels gallons, and tob with arithmetic. Unknown labels and
  missing rows give clear errors.
- `dotax_sheet` is unit-tested against a mocked sheet. It has not run
  live yet, because it needs the Google token.

**Verification done:**

- **Unit tests:** `src/core/downloaders/**/*.test.ts`.
- **DOTAX parser parity against R `output/dotax.csv`:**
  - 11 current-page files (2025-12, 2026-06): 1,106 values, 0 mismatches,
    nothing missing on either side.
  - 14 archive `.xls` files (2009-07, 2014-03, 2019-01): 2,148 values,
    0 mismatches. The 2 problems found are the known, waived 2009-07 ones.
- **Live runs on the local DB:**
  - `bls_api` keyed: the full walk took 5 requests, the rerun 1 request
    (recent window), and the 1947 history was kept.
  - The load methods work through `EvalExecutor`, including arithmetic, a
    frequency mismatch error, and a missing series (a keyed fetch, then a clear
    error).
  - `dotax_current` full run (82 files, 2025-07..2026-08):
    - 699 keys and 8,439 values, 0 open problems; the 5 waived ones are the
      known 2026-05 fuels issues. The run took about 2 minutes.
    - Second run: the 42 files from 2025 were marked historical and skipped,
      and the 40 files from 2026 were refetched.
    - When nothing changed, the parse is skipped (about 55 s, all spent in the
      polite fetch delays).

**Not converted:** no load statements have been converted yet. The existing
`load_api_bls` loaders and `rprocess/dotax.R` are untouched.
