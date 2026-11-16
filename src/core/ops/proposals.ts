/*************************************************************************
 * Ops proposals: changes that wait for a reviewer, and the one code path
 * that applies a change, whether it was proposed or made directly.
 *
 * What a change is comes from the change registry (./change-registry):
 * its schema, snapshot, validation, dry run and apply. This file is the
 * workflow around it.
 *
 * Queue rules (docs/2026-11-13-ops-agent-design.md, "Proposal queue"):
 *   - the agent's proposals are shown one at a time (setting); the rest
 *     wait as `queued` and are promoted as soon as the active one is
 *     reviewed. A person's proposal is shown at once: the throttle is
 *     there to protect reviewers from the agent, not from colleagues.
 *   - a group with the same fix is ONE proposal with many targets
 *   - order: errors before metadata, then severity, group size, age
 *   - a proposal is withdrawn when its issue is resolved another way, and
 *     goes stale when a target changes; both are re-checked on promotion,
 *     whenever an issue resolves, and nightly (with a fresh dry run)
 *   - `before` is always read by the server, never taken from the caller
 *************************************************************************/

import crypto from "node:crypto";

import { mysql } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";
import { enqueueOpsApplyProposal } from "@/core/workers/enqueue";

import { getChangeKind, type ChangeKind } from "./change-kinds";
import type { DryRunResult } from "./dry-run";
import { IssueStore } from "./issue-store";
import { OpsError } from "./issues";
import { ProposalStore } from "./proposal-store";
import { stateMatches, type MetadataBasis } from "./rules";
import { getAgentUserId } from "./service-tokens";
import { canReview, getOpsSettings } from "./settings";
import {
  closeProposalMessage,
  postIssueReply,
  postProposal,
} from "./slack-sync";
import {
  parseJson,
  SYSTEM_ACTOR,
  type Actor,
  type ProposalRow,
  type ProposalTarget,
  type ResolutionPath,
} from "./types";

const log = createLogger("ops.proposals");

/** Dry runs per proposal; bigger groups are spot-checked. */
const MAX_DRY_RUNS = 12;

export { type MetadataBasis } from "./rules";

export interface ProposalInput {
  universe: string;
  issueId: number | null;
  /** A kind from the change registry. */
  kind: string;
  summary: string;
  evidence: string;
  /** For metadata kinds: where the values came from (drives autonomy). */
  basis?: MetadataBasis;
  targets: Array<{
    targetId: number;
    issueId?: number | null;
    after: unknown;
  }>;
}

function kindOrThrow(kind: string): ChangeKind {
  try {
    return getChangeKind(kind);
  } catch (e) {
    throw new OpsError(e instanceof Error ? e.message : String(e));
  }
}

/** Parse `after` against the kind's schema; schema errors become OpsErrors. */
function parseAfter(def: ChangeKind, after: unknown): Record<string, unknown> {
  const parsed = def.afterSchema.safeParse(after ?? {});
  if (!parsed.success) {
    const why = parsed.error.issues
      .map((i) => `${i.path.join(".") || "after"}: ${i.message}`)
      .join("; ");
    throw new OpsError(`${def.kind}: ${why}`);
  }
  return parsed.data;
}

/**
 * Schema, current state and the kind's own checks for one target. Used the
 * same way for a proposal and for a direct edit.
 */
async function prepareTarget(
  def: ChangeKind,
  universe: string,
  actor: Actor,
  t: { targetId: number; after: unknown },
): Promise<{
  after: Record<string, unknown>;
  before: Record<string, unknown>;
}> {
  const after = parseAfter(def, t.after);
  const before = await def.snapshot({ targetId: t.targetId, after }, universe);
  await def.validate?.(
    { targetId: t.targetId, after, before },
    { universe, actor },
  );
  return { after, before };
}

