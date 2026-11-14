# Ops Agent: Design

Status: draft, 2026-11-13. Nothing here is built yet.

## Goal

An agent that finds and resolves data-loading problems in the UHERO universe,
and reports what it did. Problems include the load errors and reload failures
on `/investigations`, missing metadata, quarantined series, and loaders past
their lag limits. It works through a new internal MCP server that only allows
approved kinds of changes. People can use that same MCP from their own Claude
Code session, and every issue can be fixed from Slack, from the app UI, from a
person's Claude session, or by the agent.

Scope for v1: **UHERO only.** Each universe has its own context and loading
process, and UHERO has the most variety. Every table below carries `universe`
so other universes can be added later without schema changes.

**v1 work comes from two pages:**

- `/uhero/investigations` (Dashboard): load errors (`getLoadErrorSummary`)
  and failed reload jobs.
- `/uhero/investigations/no-source` (Missing Metadata): series with a null
  `source_id`, `unit_id`, `source_detail_id`, `geography_id`,
  `dataPortalName`, `description` or `source_link`
  (`SeriesCollection.NULL_FIELD_COLUMNS`). The page's goal is 0 across all
  fields, so the detector covers the whole universe, not a subset.

Quarantine and loader lag are designed into the model below but stay off
until later.

## Design principles

1. **An issue is resolved when its condition is gone, no matter who fixed it.**
   Code that doesn't use the model rechecks each problem directly. A
   "resolve" call from any path only asks for that recheck; it can't close an
   issue whose condition is still present. This is what makes the other
   resolution paths work: the agent never has to know that someone fixed
   something in their own Claude session.
2. **The issue is the record, and conversations hang off it.** Slack threads,
   UI comments, and MCP comments are all events on one issue. Each surface
   shows the same history.
3. **All writes go through one service layer.** UI server actions, MCP tools,
   Slack interactions and the agent all call the same functions, so they get
   the same validation, the same `data_source_actions` logging, and the same
   issue events.
4. **Cleanup doesn't use the model.** Closing issues, posting "resolved" notes
   in Slack threads, and reopening recurrences are done by a scheduled job on
   the worker. They cost nothing, can't be skipped, and still work when the
   agent is down.
5. **The agent is one actor among several.** It has its own user account and
   role, its own allowlist of tools on the server, and nothing a dev couldn't
   do through the UI.

## Two kinds of work

The two pages produce different tasks, and the agent handles them in
different modes. Each mode has its own playbook in the system prompt.

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

This mode is cheap and well-bounded. Grouping matters a lot here: one source
moving its file can break dozens of loaders with the same error.

### Missing metadata: research

This is open-ended, and the right approach depends on the field. The
playbooks below are placeholders; **the economists' rules for each field
replace them**:

| field | where the answer usually comes from |
|---|---|
| `source_id`, `source_detail_id`, `source_link` | the load statement (which API or file it pulls from), sibling series in the same measurement or with the same name prefix, the source's website |
| `unit_id` | sibling series, the source's own table or API metadata; units rules |
| `geography_id` | the `@GEO` part of the series name (mostly mechanical) |
| `dataPortalName` | the naming rules for data lists (unique per list; it's the label users see) |
| `description` | source documentation, sibling descriptions |

In this mode the agent may use web search and web fetch, beyond the
`probe_source_url` allowlist, because finding a source's documentation
requires it. That's acceptable because every change needs approval (level 0,
below). Answers in this mode are judgment calls, so each proposal cites where
the value came from (a sibling series ID or a URL).

Cost: a geography or sibling-based fill is cheap. Research with web search is
the expensive part of the budget, so it's capped separately (see Budget).

## Architecture

