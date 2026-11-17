/*************************************************************************
 * Ops agent runs: run records, step log, budget, work selection, digest.
 * Work selection and the digest are deterministic (no model), so the agent
 * spends its budget only on investigating.
 *************************************************************************/

import { hstToInstant } from "@catalog/utils/time";
import { mysql, rawQuery } from "@database/mysql";

import { IssueStore } from "./issue-store";
import { agentAdminUrl, issueUrl, proposalsUrl } from "./links";
import { ProposalStore } from "./proposal-store";
import { getAgentUserId } from "./service-tokens";
import { getOpsSettings, getRawSettings } from "./settings";
import { postOpsMessage } from "./slack-sync";
import {
  WORK_ORDER,
  type IssueEventRow,
  type IssueKind,
  type IssueRow,
} from "./types";

// ─── Runs + steps ─────────────────────────────────────────────────────

export async function startRun(opts: {
  universe: string;
  trigger: string;
  model: string;
  gitSha: string | null;
}): Promise<number> {
  await mysql`
    INSERT INTO ops_agent_runs (universe, \`trigger\`, status, model, git_sha, started_at)
    VALUES (${opts.universe}, ${opts.trigger}, 'running', ${opts.model}, ${opts.gitSha}, NOW())
  `;
  const rows = await mysql<{ id: number }>`
    SELECT id FROM ops_agent_runs WHERE universe = ${opts.universe}
    ORDER BY id DESC LIMIT 1
  `;
  return Number(rows[0].id);
}

export interface StepInput {
  issueId?: number | null;
  seq: number;
  kind: "tool_call" | "assistant" | "error" | "note" | "usage";
  toolName?: string | null;
  input?: string | null;
  output?: string | null;
  isError?: boolean;
  durationMs?: number | null;
  costUsd?: number | null;
}

const MAX_STEP_TEXT = 8000;
const clip = (s: string | null | undefined) =>
  s == null
    ? null
    : s.length > MAX_STEP_TEXT
      ? `${s.slice(0, MAX_STEP_TEXT)}…[${s.length - MAX_STEP_TEXT} more]`
      : s;

export async function logSteps(
  runId: number,
  steps: StepInput[],
): Promise<void> {
  for (const s of steps.slice(0, 200)) {
    await mysql`
      INSERT INTO ops_agent_run_steps
        (run_id, issue_id, seq, kind, tool_name, input, output, is_error, duration_ms, cost_usd, created_at)
      VALUES
        (${runId}, ${s.issueId ?? null}, ${s.seq}, ${s.kind}, ${s.toolName ?? null},
         ${clip(s.input)}, ${clip(s.output)}, ${s.isError ? 1 : 0},
         ${s.durationMs ?? null}, ${s.costUsd ?? null}, NOW())
    `;
  }
}

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearchRequests: number;
  costUsd: number;
}

/** Add usage to a run as it goes, so a crashed runner still counts. */
export async function addRunUsage(runId: number, u: RunUsage): Promise<void> {
  await mysql`
    UPDATE ops_agent_runs SET
      input_tokens = input_tokens + ${u.inputTokens},
      output_tokens = output_tokens + ${u.outputTokens},
      cache_write_tokens = cache_write_tokens + ${u.cacheWriteTokens},
      cache_read_tokens = cache_read_tokens + ${u.cacheReadTokens},
      web_search_requests = web_search_requests + ${u.webSearchRequests},
      cost_usd = cost_usd + ${u.costUsd}
    WHERE id = ${runId}
  `;
}

// ─── Budget ───────────────────────────────────────────────────────────

export interface BudgetStatus {
  monthlyCapUsd: number;
  monthSpentUsd: number;
  todaySpentUsd: number;
  dailyAllowanceUsd: number;
  remainingTodayUsd: number;
  daysLeftInMonth: number;
}

/**
 * Daily allowance = (monthly cap − spent before today) ÷ days left, so
 * unspent budget carries over within the month.
 */