function hashOf(kind: string, targets: ProposalTarget[]): string {
  const canon = targets
    .map((t) => ({
      t: t.targetType,
      id: t.targetId,
      after: Object.fromEntries(
        Object.entries(t.after).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }))
    .sort((a, b) => a.t.localeCompare(b.t) || a.id - b.id);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ kind, canon }))
    .digest("hex");
}

type DryRuns = Array<{
  targetId: number;
  result: DryRunResult | { ok: false; error: string };
}>;

async function dryRunsFor(
  def: ChangeKind,
  targets: ProposalTarget[],
): Promise<DryRuns> {
  if (!def.dryRun) return [];
  const out: DryRuns = [];
  for (const t of targets.slice(0, MAX_DRY_RUNS)) {
    try {
      out.push({ targetId: t.targetId, result: await def.dryRun(t) });
    } catch (e) {
      out.push({
        targetId: t.targetId,
        result: {
          ok: false as const,
          error: e instanceof Error ? e.message : String(e),
        },
      });
    }
  }
  return out;
}

// ─── Direct edits ─────────────────────────────────────────────────────

/**
 * Apply a change right away, without review: a dev's direct edit tool.
 * Runs the same schema, validation and `apply` as an approved proposal.
 */
export async function applyDirect(
  actor: Actor,
  input: {
    universe: string;
    kind: string;
    targetId: number;
    after: unknown;
    issueId: number | null;
  },
): Promise<{
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}> {
  const def = kindOrThrow(input.kind);
  const { after, before } = await prepareTarget(
    def,
    input.universe,
    actor,
    input,
  );
  await def.apply(
    { targetId: input.targetId, after },
    { universe: input.universe, actor, issueId: input.issueId },
  );
  if (input.issueId && def.verifiesByReload) {
    await IssueStore.update(input.issueId, { status: "resolving" });
    await IssueStore.addEvent(
      input.issueId,
      actor,
      "resolution_claimed",
      `${def.kind} applied directly; verifying with a reload.`,
    );
  }
  return { before, after };
}

// ─── Create ───────────────────────────────────────────────────────────

export type CreateOutcome =
  | { state: "queued" | "pending" | "existing"; proposal: ProposalRow }
  | { state: "applied"; proposal: ProposalRow; result: unknown };