```
                       ┌──────────────── Slack ────────────────┐
                       │  #udaman-ops: digests, issue threads, │
                       │  approve/reject buttons, replies       │
                       └──────▲──────────────────────┬──────────┘
                     post/update│                     │events + interactivity
                              │                       ▼
┌───────────── Next server (internet, HTTPS) ──────────────────────────────┐
│  /api/mcp          public uhero-data MCP (unchanged)                     │
│  /api/mcp/ops      internal ops MCP (IP allowlist + role gating)  ◀──────┼── Claude Code (staff, VPN)
│  /api/webhooks/slack  + message events, + interactivity                  │
│  /udaman/UHERO/investigations  + Issues / Proposals / Agent runs tabs    │
│                                                                          │
│  src/core/ops/*  ← the single service layer (issues, proposals, actions) │
└───────┬──────────────────────────────────────────────▲───────────────────┘
        │ MySQL (uhero)            BullMQ (enqueue)     │ HTTPS (ops MCP, bearer)
        ▼                               ▼               │
┌──────────── Worker server ─────────────┐   ┌──── Workstation (VPN, static IP) ────┐
│  existing reload / ingest jobs          │   │  ops-agent (systemd timer + service) │
│  NEW ops.reconcile job (detectors)      │   │  Claude Agent SDK, claude-opus-5-5   │
│  NEW ops.apply-proposal job             │   │  read-only git checkout @ deployed   │
│  NEW ops.verify job (post-reload check) │   │  no DB / Redis / SSH credentials     │
└─────────────────────────────────────────┘   └──────────────────────────────────────┘
```

The workstation only makes outbound connections: to `api.anthropic.com` and
to `/api/mcp/ops`. Nothing has to reach the workstation, so it can stay
VPN-only. Slack inbound goes to the Next server, and the agent learns about
replies by reading issue events.

### Why the agent runs on the workstation

- The worker and Next servers keep their database and Redis credentials. The
  agent box has an Anthropic key and one MCP bearer token, so if it's
  compromised the damage is limited to what the ops MCP allows.
- Reading code needs a checkout. A local read-only clone pinned to the
  deployed commit is simpler than exposing file reads over MCP.
- Alternative: since the Next server is reachable from the internet, Managed
  Agents could host the loop instead. Two catches: `/api/mcp/ops` would then
  have to accept Anthropic's egress IPs, and code reading would need the repo
  mounted in the session. Worth reconsidering if the workstation becomes a
  maintenance burden.

## Data model

New tables in the uhero DB. Following the HST convention (the
`formatHst`/`toHstSql` helpers), all DATETIMEs hold Hawaii wall-clock time. JSON payloads go in `LONGTEXT` columns,
because the Prisma schema has no Json type.

### `ops_issues`

One row per (kind, subject). The fingerprint is unique among issues that are
not closed.

| column | notes |
|---|---|
| `id`, `universe` | |
| `kind` | `load_error`, `reload_job_failed`, `missing_metadata`, `quarantined`, `loader_lag`, `agent_finding` (raised by the agent or a person, e.g. "code bug in X", "suspicious values") |
| `fingerprint` | e.g. `load_error:loader:12345`, `missing_metadata:series:678:source_id` |
| `subject_type`, `subject_id`, `subject_field` | loader / series / reload_job, plus the field for metadata issues |
| `group_key` | normalized error signature (numbers and paths stripped from `last_error`). Lets 40 loaders with "404 from bls.gov" show up as one incident in reports while each still resolves on its own. |
| `status` | see the state machine below |
| `severity` | `low` / `normal` / `high`. High = a data list or portal series is affected, or the error group spans many loaders. |
| `title`, `summary` | the summary is the latest diagnosis, updated by whoever wrote it |
| `first_seen_at`, `last_seen_at`, `last_checked_at`, `occurrence_count` | |
| `owner` | `agent` / `human` / `none`: who is expected to act next |
| `assignee_user_id` | optional, for a person who claims it |
| `snoozed_until`, `dismissed_reason` | |
| `resolved_at`, `resolution_path`, `resolved_by_user_id`, `resolution_note` | see below |
| `reopen_count` | |
| `slack_channel`, `slack_ts` | the issue's Slack thread, when there is one |

