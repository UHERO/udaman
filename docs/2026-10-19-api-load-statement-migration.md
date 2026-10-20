# API load statements → load_from_extract (2026-10-19)

Moves the UHERO loaders that call the API loader methods to the ingest
extracts, one source at a time, verified by diff. The legacy methods
themselves are unchanged; anything not migrated keeps working.

| Source | Legacy method(s)                        | Enabled loaders | Script                           |
| ------ | --------------------------------------- | --------------: | -------------------------------- |
| BLS    | `load_api_bls`, `load_api_bls_NEW`      |             459 | `scripts/migrate-api/bls.ts`     |
| BEA    | `load_api_bea`                          |           1,021 | `scripts/migrate-api/bea.ts`     |
| FRED   | `load_api_fred`                         |              66 | `scripts/migrate-api/fred.ts`    |
| EIA    | `load_api_eia_aeo`, `load_api_eia_steo` |               8 | `scripts/migrate-api/eia.ts`     |
| e-Stat | `load_api_estatjp`                      |               6 | `scripts/migrate-api/estatjp.ts` |

Shared steps live in `scripts/migrate-api/lib.ts`; its header has the
details. Converter tests: `bun test scripts/migrate-api/`. They are
outside the usual `find src …` test sweep.

## What a statement becomes

```ruby
Series.load_api_bls("CUURS24BSA0", "M")
Series.load_from_extract("bls", { series_id: "CUURS24BSA0", frequency: "M" })

Series.load_api_fred("MORTGAGE30US", "Q", "avg")
Series.load_from_extract("fred", { series_id: "MORTGAGE30US", frequency: "Q", aggregation: "avg" })

Series.load_api_bea('A', 'Regional', TableName: 'CAINC5N', LineCode: 201, GeoFips: 15007, Year: 'ALL')
Series.load_from_extract("bea", { dataset: "Regional", table: "CAINC5N", line: "201", geo: "15007", frequency: "A" })

Series.load_api_eia_steo(seriesId: "WTIPUUS")
Series.load_from_extract("eia", { route: "steo", series_id: "WTIPUUS", frequency: "M" })

Series.load_api_estatjp('0003005865', area: '00000', tab: '02', cat02: '01', cat03: '0')
Series.load_from_extract("estatjp", { stats_data_id: "0003005865", tab: "02", cat02: "01", cat03: "0", area: "00000" })
```

- Only the call is replaced. Chained methods (`.trim(…)`) and arithmetic
  around it are kept.
- The frequency is written out explicitly: it is what the legacy call
  asked for. AEO defaults to annual and STEO to monthly, as before.
- BEA `UNIT_MULT` is dropped. It is not a GetData parameter; the legacy
  client only passed it on to the API, which ignores it.
- Every UHERO statement converts. The script refuses anything it can't
  convert exactly: a BLS year range, a BEA `Year` other than ALL, an EIA
  `value_in`, unknown parameters.

## Procedure (per source, on prod)

```bash
S=bls   # bls | bea | fred | eia | estatjp
bun run scripts/migrate-api/$S.ts plan                 # read-only: what converts, what doesn't
bun run scripts/migrate-api/$S.ts stage --execute      # add the filters to the downloader's config.extraFilters
bun run ingest fetch $S                                # fetches them; extracts when something is new
bun run scripts/migrate-api/$S.ts check                # diff vs stored points; CSV in DATA_DIR/migrations/
bun run scripts/migrate-api/$S.ts check --live         # FRED / EIA / e-Stat: diff vs a fresh legacy run
bun run scripts/migrate-api/$S.ts execute              # dry run of the rewrite
bun run scripts/migrate-api/$S.ts execute --execute    # backup CSV in DATA_DIR/backup/, then rewrite in place
```

Then reload the series, or let the nightly reload do it.

- **Unchanged values add nothing.** The loader id is unchanged, so a
  reload inserts no new data points where the values are the same.
- **Staged filters are cleaned up.** `execute` drops the staged
  `extraFilters` once the load statements ask for those series themselves.
- **Undo:** `restore <backup.csv> --execute` puts the old evals back, on
  loaders still holding the converted eval.
- **Fetch sizes:**
  - BLS: 451 series, about 60 requests.
  - BEA: 40 requests.
  - FRED: 66 requests.
  - EIA and e-Stat: a handful each.

### Reading the check

`check` compares against the points the legacy loader stored, so a
revision published since its last reload shows as `differs`. On prod the
nightly reload keeps those few. `--live` runs the legacy statement instead
and compares with that. It costs one API call per loader, or several per
BLS series for a full history, so use it whole for FRED, EIA and e-Stat,
and with `--series=NAME` for spot checks on BLS and BEA.

`drops` means the loader has stored dates the extract lacks. A rewrite
never deletes points, so they stay in place; `--force` rewrites these
too. Locally every `drops` was one of:

- **Points left from an earlier eval of the same loader row.** For
  example, PC@HON.M keeps Honolulu CPI history from before BLS's 2017
  Urban Hawaii series.
- **Placeholder values stored years ago for BEA suppressed `(D)` cells.**
  These are `1e12` in thousands; the current legacy client no longer
  returns them either.
- **BLS October 2025 CPI.** It was never published (the shutdown); the
  legacy loader stored `0`.

`error` means the converted statement can't load. Locally all of these are
series the agency no longer publishes, and their legacy loaders already
fail every night:

- **BLS (11):** SMU150… county and state industry series, for example
  `EADESNS@HI.M` and `WHAFFDNS@HON.M`.
- **BEA (30):** `MARPI` (metro RPP) and lines dropped from `CAINC5N` and
  `CAGDP2`.

They are held back. Disable them separately.

## Local results (uhero_db_dev, 2026-10-19)

| Source | check (stored points)                                    | check --live             |
| ------ | -------------------------------------------------------- | ------------------------ |
| e-Stat | adds 6 (2 newer months)                                  | same 6                   |
| EIA    | drops 6 (old AEO years), differs 2 (STEO forecast moved) | same 8                   |
| FRED   | differs 28, adds 20, same 16, drops 1, unloaded 1        | same 66                  |
| BLS    | differs 203, adds 86, drops 84, same 75, error 11        | same on 4 sampled series |
| BEA    | differs 363, same 319, drops 306, adds 3, error 30       | same on 5 sampled series |

- **Every `differs` is a revision against stale data.** The local legacy
  loaders were last reloaded months ago. BLS differences are all within
  the last 12 months; BEA's are the 2026 annual NIPA revision.
- **Nothing was rewritten locally.** All five downloaders have the
  filters staged in `config.extraFilters`, and the extracts are fetched.