export async function getBudget(universe: string): Promise<BudgetStatus> {
  const settings = await getOpsSettings(universe);
  const rows = await mysql<{
    month: number | null;
    today: number | null;
    days_left: number;
  }>`
    SELECT
      SUM(CASE WHEN started_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN cost_usd ELSE 0 END) AS month,
      SUM(CASE WHEN started_at >= CURDATE() THEN cost_usd ELSE 0 END) AS today,
      DATEDIFF(LAST_DAY(NOW()), CURDATE()) + 1 AS days_left
    FROM ops_agent_runs
    WHERE universe = ${universe} AND started_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
  `;
  const month = Number(rows[0]?.month ?? 0);
  const today = Number(rows[0]?.today ?? 0);
  const daysLeft = Math.max(1, Number(rows[0]?.days_left ?? 1));
  const allowance = Math.max(
    0,
    (settings.monthlyBudgetUsd - (month - today)) / daysLeft,
  );
  return {
    monthlyCapUsd: settings.monthlyBudgetUsd,
    monthSpentUsd: month,
    todaySpentUsd: today,
    dailyAllowanceUsd: allowance,
    remainingTodayUsd: Math.max(0, allowance - today),
    daysLeftInMonth: daysLeft,
  };
}

/** Age of an HST wall-clock DATETIME value, in ms. */
const ageMs = (d: Date) => Date.now() - hstToInstant(d).getTime();

// ─── Work selection ───────────────────────────────────────────────────

/** Which playbook and tool set an item gets. */
export type WorkClass = "errors" | "lag" | "metadata";

export function workClassOf(kind: IssueKind): WorkClass {
  return kind === "missing_metadata"
    ? "metadata"
    : kind === "loader_lag"
      ? "lag"
      : "errors";
}

/** Issues must persist this long before the agent looks (unless high severity). */
const SETTLE_HOURS = 20;
/**
 * An issue the agent already looked at, with nothing new since, is left
 * alone this long before a second look (sources do change).
 */
const RELOOK_DAYS = 7;
/** Don't hand out work with less than this left in today's allowance. */
const MIN_START_USD = 0.15;
/**
 * Items handed to a runner are marked `investigating` and not handed out
 * again for this long, so a manual run beside the service can't pick up
 * the same item. A runner that died releases its items when it lapses.
 */
const CLAIM_MINUTES = 90;
/** Event types that put an issue back in front of the agent. */
const FEEDBACK_EVENTS = new Set([
  "proposal_withdrawn",
  "claim_rejected",
  "recurred",
  "reopened",
]);

export interface WorkItem {
  workClass: WorkClass;
  reason: "human_input" | "proposal_feedback" | "new";
  groupKey: string | null;
  issue: IssueRow;
  events: IssueEventRow[];
  memberIssueIds: number[];
  memberCount: number;
}

export interface WorkResult {
  paused: boolean;
  /** Why there is nothing new to start, when that's the case. */
  idleReason: string | null;
  items: WorkItem[];
  /** Free places in the ready buffer. */
  capacity: number;
}

/** Record that the runner asked for work (the liveness signal). */
export async function recordPoll(universe: string): Promise<void> {
  await mysql`
    INSERT INTO ops_settings (\`key\`, value, updated_at)
    VALUES (${`${universe}:agent.last_poll_at`},
            DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
  `;
}

/**
 * What the agent should work on now, from one ordered to-do list: load
 * errors, then lag, then metadata gaps. No model involved.
 *
 * Issues with new human input always come first. New items are handed out
 * only while the ready buffer (proposals waiting for review) has room, the
 * day's budget and item limit allow, and the issue has settled. So with
 * nobody reviewing, this returns nothing and the agent idles.
 */
