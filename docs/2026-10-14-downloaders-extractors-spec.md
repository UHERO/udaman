# Downloaders & Extractors: Implementation Spec

Oct 14, 2026 · Caleb Wood. Copied verbatim from the spec the author
shared; only the table formatting was restored. The Phase 1 report is in
`docs/2026-10-14-downloaders-extractors-phase1.md`.

## Goal

Bring the external fetch-and-transform scripts into the system as
DataDownloaders (acquire raw data) and DataExtractors (parse raw data into a
standard long format), plus one new load statement method that reads that
format with named filters. Build alongside the existing Downloads and load
methods, and migrate sources one at a time.

The target is load statements that read like load_api_bea: name the source and
the parameters that identify the series, with no positional parsing
instructions.

```
# today
Series.load_from_download("%Y@hiwi.org", { :file_type => "xls", :start_date => "1990-01-01", :sheet => "MIsle", :row => "header:col:1:Local Government:prefix", :col => "repeat:2:13", :frequency => "M" })

# target
Series.load_from_extract("hiwi", { sheet: "MIsle", industry: "Local Government" })
```

## Architecture

Three layers, each with one job:

1. Acquire (DataDownloader): fetch raw data and store it unchanged, with
   metadata and a content hash. It may parse pages to find the data
   (navigation), never to pull values out.
2. Extract (DataExtractor): turn one or more stored raw files into the
   standard long format, then validate it.
3. Load (load statement): select one series from an extract by named filters
   and map it to an internal series name.

Principles:

- The persisted raw file is the boundary. Never pass data from fetch to parse
  in memory. Fixing a parser means re-running it on cached raw files, not
  re-fetching.
- Parse is a pure function of raw files. No network access in parse. If parse
  needs something, fetch saves it.
- Code per source, rows per thing fetched. A source module holds the fetch and
  parse code; database rows hold config and point at that code by a registry
  key. No tables or models per source.
- Extractors emit the source's own labels, never internal series names.
  Mapping to series names lives in load statements.
- Fail loudly. A fetch, parse, or validation failure records an error and
  loads nothing. Never produce partial or shifted data.

## Data model

Six tables, one model each. Names are suggestions; match codebase conventions.

| Table             | One row per                    | Key columns                                                                                                                       |
| ----------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| data_downloaders  | file or endpoint fetched       | handle (unique), source_key, strategy, config (JSON), schedule, enabled                                                           |
| raw_artifacts     | distinct file fetched (a vintage) | downloader_id, content_hash, storage_path, resolved_url, content_type, size, fetched_at; unique on (downloader_id, content_hash) |
| fetch_runs        | fetch attempt                  | downloader_id, status (ok / unchanged / failed), error, raw_artifact_id, started_at                                               |
| data_extractors   | extraction                     | handle (unique), source_key, config (JSON)                                                                                        |
| extractor_inputs  | extractor-to-downloader link   | extractor_id, downloader_id, role                                                                                                 |
| extraction_runs   | parse attempt                  | extractor_id, input_artifact_ids, status, error, validation_results (JSON), output_path, output_hash, row_count, created_at       |

- source_key names the source module to run (see next section).
- extractor_inputs exists so one extractor can read several downloads, and one
  download can feed several extractors.
- If the codebase already has a job-history table, fold fetch_runs and
  extraction_runs into it instead.
- Reuse the existing Downloads cache/storage layer for raw files if it is
  generic enough.
- Extract output is a file (CSV or Parquet) referenced by
  extraction_runs.output_path, not a staging table.

## Source modules

One module per source holds both its fetch and parse code, registered under a
source_key. Sketch only; adapt to the codebase's language and conventions:

```ruby
class DotaxSource < Source
  # Acquire: may parse pages to locate files; returns raw files only.
  def fetch(downloader, ctx)
    page = ctx.get(downloader.config["landing_url"])
    link = ctx.find_link(page, pattern: downloader.config["link_pattern"])
    [ctx.download(link)]  # framework stores, hashes, records the run
  end

  # Declared dimension columns for an extractor's output.
  def dimensions(extractor) = [:table, :measure, :item, :county]

  # Extract: pure function of raw artifacts. No network.
  def parse(extractor, raw_artifacts)
    # yields { dims: { table:, measure:, item:, county: }, date:, value: }
  end
end
```

