"use server";

/*************************************************************************
 * Server actions for the ops pages (/investigations/issues, /proposals,
 * /admin/agent). Same rules as the ops MCP: UHERO internal staff can read,
 * comment, resolve, snooze and take issues; reviewers (devs, plus people on
 * the reviewer list) review proposals; devs can also dismiss issues and
 * change agent settings.
 *************************************************************************/
import { revalidatePath } from "next/cache";

import { userActor } from "@/core/ops/actors";
import { IssueStore } from "@/core/ops/issue-store";
import {
  assignIssue,
  commentOnIssue,
  dismissIssue,
  OpsError,
  reopenIssue,
  resolveIssue,
  snoozeIssue,
} from "@/core/ops/issues";
import { ProposalStore } from "@/core/ops/proposal-store";
import { reviewProposal } from "@/core/ops/proposals";
import {
  getBudget,
  getRunSteps,
  listRuns,
  outcomeStats,
  reopenRate,
} from "@/core/ops/runs";
import {
  createServiceToken,
  getAgentUserId,
  listServiceTokens,
  revokeServiceToken,
} from "@/core/ops/service-tokens";
import {
  canReview,
  getOpsSettings,
  getRawSettings,
  setOpsSetting,
  SETTING_KEYS,
} from "@/core/ops/settings";
import type { IssueKind, IssueStatus, ProposalStatus } from "@/core/ops/types";
import { getCurrentUserContext } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const INTERNAL = new Set(["internal", "admin", "dev"]);
const DEV = new Set(["admin", "dev"]);

async function requireInternal() {
  const ctx = await getCurrentUserContext();
  if (!INTERNAL.has(ctx.role)) throw new AuthorizationError("UHERO staff only");
  return ctx;
}

async function requireDev() {
  const ctx = await getCurrentUserContext();
  if (!DEV.has(ctx.role)) throw new AuthorizationError("Dev role required");
  return ctx;
}

/** Devs, admins, and people on the ops reviewer list. */
async function requireReviewer(universe = "UHERO") {
  const ctx = await requireInternal();
  const ok = await canReview(universe, {
    userId: Number(ctx.userId),
    role: ctx.role,
  });
  if (!ok) throw new AuthorizationError("Reviewers only");
  return ctx;
}