### `ops_issue_events`

An append-only timeline, shown the same way in the UI, the MCP, and the agent's context.

| column | notes |
|---|---|
| `issue_id`, `created_at` | |
| `actor_type` | `agent` / `user` / `system` |
| `actor_user_id` | the agent has its own `users` row, so this is always set except for system events |
| `via` | `ui` / `slack` / `mcp` / `agent` / `reconciler` |
| `type` | `detected`, `recurred`, `diagnosis`, `comment`, `question`, `proposal_created`, `proposal_reviewed`, `action_applied`, `resolution_claimed`, `claim_rejected`, `verified_resolved`, `condition_cleared`, `reopened`, `snoozed`, `dismissed`, `assigned` |
| `body` | markdown |
| `payload` | LONGTEXT JSON: before/after, proposal id, job id, Slack ts |

### `ops_proposals`

Changes that need a dev's approval.

| column | notes |
|---|---|
| `issue_id`, `kind` | `loader_update`, `loader_create`, `loader_disable`, `series_metadata`, `unquarantine` |
| `target_type`, `target_id` | |
| `before`, `after` | LONGTEXT JSON. `before` is the target's state when the proposal was made. |
| `evidence` | the agent's reasoning plus the `dry_run_loader` diff |
| `status` | `pending` → `approved` → `applied` / `failed`; or `rejected`, `superseded`, `stale` |
| `created_by_user_id`, `reviewed_by_user_id`, `reviewed_via`, `review_note`, timestamps | |

Additional columns for the queue: `group_key`, `targets` (a list, because one
proposal can cover a whole group), `queue_position`, `expires_at`.

**Stale check:** when a proposal is applied, the target's current state must
still equal `before`. If someone edited the loader in the meantime, the
proposal is marked `stale` and isn't applied. That event goes back on the
issue, and the agent sees it on its next run.

### Proposal queue

People should see one proposal at a time, not 35.

- **One active proposal at a time.** Only the head of the queue is posted to
  Slack and highlighted in the app. The limit is a setting (default 1) so it
  can be raised later. The rest stay `queued` and are visible on the
  Proposals tab but don't notify anyone.
- **Groups become one proposal.** When 12 loaders fail with the same
  `group_key` and the fix is the same, the agent makes one proposal listing
  all 12 targets, with a dry-run diff for each. Approving it applies all of
  them, and the stale check runs per target, so a target someone edited is
  skipped and reported rather than blocking the rest. Groups with the same
  metadata fill (e.g. 30 series from the same BLS table missing
  `source_detail_id`) work the same way.
- **Order:** severity, then group size (bigger groups first, because one
  approval fixes more), then age.
- **Approve or reject promotes the next one.** The next queued proposal is
  revalidated (still applicable? not stale?) and posted.
- **Daily expiry.** At the start of each run, every `pending` or `queued`
  proposal expires. The agent then re-creates only those whose issue is still
  open and whose fix still applies, re-running the dry run. A proposal
  re-created with the same content keeps the same Slack thread and shows "day
  N", so it doesn't post a new message each day.
- **The agent doesn't work ahead of reviewers.** Each run the agent
  investigates only enough to keep a few items in the queue (default 3),
  plus diagnosis comments. That keeps work from piling up that will just
  expire, and keeps spending inside the budget.

### `ops_agent_runs`

`trigger` (`schedule`, `slack_reply`, `manual`), start and finish times,
`model`, input/output/cache tokens, estimated cost, status, error, the Slack
digest's ts, and the commit SHA the checkout was on. A run's tool calls are
logged as JSONL on the workstation, and a summary is pushed here.

### Change to an existing table

