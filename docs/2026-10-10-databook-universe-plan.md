# DBEDT Data Book → `DATABOOK` universe: structure analysis & plan

_2026-10-10, revised for a full-history (2002–2025) vintage load.
Sources:

- current edition: https://dbedt.hawaii.gov/economic/databook/db2025/ (`DB2025_sectionNN.xlsx`)
- archive: `https://files.hawaii.gov/dbedt/economic/archive/databook/db{YYYY}/section{NN}.xls`, 2002–2024_

## TL;DR

- **Scope: every Excel edition, 2002–2025.** That's 24 editions × 24 sections, all present: 552 legacy `.xls` files plus 24 `.xlsx`, about 240 MB. Together they hold ~19,500 table-editions.
- **Everything goes into one long "vintage" file.** Each row has the edition year and is matched to a stable DATABOOK series. Udaman loads it **oldest edition first**, with each data point stamped with that edition's publication date:
  - identical values are discarded
  - changed values archive the old point and make the new one current
  - snapshot tables become real time series, one point per edition
- **Two parsers feed the same intermediate format.**
  - **2025+ "accessible" adapter:** easy, measured in §1.1.
  - **2002–2024 legacy adapter:** harder, because of multi-row headers, labels wrapped across rows, indentation used as hierarchy, and dates split across columns. The format is consistent across all 23 legacy years, so it's one adapter, not 23.
- **The 2025 edition defines the series.** Older editions only add vintages and history to series that exist in 2025. Anything DBEDT has since dropped (460 table histories) is not loaded.
- **Matching older editions to 2025 is the core problem.**
  - Table numbers can't be used as identity: 626 of the 832 current tables have had more than one number since 2002.
  - Matching chains backward one edition at a time, using title similarity plus **value overlap**. About 65–70% of adjacent-edition table pairs share ≥30% of their numbers, which is a strong signal for both tables and columns. Labels are the fallback.
  - Anything uncertain goes to a review queue rather than being guessed.
- **Two udaman changes are done:**
  1. `updateData({ vintageAt })` stamps each edition's points with its release date instead of `NOW()`. An older vintage never overwrites a newer one.
  2. `fillMissingLinear` fills interior gaps by linear interpolation; it runs as a `pseudo_history` loader for decennial and 5-year series.
- **Geography:** "Maui County 2/" (includes Kalawao) is just `MAU`. Footnote markers are stripped from labels before matching.
- **`bulkCreateSeries` is fixed** (the existing-series lookup is now scoped to the universe; see §2.5).

---

## Ported to the ingest framework (2026-10-15)

The fetch and parse steps below now run as the ingest source `databook`
(`src/core/ingest/sources/databook/`), and the loaders read its extract.
The rest of this document still describes the design; the commands changed.
Details are in `docs/2026-10-14-downloaders-extractors-phase1.md` §12.

- **Downloader `databook`** (`bun run ingest fetch databook`, weekly) stores
  each edition's 24 section workbooks as raw artifacts
  (`db<YYYY>/section<NN>`). Older editions are final; the newest is
  refetched every run.
- **Extractor `databook`** (`bun run ingest extract databook`) parses every
  stored edition, matches them to the 2025 edition's series and writes the
  latest-edition value per date, with columns section, table, name, geo,
  unit, date and value.
- **Loaders** read it by table, name and geography, e.g.
  `Series.load_from_extract("databook", { table: "20.04", name: "Pounds landed of commercial fish", geo: "HI" })`,
  plus `.fill_missing_linear` for pseudo-history. `Series.load_from_databook`
  is gone.
- **Universe tooling** (`bun run databook`): `sync` (was propose + match:
  refreshes the manifest from the stored files, keeping names), `apply`,
  `history` (vintages from the stored files), `publish`, `annual`.
  `vintages.csv`, `latest.json` and `ir/` in data-dir/databook are no longer
  written or read.
- **Units:** the unit rules now also read measure words in labels, bare
  headnote units, ranks, and what a count counts ("Number of Employees",
  Persons, Units, Jobs). "Number" went from 8,490 to 3,927 of 14,416
  measurements.

## Implementation status (2026-10-10) — superseded, see above

Built in `src/core/databook/`. The CLI is `bun run databook <cmd>` (`src/core/workers/databook-cli.ts`). Everything has been run end to end against the **local dev DB** (`uhero_db_dev`).