The framework, not source code, handles: running fetch, storing and hashing raw
files, skipping parse when inputs are unchanged, running parse, validating,
writing output, and recording runs.

Fetch strategies are reusable and selected by data_downloaders.strategy plus
config. A simple source should need config only, with no custom fetch code:

- static_url: fixed URL, supporting date patterns like the existing %Y handles.
- discover_from_page: find the file link by text or href pattern on a stable
  landing page.
- api: request with params and pagination; store the response body as the raw
  file.
- custom: call the source module's own fetch.
- Later: form/POST requests, headless browser for JS-rendered pages.

## Extract output and validation

Every extract has the same shape: declared dimension columns, then date and
value, one row per observation.

```
table,measure,item,county,date,value
fuels,State Tax,Aviation fuel,Kauai,2025-07-01,41203.17
```

- Which dimension columns exist is declared per extractor. Add a frequency
  dimension when one file mixes frequencies.
- Dimension values are the source's own labels, lightly normalized: trim and
  collapse whitespace, strip footnote markers (e.g. 1/, \*). Never rename to
  internal conventions.
- Dates follow the system's existing period-date convention; check how Series
  stores dates.

Validation runs after every parse. Any failure marks the run failed, and loads
keep using the last successful output.

- Columns match the declared dimensions exactly.
- No duplicate (dimensions, date) rows; values are numeric.
- Dates parse and fall in a plausible range.
- No series present in the previous successful run has disappeared
  (configurable per extractor).
- Optional per-extractor bound on change versus the previous vintage for
  overlapping dates; flag large jumps.

If the input raw hashes match the last successful run's inputs, skip parse
entirely.

## Load method

Add one generic method beside the existing load methods, not one method per
source:

```
Series.load_from_extract("dotax_current", { table: "fuels", measure: "State Tax", item: "Aviation fuel", county: "Kauai" })
```

- Reads the output of the extractor's latest successful run.
- Filters use named keys only, and keys must be declared dimensions.
- The filter must match exactly one series. Zero matches is an error (the
  source likely relabeled). More than one is an error that lists which
  dimensions still vary. No silent aggregation or fallback.
- If the extract has a frequency dimension and the filter omits it, infer it
  from the series name suffix (@HI.M → M).

Also validate at save time: when a load statement is created or edited, check
its keys against the extractor's dimensions and its values against the latest
extract, and suggest the closest labels on a miss.

## Implementation phases

Stop for review at the end of each phase.

1. Explore and report (no code). Find the Download model and its
   cache/storage, how load statements are stored and evaluated
   (load_from_download, load_api_bea), how jobs and scheduling run, and the
   test setup. Report how this spec maps onto the codebase, and any conflicts,
   before writing code.
2. Schema and models. Migrations and models for the tables above, plus the
   source_key → source module registry.
3. Runner. fetch → store → hash → skip if unchanged → parse → validate → write
   output, recording runs. Implement static_url, discover_from_page, and
   legacy_script. Tests use stored raw fixtures and never hit live sources.
4. Load method. load_from_extract with the matching rules and save-time
   validation.
5. Pilot. Migrate one external script through legacy mode, then one brittle
   load_from_download source as a full fetch/parse split. Run old and new side
   by side and diff the resulting series values before switching over.
6. Remove any remaining 'Downloader' code which was implemented on staging
   branch but not in prod.

Later: api and headless strategies, a dimension picker for writing load
statements, showing each series' source chain (load statement → extractor →
downloader → URL) in the UI, and retiring migrated Downloads.

## Constraints

- Don't change the behavior of existing Downloads, load_from_download, or any
  other existing load method.
- Don't migrate existing load statements automatically; migration is per
  source and verified by diff.
- No tables, models, or columns specific to one source.
- Extractors never reference internal series names.
- Tests never hit live sources.
- Raw file storage location and retention: only keep vintages with distinct
  hash.