export async function createProposal(
  actor: Actor,
  input: ProposalInput,
): Promise<CreateOutcome> {
  const def = kindOrThrow(input.kind);
  if (!input.targets.length)
    throw new OpsError("A proposal needs at least one target");
  if (input.targets.length > 200)
    throw new OpsError("At most 200 targets per proposal");
  if (!input.summary.trim()) throw new OpsError("A proposal needs a summary");

  const issue = input.issueId ? await IssueStore.getById(input.issueId) : null;
  if (input.issueId && !issue)
    throw new OpsError(`Issue ${input.issueId} not found`);

  const targets: ProposalTarget[] = [];
  for (const t of input.targets) {
    const { after, before } = await prepareTarget(
      def,
      input.universe,
      actor,
      t,
    );
    targets.push({
      targetType: def.targetType,
      targetId: t.targetId,
      issueId: t.issueId ?? null,
      before,
      after,
    });
  }

  const contentHash = hashOf(def.kind, targets);
  const live = await mysql<{ id: number }>`
    SELECT id FROM ops_proposals
    WHERE universe = ${input.universe} AND content_hash = ${contentHash}
      AND status IN ('queued', 'pending', 'approved')
    ORDER BY id DESC LIMIT 1
  `;
  if (live[0]) {
    return {
      state: "existing",
      proposal: (await ProposalStore.getById(Number(live[0].id)))!,
    };
  }

  const dryRuns = await dryRunsFor(def, targets);
  const failedRun = dryRuns.find((d) => !d.result.ok);
  if (failedRun) {
    throw new OpsError(
      `Dry run failed for target ${failedRun.targetId}: ${"error" in failedRun.result ? failedRun.result.error : "unknown"}. Fix the change before proposing it.`,
    );
  }

  const severityRank = { high: 3, normal: 2, low: 1 }[
    issue?.severity ?? "normal"
  ];
  const proposal = await ProposalStore.insert({
    universe: input.universe,
    issueId: input.issueId,
    groupKey: issue?.groupKey ?? null,
    kind: def.kind,
    lane: def.workClass,
    summary: input.summary,
    targets,
    evidence: input.evidence,
    dryRun: { basis: input.basis ?? null, runs: dryRuns },
    contentHash,
    priority: severityRank * 1000 + Math.min(targets.length, 999),
    daysPending: 1,
    createdByUserId: actor.userId,
    slackChannel: null,
    slackTs: null,
  });

  for (const id of issueIdsOf(proposal)) {
    await IssueStore.addEvent(id, actor, "proposal_created", input.summary, {
      proposalId: proposal.id,
      kind: def.kind,
    });
    await IssueStore.update(id, { status: "awaiting_human", owner: "human" });
  }

  if (actor.type === "agent") {
    // Autonomy: the agent applies directly when its level for this change
    // type allows. Fill-only kinds never overwrite a value unreviewed.
    const settings = await getOpsSettings(input.universe);
    const level = settings.autonomy[def.changeType(input.basis)];
    const fillsOnly =
      !def.autonomyFillsOnly ||
      targets.every((t) =>
        Object.values(t.before).every((v) => v == null || v === ""),
      );
    if (level >= 1 && fillsOnly) {
      await ProposalStore.setStatus(proposal.id, "approved", {
        reviewedVia: `autonomy:${level}`,
        reviewNote: `Applied directly at autonomy level ${level}`,
        markReviewed: true,
      });
      const result = await applyProposal(proposal.id, { silent: level >= 2 });
      return {
        state: "applied",
        proposal: (await ProposalStore.getById(proposal.id))!,
        result,
      };
    }
    await promoteQueue(input.universe);
  } else {
    // A person's proposal goes straight to the reviewers.
    await postProposal(proposal);
  }

  const fresh = (await ProposalStore.getById(proposal.id))!;
  return {
    state: fresh.status === "pending" ? "pending" : "queued",
    proposal: fresh,
  };
}

function issueIdsOf(p: ProposalRow): number[] {
  const ids = new Set<number>();
  if (p.issueId) ids.add(p.issueId);
  for (const t of p.targets) if (t.issueId) ids.add(t.issueId);
  return [...ids];
}

// ─── Queue ────────────────────────────────────────────────────────────

/**
 * Queue changes run one at a time in this process, so two events landing
 * together (an apply finishing while an issue resolves) can't both fill
 * the same active slot.
 */
let queueChain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queueChain.then(fn, fn);
  queueChain = next.catch(() => undefined);
  return next;
}

/** Fill the agent's active slots from its queue, posting to Slack. */
export function promoteQueue(universe: string): Promise<void> {
  return serial(() => promoteQueueNow(universe));
}

async function promoteQueueNow(universe: string): Promise<void> {
  const settings = await getOpsSettings(universe);
  const agentId = await getAgentUserId();
  // Only the agent's proposals take a slot; people's are shown at once.
  const pending = (
    await ProposalStore.list({ universe, status: ["pending"] })
  ).filter((p) => p.createdByUserId === agentId);
  let free = settings.activeSlots - pending.length;
  if (free <= 0) return;
  // ProposalStore.list orders the queue: errors, then priority, then age.
  const queued = await ProposalStore.list({ universe, status: ["queued"] });
  for (const p of queued) {
    if (free <= 0) break;
    if (!(await stillApplicable(p))) continue;
    await postProposal(p);
    free--;
  }
}