`data_source_actions`: add a nullable `ops_issue_id` (and optionally `via`).
Agent edits are already attributed to the agent's user through
`user_id`/`user_email`, and the new column ties each edit to the issue that
caused it.

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
| The agent fixes it | agent applies an allowed change or a dev approves its proposal; verify passes | `agent` / `agent_proposal` |
| Person, in the UI | edits the loader or series in the app, or clicks "Resolve" on the issue | `user_ui` |
| Person, in their own Claude Code | uses the ops MCP edit tools or `resolve_issue` | `user_mcp` |
| Person, outside every tracked surface | e.g. edited through the console script, or the source came back online | `condition_cleared` |
| Not a problem | someone dismisses it ("series intentionally has no source") | `dismissed` (suppressed until the condition changes) |

Every path ends with the same verification. A claimed resolution is
confirmed when the condition is gone. `condition_cleared` is the fallback when
nobody claimed anything. No path depends on a person reporting back.

### Verification by kind

| kind | detector condition | how a claimed resolution is checked |
|---|---|---|
| `load_error` | enabled loader with `last_error IS NOT NULL` | Editing an eval doesn't clear `last_error`. Resolving queues a reload of that loader, and `ops.verify` checks the result when the job finishes. |
| `reload_job_failed` | recent `reload_jobs` row with an error | a later successful job covering the same series |
| `missing_metadata` | null (or empty, for text fields) value in one of the seven `NULL_FIELD_COLUMNS` fields, on any UHERO series. One issue per (series, field). | recheck immediately |
| `quarantined` | `series.quarantined` set | recheck immediately. Only a person can unquarantine. |
| `loader_lag` | past `max_lag_days` (existing loader-lag logic) | after the next scheduled load |
| `agent_finding` | none, it's a manual issue | resolving closes it directly; whoever resolves it must leave a note |

### Reconciler (`ops.reconcile`, worker job)

Runs after the nightly batch completes and hourly during working hours. It
doesn't use the model.

1. Runs each detector for UHERO and upserts issues by fingerprint, bumping
   `last_seen_at` and `occurrence_count`.
2. When an open issue's condition no longer holds, it marks the issue
   `resolved`. If there was a claim the event is `verified_resolved`;
   otherwise it's `condition_cleared`.
3. It posts a short closing reply in the issue's Slack thread ("Resolved via
   UI by Jane at 9:14 — loader eval updated") and updates the parent message's
   status line with `chat.update`, so stale threads don't sit open.
4. It reopens a resolved issue if the same fingerprint comes back within 30
   days. The old Slack thread is reused, since its history is useful.
5. It ends snoozes that have expired. It lifts a dismissal when the condition
   changes (e.g. a different error message on the same loader).
6. To avoid noise, an issue only gets a Slack thread or agent attention after
   it has held for a full cycle, unless its severity is `high`. Temporary
   failures mostly clear themselves before anyone is pinged.

## What the agent works on

Each run picks issues in this order:

1. Issues with new human input since the agent's last event (a reply in
   Slack, a comment in the UI or MCP, a rejected or stale proposal).
2. `open` issues with `owner = agent`, high severity first, one issue per
   `group_key`. Fixing the representative usually fixes the group: the agent
   proposes the same fix for every member, and the reconciler verifies each
   one separately.
3. Never: `awaiting_human` without new input, snoozed, dismissed, or
   `assignee_user_id` set to a person. A person who claims an issue keeps it
   until they let it go.

When the agent is waiting on a person and nobody answers, it does nothing.
The issue stays `awaiting_human`. If the condition clears, the reconciler
closes it. If not, a short reminder goes out in the daily digest, and once a
week the digest lists issues waiting longer than 7 days. The agent doesn't
re-ping people.

## The internal ops MCP (`/api/mcp/ops`)

### Access

- **Network:** an nginx `location /api/mcp/ops` that only allows the VPN
  ranges and the workstation's static IP. Claude Code connecting from a
  staff laptop on VPN works. claude.ai cloud connectors don't, which is what
  we want for an internal tool.