| Step     | Command                          | Result                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Download | `fetch --edition Y`              | All 24 editions are staged in `data-dir/databook/raw/db{Y}/`; files are hashed to detect re-issues.                                                                                                                                                                            |
| Parse    | `extract --all`                  | Two adapters, `adapters/accessible.ts` (2025) and `adapters/legacy.ts` (2002–2024), both emit `ir.ts`. Output is about 1.7M cells in `data-dir/databook/ir/` (16 s). Capture is 93% of numeric cells for 2025 and 86–90% for legacy editions (97% within classifiable tables). |
| Manifest | `propose`                        | Built from 2025: 764 tables, ~17k measurements. It lives in `data-dir/databook/manifest/`, not the repo (19 MB). Names are frozen because `propose` starts from the previous manifest, so back that directory up.                                                              |
| Match    | `match`                          | `data-dir/databook/vintages.csv` (200 MB, every cell of every edition) and `match-report.csv`. Time-series series are matched in 70% of the editions where their table exists; snapshot series in 46%.                                                                         |
| DB       | `apply --execute`                | 19,610 series (snapshot series need ≥5 editions), 725 categories, 599 data lists, 25 units, 158 sources, and observed plus pseudo loaders. Idempotent; takes 39 s.                                                                                                             |
| Vintages | `history --execute`              | 353k data points; 23.5k dates carry revision vintages; vintage dates run 2003-08-01 … 2026-08-01. Every date has exactly one current point. A re-run inserts 0 points. Takes 35 s.                                                                                             |
| Annual   | `annual --edition Y [--execute]` | Fetch → extract → match (newer editions are matched **forward** from 2025) → apply → load only that vintage.                                                                                                                                                                   |

Code changes outside `databook/`:

- `SeriesCollection.updateData({ vintageAt })`
- `Series.fillMissingLinear`
- `SeriesCollection.loadFromDatabook` (eval `Series.load_from_databook("NAME")`, which needs the parentheses)
- the `bulkCreateSeries` universe fix
- `DATABOOK` in the hard-coded universe lists

Known gaps / next steps:

- **Series that first appear after 2025** are reported as unmatched in `match-report.csv` but not yet created. `propose` only builds from the 2025 IR.
- **Match quality is uneven by table.** The worst are restructured tables (09.13), tables with changing listings (05.37, 01.35/01.36), and tables where the legacy layout differs (13.43). These need `overrides`, which don't exist yet; the adapters only apply their generic rules.
- **Unit labels need a review pass.** A few odd ones remain, e.g. "Reported to the U", "Mixed Use Condominium Projects".
- **Local DB is missing two migrations,** `public_sync_watermarks` and `series_dependencies`. Use `--no-public-sync` locally; loader dependency writes only log warnings.

---

## 1. What's in the files

### 1.1 The 2025 edition (accessible xlsx)

Each `DB2025_sectionNN.xlsx` has:

- a `Section N Table of contents` sheet
- a `Section N Narrative` sheet: one paragraph, which becomes the category description
- one sheet per table, named `NN.TT`

Table layout:

```
1   Table 1.06-- RESIDENT POPULATION, BY COUNTY:  2010 TO 2025     ← title (sometimes wraps to row 2)
2-4 [Based on place of usual residence … Revised from previous "Data Book"]   ← headnote (unit hints: "[In percent …]")
5   Date [a] | State total | City and County of Honolulu | Hawaii County | …  ← ONE flattened header row
6+  2010: April 1 | 1360304 | 953203 | …                              ← data
24  [a]  April 1, 2020 figures are …                                  ← footnotes
30  Source:  U.S. Bureau of the Census, … <https://…> accessed …     ← source (+ URL)
```

| Feature                                        | Count (of 833 tables)    | Notes                                                                                                                             |
| ---------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Header row                                     | row 2–6 for 92%          | It's the first row with ≥2 non-empty cells.                                                                                       |
| Merged cells                                   | 6 tables                 |                                                                                                                                   |
| `… hierarchy` column (`Level 1`…`Level 9`)     | 194                      | Gives an explicit tree; levels 1–3 make up 85% of rows.                                                                           |
| Stacked panels (header row repeated mid-sheet) | 169                      | e.g. 02.02: births / deaths / birth rates / death rates                                                                           |
| Composite headers                              | common                   | `April 1, 2020, Both sexes`, `Real SPI per capita 2018`                                                                           |
| Footnote markers                               | 2,408 labels, 939 values | `Maui County [a]`, `2020 [c]`, cell = `"[a]"`, number format `#,##0\ "[b]"`                                                       |
| Number formats                                 |                          | `#,##0` 663, `0.0%` 95, `"$"#,##0` 37. Percents are stored as fractions (the loader multiplies them by 100; see `percent` below). |
| `Source:` line                                 | all                      |                                                                                                                                   |

**Layouts:**

| Layout       | Tables | Description                                                    | Example             |
| ------------ | ------ | -------------------------------------------------------------- | ------------------- |
| **Long**     | 292    | Col A = period, columns = series (219 tables have ≥20 periods) | 01.04, 01.06        |
| **Wide**     | 168    | Header = periods, rows = series                                | 01.05, 01.11, 13.11 |
| **Snapshot** | 373    | One period (named in the title), rows × columns = dimensions   | 01.27, 01.29        |

**Time labels** (long tables; plain years are about 92% of rows):

