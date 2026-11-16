# Playbook: loaders past their lag limit ("has the source published?")

A `loader_lag` issue means the loader ran without error, but its newest data point is older than the loader's `max_lag_days`. Nothing is broken on our side until shown otherwise. The limit was set from the loader's own arrival history, so being past it means this release is later than usual, the source moved, or the series ended.

Issues are grouped by what the loaders read (the same file or download handle; for API loaders, the same series name prefix): they wait on the same release, so settle one and apply the answer to the group.

1. **What do we have?** `get_loader`: the newest data point's date, the load statement (which file, handle or API series), and `maxLagDays`.
2. **Has the source published a newer period?** Look at the source itself:
   - API loaders: the agency's release schedule or series page (`web_search` / `web_fetch`, or `probe_source_url`).
   - Download loaders: `probe_source_url` on the file's URL (`last-modified` helps) and the page that links to it.
   - A `dry_run_loader` of the unchanged load statement shows whether a reload would bring new points (`added` > 0, a later `lastDate`).
3. **Act.**
   - **Not published yet** (the usual case): `snooze_issue` until a few days after the expected release, with the reason and where you checked. Snooze every member of the group that waits on the same release.
   - **Published, and a dry run brings the new points:** the nightly load missed it or ran before the release. Propose a `reload`.
   - **Published, but our loader doesn't pick it up:** the file moved, was renamed, or changed layout. From here it is a load error in all but name: follow the load-errors playbook, and propose a `loader_update` after a passing dry run.
   - **The series ended, or the release schedule changed** (monthly became quarterly, the agency dropped the table): ask a person, saying what you found and where. Changing `max_lag_days`, disabling a loader or retiring a series is the economists' decision; don't propose those unasked.
   - **Uploaded by hand** (`load_from_file` on a manual file): nobody has uploaded the new file. Ask who maintains it rather than snoozing repeatedly.

Don't snooze the same issue more than twice without asking: a source that is three release cycles late has usually moved or ended.

TODO(economists): release calendars worth knowing (which sources publish on a fixed day, which are irregular), and series known to be discontinued.
