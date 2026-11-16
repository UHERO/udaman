# Ops agent: deploy runbook

Written 2026-11-14. Nothing below has been run against prod. Steps marked
**check** are questions only the servers can answer.

Design: `docs/2026-11-13-ops-agent-design.md`.

## What gets deployed, and where

| place | what changes | when it takes effect |
|---|---|---|
| **Database** (MariaDB, uhero12) | 7 new `ops_*` tables, one new column on `data_source_actions`, one new `users` row (the agent) | when you apply the migration (§2) |
| **Prod server** (web, `udaman` unit) | Issues and Proposals tabs, `/admin/agent`, the ops MCP at `/api/mcp/ops`, Slack buttons and thread replies | on restart (§3) |
| **Worker server** (`udaman-worker` unit) | `ops.reconcile` (detectors, issue cleanup, daily digest) and `ops.apply-proposal` jobs; reload jobs verify issues | on restart (§4) |
| **Agent server** (your VPN workstation) | the `udaman-ops-agent` service: polls for work, runs the model | when you start it (§6) |

Deploying the code switches on very little by itself:

- The reconciler starts creating issues, and the Issues tab fills. No model.
- The ops MCP is available to staff on VPN.
- **The agent does nothing until its service is started on the
  workstation**, and when it is, it starts in comment-only mode: it
  diagnoses and asks questions but cannot propose changes. Proposals are a
  setting you turn on later (§7).

So §1–§5 can go out with a normal deploy, and §6–§7 can wait as long as you
like.

## 0. Before you start (local)

1. Commit the working tree on `agent-et-mcp` and merge it the usual way.
   The branch adds one dependency (`@anthropic-ai/sdk`) and two scripts
   (`ops`, `ops-agent`) to `package.json`.
2. Run the checks:

   ```bash
   bun install
   bun run check-types && bun run lint
   find src -name "*.test.ts" -o -name "*.test.tsx" | grep -v migrate-interpolate-to-disaggregate | xargs bun test
   bun run build
   ```

   Plain `bun test` exits early (one test imports a script that calls
   `process.exit`), hence the `find`.
3. Decide two values you'll need:
   - the **VPN address range(s)** and the **workstation's static IP**, for
     nginx (§3)
   - who will review proposals besides devs, if anyone (§7)

## 1. Window and backup

- Any quiet window works. The migration only creates empty tables and adds
  one nullable column; it doesn't rewrite `data_source_actions` rows.
  Avoid the nightly batch and the sweeps as usual (see
  `2026-08-27-heavy-job-deploy.md` §1).
- Back up `data_source_actions` and `users` before the migration. A full
  dump is better if one isn't recent.

## 2. Database migration

One migration: `src/lib/prisma/migrations/20261113000000_ops_agent/migration.sql`.

It creates `ops_issues`, `ops_issue_events`, `ops_proposals`,
`ops_agent_runs`, `ops_agent_run_steps`, `ops_settings` and
`ops_service_tokens`; adds `data_source_actions.ops_issue_id INT NULL`; and
inserts the agent's user (`udaman-agent@uhero.hawaii.edu`, role `internal`,
no password, so it can't sign in to the UI).

**Apply it before restarting the servers.** The new code tolerates the
missing column when logging loader edits, but every ops page and job needs
the tables.

### 2A. Check state (read-only)

```sql
SHOW TABLES LIKE '_prisma_migrations';       -- decides 2B vs 2C
SHOW TABLES LIKE 'ops_%';                    -- expect none
SHOW COLUMNS FROM data_source_actions LIKE 'ops_issue_id';   -- expect none
SELECT id, role FROM users WHERE email = 'udaman-agent@uhero.hawaii.edu';  -- expect none
-- the migration's INSERT names these columns; confirm prod's users table has them
SHOW COLUMNS FROM users WHERE Field IN ('universe','role','email','name','created_at','updated_at');
```