| Shape                                                  | Rule                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `2019`, `2020 [c]`                                     | → `YYYY-01-01` (strip the footnote marker)                                                                                    |
| `2010: April 1` / `2010: July 1`                       | Two rows for the same year: keep July 1 (the regular estimate). The census-base row goes to a separate measure or is dropped. |
| `January 1, 2010`, `Dec. 31, 2010`, `1996: Nov. 5`     | → that year                                                                                                                   |
| `2005/2006`, `2019-2020` (one-year span)               | fiscal or school year → end year; the series description notes "Fiscal Year" / "School Year" / "Crop Year" etc.               |
| `2020-2030`, `1990 - 2000`, `1959-1961` (multi-year)   | an interval (growth rate, projection, life table): **skipped**                                                                |
| `2022, including gov't`, `2012 Military personnel [a]` | year + dimension in one cell: per-table override                                                                              |

**Text-heavy tables** (~80: rankings, name lists, disasters) are out of scope.

### 1.2 The legacy editions (2002–2024 `.xls`)

|                                                     | 2002 | 2008 | 2014 | 2020 | 2024 |
| --------------------------------------------------- | ---- | ---- | ---- | ---- | ---- |
| Tables                                              | 770  | 800  | 842  | 864  | 836  |
| Tables with merged cells                            | 124  | 101  | 115  | 114  | 124  |
| Multi-row headers                                   | 278  | 263  | 276  | 282  | 255  |
| Dates split across two columns (`1980:` / `July 1`) | 46   | 49   | 43   | 39   | 41   |
| Footnote style                                      | `1/` | `1/` | `1/` | `1/` | `1/` |

- **Every year has all 24 sections.**
- **The title is always on row 1**, starting `Table N.NN--`.
- **Sheets are named `NN.NN`.** The exceptions are 2002, 2004 and 2005, where some sheets are named `N.NN`; read the table number from the title instead.

What the legacy adapter has to handle (examples: `db2002/01.06`, `db2013/12.05`):

- **Spanning header bands with no merged cells.**
  - "Civilian labor force" sits above B–C, "Unemployed (percent)" above D–E, and the leaf headers are on the next row.
  - Fill each band to the right until the next band label, then join: `Civilian labor force, Female`.
- **Labels that wrap across rows.**
  - `"     American Indian and Alaska"` / `"        Native"` with the numbers on the second row.
  - Merge a row with no numbers into the next row when that row is indented further or continues the text.
- **Hierarchy by indentation** (leading spaces) instead of `Level N`. Convert indentation depth to levels.
- **Panels.** Label-only rows like `2011` / `2012` split a table into one panel per year. This is common in legacy snapshot tables, and it's a free source of extra vintages.
- **Split date column.** `1980:` in A and `April 1` / `July 1` in B, with A blank on continuation rows. Fill down.
- **Whitespace inside labels:**
  - Runs of spaces from print alignment, e.g. `"State             total 1/"`.
  - `\n` line breaks.
  - Footnotes written `N/`.

The output is the same intermediate format as the 2025 adapter (§3.1). A per-table overrides file covers what the heuristics miss. The legacy format didn't change between 2002 and 2024, so overrides are per table lineage, not per year.

### 1.3 Table histories across editions (2002 → 2025)

Tables were chained edition by edition with a one-to-one greedy match on title token similarity, preferring the same table number and allowing gaps of up to 3 editions:

- **2025 tables:** 832.
  - 588 trace back ≥20 editions; 133 trace back 10–19.
  - 25 are new in 2025.
- **Renumbering is the norm over 24 years.** Only 206 of the 832 kept a single table number throughout; 626 changed at least once, and some changed 10+ times.
  - Example: 01.29 "Resident population by age group, by county" has been 01.29, 01.31, 01.32, 01.33 and 01.35.
  - In any single year, 25–35% of tables have a different number than the previous edition.
- **460 table histories end before 2025** (DBEDT dropped or merged the table). 127 of them appeared in only one edition.
- **Value overlap** (the share of a table's numbers, excluding year-like values and numbers under 10, that also appear in the previous edition's table with the same number):

  | Edition pair | Pairs | ≥30% overlap | some | none (snapshot-like) |
  | ------------ | ----- | ------------ | ---- | -------------------- |
  | 2024→2025    | 797   | 543 (68%)    | 117  | 137                  |
  | 2010→2011    | 778   | 470 (60%)    | 116  | 192                  |

  So for most time-series tables, unrevised history repeats exactly between editions. That makes overlapping values the best evidence for "this legacy column is that 2025 series". It also works when the column header was reworded, which labels alone can't handle.

- **Revisions are real.** The April 1, 2020 state population is 1,455,252 in 2024 and 1,455,267 in 2025. This is exactly what the vintage load should capture.

Title matching alone is noisy: tables with similar titles can swap ("X, by county: 2020" vs "X: 2010 and 2020"). Production matching should combine title, value overlap, and header-label overlap, and send low-confidence matches to review (§3.3).

### 1.4 Publication timing → vintage dates

The file "last modified" dates show edition _Y_ is published around **August of Y+1**:

- 2002 edition: Oct 2003
- 2003–2024 editions: late July – Sept of the following year
- 2025 edition: files modified Sept 27 – Oct 6, 2026

**Convention: vintage date = `{Y+1}-08-01`** for edition _Y_, i.e. the year it was released. It's simple, monotonic, and within a few weeks of the real date. It is **not** the file's last-modified date.

DBEDT also **edits the current edition's files after publishing** (2025 files were modified into October 2026). So the annual job hashes the files and reloads whenever the current edition changes. That reload uses the same vintage date, and `updateData` corrects the vintage's rows in place (see §3.3).

---

## 2. Phase 1 — series and metadata (from the 2025 edition)

The 2025 edition defines what exists: series, measurements, categories and metadata. Older editions add data only (§3).

### 2.1 Pipeline

```
editions ──► adapter (2025: accessible │ 2002–2024: legacy) ──► IR per edition
                                                                │
2025 IR ──► propose ──► manifest (in repo, reviewed) ──► apply ──► DATABOOK universe
                ▲
        overrides.yaml, previous manifest (stable IDs)
```

- **`databook extract <edition>`**
  - A pure function, with no database access.
  - Writes `tables.json` (title, headnote, unit hints, footnotes, source, layout, panels, hierarchy).
  - Writes `cells.csv` (`table, panel, row_path, col_label, period_label, date, value, cell_addr, flags`). Labels are normalized: footnote markers (`[a]`, `1/`) stripped, whitespace collapsed, `to_ascii` applied.
- **`overrides.yaml`**, keyed by table history, so one entry works for every year. Fields:
  - `skip`
  - `layout`
  - `time_col_split`
  - `duplicate_year: prefer "July 1"`
  - `interval_rows`
  - `geo_axis`
  - `unit`
  - `scale`
  - `periodic: decennial|5yr` (§3.5)
- **`databook propose`**: turns the IR plus the previous manifest into a manifest diff. Existing IDs are kept; new IDs go only to new series.
- **`databook apply`**: idempotent upsert into DATABOOK. Never wipe-and-rebuild.

### 2.2 Naming

| Layout                  | Series key                              | Example                                               |
| ----------------------- | --------------------------------------- | ----------------------------------------------------- |
| Long, plain columns     | `DB{SS}{TT}{col}`                       | 01.04 col B → `DB0104B@HI.A`                          |
| Long, geography columns | `DB{SS}{TT}` + geo                      | 01.06 → `DB0106@HI.A`, `@HON`, `@HAW`, `@KAU`, `@MAU` |
| Long with panels        | `DB{SS}{TT}P{n}{col}`                   | 02.02 deaths col B → `DB0202P2B@HI.A`                 |
| Wide (rows are series)  | `DB{SS}{TT}R{nn}`                       | 01.11 Puna → `DB0111R03@…`                            |
| Snapshot cell           | `DB{SS}{TT}R{nn}{col}` or a geo variant | 01.29 "Under 5" × Honolulu → `DB0129R02@HON.A`        |

- **Positions are taken from the 2025 edition and then frozen.**
  - The manifest stores each series' locator (table history, `row_path`, `col_label`), and every later edition is matched to that locator.
  - Within two or three years, names and table numbers will drift apart. That's acceptable; renaming would break links.
- **Measurement** = series key without the geo.
- **Geography** is assigned by `geoassign.ts` (revised 2026-10-11). A measurement is one metric across all of its geographies.
  - **Handles:**
    - state and nation: HI, US
    - counties: HON, HAW, KAU, MAU
    - islands: OAHU, HAWI, MAUI, MOL, LAN, KAUI, NII, KAHO
  - **Counties and islands are distinct geographies** (HON vs OAHU, MAU vs MAUI/MOL/LAN), following UHERO's MAU/MAUI pattern.
  - **Kalawao** rows are dropped; Maui County includes Kalawao.
  - **Where geographies are found:** anywhere in a cell's labels — row or column, parent or leaf, or the panel label ("Type of offense for Oahu"). They can be whole labels ("Hawaii County [a]", "Oahu total") or phrases at the start or end of a label ("All exemptions, Statewide", "Oahu: male", "Hawaii per capita personal income").
  - **Bare names are resolved by their siblings.** "Hawaii" is HAW among counties, HAWI among islands, and HI next to the U.S. "U.S. total" only counts as US when Hawaii or a county/island is a sibling; otherwise it's a visitor market.
  - **"Total" is the state** when it sits next to county/island geographies.
  - **Not split off:** institution names (colleges, museums, companies) and labels naming several places.
  - **Panels that differ only in geography merge.** "County" and "Island" panels become one measurement.
  - **Sub-areas take their nearest geography** and keep their label as a dimension, e.g. judicial district "Puna" becomes `@HAW`.
  - **By-state tables keep only HI and US.**
  - **The cross-edition matcher uses the same resolution,** so "Hawaii" (county context) and "Hawaii County" match across editions.
  - **Snapshot inclusion is per measurement:** if any geography reaches 5 editions, every geography of the measurement is created.
