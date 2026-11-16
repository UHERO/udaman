/*************************************************************************
 * Ops proposals: changes that need a reviewer's approval, in one queue.
 *
 * Queue rules (docs/2026-11-13-ops-agent-design.md, "Proposal queue"):
 *   - one `pending` (posted) proposal at a time (setting); the rest wait
 *     as `queued` and are promoted as soon as the active one is reviewed
 *   - a group with the same fix is ONE proposal with many targets
 *   - order: errors before metadata, then severity, group size, age
 *   - a proposal is withdrawn when its issue is resolved another way, and
 *     goes stale when a target changes; both are re-checked on promotion,
 *     whenever an issue resolves, and nightly (with a fresh dry run)
 *   - `before` is always read by the server, never taken from the caller
 *************************************************************************/

import crypto from "node:crypto";

import LoaderCollection from "@catalog/collections/loader-collection";
import type { Universe } from "@catalog/types/shared";
import { mysql, rawQuery } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";
import { enqueueOpsApplyProposal } from "@/core/workers/enqueue";

import {
  applyLoaderCreate,
  applyLoaderDisable,
  applyLoaderUpdate,
  applyMeasurementMetadata,
  applySeriesMetadata,
  applyUnquarantine,
  currentLoaderState,
  currentMeasurementState,
  currentSeriesState,
  currentTargetState,
  LOADER_FIELDS,
  MEASUREMENT_METADATA_PROPS,
  requestReload,
  SERIES_METADATA_COLUMNS,
  stateMatches,
} from "./changes";
import { dryRunLoad, type DryRunResult } from "./dry-run";
import { IssueStore } from "./issue-store";
import { OpsError } from "./issues";
import { ProposalStore } from "./proposal-store";
import {
  agentEvalRefusal,
  changeTypeFor,
  laneFor,
  type MetadataBasis,
} from "./rules";
import { getAgentUserId } from "./service-tokens";
import { canReview, getOpsSettings } from "./settings";
import {
  closeProposalMessage,
  postIssueReply,
  postProposal,
} from "./slack-sync";
import {
  SYSTEM_ACTOR,
  type Actor,
  type MetadataField,
  type ProposalKind,
  type ProposalRow,
  type ProposalTarget,
  type ResolutionPath,
  type TargetType,
} from "./types";

const log = createLogger("ops.proposals");

/** Dry runs per proposal; bigger groups are spot-checked. */
const MAX_DRY_RUNS = 12;

export { changeTypeFor, laneFor, type MetadataBasis } from "./rules";

export interface ProposalInput {
  universe: string;
  issueId: number | null;
  kind: ProposalKind;
  summary: string;
  evidence: string;
  /** For metadata kinds: where the values came from (drives autonomy). */
  basis?: MetadataBasis;
  targets: Array<{
    targetType: TargetType;
    targetId: number;
    issueId?: number | null;
    after: Record<string, unknown>;
  }>;
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

// ─── Validation ───────────────────────────────────────────────────────

const LOOKUP_TABLES: Partial<Record<MetadataField, string>> = {
  source_id: "sources",
  unit_id: "units",
  source_detail_id: "source_details",
  geography_id: "geographies",
};

async function checkLookupValue(k: string, v: unknown): Promise<void> {
  const table = LOOKUP_TABLES[k as MetadataField];
  if (!table || v == null || v === "") return;
  const rows = await rawQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM \`${table}\` WHERE id = ?`,
    [Number(v)],
  );
  if (!Number(rows[0]?.n ?? 0))
    throw new OpsError(`${k}=${v}: no such row in ${table}`);
}