- **Auth:** the existing OAuth flow (`/api/oauth/*`, PKCE), with its own
  protected-resource metadata entry. The role is read live from `users` on
  every call, same as `/api/mcp`.
- **Agent service account:** a `users` row (`udaman-agent@…`) with a new
  `agent` role and a long-lived service token (hashed, rotatable, revocable
  from the admin users page) instead of the 30-day OAuth token.
- **Role tiers:**

| role | gets |
|---|---|
| `internal` | read tools, issue tools (comment, resolve, snooze, assign self) |
| `agent` | read tools, issue tools, proposals; direct writes only for change types at autonomy level ≥ 1 (none at launch) |
| `dev` | everything internal, plus direct loader/series edits, proposal review, dismiss |
| `admin` | same as dev on this surface |

The tool list is filtered by role when the server starts. A tool that isn't
registered can't be called, no matter what the model asks for.

### Tools

**Issues: every path to a resolution**
- `list_issues(status?, kind?, group_key?, owner?, since?)`
- `get_issue(id)`: the issue, its event timeline, linked proposals, recent
  `data_source_actions` for the subject, and the Slack permalink
- `comment_on_issue(id, body, kind: comment|diagnosis|question)`: a
  `question` sets `owner = human` and posts in the Slack thread
- `resolve_issue(id, note, path_hint?)`: starts verification, as described
  above. Returns whether it resolved immediately, is pending (reload queued),
  or was rejected because the condition is still present.
- `assign_issue(id, user_id | "me" | null)`, `snooze_issue(id, until, reason)`
- `dismiss_issue(id, reason)`: dev only
- `raise_issue(kind=agent_finding, subject, title, body)`: for findings the
  detectors can't see

**Read (triage)**
- `get_loader(id)`, `get_series(id | name)`: metadata, loaders, dependents,
  recent data points and vintages
- `list_load_errors()`, `list_missing_metadata(field)`, `list_quarantined()`,
  `list_lagging_loaders()`, `get_reload_jobs()`, `get_batch_status(batchId)`
- `get_loader_actions(loader_id | series_id)`: change history
- `get_app_logs(subject, subject_id | job_id, since)`: reads the `app_logs`
  table, the database half of `/admin/logs`. It's in the shared DB, so the
  worker's entries can be read from the Next server:
  - `category='loader', name='loader.reload_error'`, keyed by
    `subject='data_sources', subject_id=<loader id>`. Holds the eval, the
    message, and the full `detail`, but **only when the error has a `detail`
    that differs from the message.**
  - `category='worker'`: one row per finished or failed job, with `jobId`,
    the queue, and `err` (cut to 500 characters).
  - `loader.batch_reload` / `.depth` summaries: when the nightly batch ran
    and how it went.

  The `logs/app-events.log` file that `/admin/logs` also shows is local to
  each server, so it isn't useful for worker problems. **Small gap to close
  in Phase 0:** write `loader.reload_error` for every loader error, not just
  those with a separate `detail`, so each error has a full record and not
  only the 254-character `last_error`.
- `check_eval(eval, series_id)`: wraps `LoaderCollection.checkEval`
- `dry_run_loader(loader_id, eval?)`: **new.** Runs the eval through
  `EvalExecutor` in memory and returns a diff against the stored data points
  (added, changed, and removed dates; changes in magnitude), with no writes.
  This is what lets anyone, the agent included, show a fix works before
  applying it.
- `probe_source_url(url)`: status, headers, the first few KB, and the content
  type. Only for domains on an allowlist (bls.gov, bea.gov, stlouisfed.org,
  dbedt.hawaii.gov, …). Most failed downloads are a moved or reformatted
  file.
- Lookups for valid values: `list_sources`, `list_source_details`,
  `list_units`, `list_geographies`, `list_measurements`