- **Measurement grouping** (revised 2026-10-11). A measurement never spans sheets. Only geography and frequency are folded into one measurement; every other breakdown (race, age, a component such as an armed-services branch) is its own measurement.
  - **State columns labelled with the metric.** Some sheets head the state column with the metric itself, e.g. 01.01 "Population (number)" | Honolulu County | Hawaii County | …. In that case the label just before a run of ≥2 sibling county/island labels is the state value of the same metric. It qualifies when it reads as a total ("Index Offenses, total", "Total acres", "Total county debt", "State average") or is the first label of its row/column. 01.01 is therefore one "Population" measurement with five series.
  - **Percent-change columns and rows are not loaded,** since udaman derives % change itself. Examples: "Population (percent change)", "Hawaii percent change".
  - **Panel labels that only name a period or a geography type merge.** Examples: "Year", "Date", "State by year", "County: 2024". A statewide time-series panel and a by-county snapshot panel therefore form one measurement (18.17, 16.13, 19.10, 22.08). If the merged panels disagree on a value for the same geography and date, they stay separate.
  - **Single-place titles set the default geography.** For example "…, for Oahu", "…Oahu Neighborhoods" and "Honolulu Construction Cost Indexes" default to OAHU or HON instead of HI. Comparison titles keep HI, e.g. "for the State and Oahu", "Honolulu and the United States".
  - **When rows and columns both name a geography,** the axis that lists more geographies wins; the other keeps its label as a dimension. In 06.06, island columns win over a "Government - State total" row.
  - **Mixed county/island lists:**
    - "Oahu" among Maui/Hawaii/Kauai counties (with no other islands) is HON.
    - A bare name whose county is already listed is the island ("Maui County total", Lanai, Maui, Molokai → MAUI).
    - A bare "Honolulu" needs other county/island siblings; otherwise it is a harbor, airport or station.
  - **Nesting levels resolve separately,** and a nested geography must be smaller than its parent. In 01.12, "Hawaii", "Maui" and "Lanai" at the top level are islands, and "Oahu > Urban Honolulu" (a census place) stays a place on OAHU instead of becoming HON.
- **Year rows inside a snapshot table are periods.** 10.06 lists contract-award totals for 2017 … 2023 as rows under a 2024-dated title. `promoteYearRows` (extract.ts) turns rows labelled with a bare year into dates when a snapshot table has ≥3 of them.
- **A series needs at least 2 observations** (`MIN_OBSERVATIONS` in apply.ts; `observations` is recorded by `match`). Event and list tables (eruptions, tsunamis, hurricanes, largest employers, rankings) and geographies printed for only one year would otherwise become single-point series.
- DATABOOK needs its own geography, unit and source rows. `SeriesCollection.create` resolves `(universe, handle)` and throws if it's missing.

### 2.3 Metadata sources