export async function getWork(universe: string): Promise<WorkResult> {
  const settings = await getOpsSettings(universe);
  if (settings.agentPaused)
    return { paused: true, idleReason: "paused", items: [], capacity: 0 };

  const budget = await getBudget(universe);
  if (budget.remainingTodayUsd < MIN_START_USD)
    return {
      paused: false,
      idleReason: "today's budget is used",
      items: [],
      capacity: 0,
    };

  // The buffer is the agent's own proposals; a person's don't hold it up.
  const agentId = await getAgentUserId();
  const live = await ProposalStore.list({
    universe,
    status: ["queued", "pending"],
  });
  const capacity = Math.max(
    0,
    settings.readyTarget -
      live.filter((p) => p.createdByUserId === agentId).length,
  );
  const liveIssueIds = new Set<number>();
  for (const p of live) {
    if (p.issueId) liveIssueIds.add(p.issueId);
    for (const t of p.targets) if (t.issueId) liveIssueIds.add(t.issueId);
  }

  const startedToday = await mysql<{ n: number }>`
    SELECT COUNT(DISTINCT st.issue_id) AS n
    FROM ops_agent_run_steps st
    JOIN ops_agent_runs r ON r.id = st.run_id
    WHERE r.universe = ${universe} AND r.started_at >= CURDATE()
      AND st.issue_id IS NOT NULL
  `;
  const dailyLeft = Math.max(
    0,
    settings.maxItemsPerDay - Number(startedToday[0]?.n ?? 0),
  );

  const rows = await rawQuery(
    `SELECT id FROM ops_issues
     WHERE universe = ? AND kind IN (${WORK_ORDER.map(() => "?").join(",")})
       AND status IN ('open', 'investigating', 'awaiting_human')
       AND assignee_user_id IS NULL
       AND (snoozed_until IS NULL OR snoozed_until < NOW())
     ORDER BY
       (last_human_event_at IS NOT NULL AND (last_agent_event_at IS NULL OR last_human_event_at > last_agent_event_at)) DESC,
       FIELD(kind, ${WORK_ORDER.map(() => "?").join(",")}),
       FIELD(severity, 'high', 'normal', 'low'),
       first_seen_at
     LIMIT 2000`,
    [universe, ...WORK_ORDER, ...WORK_ORDER],
  );
  const issues = await IssueStore.getByIds(rows.map((r) => Number(r.id)));
  const byId = new Map(issues.map((i) => [i.id, i]));
  const ordered = rows.map((r) => byId.get(Number(r.id))!).filter(Boolean);

  const groups = new Map<string, IssueRow[]>();
  for (const i of ordered) {
    const g = i.groupKey ?? `issue:${i.id}`;
    const list = groups.get(g) ?? [];
    list.push(i);
    groups.set(g, list);
  }

  // Items a runner is working on right now hold a place in the buffer
  // (they may each become a proposal), so two polls can't overfill it.
  const isClaimed = (members: IssueRow[]) =>
    members.some(
      (m) =>
        m.status === "investigating" &&
        ageMs(m.updatedAt) < CLAIM_MINUTES * 60000,
    );
  const inProgress = [...groups.values()].filter(isClaimed).length;

  const items: WorkItem[] = [];
  let newSlots = Math.min(capacity - inProgress, dailyLeft);
  for (const [groupKey, members] of groups) {
    const rep = members[0];
    const humanInput =
      rep.lastHumanEventAt != null &&
      (rep.lastAgentEventAt == null ||
        rep.lastHumanEventAt > rep.lastAgentEventAt);
    if (isClaimed(members)) continue;
    if (members.some((m) => liveIssueIds.has(m.id)) && !humanInput) continue;
    if (rep.status === "awaiting_human" && !humanInput) continue;

    const events = await (humanInput || rep.lastAgentEventAt
      ? IssueStore.listEvents(rep.id)
      : Promise.resolve(null));
    const last = events?.[events.length - 1];
    let reason: WorkItem["reason"] = "new";
    if (humanInput) {
      reason =
        last?.type === "proposal_reviewed"
          ? "proposal_feedback"
          : "human_input";
    } else {
      if (newSlots <= 0) continue;
      if (last && FEEDBACK_EVENTS.has(last.type)) {
        reason = "proposal_feedback";
      } else {
        const ageH = ageMs(rep.firstSeenAt) / 3600000;
        if (rep.severity !== "high" && ageH < SETTLE_HOURS) continue;
        if (
          rep.lastAgentEventAt &&
          ageMs(rep.lastAgentEventAt) < RELOOK_DAYS * 86400000
        )
          continue;
      }
      newSlots--;
    }
    items.push({
      workClass: workClassOf(rep.kind),
      reason,
      groupKey: groupKey.startsWith("issue:") ? null : groupKey,
      issue: rep,
      events: events ?? (await IssueStore.listEvents(rep.id)),
      memberIssueIds: members.slice(0, 200).map((m) => m.id),
      memberCount: members.length,
    });
  }

  const idleReason = items.length
    ? null
    : capacity <= 0
      ? "the ready buffer is full; waiting for reviews"
      : inProgress >= capacity
        ? "items are already being worked on"
        : dailyLeft <= 0
          ? "today's item limit is reached"
          : "nothing workable on the list";
  return { paused: false, idleReason, items, capacity };
}