async function withdraw(
  p: ProposalRow,
  status: "withdrawn" | "stale",
  note: string,
  opts: { reopenIssues: boolean },
): Promise<void> {
  await ProposalStore.setStatus(p.id, status, { reviewNote: note });
  await closeProposalMessage(
    p,
    `${status === "stale" ? "Stale" : "Withdrawn"}: ${note}`,
  );
  if (!opts.reopenIssues) return;
  // Hand the issues back to the agent, with the reason as new input.
  for (const id of issueIdsOf(p)) {
    const issue = await IssueStore.getById(id);
    if (!issue || ["resolved", "closed", "dismissed"].includes(issue.status))
      continue;
    await IssueStore.addEvent(
      id,
      SYSTEM_ACTOR,
      "proposal_withdrawn",
      `Proposal #${p.id} ${status}: ${note}`,
      { proposalId: p.id },
    );
    await IssueStore.update(id, { status: "open", owner: "agent" });
  }
}

/** Has this target changed since the proposal recorded its `before`? */
async function targetUnchanged(
  def: ChangeKind,
  universe: string,
  t: ProposalTarget,
): Promise<boolean> {
  const current = await def.snapshot(t, universe).catch(() => null);
  return current != null && stateMatches(current, t.before);
}

/**
 * Re-check a live proposal: its issues still open and its targets
 * unchanged. Withdraws it (or marks it stale) otherwise and returns false.
 */
async function stillApplicable(p: ProposalRow): Promise<boolean> {
  const issueIds = issueIdsOf(p);
  if (issueIds.length) {
    const issues = await IssueStore.getByIds(issueIds);
    if (
      issues.every((i) =>
        ["resolved", "closed", "dismissed"].includes(i.status),
      )
    ) {
      await withdraw(p, "withdrawn", "the issue was resolved another way.", {
        reopenIssues: false,
      });
      return false;
    }
  }
  const def = kindOrThrow(p.kind);
  for (const t of p.targets) {
    if (!(await targetUnchanged(def, p.universe, t))) {
      await withdraw(
        p,
        "stale",
        `${t.targetType} ${t.targetId} changed since this was proposed.`,
        { reopenIssues: true },
      );
      return false;
    }
  }
  return true;
}

/**
 * Keep the queue in step with the issues: withdraw proposals that no
 * longer apply and show the next one. Cheap (the buffer is a handful of
 * rows); called whenever an issue resolves and on every reconcile.
 */
export function syncQueue(universe: string): Promise<number> {
  return serial(async () => {
    const live = await ProposalStore.list({
      universe,
      status: ["queued", "pending"],
    });
    let dropped = 0;
    for (const p of live) if (!(await stillApplicable(p))) dropped++;
    await promoteQueueNow(universe);
    return dropped;
  });
}

/**
 * Nightly, after the batch: the same check plus a fresh dry run for
 * load-statement proposals. One that still applies stays where it is, on
 * the same Slack message; nothing is re-investigated because a day passed.
 */
export async function revalidateQueue(universe: string): Promise<{
  kept: number;
  dropped: number;
}> {
  const live = await ProposalStore.list({
    universe,
    status: ["queued", "pending"],
  });
  let kept = 0;
  let dropped = 0;
  for (const p of live) {
    if (!(await stillApplicable(p))) {
      dropped++;
      continue;
    }
    const runs = await dryRunsFor(kindOrThrow(p.kind), p.targets);
    if (runs.some((r) => !r.result.ok)) {
      await withdraw(p, "withdrawn", "the dry run no longer passes.", {
        reopenIssues: true,
      });
      dropped++;
      continue;
    }
    if (runs.length) {
      const basis = (p.dryRun as { basis?: string } | null)?.basis ?? null;
      await ProposalStore.setDryRun(p.id, { basis, runs });
    }
    kept++;
  }
  await promoteQueue(universe);
  return { kept, dropped };
}

// ─── Review + apply ───────────────────────────────────────────────────