| Udaman field                               | From                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description` / `dataPortalName`           | Table title (without the period) + panel label + `row_path` + column label, plus a period-basis note when it isn't calendar year ("Fiscal Year", "School Year", "Crop Year", "As of July 1", "5-year ACS ending in year"). The portal name is the leaf label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `notes` / `investigation_notes`            | Headnote + the footnotes that apply (matched by marker letter).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `unit`                                     | In order (meta.ts `inferUnit`), first match wins:<br>1. A percent number format, or any label saying "percent" or "%" ("Hawaii as percent of U.S."; not "50% exemption").<br>2. A unit written in the labels, most specific label first: "(dollars)", "($1,000)", "(in thousands)", "(1,000 kWh)", "(sq. km.)", "(2017=100)", "($/kWh)", ", in thousands of dollars". A label with two units ("($M) and personnel (number)") gives the half whose subject another label names. Item names under a numeric code are skipped.<br>3. The headnote ("[In thousands of dollars …]").<br>4. `$` in the number format, then header words (rate, index, acres …).<br>5. Otherwise "Number".<br>Portal names drop the unit parenthetical unless two measurements would then share a name ("Land area (sq. km.)" / "(sq. mi.)"). Descriptions keep it. |
| `percent` / `decimals`                     | Cell number format: `0.0%` → `percent = true`, 1 decimal. Excel stores the fraction (0.17 shows as 17%). The adapters multiply numeric `%` cells by 100 (`toPercentUnits`, meta.ts), so the series holds 17. The `percent` field does not scale anything: in Rails, Angular and this port it only relabels changes ("Chg" instead of "% Chg") and makes YOY a difference. Text cells such as "17%" already parse to 17.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `xseries.units` (scale)                    | "in thousands" / "in millions" in the headnote.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `source` / `source_link` / `source_detail` | **Source is always "DBEDT State of Hawaii Data Book"**, linked to https://dbedt.hawaii.gov/economic/databook/, because that is where we get the data and citing it means users won't think UHERO compiled the tables. **`source_detail`** = "Data Book Table 1.07 (2025 edition). Original source: " + DBEDT's citation from the table's `Source:` footer. The original agency and URL are also kept in the manifest (`originalAgency` / `originalLink`).                                                                                                                                                                                                                                                                                                                                                                                    |
| `seasonal_adjustment`                      | `not_applicable`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Categories                                 | `Databook` → `§N section` (Narrative text) → `Table NN.TT` (one data_list per table).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `list_order` / `indent`                    | Table order; `Level N` clamped to indent0–3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Defaults                                   | geo HI, freq A                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Legacy editions don't change metadata, with one exception: §3.3 records each matched series' historical labels in the manifest as aliases, which helps with review.

### 2.4 Scope

1. **Series from 2025 long/wide tables.** Roughly 430 tables and ~5–6k series. Every vintage back to 2002 gets loaded for these.
2. **Series from 2025 snapshot tables, included only if the series is matched in ≥5 editions.** 01.29 traces back to 2002, so "Honolulu, under 5" gets about 23 annual points. Tables whose snapshots never roll forward (1.10 land area, 2020 Census) fall below the threshold and are dropped. The final count comes from the first match report; expect roughly 10–20k series.
3. **Out:**
   - anything that isn't in the 2025 edition (discontinued tables and series are dropped)
   - rankings and text tables
   - interval rows
   - sub-county geographies

### 2.5 Universe setup and tooling

- **Universe:**
  - Insert a `universe` row `DATABOOK`. No migration is needed (it's a lookup table).
  - Add `DATABOOK` to `UNIVERSES` in `src/core/catalog/types/shared.ts`, to `src/core/catalog/utils/validators.ts`, and to `src/components/compare/parse-filter-names.ts`. That last one is a separate list, which also misses HHF.
  - Check `normalizeUniverse` in `src/lib/auth/roles.ts`.
- **Don't** reuse the wipe-and-rebuild `universe-upload.ts` pattern (DBEDT/Factbook). Stable IDs matter here. `src/lib/prisma/migrations/factbook-seed/seed.ts` (dry-run plus `--execute`) is the closest template for `apply`.
- **`bulkCreateSeries` is fixed** (`src/actions/series-actions.ts`).
  - It now looks up existing series with `SeriesCollection.findByNameAndUniverse(name, universe)`.
  - Before, it used the unscoped `getByName`, which attached loaders to a same-named series in another universe. The old `try/catch` also treated any database error as "not found".
  - `apply` will probably write directly rather than going through this action, but it's safe to use now.
- **The existing ~420 UHERO series** (`load_from "rawdata/Manual/DataBook.csv"`): ignore them. You'll archive them separately. No crosswalk.

---

## 3. Phase 2 — full-history vintage load (2002–2025)

### 3.1 The vintage file

All editions are parsed into one long file, `data-dir/databook/vintages.csv` (or partitioned per edition):

| Column                           | Example                                             | Notes                                                          |
| -------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `vintage`                        | `2013`                                              | Edition year                                                   |
| `vintage_date`                   | `2014-08-01`                                        | §1.4                                                           |
| `table_num`                      | `01.32`                                             | As printed in that edition                                     |
| `table_line`                     | `L0129`                                             | Stable table-history ID (that of the 2025 table)               |
| `panel`, `row_path`, `col_label` | `—`, `Under 5 years`, `City and County of Honolulu` | Normalized                                                     |
| `period_label` / `date`          | `July 1, 2012` / `2012-01-01`                       |                                                                |
| `value`                          | `61327`                                             | Scale-adjusted (thousands → units), percent convention applied |
| `series`                         | `DB0129R02@HON.A`                                   | Blank if unmatched                                             |
| `match`                          | `value-overlap` · `label` · `manual` · `none`       | How the series was matched                                     |
| `confidence`                     | `0.97`                                              |                                                                |
| `cell_addr`                      | `section01.xls!01.32!D14`                           | Provenance, used for review                                    |

Size estimate: about 100k numeric cells per edition × 24, so ~2.4M rows. Most of those are in tables we'll match; unmatched rows stay in the file for review instead of being dropped.

### 3.2 Matching older editions to 2025 series

Matching goes backward from the newest edition: 2025 ↔ 2024, then 2024 ↔ 2023, and so on. **Each edition is matched to the next newer one, not straight to 2025.** That way, a column renamed in 2014 and again in 2020 is followed one step at a time.

1. **Table history.** Candidates come from title token similarity (one-to-one, preferring the same number, gaps of up to 3 editions). Value overlap and header-label overlap are added to the score. The result is a `table_line` for every legacy table, or "discontinued".
2. **Series within a matched table:**
   - **Time-series tables:** for each older column or row, pick the newer series with the most identical values over shared periods. Overlap of ≥90% on ≥3 shared periods is an automatic match. Use the Hungarian assignment so two columns can't claim the same series. Revisions only lower the overlap; they rarely flip a match.
   - **Snapshot tables:** there are no shared periods, so match on normalized `(panel, row_path, col_label)`, with geography synonyms and a fuzzy label match. Confirm structurally: does the row order and the number of children under each parent line up?
   - Matched series record the older edition's raw labels as aliases in the manifest, so later lookups and human review can see what it used to be called.
3. **Review queue:** tables matched below threshold, tables with conflicting matches, and series whose snapshot labels changed. These go into a report (HTML or CSV) grouped by table history. A decision is recorded once in `overrides.yaml` / the manifest (`manual` match) and applies to every year.

Expected yield: most rows in the 588 tables with ≥20 editions should match automatically. Snapshot tables will need the most review.

### 3.3 Loading order and udaman mechanics

`SeriesCollection.updateData` (`src/core/catalog/collections/series-collection.ts:1706`) already has the semantics you described:

- a value identical to the loader's latest for that date is skipped
- a changed value demotes the current point (`current = 0`) and inserts the new one as current
- dates the loader didn't send are left alone

It now takes an optional **`vintageAt`** (done; `src/core/catalog/collections/series-collection.ts`).

- **`created_at` is set to `vintageAt`** (HST wall-clock `YYYY-MM-DD[ HH:MM:SS]`) instead of `NOW()`.
  - Without this, loading editions back-to-back would collide on the `(xseries_id, date, created_at, data_source_id)` key.
  - It would also record every vintage as "today", making `getVintagesByDate`, `getAsOf` and the portal's `publishedAt` meaningless.
  - `updated_at` stays `NOW()`, so the public data point sync, which compares `updated_at`, still picks up the change.
- **An older vintage never overwrites a newer one.** If this loader already has a point for a date with a later `created_at` than `vintageAt`, that date is skipped and a warning is logged.
- **Same vintage, different value:** the row is corrected in place. This handles DBEDT re-issuing the current edition's files.
- Without `vintageAt`, behavior is unchanged.
- **Not yet run against a database.** The unit tests don't cover `updateData`. The first `databook-history` dry run (build order step 4) is its real test.

**Load procedure** (a `databook-history` job, run once, then re-runnable after clearing):

1. Create one `Databook.load("<series>")` loader per series: `clear_before_load = false`, `reload_nightly = false`.
2. For `vintage` = 2002 … 2025, in order: for each series with rows in that vintage, call `updateData({ xseriesId, data, dataSourceId: loader.id, pseudoHistory: false, vintageAt: vintage_date })`.
3. Run the pseudo-history pass (§3.5).
4. `updatePublicDataPoints` for the universe.

**What you get:**

- **Revisions become vintages.** Every revision across 24 editions is kept as a vintage dated to its edition.
- **History reaches back further than 2025 shows.** The 2002 edition's 01.06 covers 1980–2002 and the 2025 edition covers 2010–2025. Years 1980–2009 come from the most recent edition that included them and stay current.
  - Caveat: that history can mix estimate bases. A year whose last printing came _before_ a revision of its neighbors stays on the old basis.
    - `databook match` flags these: a date whose newest vintage is older than its neighbors' newest vintage, where the neighbors were revised by more than ~1% afterwards.
    - Affected measurements get a note (decision 7).
- **Snapshot series gain one point per edition,** dated by the period in the title, not by the edition year. A 5-year ACS window `2020-2024` is dated by its end year.
- **Duplicate dates within one edition** (April 1 / July 1) are resolved by the §1.1 rule before loading, so a single edition never sends two values for one date.

### 3.4 Loader eval for ongoing use

The loader eval is `Databook.load("DB0106@HON.A")`. A new static method in `eval-executor.ts` returns the **latest-vintage observed value per date** from `vintages.csv`. A normal annual reload of the newest edition then behaves like any other loader: identical values are skipped, revisions become new vintages.

`vintageAt` comes from the edition being loaded, so the reload path needs to pass it through. Simplest: the annual job calls the same history routine for only the new vintage, rather than relying on the generic reload.

### 3.5 Gaps in decennial and 5-year series → pseudo-history

Some series only have observations every 10 years (census: 1.01, 1.05, 1.46, …) or every 5 years (Ag Census §19, Economic Census establishments).

- **New series method `fillMissingLinear()`.**
  - It generalizes `fillMissingMonthsLinear` (`src/core/catalog/models/series.ts:1416`, monthly-only today) to any frequency.
  - It returns **only** the interpolated interior points, never extrapolating past the first or last observation.
  - The same idea as `fillAlternateMissingMonths`, which also returns only new points.
  - Register it in `eval-executor.ts`.
- **A second loader per flagged series:** eval `Databook.load("DB0105R02@HI.A").fill_missing_linear`, with `pseudo_history = true` and a **lower priority** than the observed loader (e.g. 40 vs 100). So:
  - Real observations always win.
  - When a later edition adds a real point inside a gap (a new census, a new Ag Census), it takes over, and the interpolated neighbors are recalculated as new pseudo vintages.
- **Which series get it:**
  - `periodic:` in overrides.
  - Or automatic: series whose median gap between observed dates is ≥2 years.
  - Don't apply it to series whose gaps are just missing editions (a table that skipped a year).
- Pseudo-history points are flagged `pseudo_history = 1` in `data_points` and `public_data_points`. Check how the data portal renders them before publishing.

### 3.6 Annual run (once an edition is published, ~Aug–Oct)

1. Download the 24 files. Hash them; re-run whenever the current edition's files change, since DBEDT edits after publishing.
2. Run the adapter (accessible, or legacy if DBEDT reverts) and validate: every table has a header and a Source line.
3. Match the new edition to the previous one (§3.2) and to the manifest: matched / moved / new / missing / unit changed / large revisions → review.
4. Approve. New series get IDs (manifest append + `apply`). Missing series are marked discontinued, never deleted.
5. Append the edition to `vintages.csv` and load **only that vintage** with `vintageAt = {Y+1}-08-01`. Then run the pseudo-history pass and the public data point update.

---

## 4. Required code changes (udaman)

| Change                                                                                                   | Where                                                                       |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ✅ Scope the `bulkCreateSeries` lookup to the universe                                                   | `src/actions/series-actions.ts` (done)                                      |
| Add `DATABOOK` to the hard-coded universe lists                                                          | `types/shared.ts`, `utils/validators.ts`, `compare/parse-filter-names.ts`   |
| ✅ `updateData({ …, vintageAt })` + older-vintage guard + same-vintage correction                        | `collections/series-collection.ts`                                          |
| ✅ `fillMissingLinear()` (A/S/Q/M/W/D, interior gaps only, returns only the filled points; 5 unit tests) | `models/series.ts` + `eval-executor.ts` registry                            |
| `Databook.load(name)` static loader method                                                               | `eval-executor.ts` + a `databook` module that reads `vintages.csv` (cached) |
| `databook` CLI: `extract`, `match`, `propose`, `apply`, `load-history`, `load-edition`                   | `scripts/databook/` or `src/core/databook/`                                 |

## 5. Build order

1. **The 2025 adapter + IR + overrides; then `propose` → `apply`.** The DATABOOK universe exists, with 2025 data loaded as vintage 2026-08-01. This is useful on its own.
2. **Legacy adapter.** Develop it against fixtures (`db2002/01.06`, `db2013/12.05`, a merged-header table, a panelled snapshot) and measure parse coverage on all 23 editions.
3. **Matcher + review report.** Iterate on thresholds using 2024↔2025 and 2010↔2011 as test pairs, then review the long-history snapshot tables.
4. **The `vintageAt` change + the `databook-history` job.** Dry-run it against a copy of the database: count inserted, discarded and vintaged points per edition.
5. **`fillMissingLinear` + pseudo loaders.**
6. **The annual job.**

## 6. Decisions (2026-10-10)

1. **Discontinued tables and series:** dropped. Only series that appear in the 2025 edition are created.
2. **Vintage date:** `{Y+1}-08-01`, the release year, not the file's last-modified date. Re-issued files reuse the same date and are corrected in place.
3. **Fiscal, school and crop years:** dated by end year, with a note in the series description.
4. **Percent:** store percent units (fraction × 100, as all existing udaman percent series do) and set udaman's `percent` field.
5. **Snapshot series:** included only if matched in ≥5 editions.
6. **Interval rows:** skipped.
7. **Mixed estimate bases:** add a note on the measurement. `databook match` also flags "stuck" years automatically (§3.3), for review.

---

## Appendix A — parser fixtures

| Table                                              | Why                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2025 01.06 / 2002 01.06                            | Same table in both formats: split date column (legacy), duplicate-year rows, geography columns, Maui `2/` vs `[b]` |
| 2025 01.05                                         | Wide, island rows, second panel, `[e]` cell values                                                                 |
| 2025 01.07                                         | Two panels: years, then intervals                                                                                  |
| 2025 01.11                                         | Wide, `Level 1-3` hierarchy                                                                                        |
| 2025 01.27 / 2024 01.27                            | Composite header vs. a two-row header band                                                                         |
| 2025 01.29 + history 01.29/01.31/01.32/01.33/01.35 | Snapshot that rolls forward; renumbered 5 times                                                                    |
| 2025 02.02                                         | Four stacked panels, `[a]` as a value                                                                              |
| 2013 12.05                                         | Legacy: header band, wrapped labels, indentation hierarchy, year panels                                            |
| 2025 13.11                                         | Wide by state, two measures × 7 years                                                                              |

## Appendix B — analysis scripts (session scratchpad; can be promoted to `scripts/databook/`)

- `profile.ts`: per-table layout, panels, hierarchy, number formats (2025)
- `timelabels.ts`: census of time-label shapes
- `archsurvey.ts`: legacy edition survey (tables, merged cells, header bands, footnote style)
- `lineage.ts`: chains table histories across 2002–2025 (`lineage.json`)
- `overlap.ts`: value overlap between adjacent editions
- `props.ts`: file modified dates → publication timing
