# Playbook: load errors ("this used to work, find out what changed")

A load error means an enabled loader's last reload failed (`data_sources.last_error`). (A "Lag limit exceeded" message is not a load error; those are `loader_lag` issues with their own playbook.) These almost always have a definite answer, because the loader worked before. Compare then with now.

1. **When did it last work?** `get_loader`: `lastRunAt`, `lastError`, the newest data points, and the change history. `get_app_logs` with category `loader`, name `loader.reload_error`, subject `data_sources`, subject_id = the loader id has the full error (written when an error is new or changes); `last_error` is cut to 254 characters. A missing file under the data directory (`ENOENT … /data/rawdata/…`) is a file someone uploads by hand: check the loader history and ask, don't guess a new path.
2. **What changed since then?** Check in this order and stop when you find it:
   - the load statement: the loader's history (loader actions). Was it edited just before it broke?
   - the source: `probe_source_url` for the file or API. Moved (404, redirect to a landing page), different format (HTML instead of xlsx), renamed headers?
   - our code: `git_log` on the eval parser, executor, download processor, or the API client named in the error, since the last good run. `git_show` the suspicious commit.
   - upstream series: for computed series, is an input itself erroring? (`get_series` on the inputs.)
3. **Confirm with a dry run.** `dry_run_loader` with the loader id and your fixed eval. Check that the point count, newest date and recent values look right, and that history didn't shift unexpectedly (a large `changed` count or `maxRelativeChange` on old dates means the fix changes history; explain why if so).
4. **Group.** If the issue represents a group, check two or three other members. When the same fix applies, propose once with all members as targets.
5. **Act.**
   - Fix found and dry run passes → `propose_change` kind `loader_update` (or `reload` if nothing needs changing and the failure looks temporary).
   - Cause found, fix needs a person (a new download handle, a credential, a source that changed its methodology) → `comment_on_issue` kind `question` saying exactly what's needed.
   - Our code → `raise_issue` subject_type `code`, then a diagnosis comment linking it.
   - Not enough to go on → diagnosis comment with what you checked.

TODO(economists): sources with known quirks (e.g. which agency files are replaced in place, which move every January).