export async function reviewProposal(
  proposalId: number,
  actor: Actor,
  decision: "approve" | "reject",
  note: string | null,
): Promise<ProposalRow> {
  const p = await ProposalStore.getById(proposalId);
  if (!p) throw new OpsError(`Proposal ${proposalId} not found`);
  if (!(await canReview(p.universe, actor)))
    throw new OpsError(
      "Only reviewers (devs, or people on the reviewer list) can review proposals",
    );
  if (!["queued", "pending"].includes(p.status)) {
    throw new OpsError(`Proposal ${proposalId} is ${p.status}, not reviewable`);
  }
  if (decision === "reject") {
    await ProposalStore.setStatus(p.id, "rejected", {
      reviewedByUserId: actor.userId,
      reviewedVia: actor.via,
      reviewNote: note,
      markReviewed: true,
    });
    for (const id of issueIdsOf(p)) {
      await IssueStore.addEvent(
        id,
        actor,
        "proposal_reviewed",
        note ?? "Rejected",
        { proposalId: p.id, decision },
      );
      await IssueStore.update(id, { status: "open", owner: "agent" });
    }
    await closeProposalMessage(
      p,
      `❌ Rejected by ${actor.email ?? "a reviewer"}${note ? `: ${note}` : ""}`,
    );
    await promoteQueue(p.universe);
    return (await ProposalStore.getById(p.id))!;
  }
  await ProposalStore.setStatus(p.id, "approved", {
    reviewedByUserId: actor.userId,
    reviewedVia: actor.via,
    reviewNote: note,
    markReviewed: true,
  });
  for (const id of issueIdsOf(p)) {
    await IssueStore.addEvent(
      id,
      actor,
      "proposal_reviewed",
      note ?? "Approved",
      { proposalId: p.id, decision },
    );
  }
  await closeProposalMessage(
    p,
    `✅ Approved by ${actor.email ?? "a reviewer"}; applying…`,
  );
  await enqueueOpsApplyProposal({ proposalId: p.id });
  return (await ProposalStore.getById(p.id))!;
}

interface TargetResult {
  targetType: string;
  targetId: number;
  status: "applied" | "stale" | "failed";
  message?: string;
}

/**
 * Apply an approved proposal (worker job, or inline for autonomy writes).
 * Each target gets its own stale check; a changed target is skipped and
 * reported rather than blocking the rest.
 */
