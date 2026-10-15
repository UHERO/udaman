# Ingest: DataDownloaders and DataExtractors

Spec: `docs/2026-10-14-downloaders-extractors-spec.md`. Decisions and phase
notes: `docs/2026-10-14-downloaders-extractors-phase1.md`.

```
Acquire  data_downloaders  fetch raw files, store them unchanged (raw_artifacts)
Extract  data_extractors   parse stored raw files → long CSV, validate (extraction_runs)
Load     load statement    Series.load_from_extract("handle", { dim: "label" })
```

## Framework (this directory)

| File                                                 | Job                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                           | The source-module contract: `SourceModule`, `FetchContext`, `ParseResult`, `MissingPeriod`                        |
| `registry.ts`                                        | `source_key` → module                                                                                             |
| `run.ts`                                             | `runFetch` / `runExtract`: claims, run records, skip-if-unchanged, validation, output                             |
| `strategies.ts`                                      | `static_url`, `discover_from_page`, `custom`                                                                      |
| `context.ts`                                         | Builds the `FetchContext` (stores, hashes, collects key failures)                                                 |
| `raw-store.ts`                                       | Content-addressed raw files: `DATA_DIR/ingest/raw/<downloader>/<sha256[0:2]>/<sha256>.<ext>`                      |
| `extract-file.ts`                                    | Extract CSV (`<run>.csv`) and missing periods (`<run>.missing.csv`) under `DATA_DIR/ingest/extracts/<extractor>/` |
| `validate.ts`                                        | Framework checks (hard: columns, dates, values, duplicates; soft: disappeared, changes)                           |
| `references.ts`                                      | `load_from_extract` calls in load statements                                                                      |
| `db.ts`                                              | The runner's DB seam (`catalogDb`; tests use `testing/memory-db.ts`)                                              |
| `http.ts`, `labels.ts`, `csv.ts`, `google-sheets.ts` | Shared helpers                                                                                                    |

## Source modules: `sources/<source_key>/`

Every source is a directory named exactly like its `source_key`, with the
same files:

| File                       | Job                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                 | The `SourceModule`: key, version, dimensions, `fetch` and `parse` wired in. Documents the load statement and the dimensions.                    |
| `fetch.ts`                 | Acquire. Navigation only (find files, call APIs); everything it wants parsed goes through `ctx.store` / `ctx.download`. Never pulls values out. |
| `parse.ts`                 | Extract. A pure function of the stored files: no network, no database. Returns rows, its own checks and missing periods.                        |
| `fetch-*.ts`, `parse-*.ts` | Helpers of one side, when the main file would be too long (e.g. `fetch-site.ts`, `parse-reports.ts`).                                           |
| `checks.ts`                | Source-specific consistency checks (optional).                                                                                                  |
| other `*.ts`               | Small modules both sides share (DOTAX: `artifact-keys.ts`, `dates.ts`, `labels.ts`).                                                            |
| `config/`                  | Bundled config tables (label rules, known issues, fixed labels) (optional).                                                                     |
| `fixtures/`                | Stored raw files the tests parse (optional; tracked despite the `*.xlsx` gitignore).                                                            |
| `<source_key>.test.ts`     | Tests. They never hit the network or MySQL.                                                                                                     |

Rules that hold for every source:

- Extractors emit the source's own labels, never UDAMAN series names. Where a
  source relabels a row, the parser maps every spelling to one fixed label
  (DOTAX: `config/labels` + `config/canonical`). An unrecognized spelling
  fails the run; it does not become a new series.
- Fail loudly. A fetch with a failed key does not extract. A failed check
  keeps the last ok output in use. Only soft failures (disappeared series,
  large changes, a new row without a fixed label) can be accepted
  (`bun run ingest accept <run>`).
- A period with no value inside a series' range is reported as a missing
  period: `blank` (the source printed no value), `absent` (the period's file
  was read but has no such row), or `failed` (the period could not be read;
  only possible when a known issue waived the failure). So in a published
  extract, a hole is never an unnoticed read or download failure.
- Bump `version` in `index.ts` whenever the same raw files would parse
  differently. It is part of the inputs hash, so a bump forces a re-parse.

CLI: `bun run ingest` (`list`, `fetch`, `extract`, `runs`, `run`, `accept`,
`artifacts`, `series`, `google-auth`).
