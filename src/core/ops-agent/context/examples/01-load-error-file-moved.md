# Example: source file renamed for the new year (placeholder case)

> Illustrative. Replace with a real case: real series, loader id, error text and the fix that was approved.

**Issue:** group of 14 load errors, `404 Not Found: url(dbedt.hawaii.gov)`, all loaders using download handle `%Y@dbedt.hawaii.gov` for the monthly visitor tables. First seen after the January release.

**Investigation:**
- `get_loader` on one member: last good run in late December; no load-statement edits since.
- `probe_source_url` on the URL in the download: 404. The agency's monthly page lists the file as `…/visitor/2026/mvs_jan_2026.xlsx`; the old pattern was `…/visitor/mvs_<mon>_<yyyy>.xlsx` with no year folder.
- `git_log` on the download processor since December: nothing relevant.
- `dry_run_loader` with the updated URL pattern on two members: same point counts plus one new month; history unchanged (0 changed).

**Action:** one `loader_update` proposal with 14 targets.
- Summary: "DBEDT moved monthly visitor files into a year folder; update URL pattern for 14 loaders."
- Evidence: the 404, the new location on the agency page, and the dry-run numbers for the two members checked.

**Why this was right:** the cause was outside our code, the fix was the smallest possible (URL only), and the dry run showed no history change.