async function validateTarget(
  kind: ProposalKind,
  universe: string,
  t: ProposalInput["targets"][number],
  actor: Actor,
): Promise<Record<string, unknown>> {
  if (actor.type === "agent" && t.after.eval != null) {
    const refusal = agentEvalRefusal(String(t.after.eval));
    if (refusal) throw new OpsError(refusal);
  }
  if (kind === "measurement_metadata") {
    if (t.targetType !== "measurement")
      throw new OpsError("measurement_metadata targets must be measurements");
    const before = await currentMeasurementState(t.targetId);
    if (before.universe !== universe)
      throw new OpsError(`Measurement ${t.targetId} is not in ${universe}`);
    if (!Object.keys(t.after).length)
      throw new OpsError("A metadata target needs at least one field");
    for (const [k, v] of Object.entries(t.after)) {
      if (!(k in MEASUREMENT_METADATA_PROPS))
        throw new OpsError(
          `Not a measurement metadata field: ${k} (allowed: ${Object.keys(MEASUREMENT_METADATA_PROPS).join(", ")})`,
        );
      await checkLookupValue(k, v);
    }
    return Object.fromEntries(Object.keys(t.after).map((k) => [k, before[k]]));
  }
  if (kind === "series_metadata") {
    if (t.targetType !== "series")
      throw new OpsError("series_metadata targets must be series");
    const before = await currentSeriesState(t.targetId);
    if (before.universe !== universe)
      throw new OpsError(`Series ${t.targetId} is not in ${universe}`);
    for (const [k, v] of Object.entries(t.after)) {
      if (!(k in SERIES_METADATA_COLUMNS))
        throw new OpsError(`Not an editable metadata field: ${k}`);
      await checkLookupValue(k, v);
    }
    return Object.fromEntries(Object.keys(t.after).map((k) => [k, before[k]]));
  }
  if (kind === "unquarantine") {
    const before = await currentSeriesState(t.targetId);
    if (!before.quarantined)
      throw new OpsError(`Series ${t.targetId} is not quarantined`);
    t.after = { quarantined: false };
    return { quarantined: true };
  }
  if (kind === "loader_create") {
    if (t.targetType !== "series")
      throw new OpsError("loader_create targets the series");
    await currentSeriesState(t.targetId);
    if (!t.after.eval) throw new OpsError("loader_create needs after.eval");
    await LoaderCollection.checkEval(String(t.after.eval), t.targetId);
    return {};
  }
  // loader_update / loader_disable / reload
  if (t.targetType !== "loader")
    throw new OpsError(`${kind} targets must be loaders`);
  const before = await currentLoaderState(t.targetId);
  if (before.universe !== universe)
    throw new OpsError(`Loader ${t.targetId} is not in ${universe}`);
  if (kind === "loader_disable") {
    t.after = { disabled: true };
    return { disabled: before.disabled };
  }
  if (kind === "reload") {
    t.after = {};
    return { eval: before.eval };
  }
  for (const k of Object.keys(t.after)) {
    if (!(LOADER_FIELDS as readonly string[]).includes(k) || k === "disabled")
      throw new OpsError(`Not an editable loader field: ${k}`);
  }
  if (t.after.eval) {
    await LoaderCollection.checkEval(
      String(t.after.eval),
      Number(before.seriesId),
    );
  }
  // Always include eval in `before`, so an edit to it since makes this stale.
  const keys = new Set([...Object.keys(t.after), "eval"]);
  return Object.fromEntries([...keys].map((k) => [k, before[k]]));
}

async function dryRunsFor(
  kind: ProposalKind,
  targets: ProposalTarget[],
): Promise<
  Array<{
    targetId: number;
    result: DryRunResult | { ok: false; error: string };
  }>