/** For the proposals page: may this user approve and reject? */
export async function canReviewProposals(universe = "UHERO"): Promise<boolean> {
  const ctx = await getCurrentUserContext();
  return canReview(universe.toUpperCase(), {
    userId: Number(ctx.userId),
    role: ctx.role,
  });
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function run(
  fn: () => Promise<string | void>,
  revalidate?: string,
): Promise<Result> {
  try {
    const message = (await fn()) ?? undefined;
    if (revalidate) revalidatePath(revalidate, "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof OpsError || e instanceof AuthorizationError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

const serialize = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ─── Issues ───────────────────────────────────────────────────────────

export async function listOpsIssues(opts: {
  universe: string;
  status?: IssueStatus[];
  kind?: IssueKind[];
  search?: string;
  page?: number;
}) {
  await requireInternal();
  const perPage = 50;
  const page = Math.max(1, opts.page ?? 1);
  const res = await IssueStore.list({
    universe: opts.universe.toUpperCase(),
    status: opts.status?.length
      ? opts.status
      : ["open", "investigating", "awaiting_human", "resolving"],
    kind: opts.kind,
    search: opts.search,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  const counts = await IssueStore.counts(opts.universe.toUpperCase());
  return serialize({ ...res, counts, page, perPage });
}

export async function getOpsIssue(id: number) {
  await requireInternal();
  const issue = await IssueStore.getById(id);
  if (!issue) return null;
  const [events, proposals] = await Promise.all([
    IssueStore.listEvents(id),
    ProposalStore.list({ universe: issue.universe, issueId: id, limit: 50 }),
  ]);
  return serialize({ issue, events, proposals });
}

export async function commentOnIssueAction(id: number, body: string) {
  const ctx = await requireInternal();
  return run(async () => {
    await commentOnIssue(
      id,
      await userActor(ctx.userId, "ui"),
      body,
      "comment",
    );
  });
}

export async function resolveIssueAction(id: number, note: string) {
  const ctx = await requireInternal();
  return run(async () => {
    const r = await resolveIssue(
      id,
      await userActor(ctx.userId, "ui"),
      note || null,
    );
    if (r.state === "resolved") return "Resolved: the condition is gone.";
    if (r.state === "already") return "Already resolved.";
    if (r.state === "pending") return r.message;
    throw new OpsError(r.message);
  });
}

export async function snoozeIssueAction(
  id: number,
  days: number,
  reason: string,
) {
  const ctx = await requireInternal();
  return run(async () => {
    await snoozeIssue(id, await userActor(ctx.userId, "ui"), days, reason);
  });
}

export async function assignIssueAction(id: number, take: boolean) {
  const ctx = await requireInternal();
  return run(async () => {
    await assignIssue(
      id,
      await userActor(ctx.userId, "ui"),
      take ? Number(ctx.userId) : null,
    );
  });
}

export async function dismissIssueAction(id: number, reason: string) {
  const ctx = await requireDev();
  return run(async () => {
    await dismissIssue(id, await userActor(ctx.userId, "ui"), reason);
  });
}

export async function reopenIssueAction(id: number, reason: string) {
  const ctx = await requireDev();
  return run(async () => {
    await reopenIssue(id, await userActor(ctx.userId, "ui"), reason || null);
  });
}

// ─── Proposals ────────────────────────────────────────────────────────

export async function listOpsProposals(
  universe: string,
  status?: ProposalStatus[],
) {
  await requireInternal();
  const rows = await ProposalStore.list({
    universe: universe.toUpperCase(),
    status: status?.length ? status : ["pending", "queued"],
    limit: 200,
  });
  return serialize(rows);
}

export async function countPendingProposals(universe: string): Promise<number> {
  try {
    const rows = await ProposalStore.list({
      universe: universe.toUpperCase(),
      status: ["pending"],
    });
    return rows.length;
  } catch {
    return 0; // ops tables not migrated yet
  }
}

export async function reviewProposalAction(
  id: number,
  decision: "approve" | "reject",
  note: string,
) {
  const ctx = await requireReviewer();
  return run(async () => {
    const p = await reviewProposal(
      id,
      await userActor(ctx.userId, "ui"),
      decision,
      note || null,
    );
    return decision === "approve"
      ? `Proposal #${p.id} approved; applying.`
      : `Proposal #${p.id} rejected.`;
  });
}

// ─── Agent admin ──────────────────────────────────────────────────────

export async function getAgentDashboard(universe = "UHERO") {
  await requireDev();
  const [
    settings,
    raw,
    budget,
    runs,
    tokens,
    stats,
    typeStats,
    outcomes,
    reopen,
    counts,
  ] = await Promise.all([
    getOpsSettings(universe),
    getRawSettings(universe),
    getBudget(universe),
    listRuns(universe, 60),
    listServiceTokens(),
    ProposalStore.reviewStats(universe),
    getAgentUserId().then((id) => ProposalStore.changeTypeStats(universe, id)),
    outcomeStats(universe),
    reopenRate(universe),
    IssueStore.counts(universe),
  ]);
  return serialize({
    settings,
    lastPollAt: raw["agent.last_poll_at"] || null,
    budget,
    runs,
    tokens,
    stats,
    typeStats,
    outcomes,
    reopen,
    counts,
  });
}

export async function getAgentRunSteps(runId: number) {
  await requireDev();
  return serialize(await getRunSteps(runId));
}

export async function setOpsSettingAction(
  name: string,
  value: string,
  universe = "UHERO",
) {
  const ctx = await requireDev();
  return run(async () => {
    if (!SETTING_KEYS.includes(name))
      throw new OpsError(`Unknown setting ${name}`);
    try {
      await setOpsSetting(universe, name, value, Number(ctx.userId));
    } catch (e) {
      throw new OpsError(e instanceof Error ? e.message : String(e));
    }
  }, "/admin/agent");
}

export async function createServiceTokenAction(name: string) {
  const ctx = await requireDev();
  const { id, token } = await createServiceToken(
    name || "ops agent",
    Number(ctx.userId),
  );
  revalidatePath("/admin/agent");
  return { id, token };
}

export async function revokeServiceTokenAction(id: number) {
  await requireDev();
  return run(async () => {
    await revokeServiceToken(id);
  }, "/admin/agent");
}