export async function applyProposal(
  proposalId: number,
  opts: { silent?: boolean } = {},
): Promise<{ results: TargetResult[] }> {
  const p = await ProposalStore.getById(proposalId);
  if (!p) throw new OpsError(`Proposal ${proposalId} not found`);
  if (p.status !== "approved") {
    return { results: [] };
  }
  const def = kindOrThrow(p.kind);
  // Attribute the change to the reviewer (or the agent, for autonomy writes).
  const reviewerId = p.reviewedByUserId ?? p.createdByUserId;
  const reviewer = reviewerId
    ? (
        await mysql<{
          email: string;
          role: string;
        }>`SELECT email, role FROM users WHERE id = ${reviewerId} LIMIT 1`
      )[0]
    : undefined;
  const actor: Actor = {
    type: p.reviewedByUserId ? "user" : "agent",
    userId: reviewerId,
    email: reviewer?.email ?? null,
    role: reviewer?.role ?? "",
    via: p.reviewedByUserId
      ? ((p.reviewedVia as Actor["via"]) ?? "ui")
      : "agent",
  };

  // Credit agent-authored proposals as such, whoever approved them.
  const agentId = await getAgentUserId();
  const credit: ResolutionPath | undefined =
    p.createdByUserId != null && p.createdByUserId === agentId
      ? "agent_proposal"
      : undefined;

  const results: TargetResult[] = [];
  for (const t of p.targets) {
    const issueId = t.issueId ?? p.issueId;
    try {
      if (!(await targetUnchanged(def, p.universe, t))) {
        results.push({
          targetType: t.targetType,
          targetId: t.targetId,
          status: "stale",
        });
        continue;
      }
      await def.apply(t, { universe: p.universe, actor, issueId, credit });
      // Verified through the reload the change queued.
      if (issueId && def.verifiesByReload) {
        await IssueStore.update(issueId, {
          status: "resolving",
          owner: "agent",
        });
        await IssueStore.addEvent(
          issueId,
          actor,
          "resolution_claimed",
          `Proposal #${p.id} applied; verifying with a reload.`,
          { proposalId: p.id, ...(credit ? { path: credit } : {}) },
        );
      }
      results.push({
        targetType: t.targetType,
        targetId: t.targetId,
        status: "applied",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(
        { err: e, proposalId, target: t.targetId },
        "proposal target failed",
      );
      results.push({
        targetType: t.targetType,
        targetId: t.targetId,
        status: "failed",
        message,
      });
    }
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const status = applied
    ? "applied"
    : results.every((r) => r.status === "stale")
      ? "stale"
      : "failed";
  await ProposalStore.setStatus(p.id, status, {
    applyResult: results,
    markApplied: applied > 0,
  });

  const line = `${applied}/${results.length} applied${results.some((r) => r.status === "stale") ? `, ${results.filter((r) => r.status === "stale").length} stale (changed since proposed)` : ""}${results.some((r) => r.status === "failed") ? `, ${results.filter((r) => r.status === "failed").length} failed` : ""}`;
  for (const id of issueIdsOf(p)) {
    await IssueStore.addEvent(
      id,
      actor,
      "action_applied",
      `Proposal #${p.id}: ${line}`,
      { proposalId: p.id, results },
    );
    if (status !== "applied")
      await IssueStore.update(id, { status: "open", owner: "agent" });
  }
  if (!opts.silent) {
    await closeProposalMessage(
      p,
      `${status === "applied" ? "✅" : "⚠️"} ${line}`,
    );
    if (p.reviewedVia?.startsWith("autonomy") && p.issueId) {
      const issue = await IssueStore.getById(p.issueId);
      if (issue)
        await postIssueReply(
          issue,
          `🤖 Applied directly (autonomy level): ${p.summary}\n${line}`,
          { createThread: true },
        );
    }
  }
  await promoteQueue(p.universe);
  return { results };
}

// ─── Review record ────────────────────────────────────────────────────

export interface ChangeTypeStat {
  changeType: string;
  approved: number;
  rejected: number;
  failed: number;
  autoApplied: number;
  streak: number;
}

/**
 * Review record per change type for proposals the agent made: totals and
 * the current run of consecutive approvals that applied cleanly. This is
 * the evidence for raising (or lowering) an autonomy level.
 */
export async function changeTypeStats(
  universe: string,
): Promise<ChangeTypeStat[]> {
  const agentId = await getAgentUserId();
  if (agentId == null) return [];
  const rows = await mysql<{
    kind: string;
    status: string;
    dry_run: string | null;
    reviewed_via: string | null;
  }>`
    SELECT kind, status, dry_run, reviewed_via FROM ops_proposals
    WHERE universe = ${universe} AND created_by_user_id = ${agentId}
      AND status IN ('applied', 'failed', 'rejected')
    ORDER BY id
  `;
  const out = new Map<string, ChangeTypeStat>();
  for (const r of rows) {
    let type: string;
    try {
      const basis = parseJson<{ basis?: MetadataBasis }>(r.dry_run)?.basis;
      type = getChangeKind(r.kind).changeType(basis ?? undefined);
    } catch {
      continue; // a kind that no longer exists
    }
    const m = out.get(type) ?? {
      changeType: type,
      approved: 0,
      rejected: 0,
      failed: 0,
      autoApplied: 0,
      streak: 0,
    };
    if (r.reviewed_via?.startsWith("autonomy")) {
      m.autoApplied++;
      if (r.status === "failed") m.failed++;
    } else if (r.status === "applied") {
      m.approved++;
      m.streak++;
    } else {
      if (r.status === "rejected") m.rejected++;
      else m.failed++;
      m.streak = 0;
    }
    out.set(type, m);
  }
  return [...out.values()];
}
