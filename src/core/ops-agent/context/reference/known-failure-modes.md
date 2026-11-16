# Failure modes seen before

Starting points, not answers; confirm each case.

- **Source file moved or renamed.** Agencies rename yearly files (`…_2025.xlsx` → `…_2026.xlsx`) or reorganize sites. Symptom: 404 or HTML where a spreadsheet was expected. Check with `probe_source_url`, find the new location on the agency's site, and propose the updated URL or download handle after a dry run.
- **Header text changed.** Header matching in `load_from_download` (`:row => "header:…"`) compares cleaned text: lowercased, accents and typographic quotes turned to ASCII, and okina stripped with the `no_okina` match types. A renamed row ("Hawaii Island" → "Hawaiʻi Island") makes the header lookup fail. See `src/core/catalog/utils/download-processor.ts`.
- **Spreadsheet layout changed.** A new column or row shifts positions; values load but are wrong, or the frequency doesn't line up. Dry-run diffs with many changed historical values are the tell.
- **Upstream dependency failing.** A series computed from others fails when an input fails. Fix the root series; the dependents recover on reload. `get_series` → `usedByLoadersOf` and the eval text show dependencies.
- **API errors.** Expired keys, rate limits, or the agency retiring a series id. A one-off 5xx or timeout is usually temporary; a "series does not exist" message isn't.
- **Release not out yet.** A source publishing late isn't an error to fix; snooze until the expected release.
- **Our code.** Parser errors on valid-looking statements, `NaN` or out-of-range values from a method receiving the wrong argument shape, and similar. Read the code, then raise a finding rather than working around it.

TODO(economists): add failure modes specific to sources you know (DBEDT, HTA, UIC, tax files).