> {
  if (!["loader_update", "loader_create", "reload"].includes(kind)) return [];
  const out = [];
  for (const t of targets.slice(0, MAX_DRY_RUNS)) {
    try {
      const result =
        kind === "loader_create"
          ? await dryRunLoad({
              seriesId: t.targetId,
              eval: String(t.after.eval),
              scale: t.after.scale != null ? Number(t.after.scale) : 1,
            })
          : await dryRunLoad({
              loaderId: t.targetId,
              eval: t.after.eval != null ? String(t.after.eval) : undefined,
              scale: t.after.scale != null ? Number(t.after.scale) : undefined,
            });
      out.push({ targetId: t.targetId, result });
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

// ─── Create ───────────────────────────────────────────────────────────

export type CreateOutcome =
  | { state: "queued" | "pending" | "existing"; proposal: ProposalRow }
  | { state: "applied"; proposal: ProposalRow; result: unknown };

export async function createProposal(
  actor: Actor,
  input: ProposalInput,
): Promise<CreateOutcome> {
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
    const before = await validateTarget(input.kind, input.universe, t, actor);
    targets.push({
      targetType: t.targetType,
      targetId: t.targetId,
      issueId: t.issueId ?? null,
      before,
      after: t.after,
    });
  }

  const contentHash = hashOf(input.kind, targets);
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

  const dryRuns = await dryRunsFor(input.kind, targets);
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
    kind: input.kind,
    lane: laneFor(input.kind),
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
      kind: input.kind,
    });
    await IssueStore.update(id, { status: "awaiting_human", owner: "human" });
  }

  // Autonomy: the agent applies directly when its level for this change
  // type allows. Metadata writes only ever fill empty fields directly.
  if (actor.type === "agent") {
    const settings = await getOpsSettings(input.universe);
    const level = settings.autonomy[changeTypeFor(input.kind, input.basis)];
    const fillsOnly =
      !["series_metadata", "measurement_metadata"].includes(input.kind) ||
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
  }

  await promoteQueue(input.universe);
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

/** Fill the active slots from the queue, posting to Slack. */
export function promoteQueue(universe: string): Promise<void> {
  return serial(() => promoteQueueNow(universe));
}

async function promoteQueueNow(universe: string): Promise<void> {
  const settings = await getOpsSettings(universe);
  const pending = await ProposalStore.list({ universe, status: ["pending"] });
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
  if (p.kind === "loader_create") return true; // nothing to compare against
  for (const t of p.targets) {
    const current = await currentTargetState(t.targetType, t.targetId).catch(
      () => null,
    );
    if (!current || !stateMatches(current, t.before)) {
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
    const runs = await dryRunsFor(p.kind, p.targets);
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
        {
          proposalId: p.id,
          decision,
        },
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
      {
        proposalId: p.id,
        decision,
      },
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
      const current =
        p.kind === "loader_create"
          ? {}
          : await currentTargetState(t.targetType, t.targetId);
      if (!stateMatches(current, t.before)) {
        results.push({
          targetType: t.targetType,
          targetId: t.targetId,
          status: "stale",
        });
        continue;
      }
      switch (p.kind) {
        case "loader_update":
          await applyLoaderUpdate(t.targetId, t.after, actor, issueId);
          await requestReload(t.targetId, actor, issueId);
          break;
        case "loader_disable":
          await applyLoaderDisable(t.targetId, actor, issueId);
          break;
        case "loader_create": {
          const s = await currentSeriesState(t.targetId);
          const created = await applyLoaderCreate(
            t.targetId,
            s.universe as Universe,
            t.after,
            actor,
            issueId,
          );
          await requestReload(created.loaderId, actor, issueId);
          break;
        }
        case "reload":
          await requestReload(t.targetId, actor, issueId);
          break;
        case "series_metadata":
          await applySeriesMetadata(
            t.targetId,
            t.after,
            actor,
            issueId,
            credit,
          );
          break;
        case "measurement_metadata":
          await applyMeasurementMetadata(
            t.targetId,
            t.after,
            actor,
            issueId,
            credit,
          );
          break;
        case "unquarantine":
          await applyUnquarantine(t.targetId, actor);
          break;
      }
      // Loader kinds verify through the reload; mark those issues "resolving".
      if (
        issueId &&
        ["loader_update", "loader_create", "reload"].includes(p.kind)
      ) {
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
