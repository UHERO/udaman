# Ops Agent: Design

Status: revised and built 2026-11-14. Not deployed; the steps are in
`docs/2026-11-14-ops-agent-deploy.md`. [Build status](#build-status-2026-11-14)
says what was verified and what is still unbuilt.

## Goal

Fewer students are available to resolve data-source changes and metadata
gaps, so an agent takes over the routine part of that work in the UHERO
universe.

The agent works through a to-do list of issues, one at a time: load errors
first, then metadata gaps. For each one it investigates and presents a
proposed fix. A reviewer approves it, rejects it, or fixes the issue
themselves, and the agent moves to the next. It is always available, but
until a change type is given more autonomy it only makes progress as fast as
someone reviews, and always within its budget.

Later, change types that have earned it are applied without review. The
agent then works down the list on its own, logs what it did, and stops only
to ask about ambiguous cases.

It works through two internal MCP servers that only allow approved kinds of
changes: one for the data (the catalog), one for the workflow around it
(issues and review). People use the same servers from their own Claude Code
session, and every issue can be fixed from Slack, from the app UI, from a
person's Claude session, or by the agent.

Scope for v1: **UHERO only.** Every table below carries `universe` so other
universes can be added later without schema changes.

## The to-do list

One ordered list. The agent takes the first item it is allowed to work on.

| order | kind | what it is | size in the 2026-11-11 snapshot |
|---|---|---|---|
| 1 | `load_error` | enabled loader whose last reload failed | 73 loaders in 9 groups |
| 1 | `reload_job_failed` | a person's reload job failed and wasn't re-run | few |
| 2 | `loader_lag` | loader past its `max_lag_days` limit | 44 loaders in 14 groups (35 of them wait on 5 files) |
| 3 | `missing_metadata` (required fields) | portal series with no source, unit or label | 397 issues on about 200 measurements |
| off | `missing_metadata` (deferred fields) | `description`, `source_detail_id`, `source_link` | 40,000+ |
| off | `quarantined`, `data_revision` | designed, not detected yet | |

Within a kind the order is severity, then group size (bigger first, because
one approval fixes more), then age. Metadata work starts only when no error
or lag item is workable. An item that is waiting on a person's answer does
not block the list; the agent moves on.

### What the snapshot showed

These numbers shaped the scope, and should be re-derived after each snapshot
refresh.

- **Load errors are a small, steady workload.** 117 of 19,715 enabled
  loaders had `last_error` set, in 10 groups. One group of 36 is a single
  `ENOENT` signature, so there are about 8 real causes.
- **Lag already arrives as a load error.** 44 of the 117 are "Lag limit
  exceeded", written to `last_error` by `loader-collection.ts`. The earlier
  draft said lag was off. It needs its own kind, because "this worked, what
  changed" is the wrong question: usually the source hasn't published yet.
- **Nearly every series is missing some metadata.** The seven-field check
  finds 44,937 gaps on 16,591 of 16,654 series. Three fields account for
  40,719 of them: `description` (13,948), `source_link` (14,472) and
  `source_detail_id` (12,299). These are optional in practice and don't
  create issues in v1.
- **`geography_id` has no gaps**, so there is no geography fill to automate.
- **Counted the way the portal reads them, the required gaps are small.**
  Among the 10,183 series in data lists, 822 have no source, 778 no unit and
  39 no label, after measurement fallback. Those sit in 195, 178 and 24
  measurements.

## Design principles

1. **An issue is resolved when its condition is gone, no matter who fixed
   it.** Code that doesn't use the model rechecks each problem directly. A
   "resolve" call from any path only asks for that recheck; it can't close an
   issue whose condition is still present. The agent never has to know that
   someone fixed something in their own Claude session.
2. **The issue is the record, and conversations hang off it.** Slack threads,
   UI comments, and MCP comments are all events on one issue. Each surface
   shows the same history.
3. **All writes go through one service layer.** UI server actions, MCP tools,
   Slack interactions and the agent call the same functions, so they get the
   same validation, the same `data_source_actions` logging, and the same
   issue events.
4. **Cleanup doesn't use the model.** Closing issues, posting "resolved"
   notes in Slack threads, and reopening recurrences are done by a scheduled
   job on the worker. They cost nothing, can't be skipped, and still work
   when the agent is down.
5. **The agent is one actor among several.** It has its own user account,
   its own allowlist of tools on the server, and nothing a dev couldn't do
   through the UI.
6. **Reviews set the pace.** While a change type needs approval, the agent
   prepares only a small buffer ahead of the reviewer and then waits.

## Kinds of work

Each kind has its own playbook in the agent's context files.

### Load errors: "this used to work, find out what changed"

There's almost always a definite answer, because the loader worked before.
The investigation compares then and now:

1. **When did it last work?** `last_run`, the last successful reload in
   `app_logs` (`worker` rows), and the newest data point.
2. **What changed since then?** In order:
   - the load statement (`data_source_actions` history)
   - the source: `probe_source_url` for moved or renamed files, a changed
     format, or new header text
   - our code: `git log` on the eval parser, download processor, and API
     clients since that date
   - upstream series: a dependency that is itself erroring or was renamed
3. **Confirm the cause with a dry run** of the fixed load statement before
   proposing it.

This mode is cheap and well-bounded. Grouping matters: one source moving its
file can break dozens of loaders with the same error.

### Loader lag: "has the source published?"

Nothing is broken on our side until shown otherwise. The agent checks the
source's release page or API for a newer period.

- Not published yet: snooze the issue until the expected release, with the
  reason. This is the usual outcome.
- Published, but our loader didn't pick it up: the file moved or changed.
  Treat it as a load error from here.
- The series was discontinued, or the release schedule changed: ask a
  person. Changing `max_lag_days` or disabling a loader is the economists'
  decision.

### Missing metadata: fill at the right level

Metadata can be set on a measurement or on a series. The portal views
(`portal_v`) read the series value and fall back to the measurement's for
unit, source, source detail, label and source link. Two consequences:

- **A gap exists only when both levels are empty.** The detector checks the
  effective value, not the series column alone.
- **The measurement is the unit of work.** When the series in a measurement
  are the same measure at different geographies and frequencies, one value
  on the measurement fills them all.

Required fields in v1: `source_id`, `unit_id`, `dataPortalName`, for series
in data lists. One issue per (measurement, field).

A series is in a data list only through a measurement
(`data_list_measurements` → `measurement_series`), which is also the only
way the UI adds them. The `data_lists_series` table is a leftover: no portal
view, REST API query or app page reads it, only the universe export and
purge code. The detector ignores it.

For each issue the agent decides the level:

| situation | fix |
|---|---|
| every series in the measurement that has a value agrees, and the empty ones are the same measure | set the value on the measurement |
| the series legitimately differ (seasonally adjusted and not in one measurement, mixed sources, a level and a rate) | set values on the individual series, and leave the measurement alone |
| the series disagree and it isn't clear why | ask a person |

The agent never overwrites an existing series value to make a measurement
uniform. In the snapshot, 128 measurements hold series with different
sources and 21 with different units, so the mixed case is real.

Where the answer usually comes from:

| field | evidence |
|---|---|
| `source_id` | the load statement (which API or file it pulls from), other series in the measurement, the source's website |
| `unit_id` | other series in the measurement, the source's own table or API metadata, the loader's scale |
| `dataPortalName` | the naming rules for data lists (unique per list; it's the label users see) |

The economists' rules for each field replace these placeholders, including
the other cases where series in one measurement should differ.

In this mode the agent may use web search and web fetch, because finding a
source's documentation requires it. Each proposal cites where the value came
from (a series ID or a URL).

**One-time bulk pass, without the agent.** Before the agent starts on
metadata, `scripts/ops-measurement-fill.ts` lists every measurement whose
valued series all agree and whose own value is empty, with the value it
would set. That list is reviewed as a CSV (delete the rows you disagree
with) and applied in one go.

On the snapshot it finds 35 measurements (22 sources, 13 units, no labels),
filling 156 series. That is under a tenth of the 397 gaps, so most metadata
work is research for the agent. The CSV does need reading: one row would
give `GDP@JP.A` the BEA as its source because the two US series in that
measurement have it.

**Deferred fields.** `description`, `source_detail_id` and `source_link`
are a setting (`metadata.required_fields`), not a code change, so they can
be switched on once the required work is done. `source_link` already falls
back to the source's own link on the portal.

## Architecture

```
                       ┌──────────────── Slack ────────────────┐
                       │  #automation: the active proposal,    │
                       │  questions, digest, approve/reject     │
                       └──────▲──────────────────────┬──────────┘
                     post/update│                     │events + interactivity
                              │                       ▼
┌───────────── Next server (internet, HTTPS) ──────────────────────────────┐
│  /api/mcp          public uhero-data MCP (unchanged)                     │
│  /api/mcp/catalog  catalog MCP: read, test, propose, (devs) edit  ◀──────┼── Claude Code (staff, VPN)
│  /api/mcp/ops      ops MCP: issues and the review queue           ◀──────┤
│  /api/ops-runner/* runner API: the agent harness only (not MCP)          │
│  /api/webhooks/slack  + message events, + interactivity                  │
│  /udaman/UHERO/investigations  + Issues / Proposals tabs                 │
│  /admin/agent      runs, spend, quality, controls                        │
│                                                                          │
│  src/core/ops/*  ← the single service layer (issues, proposals, changes) │
└───────┬──────────────────────────────────────────────▲───────────────────┘
        │ MySQL (uhero)            BullMQ (enqueue)     │ HTTPS (both MCPs + runner API, bearer)
        ▼                               ▼               │
┌──────────── Worker server ─────────────┐   ┌──── Workstation (VPN, static IP) ────┐
│  existing reload / ingest jobs          │   │  ops-agent service: polls for work,  │
│  ops.reconcile job (detectors)          │   │  runs when there is room and budget  │
│  ops.apply-proposal job                 │   │  Anthropic SDK loop, claude-opus-5-5 │
│  series-reload verifies issues          │   │  read-only git checkout @ deployed   │
└─────────────────────────────────────────┘   │  no DB / Redis / SSH credentials     │
                                              └──────────────────────────────────────┘
```

The workstation only makes outbound connections: to `api.anthropic.com` and
to the three internal endpoints above. Nothing has to reach the workstation, so it can stay
VPN-only. Slack inbound goes to the Next server, and the agent learns about
replies and reviews by asking the server for work.

### Why the agent runs on the workstation

- The worker and Next servers keep their database and Redis credentials. The
  agent box has an Anthropic key and one MCP bearer token, so if it's
  compromised the damage is limited to what those endpoints allow the agent.
- Reading code needs a checkout. A local read-only clone pinned to the
  deployed commit is simpler than exposing file reads over MCP.
- Alternative: Managed Agents could host the loop. The internal endpoints would then
  have to accept Anthropic's egress IPs, and code reading would need the
  repo mounted in the session. Worth reconsidering if the workstation
  becomes a maintenance burden.

## How the agent is paced

The agent is a long-running service on the workstation. Every few minutes it
asks the runner API for work, which the server answers without the model. The agent
starts a model conversation only when the server hands it an item.

The server hands out an item when all of these hold:

- the agent isn't paused
- there is budget left for today
- there is new human input on an issue, **or** the ready buffer has room

**The ready buffer** is the active proposal plus the ones prepared behind
it. Its size is a setting (default 3: one shown, two waiting), so the next
proposal appears as soon as the reviewer finishes the current one.

The result is the behaviour described under Goal:

- Nobody is reviewing: the buffer fills, and the agent idles at no cost.
- Someone reviews five in a sitting: each review promotes the next
  proposal immediately, and the agent refills the buffer within minutes.
- A change type is at autonomy level 1 or 2: its fixes don't wait in the
  buffer. The agent keeps going down the list until the daily budget or
  per-day item limit (default 20) stops it.

An item handed to a runner is marked `investigating` and holds its place in
the buffer for up to 90 minutes, so a manual run beside the service can't
take the same item or overfill the buffer.

### Proposal queue

- **A person's proposal skips the queue.** Staff can propose changes from
  Claude Code too. Those are shown for review at once and don't count
  against the agent's buffer: the throttle protects reviewers from the
  agent, not from colleagues.
- **One active agent proposal.** Only the head of the queue is posted to Slack and
  highlighted in the app. The rest are visible on the Proposals tab but
  don't notify anyone. Errors always sort ahead of metadata, so an urgent
  fix is never stuck behind a metadata fill.
- **Groups become one proposal.** When 12 loaders fail with the same
  `group_key` and the fix is the same, the agent makes one proposal listing
  all 12 targets, with a dry-run diff for each. Approving it applies all of
  them. The stale check runs per target, so a target someone edited is
  skipped and reported without blocking the rest.
- **Approve, reject, or fix it yourself: all three move the list on.** When
  a reviewer resolves the issue another way, the reconciler sees the
  condition clear and withdraws the proposal.
- **Promotion revalidates.** Before a waiting proposal becomes active, the
  server checks that its issue is still open, its targets are unchanged, and
  (for load statements) the dry run still passes.
- **Nightly revalidation.** After the nightly batch, the reconciler runs the
  same check on everything in the buffer and withdraws what no longer
  applies. A proposal that still applies stays where it is, with the same
  Slack message. Nothing is re-investigated just because a day passed.

### What the agent picks up

1. Issues with new human input since the agent's last event: a reply in
   Slack, a comment in the UI or MCP, a rejected or stale proposal.
2. The next workable item on the to-do list, one issue per `group_key`.
   Fixing the representative usually fixes the group.
3. Never: `awaiting_human` without new input, snoozed, dismissed, or assigned
   to a person. A person who claims an issue keeps it until they let it go.

**Settling period.** An issue must exist for 20 hours before the agent picks
it up, so temporary failures clear themselves first. High severity, or a
group of 10 or more load errors, skips the wait.

**Second looks.** An issue the agent investigated and left with only a
diagnosis goes back on the list, but isn't picked again for 7 days unless
something changes: a person comments, a proposal is rejected or withdrawn,
or the issue recurs.

When the agent is waiting on a person and nobody answers, it does nothing.
If the condition clears, the reconciler closes the issue. The digest lists
issues that have waited more than 7 days. The agent doesn't re-ping people.

### Progress log

Everything the agent does is an event on an issue, and every run is a row in
`ops_agent_runs` with its steps. `/admin/agent` shows them as a log: what
was investigated, proposed, applied, asked, and skipped, with cost. This is
the record a person reads when the agent works unattended.

## Data model

New tables in the uhero DB. All DATETIMEs hold Hawaii wall-clock time (the
`formatHst`/`toHstSql` helpers). JSON payloads go in `LONGTEXT` columns,
because the Prisma schema has no Json type.

### `ops_issues`

One row per (kind, subject). The fingerprint is unique among issues that are
not closed.

| column | notes |
|---|---|
| `id`, `universe` | |
| `kind` | `load_error`, `reload_job_failed`, `loader_lag`, `missing_metadata`, `quarantined`, `data_revision`, `agent_finding` (raised by the agent or a person, e.g. "code bug in X") |
| `fingerprint` | e.g. `load_error:loader:12345`, `missing_metadata:measurement:678:source_id` |
| `subject_type`, `subject_id`, `subject_field` | loader / series / measurement / reload_job, plus the field for metadata issues |
| `group_key` | normalized error signature (numbers and paths stripped from `last_error`). Lets 40 loaders with "404 from bls.gov" show up as one incident while each still resolves on its own. |
| `status` | see the state machine below |
| `severity` | `low` / `normal` / `high`. High = a data list or portal series is affected, or the error group spans many loaders. |
| `title`, `summary` | the summary is the latest diagnosis |
| `first_seen_at`, `last_seen_at`, `last_checked_at`, `occurrence_count` | |
| `owner` | `agent` / `human` / `none`: who is expected to act next |
| `assignee_user_id` | optional, for a person who claims it |
| `snoozed_until`, `dismissed_reason` | |
| `resolved_at`, `resolution_path`, `resolved_by_user_id`, `resolution_note` | |
| `reopen_count`, `last_human_event_at`, `last_agent_event_at` | |
| `slack_channel`, `slack_ts` | the issue's Slack thread, when there is one |

### `ops_issue_events`

An append-only timeline, shown the same way in the UI, the MCP, and the
agent's context.

| column | notes |
|---|---|
| `issue_id`, `created_at` | |
| `actor_type` | `agent` / `user` / `system` |
| `actor_user_id` | the agent has its own `users` row, so this is set except for system events |
| `via` | `ui` / `slack` / `mcp` / `agent` / `reconciler` |
| `type` | `detected`, `recurred`, `diagnosis`, `comment`, `question`, `proposal_created`, `proposal_reviewed`, `proposal_withdrawn`, `action_applied`, `resolution_claimed`, `claim_rejected`, `verified_resolved`, `condition_cleared`, `reopened`, `snoozed`, `dismissed`, `assigned` |
| `body` | markdown |
| `payload` | LONGTEXT JSON: before/after, proposal id, job id, Slack ts |

### `ops_proposals`

Changes that need approval, and the record of changes applied without it.

| column | notes |
|---|---|
| `issue_id`, `kind` | `loader_update`, `loader_create`, `loader_disable`, `reload`, `series_metadata`, `measurement_metadata`, `unquarantine` |
| `targets` | a list, because one proposal can cover a whole group; each has its type, id, `before` and `after` |
| `evidence` | the agent's reasoning plus the `dry_run_loader` diff; for metadata, the `basis` (`measurement_siblings` / `research`) and its citations |
| `status` | `queued` → `pending` → `approved` → `applied` / `failed`; or `rejected`, `superseded`, `stale`, `withdrawn` |
| `lane`, `priority` | `lane` is the work class (`errors` / `metadata`) and only orders the queue: errors first, then priority (severity, group size), then age |
| `created_by_user_id`, `reviewed_by_user_id`, `reviewed_via`, `review_note`, timestamps | |

**Stale check:** when a proposal is applied, each target's current state must
still equal its `before`. If someone edited it in the meantime, that target
is marked stale and skipped. The event goes back on the issue, and the agent
sees it as new input.

### `ops_agent_runs`, `ops_agent_run_steps`

A run: `trigger` (`work_available`, `human_input`, `manual`), start and
finish times, `model`, input/output/cache tokens, estimated cost, status,
stop reason, and the commit SHA the checkout was on. Steps: each tool call
and model turn (inputs, outputs cut to a few KB, duration, tokens), sent to
the app as the run goes.

### Other tables

- `ops_settings`: autonomy levels, required metadata fields, buffer size,
  items per day, extra reviewers, monthly cap, pause switch, and the
  runner's last poll time.
- `ops_service_tokens`: the agent's hashed, revocable bearer tokens.
- `data_source_actions`: a nullable `ops_issue_id` ties each loader edit to
  the issue that caused it.

## Issue lifecycle

```
            detected
               │
               ▼
   ┌──────── open ◀───────────────────────── reopened (recurred within 30d)
   │           │  owner=agent                        ▲
   │           ▼                                     │
   │   investigating ──▶ awaiting_human ──┐          │
   │           │   (question / proposal)  │          │
   │           ▼                          ▼          │
   │       resolving  ◀── resolve_issue() from any path
   │  (claim made; verify pending, e.g. reload queued)
   │           │
   │   verify ok│      verify fails → back to open + claim_rejected event
   │           ▼
   └──▶    resolved ──(14d quiet)──▶ closed
               ▲
   condition cleared on its own (detector) ─┘    dismissed / snoozed: suppress
```

### Resolution paths

| path | how it happens | `resolution_path` |
|---|---|---|
| The agent fixes it | the agent applies an allowed change, or a reviewer approves its proposal; verify passes | `agent` / `agent_proposal` |
| Person, in the UI | edits the loader, series or measurement in the app, or clicks "Resolve" on the issue | `user_ui` |
| Person, in their own Claude Code | proposes or (devs) edits on the catalog MCP, or calls `resolve_issue` on the ops MCP | `user_mcp` |
| Person, outside every tracked surface | e.g. a console script, or the source came back online | `condition_cleared` |
| Not a problem | someone dismisses it ("series intentionally has no source") | `dismissed` (suppressed until the condition changes) |

Every path ends with the same verification. No path depends on a person
reporting back.

### Detection and verification by kind

| kind | detector condition | how a claimed resolution is checked |
|---|---|---|
| `load_error` | enabled loader with `last_error` set, excluding the lag-limit message | Editing an eval doesn't clear `last_error`. Resolving queues a reload of that loader, and the reload job reports the result. |
| `loader_lag` | enabled loader whose `last_error` is the lag-limit message | after the next scheduled load |
| `reload_job_failed` | a `reload_jobs` row that failed in the last 7 days, with no later successful job covering the same series | a later successful job |
| `missing_metadata` | a measurement in a data list with at least one series whose effective value (series, else measurement) is empty for a required field. One issue per (measurement, field). | recheck immediately |
| `quarantined` (off) | `series.quarantined` set | recheck immediately. Only a person can unquarantine. |
| `data_revision` (off) | see below | a person confirms the revision is real, or the loader is fixed and reloaded |
| `agent_finding` | none, it's a manual issue | resolving closes it directly; whoever resolves it must leave a note |

### Silently wrong data (`data_revision`, later)

Everything above catches loud failures. For forecasters the costly case is a
loader that succeeds with wrong values, typically after a spreadsheet's
layout shifts. A detector that doesn't use the model can catch most of it
from data-point vintages after each nightly load:

- a reload changed more than a set share of a series' historical points, or
- changed old values by more than a set relative amount, or
- removed points that existed before.

Real benchmark revisions will trip it too, so its issues go to a person as
"confirm or investigate", and the thresholds need tuning against a few
months of history before it's switched on. It reuses the diff logic in
`dry-run.ts`.

### Reconciler (`ops.reconcile`, worker job)

Runs after the nightly batch completes and hourly during working hours. It
doesn't use the model.

1. Runs each detector and upserts issues by fingerprint, bumping
   `last_seen_at` and `occurrence_count`.
2. When an open issue's condition no longer holds, it marks the issue
   `resolved` (`verified_resolved` if there was a claim, otherwise
   `condition_cleared`) and withdraws any proposal for it.
3. It posts a short closing reply in the issue's Slack thread ("Resolved via
   UI by Jane at 9:14 — loader eval updated") and updates the parent message
   with `chat.update`, so stale threads don't sit open.
4. It reopens a resolved issue if the same fingerprint comes back within 30
   days, reusing the old Slack thread.
5. It ends expired snoozes, and lifts a dismissal when the condition changes
   (e.g. a different error message on the same loader).
6. After the nightly batch, it revalidates the proposal buffer.
7. It alerts #automation when the agent hasn't asked for work in 26 hours.

## Servers

Two MCP servers and one internal API, built from shared modules in one
codebase (`src/lib/internal-mcp/`, `src/core/ops/`).

| endpoint | what it is for | who connects |
|---|---|---|
| **Catalog MCP** `/api/mcp/catalog` | working on the data: read, test, propose a change, and for devs edit directly | anyone working on data: the agent, and staff in Claude Code |
| **Ops MCP** `/api/mcp/ops` | the workflow around the data: what's broken, what's been tried, what's waiting for review | the agent always; staff who work issues or review proposals |
| **Runner API** `/api/ops-runner/*` | the agent harness's bookkeeping: start a run, get work, budget, log, finish | the harness only, with the service token. Plain HTTP, not MCP. |

Why two servers: someone who just wants to fix the unit on a few series
connects to the catalog and gets a reviewable change, without the issue
machinery in their tool list. And why the runner API isn't MCP: the model
never sees those calls, so it can't claim work or close a run on its own.

The public `uhero-data` MCP at `/api/mcp` is separate and unchanged.

### Access

- **Network:** nginx allows `/api/mcp/catalog` and `/api/mcp/ops` only from
  the VPN ranges and the workstation's static IP, and `/api/ops-runner/`
  only from the workstation. Claude Code from a staff laptop on VPN works.
  claude.ai cloud connectors don't, which is intended.
- **Auth:** the existing OAuth flow (`/api/oauth/*`, PKCE), with a
  protected-resource metadata entry per MCP server. The role is read live
  from `users` on every call. The runner API accepts only the agent's
  service token.
- **Agent service account:** a `users` row with role `internal`, so edits
  are attributed to it. A caller is the agent because it authenticated with
  an `ops_service_tokens` token, not because of its role.
- **Role gating:** each tool module is a `registerXTools(server, ctx)`
  function that registers only what the caller may use. A tool that isn't
  registered can't be called, no matter what the model asks for.

Tools per caller (catalog + ops):

| caller | catalog | ops |
|---|---|---|
| agent, comment-only | 10: read and test | 7: issues, `list_proposals` |
| agent, proposing | 11: + `propose_change` | 7 |
| `internal` staff | 11: read, test, `propose_change` | 8: + `assign_issue` |
| extra reviewers | 11 | 9: + `review_proposal` |
| `dev`, `admin` | 15: + the four direct edit tools | 11: + `dismiss_issue`, `reopen_issue`, `review_proposal` |

### Reviewers

Proposals are reviewed by devs and admins, from Slack, the app, or the ops
MCP. Loader configuration is the economists' domain, so named economists can
be added as reviewers without making them devs: the "Extra reviewers"
setting on `/admin/agent` takes their user ids. It starts empty, so until
someone is added the agent's throughput is one developer's review time.

### Catalog MCP tools

**Read**
- `get_series(id | name)`, `find_series(...)`: series metadata, the
  measurements it belongs to with their own metadata, loaders, siblings,
  dependents
- `get_measurement(id)`: the measurement's metadata and every series in it
  with that series' own
- `get_loader(id)`: load statement, settings, last run and error, newest
  points, change history
- `list_lookup(table)`: valid sources, source details, units, geographies
- `get_reload_jobs()`, `get_app_logs(...)`: reads `app_logs`, which is in
  the shared DB, so the worker's entries are visible from the Next server
  (`loader.reload_error` per loader, `category='worker'` job results,
  `loader.batch_reload` summaries)

**Test**
- `check_eval(eval, series_id)`: wraps `LoaderCollection.checkEval`
- `dry_run_loader(loader_id, eval?)`: runs the eval through `EvalExecutor`
  in memory and returns a diff against the stored data points (added,
  changed and removed dates; changes in magnitude), with no writes
- `probe_source_url(url)`: status, headers, the first few KB, and the
  content type, for allowlisted domains only (bls.gov, bea.gov,
  stlouisfed.org, hawaii.gov, …)

**Change**
- `propose_change(kind, targets, summary, evidence, issue_id?, basis?)`:
  for everyone who may propose (staff always; the agent once proposals are
  on). `issue_id` is optional, so a change doesn't need an issue. At
  autonomy level ≥ 1 an agent proposal is approved by the system and
  applied at once, so every agent change still has a proposal row.
- Direct edits, devs only: `update_loader`, `request_reload`,
  `update_series_metadata`, `update_measurement_metadata`. Each takes
  `target_id`, `changes` and an optional `issue_id`.

Both are generated from the change registry, below.

**Limits for callers who aren't devs**
- A load statement they supply, in a dry run or a proposal, may only name
  files by a relative path inside the data directory. Download handles and
  API loaders can only reach what the catalog already defines.
- The agent additionally never sees data values of restricted series
  (`get_loader` points and dry-run samples); dates and counts stay.

### Ops MCP tools

**Issues**
- `list_issues(status?, kind?, group_key?, search?)`
- `get_issue(id)`: the issue, its timeline, linked proposals and its group
- `comment_on_issue(id, body, kind: comment|diagnosis|question)`: a
  `question` sets `owner = human` and posts in the Slack thread
- `resolve_issue(id, note)`: starts verification. Returns whether it
  resolved immediately, is pending (reload queued), or was rejected because
  the condition is still present.
- `snooze_issue(id, days, reason)`: people can snooze up to 90 days; the
  agent at most 14, and without review, since a snooze changes no data and
  shows in the digest
- `raise_issue(subject, title, body)`: for findings the detectors can't
  see, including bugs in our code
- `assign_issue(id, take)`: people only
- `dismiss_issue(id, reason)`, `reopen_issue(id)`: devs only

**Review**
- `list_proposals(status?)`
- `review_proposal(id, approve|reject, note)`: reviewers only

### Runner API

`POST /api/ops-runner/<action>` with the service token: `start`, `work`,
`budget`, `log`, `finish`. `work` is also the runner's liveness signal, and
marks the items it hands out as being worked on. The server picks the work
and records runs and steps without the model.

### The change registry

What makes the catalog extensible is a core module, not a server:
`src/core/ops/change-registry.ts`. Each kind of change registers once:

```ts
registerChangeKind({
  kind: "series_metadata",
  targetType: "series",
  summary,          // one line for tool descriptions
  workClass,        // orders the review queue: errors before metadata
  changeType,       // which autonomy setting governs it
  afterSchema,      // zod schema for `after`
  snapshot,         // current state, stored as `before`
  validate,         // lookups exist, the eval resolves, …
  dryRun,           // for load statements
  apply,            // the one function that makes the change
  directTool,       // optional: a dev-only tool that applies it at once
});
```

- `propose_change` builds its kind list and description from the registry.
- Approving a proposal calls the kind's `apply`.
- A dev's direct edit tool calls the same `apply`, after the same schema
  and validation.

So a proposal and a direct edit can't drift apart, and the stale check is
the same everywhere: take the kind's `snapshot` again and compare it with
`before`.

Registered kinds: `loader_update`, `loader_create`, `loader_disable`,
`reload`, `series_metadata`, `measurement_metadata`, `unquarantine`.

### Adding a capability later

A new domain, such as geographies, data lists or forecasts, is one module
that does three things:

1. Registers its read tools on the catalog server
   (`src/lib/internal-mcp/catalog/<domain>.ts`, added to `catalog/index.ts`).
2. Registers its change kinds (`src/core/ops/change-kinds/<domain>.ts`).
   Proposals, review, the stale check and, if declared, a direct edit tool
   pick them up automatically.
3. Optionally adds a detector, so problems in that domain surface as issues.

A domain moves to its own MCP endpoint only when its audience differs: some
users need it and nothing else, or the catalog's tool list grows large
enough to hurt tool selection. Since each module is a register function,
that move is a change to the routing, not a rewrite.

### Autonomy levels

Each type of change has its own level, stored in `ops_settings` and editable
by devs. The server checks it on every agent write. **Everything starts at
level 0.**

| level | meaning |
|---|---|
| 0 | the agent only proposes; a reviewer approves each change |
| 1 | the agent applies it, posts in Slack, and it's revertible from the issue. Only if the dry run passes and the target was unchanged since the agent read it. |
| 2 | like 1, but no Slack post; it appears in the progress log and the digest |

A person decides each promotion, on `/admin/agent`. Next to each change
type the page shows its record: consecutive agent proposals of that type
approved and applied cleanly (a rejection or a failed apply resets the
count), and the totals. The thresholds below are starting points to adjust:

| change type | to reach level 1 | ceiling |
|---|---|---|
| `request_reload` (retry after a temporary failure) | 10 in a row | 2 |
| `fill_measurement_from_series` (valued series all agree) | 20 in a row | 2 |
| `fill_metadata_from_research` | 30 approved, under 5% rejected | 1 |
| `loader_update` | 20 in a row, none reopened within 30 days; consider only once the proposals are mostly URL and file-name changes, since it's the economists' area | 1 |
| `loader_create` / `loader_disable` / `unquarantine` | stays 0 | 0 |

Lowering a level is also by hand: do it the first time an applied change
has to be reverted. Metadata changes apply without review only when every
target field was empty; overwriting is always reviewed.

### Service layer (`src/core/ops/`)

`issue-store`, `issues` (resolve, verify, comment, snooze, dismiss, assign),
`detectors`, `reconciler`, `proposals` (queue, review, apply, revalidation),
`proposal-store`, `changes` (the write path, with `data_source_actions`
logging and issue events), `dry-run`, `runs` (runs, budget, work selection,
digest), `settings`, `service-tokens`, `slack-sync`, `slack-inbound`,
`rules`, `actors`, `links`.

UI edits to a loader or series call `noteUiChange`, so an edit made in the
app to something with an open issue writes an `action_applied` event on that
issue, and the reconciler does the rest.

## Slack

Channel: **#automation**, set as an environment variable on the Next server.

- **The active proposal** is one top-level message with Approve / Reject
  buttons. Replies go in its thread. When it's reviewed or withdrawn, the
  message is updated in place and the next proposal is posted.
- **Questions** from the agent get their own top-level message.
- **Digest:** posted by the 5:00 reconcile, and only if something happened
  since the last one or someone is being waited on: counts by kind, what
  was resolved and by which path, what the agent investigated and proposed,
  what's waiting on someone, and spend. Everything else is a link to the
  app.
- **Inbound** (`/api/webhooks/slack`):
  - `message.channels` in the ops channel. A thread reply is matched to its
    issue by `thread_ts`, stored as a `comment` event, and counts as new
    human input, which the agent picks up on its next poll.
  - The Slack user is mapped to a UDAMAN user by email.
  - Approve / Reject: the mapped user must be a reviewer; otherwise they get
    an ephemeral "only reviewers can approve" message.

Everything in Slack is mirrored into `ops_issue_events`, and comments made in
the UI or MCP on an issue with a thread are posted to the thread, so both
surfaces are complete.

## App UI

- **`/investigations/issues`:** filterable list. The detail view shows the
  timeline, proposals, the subject's loader actions, and Resolve / Assign /
  Snooze / Dismiss / Comment.
- **`/investigations/proposals`:** the active proposal and the buffer, each
  with its before/after and dry-run diff. Reviewers approve or reject.
- **`/admin/agent`** (dev only):
  - Health: time since the agent last asked for work, failed runs, runs
    stopped by a limit.
  - Spend: month-to-date against the cap, forecast, cost per resolved issue.
  - Quality, per change type: approved unchanged, edited, rejected; how
    often an applied fix doesn't hold. This is the evidence for promotion.
  - Outcomes: how issues got resolved and how long each path takes.
  - Progress log and run detail.
  - Controls: pause, comment-only or proposing, autonomy levels, buffer
    size, items per day, required metadata fields, extra reviewers, monthly
    cap, service tokens.
- The Missing Metadata page counts series columns only, so its numbers are
  much larger than the issue list's. An "effective value" view that matches
  the detector is not built yet.

## Agent runner (workstation)

- **Harness:** the Anthropic TypeScript SDK in a manual tool loop, plus the
  MCP client from `@modelcontextprotocol/sdk`. It connects to both MCP
  servers and gives the model their tools as one set; `propose_change` is
  the only way to change anything. Its own bookkeeping goes through the
  runner API.
- **Code reading:** local read-only tools (`read_file`, `grep`,
  `list_files`, `git_log`, `git_show`) confined to a checkout of the
  deployed commit. No shell, no writes.
- **Web tools:** `web_search` and `web_fetch` are attached **only to
  missing-metadata and lag items**, with a small per-item limit. Load-error
  conversations get `probe_source_url` alone. See the security section.
- **Model:** `claude-opus-5-5`, effort `medium` by default. The system
  prompt and tool list are fixed per kind of work, so the prompt cache is
  reused across items.
- **One conversation per item.** Each group of issues gets a fresh
  conversation, so context stays small.
- **Context files:** the system prompt, playbooks and worked examples live
  in `src/core/ops-agent/context/` as markdown, so economists can edit them
  without touching code.
- **Service:** a systemd service that asks the runner API for work every 5 minutes
  (and again 15 seconds after finishing work). Before a run it puts the
  checkout on `OPS_GIT_SYNC_REF`. It backs off, up to an hour, while the
  server or the API keeps failing.
- **Limits:** per item, a turn limit and a dollar limit. Per day, the budget
  allowance and a maximum number of items. The run stops cleanly and records
  why.

## Budget: $50/month

- **Accounting:** the runner adds up `usage` from every response (input,
  cache write, cache read, output tokens, and web search calls), prices it,
  and saves it to `ops_agent_runs`.
- **Daily allowance:** (remaining monthly budget) ÷ (days left in the
  month). Unspent budget carries over within the month.
- **Order, not a split:** errors come first, and metadata research uses
  what's left.
- **Backstop:** a dedicated Anthropic Console workspace and API key for the
  agent, with a $50 monthly spend limit, so a runaway loop can't go over and
  development usage is billed separately.
- **What it buys (rough):** a load-error investigation is roughly
  $0.10–$0.40, and a research-heavy metadata item can be $0.50 or more.
  That's 5–10 items a day, which is more than one reviewer will get through.
  Review pacing means most days spend less.

## Prompt injection and the limits on damage

The agent reads text other people control: `last_error` strings, contents of
downloaded files, and web pages.

1. Server-side tool allowlist per caller (no deletes, no SQL, no channel
   choice).
2. Writes to anything already populated go through review, with a stale
   check.
3. Agent writes are attributed to the agent account and reversible: issue
   events store before and after, and the Issues UI has a revert action.
4. `probe_source_url` is limited to an allowlist of domains.
5. Web search and fetch are attached only to metadata and lag items. Review
   protects writes, not reads: a conversation that can both read internal
   data and fetch arbitrary URLs could be talked into leaking what it read.
6. The system prompt says to treat that text as untrusted.

Checked 2026-11-14, and closed in code:

- The read tools did return data values for restricted series. They are now
  hidden from the agent.
- A load statement could name any file path (`load_from_file`, `.load_from`),
  so a dry run of an agent-supplied statement could read outside the data
  directory. Agent-supplied statements are now limited to relative paths
  inside it. A dry run still downloads from whatever handles the statement
  names, but handles are catalog rows the agent can't create.

## Rollout

Each step stops for review before the next. The code for most of it exists;
the steps are about switching it on in an order that can be checked.

| step | switches on | gate to pass |
|---|---|---|
| **A. Issues backbone** | migration, detectors, reconciler, Issues tab, Slack closing notes. No model. | issue counts match the investigations pages for a week; issues close themselves when people fix things |
| **B. MCP for people** | `/api/mcp/catalog` and `/api/mcp/ops` behind the nginx allowlist | you do a week of your usual Claude-assisted fixes through it; missing tools are added |
| **C. Evaluation** | replay cases built from past fixes (`scripts/ops-eval.ts`), run against the local snapshot | the agent's proposed fix matches what the person did often enough to be worth reviewing (target to set once the first results are in) |
| **D. Comment-only agent** | the runner on the workstation; diagnoses and questions, no proposals. This is the default: the agent has no `propose_change` tool until "Proposals on" is set on `/admin/agent` | two weeks of diagnoses read as correct; spend as forecast |
| **E. Proposals for load errors and lag** | "Proposals on": the queue, Slack buttons, `ops.apply-proposal`; everything at level 0 | approval rate and fix-holds rate on `/admin/agent` |
| **F. Metadata** | the one-time bulk pass, then metadata items in the list | economists' field rules written |
| **G. Raise autonomy** | individual change types to level 1 | the thresholds in the autonomy table |
| **H. Later** | `data_revision`, deferred metadata fields, other universes | |

Steps A and B are useful without the agent: issue tracking that closes
itself, and an internal MCP for staff.

**Evaluation cases.** `scripts/ops-eval.ts build` pairs consecutive edits to
a loader's load statement from `data_source_actions`. The error at the time
wasn't recorded, so a pair is usable only if the old statement still fails
in a dry run today and the person's statement passes. That is a small
share: of the 25 most recent edits, 2 qualified. Expect a few dozen cases
from the past year, not hundreds. `prepare` breaks one loader again in the
local database, the agent runs on that issue, and `finish` scores its
proposal against the person's fix (same statement, same data, or
different) and restores the loader. Local database only. Step B adds a
second source: the fixes done by hand through the MCP.

## Open questions

1. **Field rules.** For source, unit and label: where the value should come
   from, when series in one measurement should differ (beyond seasonally
   adjusted versus not), and the naming rules for `dataPortalName`. The
   agent's quality on metadata depends on these.
2. **Reviewers.** Which economists, if any, should be able to approve, and
   for which change types?
3. **Lag and the existing lag digest.** Once lag items are worked by the
   agent, should the separate loader-lag digest be merged into this one?

## Build status (2026-11-14)

### What changed on 2026-11-14

The first build (2026-11-13) followed the earlier draft. This revision:

| area | change |
|---|---|
| Detectors | lag-limit messages are `loader_lag`, grouped by the file or handle they read; `missing_metadata` checks effective values on data-list measurements, per (measurement, field), for the fields in `metadata.required_fields` |
| Changes | measurement metadata: `applyMeasurementMetadata`, the `measurement_metadata` proposal kind, `update_measurement_metadata` and `get_measurement` tools; a series or measurement edit in the app rechecks the measurement's issues |
| Queue | one ordered list; withdrawal when an issue resolves another way; nightly revalidation in place of daily expire-and-re-issue |
| Work selection | review-paced buffer, per-day item limit, claims, 7-day second looks |
| Runner | polling service; web tools only on metadata and lag items |
| Reviewers | `reviewers.user_ids` setting, used by the app, Slack and the MCP |
| Safety | restricted values hidden from the agent; file paths in agent-supplied load statements confined to the data directory |
| Logging | `loader.reload_error` is written whenever a loader's error is new or changed (it used to need a separate detail, and the local snapshot has none at all), so the load-error playbook has something to read |
| Digest | daily, from the reconciler, not per run |
| Context | lag playbook, measurement-level metadata playbooks and examples |
| Scripts | `scripts/ops-measurement-fill.ts`, `scripts/ops-eval.ts` |

### What changed on 2026-11-16

The single ops MCP was split, following a review of its tool list:

| area | change |
|---|---|
| Servers | catalog MCP (data) and ops MCP (issues, review) in place of one; the `run_*` tools became the runner API, which is plain HTTP |
| Change registry | every change kind registers once; `propose_change`, review and the dev edit tools are all built from it |
| Proposals by people | any internal staff member can propose from Claude Code; a person's proposal is shown at once and doesn't use the agent's buffer |
| Direct edit tools | generated per kind; they now take `target_id` and `changes`, and `update_loader` always reloads |
| File-path guard | applies to everyone but devs, not only the agent |
| Runner | connects to both servers; idle polls are one HTTP request; env is `OPS_SERVER_URL` and `OPS_AGENT_TOKEN` |

### Not built

- `data_revision` and `quarantined` detectors.
- The "effective value" view on the Missing Metadata page.
- A revert button for applied agent changes. Issue events store before and
  after, so a revert is a manual edit for now.
- Automatic demotion of an autonomy level; it's a manual setting.
- Separate autonomy for URL-only `loader_update` changes.

### Files

| Area | Files |
|---|---|
| Schema | `src/lib/prisma/migrations/20261113000000_ops_agent/`, `schema.prisma` (`ops_*` models, `data_source_actions.ops_issue_id`) |
| Service layer | `src/core/ops/` |
| Worker | `processors/ops.ts`; `JobName.OPS_RECONCILE` / `OPS_APPLY_PROPOSAL`; schedules in `scheduler.ts`; the nightly batch enqueues a reconcile; `series-reload` verifies issues (`opsIssueId`) |
| Change registry | `src/core/ops/change-registry.ts`, `src/core/ops/change-kinds/` (`loaders`, `metadata`) |
| MCP servers | `src/lib/internal-mcp/shared.ts` (auth, context, handler), `catalog/` (`series`, `measurements`, `loaders`, `sources`, `changes`), `ops/` (`issues`, `review`); routes `src/app/api/mcp/catalog`, `src/app/api/mcp/ops`; `.well-known/oauth-protected-resource/api/mcp/{catalog,ops}` |
| Runner API | `src/app/api/ops-runner/[action]/route.ts` |
| Slack | `mailers/slack.ts` (`postSlackMessage`, `updateSlackMessage`, `getSlackUserEmail`); `api/webhooks/slack` routes `message` events and button clicks |
| UI | `/udaman/[universe]/investigations/issues` (+ `[id]`), `/investigations/proposals`, `/admin/agent` (+ `runs/[id]`); `src/actions/ops.ts`; `src/components/ops/*`, `components/admin/agent-controls.tsx` |
| App edits → issues | `src/actions/data-loaders.tsx`, `series-actions.ts` and `measurements.ts` call `noteUiChange` |
| Runner | `src/core/ops-agent/` (`runner.ts`, `mcp-client.ts`, `local-tools.ts`, `prompt.ts`, `pricing.ts`, `context/`, `README.md`) |
| CLI | `bun run ops reconcile [--daily] \| status \| token <name>`; `bun run ops-agent [--once] [--issue N]` |
| Scripts | `scripts/ops-measurement-fill.ts` (bulk fill), `scripts/ops-eval.ts` (replay evaluation) |
| Tests | `src/core/ops/rules.test.ts`, `src/core/ops/change-registry.test.ts`, `src/core/ops-agent/agent.test.ts` |

### Verified locally

Against the local prod snapshot, with Slack disabled:

- reconcile: 73 load errors, 44 lag issues and 397 metadata issues; a
  second pass creates none
- work selection: errors first, three items for an empty buffer, nothing
  more while those are in progress or the buffer is full
- the queue: first proposal shown, second waits, a duplicate is recognised;
  a non-reviewer is refused and a listed reviewer isn't; a rejection shows
  the next proposal and returns the issue to the agent as feedback
- applying a measurement proposal resolves its issue as `agent_proposal`
- fixing an issue by hand withdraws its proposal and shows the next one
- an agent-supplied load statement that leaves the data directory is refused
- the bulk-fill report and its dry run; the evaluation script's `build`,
  `prepare` and `finish` (the loader was restored exactly)
- both MCP servers over an in-memory transport, for each kind of caller:
  the tool sets in the table under Servers; schema and lookup refusals; a
  staff proposal shown at once; a dev's direct edit resolving the issue and
  withdrawing that proposal
- typecheck, lint, and the three test files

**Not exercised:** a real model run, live Slack (threads, buttons, replies),
the HTTP routes under Next (both MCP endpoints with OAuth and the service
token, and the runner API), the worker jobs under BullMQ, and the runner's
polling loop against a server.