**Changes**
- `propose_change(issue_id, kind, target, after, evidence)`: creates an
  `ops_proposals` row, posts it to the issue's Slack thread with
  Approve/Reject buttons, and shows it on the Proposals tab
- `review_proposal(id, approve|reject, note)`: dev only. Approval queues
  `ops.apply-proposal`.
- `update_series_metadata(series_id, fields, expected_current, issue_id?)`:
  dev directly. The agent calls it only for action types its current
  autonomy level allows; otherwise the server returns "proposal required."
- `update_loader(loader_id, …, issue_id?)`: dev directly. Same rule for the
  agent.
- `request_reload(loader_id, issue_id)`: queues `SERIES_RELOAD`. Limited per
  loader per day. Counts as a change for the autonomy levels, because it
  writes data points.

### Autonomy levels

Each type of change has its own level, stored as an app setting (the
existing settings / feature-toggle tables) and editable by devs. The ops MCP
checks the setting on every agent write. **Everything starts at level 0.**

| level | meaning |
|---|---|
| 0 | the agent only proposes; a dev approves each change |
| 1 | the agent applies it, posts in Slack, and it's revertible from the issue. Only if the dry run passes and the target was null or unchanged since the agent read it. |
| 2 | like 1, but no Slack post; it just appears in the daily digest |

| change type | starting level | likely first to move up |
|---|---|---|
| `request_reload` (retry after a temporary failure) | 0 | yes |
| `fill_geography` (from the series name) | 0 | yes |
| `fill_metadata_from_sibling` | 0 | after the evaluation |
| `fill_metadata_from_research` | 0 | probably never above 1 |
| `loader_update` | 0 | maybe by pattern (e.g. a URL change with a matching dry run); otherwise stays 0, since it's the economists' area |
| `loader_create` / `loader_disable` / `unquarantine` | 0 | no |

When a change type moves up a level, a person decides it, based on the
approval history: how many of that type were approved unchanged versus
edited or rejected. The Proposals tab shows that rate for each type.

**Reporting**
- `post_report(text, run_id)`: agent only. Posts to the fixed ops channel as
  the run's digest. The agent can't pick a channel or DM anyone.

**Not exposed to anyone:** deletes of any kind, clearing data points, admin
actions, universe archive/purge, raw SQL, hhdb (FICOH is restricted data),
user/permission tables.

### Service layer (`src/core/ops/`)

```
src/core/ops/
  issues.ts        createOrTouch, comment, claimResolution, verify, resolve,
                   reopen, snooze, dismiss, assign
  proposals.ts     create, review, apply (stale check), supersede
  changes.ts       updateLoader / updateSeriesMetadata / requestReload with
                   data_source_actions logging + issue events
  detectors/       one file per kind: detectAll(universe), checkOne(subject)
  slack-sync.ts    thread creation, closing notes, chat.update, event → issue mapping
  dry-run.ts       in-memory EvalExecutor run + diff
```

**Required refactor:** `data_source_actions` is written in
`src/actions/data-loaders.tsx` (CREATE / UPDATE / CLEAR_ERROR), not in the
controller. That logging has to move down into `ops/changes.ts`, or into the
controller, so that UI server actions, MCP tools and approved proposals all
log the same way. Then any UI edit to a loader with an open issue writes an
`action_applied` event on that issue, and the reconciler does the rest.

## Slack

Channel: **#automation** (the loader-lag digest's channel), set as an
environment variable on the Next server.

- **Daily digest**, one top-level message per agent run: counts by kind;
  what was fixed; what's waiting on someone (with links); what was resolved
  by people or cleared on its own since the last run.
- **Issue threads:** only the active proposal and issues where the agent
  asked a question get their own top-level message, with replies in its
  thread. Everything else is a line in the digest with a link to the app.
  Combined with the one-at-a-time queue, the agent adds at most a couple of
  messages a day to #automation.