### 2B. If prod has no `_prisma_migrations` (not baselined): by hand

```bash
mysql --defaults-extra-file=~/.my.cnf <DB_NAME> \
  < src/lib/prisma/migrations/20261113000000_ops_agent/migration.sql
```

`<DB_NAME>` is the database named in the server's `.env.prod`. The DDL is
not idempotent: if it stops partway, look at what exists before rerunning
(the `INSERT IGNORE` at the end is safe to repeat). Record it wherever the
earlier hand-applied migrations are recorded.

### 2C. If prod is baselined

```bash
bunx prisma migrate deploy
```

Never `migrate dev` or `migrate reset` on prod.

### 2D. Verify

```sql
SHOW TABLES LIKE 'ops_%';                    -- 7 tables
SHOW COLUMNS FROM data_source_actions LIKE 'ops_issue_id';
SELECT id, email, role FROM users WHERE email = 'udaman-agent@uhero.hawaii.edu';
```

### 2E. Roll back (only if you're abandoning the feature)

```sql
DROP TABLE ops_issue_events, ops_issues, ops_proposals, ops_agent_run_steps,
           ops_agent_runs, ops_settings, ops_service_tokens;
ALTER TABLE data_source_actions DROP COLUMN ops_issue_id;
-- Only if the agent never made an edit (its user id appears in data_source_actions otherwise):
DELETE FROM users WHERE email = 'udaman-agent@uhero.hawaii.edu';
```

Rolling back the code alone is safe without this: old code ignores the new
tables and the nullable column.

## 3. Prod server (web)

### 3A. Environment (`.env.prod`)

| Variable | Action |
|---|---|
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Already there for the existing bot. **Check** both are set. |
| `OPS_SLACK_CHANNEL` | Optional. Defaults to `automation`. |
| `UDAMAN_BASE_URL` | Optional. Links in Slack messages use it, then `AUTH_URL`, then `https://udaman.uhero.hawaii.edu`. **Check** one of those is the public URL. |
| `OPS_MCP_ALLOWED_IPS` | Optional second check inside the app: comma-separated exact IPs allowed to call `/api/mcp/ops`. Only useful for single addresses (it has no ranges); nginx is the real gate. |
| `OPS_PROBE_DOMAINS` | Optional. Replaces the built-in list of source domains `probe_source_url` may fetch (bls.gov, bea.gov, census.gov, hawaii.gov, …). |

### 3B. nginx: restrict the ops MCP

Add inside the UDAMAN `server` block, above the general `location /`:

```nginx
location /api/mcp/ops {
    allow <VPN_RANGE_CIDR>;        # staff Claude Code on VPN
    allow <WORKSTATION_STATIC_IP>; # the agent
    deny  all;

    # same proxy settings as the existing `location /`
    proxy_pass http://<the existing upstream>;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- **Check** how the workstation's requests arrive at this server. If they
  come through a NAT or another proxy, `allow` the address nginx actually
  sees.
- Leave `/api/mcp` (the public uhero-data MCP), `/api/oauth/*` and
  `/.well-known/*` as they are. Staff Claude Code needs the OAuth and
  `.well-known` paths to sign in.
- `sudo nginx -t && sudo systemctl reload nginx`

### 3C. Code and restart

```bash
git pull
bun install
bun run build
sudo systemctl restart udaman
```

Restart web and worker close together (§4); both read the new tables.

### 3D. Smoke test

1. `/udaman/UHERO/investigations` shows two new tabs, Issues and Proposals.
   Both load (empty until the first reconcile).
2. `/admin/agent` loads as a dev. Health says the runner has never asked for
   work; the status line says "comment-only".
3. From outside the VPN:
   `curl -i https://<host>/api/mcp/ops` → **403 from nginx**.
4. From the VPN, without a token: the same request → **401** with a
   `WWW-Authenticate: Bearer realm="mcp-ops"` header.
5. From your laptop on VPN, add the MCP to Claude Code and sign in:

   ```bash
   claude mcp add --transport http udaman-ops https://<host>/api/mcp/ops
   ```

   `list_issues` should answer. As a dev you should see 26 tools, including
   `update_loader`, `update_measurement_metadata` and `review_proposal`. An
   `internal` user sees 18: the read and issue tools only.

## 4. Worker server

### 4A. Environment

The worker reads the same `.env.prod`. It posts to Slack itself (issue
closing notes, the digest, the missed-poll alert), so it needs
`SLACK_BOT_TOKEN`, and `OPS_SLACK_CHANNEL` / `UDAMAN_BASE_URL` if you set
them on the web server. `APP_ENV=production` must be set, as for every
other schedule.

### 4B. Code and restart

```bash
git pull
bun install
sudo systemctl restart udaman-worker
```

In the worker log, expect:

```
Registered schedule: ops-reconcile-daily (daily 5:00 AM HST)
Registered schedule: ops-reconcile (hourly 7:35 AM–5:35 PM HST)
```

The nightly batch also queues a reconcile when it finishes.

### 4C. First reconcile

Don't wait for the schedule. On the worker (or any machine with the prod
env):

```bash
bun run ops reconcile
bun run ops status
```

- On the 2026-11-11 snapshot this found **73 load errors, 44 lag issues and
  397 metadata issues**, in a few seconds. Prod should be close.
- A second `bun run ops reconcile` should report `created: 0`.
- It posts nothing to Slack: issues get a thread only when the agent asks a
  question or a proposal is shown.
- The Issues tab should now match the load-error count on the
  investigations dashboard, minus the lag-limit ones, which are their own
  kind.

After this, new or changed loader errors are also written to `app_logs` as
`loader.reload_error` (they previously needed a separate detail message).
**Check** after the next nightly batch:

```sql
SELECT COUNT(*), MAX(created_at) FROM app_logs WHERE name = 'loader.reload_error';
```

### 4D. What the worker does from now on

| when | job | effect |
|---|---|---|
| hourly 7:35–17:35 HST, and after the nightly batch | `ops.reconcile` | new issues; issues whose condition cleared are resolved, whoever fixed them; proposals for resolved issues are withdrawn |
| 5:00 HST | `ops.reconcile` (daily) | the same, plus a fresh dry run for each waiting proposal, and the digest to `#automation` if something happened or someone is being waited on |
| on approval | `ops.apply-proposal` | applies the change; loader changes queue a reload that verifies the issue |

Expect a digest most mornings once people start fixing things, because
"resolved since the last digest" counts as something happening.

## 5. Slack app

In the existing UDAMAN bot's settings (api.slack.com):

1. **Event Subscriptions** → bot events: add `message.channels`. The request
   URL is the existing `/api/webhooks/slack`.
2. **Interactivity & Shortcuts**: turn on, Request URL = the same
   `https://<host>/api/webhooks/slack`.
3. **OAuth scopes**: `chat:write`, `channels:history`, `users:read`,
   `users:read.email`. Adding a scope means reinstalling the app to the
   workspace; the bot token usually stays the same, but **check** it and
   update `SLACK_BOT_TOKEN` on both servers if it changed.
4. Invite the bot to `#automation` if it isn't a member.

Slack users are matched to UDAMAN users by email. Someone whose Slack email
differs from their UDAMAN email can comment in threads but can't approve.

Nothing uses the buttons until proposals are on (§7), so this can be done
any time before then. Thread replies matter as soon as the agent asks its
first question.

## 6. Agent server (the workstation)

Full reference: `src/core/ops-agent/README.md`.

### 6A. One-time setup

1. **Console workspace.** In the Anthropic Console create a workspace just
   for the agent, set its monthly spend limit to **$50**, and create an API
   key in it. This is the hard cap; the app's own accounting sits under it.
2. **User and checkout:**

   ```bash
   sudo useradd -m opsagent
   sudo -iu opsagent
   curl -fsSL https://bun.sh/install | bash
   git clone <repo> ~/udaman && cd ~/udaman && bun install
   ```

   The clone needs read access only (a deploy key is enough).
3. **Service token.** On `/admin/agent` → Service tokens → Create. It is
   shown once. (Or on a server: `bun run ops token workstation`.)
4. **Env file** `~opsagent/.config/udaman-ops-agent.env`, mode 600:

   ```sh
   ANTHROPIC_API_KEY=sk-ant-…
   OPS_MCP_URL=https://<host>/api/mcp/ops
   OPS_MCP_TOKEN=uops_…
   OPS_REPO_ROOT=/home/opsagent/udaman
   OPS_GIT_SYNC_REF=origin/master
   ```

   The workstation holds no database, Redis, Slack or SSH credentials.
   `OPS_GIT_SYNC_REF` should name whatever prod is deployed from; the agent
   reads code from that commit.
5. **Connectivity check**, as `opsagent`:

   ```bash
   set -a; . ~/.config/udaman-ops-agent.env; set +a
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $OPS_MCP_TOKEN" "$OPS_MCP_URL"
   ```

   Anything but 403 means nginx let it through (a GET may answer 405 or
   406; that's fine). 403 means the workstation's IP isn't in the allow
   list as nginx sees it.

### 6B. First run, by hand

```bash
cd ~/udaman
set -a; . ~/.config/udaman-ops-agent.env; set +a
bun run ops-agent --once --max-items 1
```

- It asks for work, investigates one issue group (a high-severity
  load-error group goes first), writes a diagnosis on the issue, and exits.
  Expect roughly $0.10–$0.50.
- Read the result on `/admin/agent` → Runs → the run: every tool call and
  the model's notes are there. Then read the diagnosis on the issue.
- **This is the first real model run the code has had.** If it fails, the
  run's error and the step log say where. Likely spots, none exercised
  before now: the Anthropic API call's parameters (`runner.ts`
  `client.beta.messages.create`: model id, the fallback beta, the web tool
  versions), and the MCP connection over HTTP.

### 6C. The service

`/etc/systemd/system/udaman-ops-agent.service`:

```ini
[Unit]
Description=UDAMAN ops agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=opsagent
WorkingDirectory=/home/opsagent/udaman
EnvironmentFile=/home/opsagent/.config/udaman-ops-agent.env
ExecStart=/home/opsagent/.bun/bin/bun run ops-agent
Restart=always
RestartSec=60
TimeoutStopSec=15min

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now udaman-ops-agent
journalctl -u udaman-ops-agent -f
```

- It polls every 5 minutes. With nothing to do it logs one line when the
  reason changes, e.g. `idle: the ready buffer is full; waiting for reviews`.
- `/admin/agent` → Health shows when it last asked for work. If that goes
  26 hours without a poll, the reconciler posts an alert to `#automation`.
- **Pause** on `/admin/agent` stops it handing out work without touching
  the workstation.
- Stopping the service lets the current item finish first (up to 15 min).

### 6D. After later deploys

- `git` is synced by the runner before each run, so playbook and context
  edits (`src/core/ops-agent/context/`) reach the agent without any action.
- If the deploy changed the runner itself (`src/core/ops-agent/*.ts`) or
  dependencies: `sudo -iu opsagent bash -c 'cd ~/udaman && git fetch && git checkout --detach origin/master && bun install'`,
  then `sudo systemctl restart udaman-ops-agent`.

## 7. Switching things on, in order

Each step is a setting on `/admin/agent`; none needs a deploy.

| step | do | look for before moving on |
|---|---|---|
| **A. Issues only** | §1–§4. Agent service not started. | For a week: issue counts track the investigations pages, and issues close themselves when people fix things. |
| **B. MCP for people** | Use `/api/mcp/ops` from your own Claude Code for your usual fixes. | Any tool you had to work around; add it. |
| **C. Evaluation** (local, optional but cheap) | `bun run scripts/ops-eval.ts build --out cases.json`, then `prepare` / agent / `finish` per case, against the local database and a local Next server. | How often the agent's fix matches the person's. |
| **D. Comment-only agent** | §6. "Proposals on" stays `0`. | Two weeks of diagnoses that read as correct; spend as forecast. At 20 items a day it will have looked at every load-error and lag group within the first few days, then mostly idle. |
| **E. Proposals** | §5 done. Set "Proposals on" to `1`. | One proposal appears in `#automation` and on the Proposals tab; approving it applies it and the next appears within minutes. Watch the per-type record on `/admin/agent`. |
| **F. Metadata** | First the bulk pass below. Metadata items are already on the list; they come up when no error or lag item is workable. | The economists' field rules are written into `context/playbooks/metadata-fields/` (the `TODO(economists)` sections). |
| **G. Autonomy** | Raise one change type at a time on `/admin/agent`. | The thresholds in the design doc's autonomy table. |

**Settings worth knowing** (all on `/admin/agent`):

| setting | default | meaning |
|---|---|---|
| Pause | off | the agent gets no work |
| Proposals on | 0 | 0 = comment-only |
| Proposals shown for review at once | 1 | |
| Ready buffer | 3 | shown + waiting; the agent stops investigating new items when it's full |
| New items per day, at most | 20 | |
| Required metadata fields | `source_id,unit_id,dataPortalName` | add `source_detail_id`, `source_link` or `description` later to create issues for them |
| Extra reviewers | empty | user ids who may approve, besides devs and admins |
| Monthly cap | 50 | the app's own limit; the Console workspace limit is the backstop |
| Autonomy, per change type | 0 | 0 = every change is reviewed |

### The one-time metadata bulk pass (before step F)

On a machine with the prod env:

```bash
bun run scripts/ops-measurement-fill.ts --report fill.csv
# review fill.csv; delete rows you disagree with
bun run scripts/ops-measurement-fill.ts --apply fill.csv --user you@hawaii.edu            # dry run
bun run scripts/ops-measurement-fill.ts --apply fill.csv --user you@hawaii.edu --execute
```

On the snapshot it proposes 35 rows (22 sources, 13 units), filling 156
series. Read it: one row would give a Japan GDP series the BEA as its
source because the US series in the same measurement have it. Each applied
row resolves its issue as fixed by you.

## 8. Rollback

| to undo | do |
|---|---|
| the agent | `sudo systemctl disable --now udaman-ops-agent`, or Pause on `/admin/agent`. Revoke its token there if the workstation is in doubt. |
| proposals | set "Proposals on" to `0`. Waiting proposals stay reviewable; reject them or leave them to be withdrawn. |
| an applied change | the issue's timeline has the before and after; edit the loader, series or measurement back by hand (there is no revert button yet). Loader edits are also in the loader's action history, attributed to the agent's user. |
| the reconciler | it only writes `ops_*` tables and Slack. To stop it, remove the two `scheduled:ops-reconcile*` job schedulers or deploy with them commented out in `scheduler.ts`. |
| everything | deploy the previous commit (safe with the tables in place), then §2E if you want the tables gone. |

## 9. Not verified before this deploy

The logic was exercised against the local snapshot (see the design doc's
"Verified locally"). These have never run and are the places to watch:

- a real model run (§6B)
- live Slack: thread creation, the Approve / Reject buttons, thread replies
  becoming comments
- `/api/mcp/ops` over HTTP under Next, including OAuth sign-in from Claude
  Code and the service-token path
- the `ops.reconcile` and `ops.apply-proposal` jobs under BullMQ, and reload
  verification of loader issues
- the runner's polling loop against a server, and the git sync

Also still open: the `TODO(economists)` sections in the agent's context
files, which the quality of metadata proposals depends on.
