# Ops agent (runner)

Works down the UHERO to-do list (load errors, then loaders past their lag
limit, then metadata gaps) one item at a time, and proposes fixes for
review. Design: `docs/2026-11-13-ops-agent-design.md`. Deploying:
`docs/2026-11-14-ops-agent-deploy.md`.

- `runner.ts`: a long-running service. Every few minutes it asks the server
  for work (the runner API, no model). The server hands out an item only
  while there is room behind the proposal being reviewed, and budget left.
  Each item is one fresh conversation with Claude (`claude-opus-5-5`,
  adaptive thinking, effort `medium`, server-side refusal fallback).
- Tools per kind of work: the catalog and ops MCP tools and local read-only
  code tools always; web search and web fetch only on metadata and lag
  items.
- `mcp-client.ts`: the three connections to the server, all with the service
  token. Two MCP servers whose tools the model sees (`/api/mcp/catalog`:
  read, test and propose changes; `/api/mcp/ops`: issues and the review
  queue), and the runner API (`/api/ops-runner/*`: start, work, budget, log,
  finish) that only the harness calls.
- `local-tools.ts`: `read_file`, `grep`, `list_files`, `git_log`, `git_show`,
  confined to the checkout (no `.env` files, no writes).
- `prompt.ts` and `context/`: the system prompt, built from markdown. Edit
  `context/` to teach the agent; see `context/README.md`.
- `pricing.ts`: token prices for the $50/month accounting.

The runner can't touch the database, Redis or Slack directly. Everything goes
through those three endpoints, which enforce the tool allowlist, the
autonomy levels and the review queue. The model can't claim work or close a
run: those calls aren't tools.

## Workstation setup

1. A dedicated Unix user (e.g. `opsagent`) with a clone of this repo:
   ```sh
   git clone <repo> ~/udaman && cd ~/udaman && bun install
   ```
   The runner reads code from this checkout and puts it on
   `OPS_GIT_SYNC_REF` before each run that has work.
2. An Anthropic API key from a **dedicated Console workspace** with a monthly
   spend limit of $50. That's the hard backstop behind the app's own
   accounting.
3. A service token: on `/admin/agent` (dev only), "Create token". Or on a
   server: `bun run ops token workstation`.
4. `~/.config/udaman-ops-agent.env` (mode 600):
   ```sh
   ANTHROPIC_API_KEY=sk-ant-…
   OPS_SERVER_URL=https://udaman.uhero.hawaii.edu
   OPS_AGENT_TOKEN=uops_…
   OPS_REPO_ROOT=/home/opsagent/udaman
   OPS_GIT_SYNC_REF=origin/master
   # optional: OPS_POLL_SECONDS=300  OPS_AGENT_MODEL=claude-opus-5-5  OPS_AGENT_EFFORT=medium
   ```
   `origin/master` stands in for "the deployed commit". If deploys lag
   master, point it at a deployed tag or branch instead.
5. systemd unit (`/etc/systemd/system/udaman-ops-agent.service`):
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
   # SIGTERM lets the current item finish before the service stops.
   TimeoutStopSec=15min

   [Install]
   WantedBy=multi-user.target
   ```
   `systemctl enable --now udaman-ops-agent`, then
   `journalctl -u udaman-ops-agent -f`. An idle agent logs one line per
   change of reason ("the ready buffer is full; waiting for reviews").

The service loads `runner.ts` once. After a deploy that changes the runner
(anything under `src/core/ops-agent/*.ts`), restart the service; changes to
`context/` are picked up on the next run without a restart.

Manual runs (the service can stay up; an item handed to one runner isn't
handed to another):
`bun run ops-agent --once --max-items 1`, or `--issue 123` for one issue.
They count against the budget.

## Server-side setup

- Apply the `20261113000000_ops_agent` migration. It creates the ops tables
  and the agent's user row.
- nginx: allow `/api/mcp/catalog` and `/api/mcp/ops` only from the VPN range
  and the workstation's static IP, and `/api/ops-runner/` only from the
  workstation. `OPS_MCP_ALLOWED_IPS` is an optional second check in the app.
- Slack app (the existing UDAMAN bot):
  - Event Subscriptions: add bot event `message.channels`.
  - Interactivity: Request URL = the same `/api/webhooks/slack`.
  - Scopes: `chat:write`, `channels:history`, `users:read`, `users:read.email`.
  - The bot must be in `#automation` (`OPS_SLACK_CHANNEL` overrides the channel).
- Worker: the new schedules (`ops-reconcile-daily` 5:00, `ops-reconcile`
  hourly 7:35–17:35 HST) register on restart in production.

Full steps, in order, with checks: `docs/2026-11-14-ops-agent-deploy.md`.