- **Inbound** (extending `/api/webhooks/slack`):
  - Subscribe to `message.channels` in the ops channel. A thread reply is
    matched to its issue by `thread_ts`, stored as a `comment` event (`via =
    slack`), and sets "new human input."
  - Map the Slack user to a UDAMAN user by email (`users.lookupByEmail`, cached).
  - Interactivity endpoint for Approve/Reject. **The approver's mapped UDAMAN
    role must be dev**; otherwise they get an ephemeral "only devs can
    approve" message.
  - Optional: a reply in an agent-owned thread starts a debounced agent run
    (wait 2 min for follow-ups), so a conversation doesn't have to wait for
    the next scheduled run.
- **`slack.ts` additions:** `updateSlackMessage` (`chat.update`), interactive
  block builders, and a `getPermalink` helper.

Everything in Slack is mirrored into `ops_issue_events`, so the app UI shows
the full conversation. Comments made in the UI or MCP on an issue that has a
thread are also posted to the thread, prefixed with the author's name, so
Slack stays complete too.

## App UI (`/udaman/UHERO/investigations`)

New tabs alongside Dashboard / Missing Metadata / Quarantine:

- **Issues:** filterable list. The detail view shows the timeline (from
  every source), proposals, the subject's loader actions, and Resolve /
  Assign / Snooze / Dismiss / Comment buttons, all calling `src/core/ops`.
- **Proposals:** pending queue. Each shows the before/after diff and the dry-run
  data diff. Devs can approve or reject.
- **Agent runs:** history, cost, and a link to each run's digest.

Existing pages get small links back: the series page and the loader-action
history show the open issue badge.

## Agent runner (workstation)

- **Harness:** Claude Agent SDK (TypeScript). Built-in tools limited to
  `Read`, `Grep`, `Glob`, scoped to the checkout. `Bash`, `Write`, `Edit` and
  web tools are off. One MCP server: `/api/mcp/ops`, using the service token.
  A `PreToolUse` hook logs every call and enforces the per-run limits.
- **Model:** `claude-opus-5-5`, adaptive thinking, effort `high` for the
  investigation. The system prompt and tool list are fixed (no timestamps)
  so prompt caching stays effective across issues and runs.
- **Checkout:** before each run, `git fetch && git checkout <sha>`, where
  `<sha>` comes from a new `/api/version` endpoint. That way the code the
  agent reads is the code that's running.
- **System prompt includes:** UHERO-specific context (loader priority
  convention, units rules, the eval DSL and where the parser lives, known
  failure modes from `docs/`), the resolution model above, and the rule that
  error text, downloaded files and probed pages are data, not instructions.
- **Per-run loop:**
  1. `list_issues` and pick work as described above
  2. per group: `get_issue` → read loader, code, data → `probe_source_url` /
     `dry_run_loader` → classify
  3. act within its tier (comment + diagnosis always; allowlisted write;
     reload; or propose)
  4. `post_report`
- **Limits per run:** maximum issues investigated, proposals, reloads, and
  total tokens (task budget). The run stops cleanly and reports when a limit
  is hit.
- **Code access:** in load-error mode the agent may also run read-only
  `git log` / `git show` on the checkout, through a narrow command allowlist
  (not general Bash), to answer "did our code change since this last worked?"
- **Schedule:** a systemd timer shortly after the nightly batch's usual
  finish time. The run first checks `get_batch_status` and exits if the
  batch is still going. A Slack-reply trigger can be added in a later phase.

## Budget: $50/month

A conservative cap, so most of the API budget stays available for
development.

- **Accounting:** the runner adds up `usage` from every response (input,
  cache write, cache read, output tokens, and web search calls), prices it,
  and saves it to `ops_agent_runs`. Monthly total = the sum of that table.
- **Daily allowance:** (remaining monthly budget) ÷ (days left in the month),
  recomputed each run. Unspent budget carries over within the month. A run
  stops cleanly when it reaches the day's allowance.