/** Mark handed-out items as being worked on (see CLAIM_MINUTES). */
export async function claimWork(items: WorkItem[]): Promise<void> {
  for (const item of items)
    await IssueStore.update(item.issue.id, { status: "investigating" });
}

// ─── Finish + digest ──────────────────────────────────────────────────

export async function finishRun(
  runId: number,
  outcome: {
    status: "finished" | "failed" | "budget_stopped";
    stopReason?: string | null;
    issuesInvestigated: number;
    proposalsCreated: number;
    summary?: string | null;
    error?: string | null;
  },
): Promise<void> {
  await mysql`
    UPDATE ops_agent_runs SET
      status = ${outcome.status}, finished_at = NOW(),
      stop_reason = ${outcome.stopReason ?? null},
      issues_investigated = ${outcome.issuesInvestigated},
      proposals_created = ${outcome.proposalsCreated},
      summary = ${outcome.summary ?? null}, error = ${outcome.error ?? null}
    WHERE id = ${runId}
  `;
}

/**
 * The daily digest, built from tables (no model) and posted by the nightly
 * reconcile. Skipped when nothing happened since the last one and nobody
 * is being waited on.
 */
export async function postDailyDigest(universe: string): Promise<boolean> {
  const raw = await getRawSettings(universe);
  const since =
    raw["digest.last_posted_at"] ||
    (
      await mysql<{ t: string }>`
        SELECT DATE_FORMAT(NOW() - INTERVAL 1 DAY, '%Y-%m-%d %H:%i:%s') AS t`
    )[0].t;

  const [counts, resolved, pending, queued, questions, budget, runRows] =
    await Promise.all([
      IssueStore.counts(universe),
      IssueStore.listResolvedSince(universe, since),
      ProposalStore.list({ universe, status: ["pending"] }),
      ProposalStore.list({ universe, status: ["queued"] }),
      IssueStore.list({ universe, status: "awaiting_human", limit: 200 }),
      getBudget(universe),
      mysql<{
        runs: number;
        investigated: number | null;
        proposals: number | null;
        cost: number | null;
        failed: number | null;
      }>`
        SELECT COUNT(*) AS runs, SUM(issues_investigated) AS investigated,
               SUM(proposals_created) AS proposals, SUM(cost_usd) AS cost,
               SUM(status = 'failed') AS failed
        FROM ops_agent_runs
        WHERE universe = ${universe} AND started_at >= ${since}`,
    ]);
  const runs = runRows[0];
  const asked = questions.rows.filter(
    (i) => !pending.some((p) => p.issueId === i.id),
  );
  const waitingLong = questions.rows.filter(
    (i) => i.lastAgentEventAt && ageMs(i.lastAgentEventAt) > 7 * 86400000,
  );
  const happened = resolved.length > 0 || Number(runs?.runs ?? 0) > 0;
  if (!happened && !pending.length && !asked.length) return false;

  const byPath: Record<string, number> = {};
  for (const r of resolved)
    byPath[r.resolutionPath ?? "?"] =
      (byPath[r.resolutionPath ?? "?"] ?? 0) + 1;

  const lines: string[] = ["*Ops digest*"];
  const kindLine = Object.entries(counts.byKind)
    .map(([k, n]) => `${k} ${n}`)
    .join(" · ");
  lines.push(`Open: ${kindLine || "nothing"}`);
  if (resolved.length) {
    lines.push(
      `Resolved since the last digest: ${resolved.length} (${Object.entries(
        byPath,
      )
        .map(([p, n]) => `${p} ${n}`)
        .join(", ")})`,
    );
  }
  if (Number(runs?.runs ?? 0) > 0) {
    lines.push(
      `Agent: investigated ${Number(runs.investigated ?? 0)}, proposed ${Number(runs.proposals ?? 0)}${Number(runs.failed ?? 0) ? `, ${runs.failed} failed run(s)` : ""}`,
    );
  }
  if (pending.length) {
    lines.push(`*Waiting for review* (<${proposalsUrl(universe)}|proposals>):`);
    for (const p of pending) lines.push(`• #${p.id} ${p.summary}`);
  }
  if (queued.length) lines.push(`Ready behind it: ${queued.length}`);
  if (asked.length) {
    lines.push("*Questions for a person:*");
    for (const i of asked.slice(0, 5))
      lines.push(`• <${issueUrl(universe, i.id)}|#${i.id}> ${i.title}`);
  }
  if (waitingLong.length)
    lines.push(
      `${waitingLong.length} issue(s) have waited on a person for over 7 days.`,
    );
  lines.push(
    `Spend: $${Number(runs?.cost ?? 0).toFixed(2)} since the last digest · $${budget.monthSpentUsd.toFixed(2)} of $${budget.monthlyCapUsd.toFixed(0)} this month · <${agentAdminUrl()}|dashboard>`,
  );
  const posted = await postOpsMessage(lines.join("\n"));
  await mysql`
    INSERT INTO ops_settings (\`key\`, value, updated_at)
    VALUES (${`${universe}:digest.last_posted_at`},
            DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
  `;
  return posted != null;
}