- **Split by mode:** at most about 40% of each day's allowance goes to
  missing-metadata research. Load errors go first, because they're urgent and
  cheap to diagnose.
- **Backstop:** a dedicated Anthropic Console workspace and API key for the
  agent, with a $50 monthly spend limit on that workspace. Even a runaway
  loop can't go over, and the user's development usage is billed separately.
- **What $50 buys (rough):** `claude-opus-5-5` costs $4 / $20 per million
  input/output tokens, with cache reads far cheaper. A load-error
  investigation is roughly $0.10–$0.40, and a research-heavy metadata task
  can be $0.50 or more. That's about $1.60 a day, or 5–10 investigations,
  which suits the one-at-a-time queue. Ways to stretch it:
  - a fixed system prompt and tool list so caching works
  - effort `medium` by default, `high` only on a second look
  - groups resolved as one investigation
  - skipping issues the reconciler will close on its own (temporary failures
    are given one cycle before anyone looks at them)

  A cheaper model is possible later, but that's your call once there's data
  on the approval rate.
- The digest shows month-to-date spend and the forecast.

## Prompt injection and the limits on damage

The agent reads text other people control: `last_error` strings, contents of
downloaded files, and source web pages. Measures, from most to least important:

1. Server-side tool allowlist per role (no deletes, no SQL, no channel choice).
2. Writes to anything already populated go through dev approval, with a stale
   check.
3. All agent writes are attributed to the agent account and reversible: issue
   events store before/after, and the Issues UI has a revert action for
   `action_applied` events that the agent made.
4. `probe_source_url` is limited to an allowlist of domains.
5. The system prompt says to treat that text as untrusted.

## Phases

Each phase stops for review before the next.

| phase | delivers | uses the model? |
|---|---|---|
| **0: Issues backbone** | tables, detectors, reconciler job, Issues tab, loader-action logging moved into the service layer, Slack closing notes | no |
| **1: Ops MCP for people** | `/api/mcp/ops` + nginx allowlist, issue and read tools, dev edit tools, `dry_run_loader`, `check_eval`. Staff can use it from Claude Code right away. | no |
| **2: Read-only agent** | workstation runner, diagnoses and comments, daily digest. Its diagnoses are measured against what people actually do. | yes |
| **3: Proposals + approvals** | `ops_proposals`, the one-at-a-time queue with daily expiry, Proposals tab, Slack buttons and inbound replies, `ops.apply-proposal`, the autonomy-level setting (everything at 0), budget accounting | yes |
| **4: Raise autonomy** | move individual change types to level 1 based on approval history; the Slack-reply trigger | yes |

Phases 0–1 are useful even without the agent: issue tracking that closes
itself and an internal MCP for staff.

**Evaluation before phase 3:** build cases from past fixes. Pairs of
`data_source_actions` UPDATE events that cleared a `last_error` show the error,
the old eval, and the eval a person changed it to. Replay them against the
local DB snapshot, never prod.

## Open questions

Settled 2026-11-13:
- logs come from the `app_logs` table
- task sources are the two investigations pages, across the whole universe
- Slack channel is #automation
- proposals expire daily, one is active at a time, groups are one proposal
- autonomy levels per change type, all starting at 0
- $50/month cap

Still open:

1. **Metadata playbooks:** the rules for each field (where a source, unit,
   or description should come from, and naming rules for `dataPortalName`)
   need to be written by whoever owns them. The agent's quality in that mode
   depends on them.
2. **Ordering within missing metadata:** the full universe is a big backlog.
   Should series in data lists or on the portal go first? (Suggested: yes.)
3. **One digest or two:** should the agent's digest be merged with the
   loader-lag digest once lag is in scope?
4. **Queue depth:** is one active proposal right at first, or one per mode
   (one load-error fix and one metadata fill)? Errors are more urgent and
   shouldn't wait behind a metadata fill.