// ─── Dashboard queries ────────────────────────────────────────────────

export async function listRuns(universe: string, limit = 50) {
  return mysql`
    SELECT * FROM ops_agent_runs WHERE universe = ${universe}
    ORDER BY id DESC LIMIT ${limit}
  `;
}

export async function getRunSteps(runId: number) {
  return mysql`
    SELECT * FROM ops_agent_run_steps WHERE run_id = ${runId} ORDER BY seq, id
  `;
}

export async function outcomeStats(universe: string) {
  return mysql<{ path: string | null; n: number; avg_hours: number | null }>`
    SELECT resolution_path AS path, COUNT(*) AS n,
           AVG(TIMESTAMPDIFF(MINUTE, first_seen_at, resolved_at)) / 60 AS avg_hours
    FROM ops_issues
    WHERE universe = ${universe} AND resolved_at IS NOT NULL
      AND resolved_at >= NOW() - INTERVAL 90 DAY
    GROUP BY resolution_path
  `;
}

export async function reopenRate(universe: string) {
  const rows = await mysql<{ total: number; reopened: number }>`
    SELECT COUNT(*) AS total, SUM(reopen_count > 0) AS reopened
    FROM ops_issues WHERE universe = ${universe} AND resolved_at IS NOT NULL
  `;
  return {
    total: Number(rows[0]?.total ?? 0),
    reopened: Number(rows[0]?.reopened ?? 0),
  };
}
