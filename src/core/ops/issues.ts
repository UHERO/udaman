/*************************************************************************
 * Ops issue service. Every resolution path (agent, app UI, a person's own
 * Claude Code over the internal MCP servers, Slack) calls these functions, so they all
 * write the same events and get the same verification.
 *
 * Core rule: an issue is resolved when its condition is gone. A "resolve"
 * call is a request to check, never a switch.
 *************************************************************************/

import { mysql } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";
import { enqueueSeriesReload } from "@/core/workers/enqueue";

import { conditionStillPresent } from "./detectors";
import {
  fingerprintOf,
  IssueStore,
  NOW,
  type DetectedCondition,
} from "./issue-store";
import { getOpsSettings } from "./settings";
import { postIssueReply, refreshIssueHeadline } from "./slack-sync";
import type {
  Actor,
  IssueEventType,
  IssueRow,
  ResolutionPath,
  TargetType,
} from "./types";

const log = createLogger("ops.issues");

export class OpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpsError";
  }
}

const DEV_ROLES = new Set(["dev", "admin"]);
export const isDevActor = (a: Actor) =>
  a.type === "user" && DEV_ROLES.has(a.role);

async function mustGet(issueId: number): Promise<IssueRow> {
  const issue = await IssueStore.getById(issueId);
  if (!issue) throw new OpsError(`Issue ${issueId} not found`);
  return issue;
}

function pathFor(actor: Actor): ResolutionPath {
  if (actor.type === "agent") return "agent";
  if (actor.type === "system") return "condition_cleared";
  if (actor.via === "slack") return "user_slack";
  if (actor.via === "mcp") return "user_mcp";
  return "user_ui";
}

function who(actor: Actor): string {
  if (actor.type === "agent") return "the agent";
  if (actor.type === "system") return "the reconciler";
  return actor.email ?? `user ${actor.userId}`;
}

const VIA_LABEL: Record<string, string> = {
  ui: "the app",
  slack: "Slack",
  mcp: "Claude Code (MCP)",
  agent: "the agent",
  reconciler: "the reconciler",
  worker: "the worker",
};

/** Mark resolved, record the event, close out the Slack thread. */
export async function markResolved(
  issue: IssueRow,
  actor: Actor,
  path: ResolutionPath,
  note: string | null,
  eventType: IssueEventType,
): Promise<IssueRow> {
  await IssueStore.update(issue.id, {
    status: "resolved",
    owner: "none",
    resolved_at: NOW,
    resolution_path: path,
    resolved_by_user_id: actor.userId,
    resolution_note: note,
    last_checked_at: NOW,
  });
  await IssueStore.addEvent(issue.id, actor, eventType, note, { path });
  const updated = (await IssueStore.getById(issue.id))!;
  const how =
    path === "condition_cleared"
      ? "Condition cleared (no one claimed a fix)."
      : `Resolved via ${VIA_LABEL[actor.via] ?? actor.via} by ${who(actor)}.`;
  await postIssueReply(updated, `✅ ${how}${note ? `\n> ${note}` : ""}`);
  await refreshIssueHeadline(updated);
  // A proposal for an issue that got fixed another way is withdrawn, and
  // the next one in the queue is shown. Never blocks or fails the resolve.
  void import("./proposals")
    .then((m) => m.syncQueue(updated.universe))
    .catch((e) => log.warn({ err: e }, "queue sync after resolve failed"));
  return updated;
}

export type ResolveOutcome =
  | { state: "resolved"; issue: IssueRow }
  | { state: "pending"; issue: IssueRow; message: string }
  | { state: "rejected"; issue: IssueRow; message: string }
  | { state: "already"; issue: IssueRow };

/**
 * Ask for an issue to be resolved. Checks the condition:
 *   gone              → resolved
 *   load error stays  → reload queued, verified when the job finishes
 *                       (the agent needs autonomy for request_reload)
 *   otherwise         → rejected, with the reason recorded on the issue
 */
export async function resolveIssue(
  issueId: number,
  actor: Actor,
  note: string | null,
): Promise<ResolveOutcome> {
  const issue = await mustGet(issueId);
  if (["resolved", "closed"].includes(issue.status)) {
    return { state: "already", issue };
  }
  if (issue.kind === "agent_finding" && !note?.trim()) {
    throw new OpsError("Resolving a finding needs a note saying what was done");
  }
  await IssueStore.addEvent(issue.id, actor, "resolution_claimed", note);

  const present = await conditionStillPresent(issue);
  if (present === null || present === false) {
    const resolved = await markResolved(
      issue,
      actor,
      present === null ? "manual" : pathFor(actor),
      note,
      "verified_resolved",
    );
    return { state: "resolved", issue: resolved };
  }

  if (
    (issue.kind === "load_error" || issue.kind === "loader_lag") &&
    issue.subjectId != null
  ) {
    const settings = await getOpsSettings(issue.universe);
    if (actor.type === "agent" && settings.autonomy.request_reload === 0) {
      const message =
        "The loader still has an error. Reloading to verify needs approval at the current autonomy level; propose a `reload` instead.";
      await IssueStore.addEvent(issue.id, actor, "claim_rejected", message);
      return { state: "rejected", issue, message };
    }
    await enqueueSeriesReload({
      seriesId: Number(issue.detail?.seriesId ?? 0),
      loaderId: issue.subjectId,
      clearFirst: false,
      opsIssueId: issue.id,
    });
    await IssueStore.update(issue.id, { status: "resolving" });
    const message =
      "The loader's last error is still set, which is expected until it reloads. A reload is queued; the issue resolves if it succeeds.";
    await IssueStore.addEvent(issue.id, actor, "comment", message, {
      reloadQueued: true,
    });
    return {
      state: "pending",
      issue: (await IssueStore.getById(issue.id))!,
      message,
    };
  }

  const message = "The condition is still present, so the issue stays open.";
  await IssueStore.addEvent(issue.id, actor, "claim_rejected", message);
  return { state: "rejected", issue, message };
}

/** Called by the series-reload worker job when it carried an opsIssueId. */
export async function verifyAfterReload(
  issueId: number,
  reload: { status: string; message: string },
): Promise<void> {
  const issue = await IssueStore.getById(issueId);
  if (!issue || ["resolved", "closed", "dismissed"].includes(issue.status))
    return;
  const present = await conditionStillPresent(issue);
  const worker: Actor = {
    type: "system",
    userId: null,
    email: null,
    role: "system",
    via: "worker",
  };
  if (present === false) {
    // Credit whoever claimed it: the most recent resolution_claimed event.
    const events = await IssueStore.listEvents(issue.id);
    const claim = [...events]
      .reverse()
      .find((e) => e.type === "resolution_claimed");
    const claimant: Actor = claim
      ? {
          type: claim.actorType,
          userId: claim.actorUserId,
          email: claim.actorEmail,
          role: "",
          via: claim.via,
        }
      : worker;
    const claimedPath = claim?.payload?.path as ResolutionPath | undefined;
    await markResolved(
      issue,
      claimant,
      claim ? (claimedPath ?? pathFor(claimant)) : "condition_cleared",
      `Reload ${reload.status}: ${reload.message}`.slice(0, 1000),
      "verified_resolved",
    );
    return;
  }
  await IssueStore.update(issue.id, { status: "open", owner: "agent" });
  await IssueStore.addEvent(
    issue.id,
    worker,
    "claim_rejected",
    `Verification reload ${reload.status}: ${reload.message}`.slice(0, 2000),
  );
  log.info({ issueId }, "verification reload did not clear the condition");
}

export type CommentKind = "comment" | "diagnosis" | "question";

export async function commentOnIssue(
  issueId: number,
  actor: Actor,
  body: string,
  kind: CommentKind = "comment",
  opts: { slackTs?: string | null } = {},
): Promise<void> {
  const issue = await mustGet(issueId);
  if (!body.trim()) throw new OpsError("Comment body is empty");
  const added = await IssueStore.addEvent(
    issue.id,
    actor,
    kind,
    body,
    null,
    opts.slackTs ?? null,
  );
  if (added === null) return; // duplicate Slack delivery

  if (kind === "diagnosis") {
    await IssueStore.update(issue.id, { summary: body.slice(0, 60000) });
  }
  if (kind === "question") {
    await IssueStore.update(issue.id, {
      status: "awaiting_human",
      owner: "human",
    });
    const updated = (await IssueStore.getById(issue.id))!;
    await postIssueReply(updated, `🙋 *Question from the agent*\n${body}`, {
      createThread: true,
    });
    await refreshIssueHeadline(updated);
    return;
  }
  // The agent looked and left a note without proposing or asking: the
  // issue goes back on the list (it gets a second look after a while).
  if (actor.type === "agent" && issue.status === "investigating") {
    await IssueStore.update(issue.id, { status: "open" });
  }
  // A person answered: hand the issue back to the agent.
  if (actor.type === "user" && issue.status === "awaiting_human") {
    await IssueStore.update(issue.id, { status: "open", owner: "agent" });
  }
  // Mirror to Slack unless it came from there.
  if (actor.via !== "slack" && issue.slackTs) {
    const label = kind === "diagnosis" ? "Diagnosis" : "Comment";
    await postIssueReply(
      issue,
      `*${label} from ${who(actor)}* (${VIA_LABEL[actor.via] ?? actor.via})\n${body}`,
    );
  }
}

export async function snoozeIssue(
  issueId: number,
  actor: Actor,
  days: number,
  reason: string,
): Promise<void> {
  const issue = await mustGet(issueId);
  const d = Math.min(Math.max(Math.round(days), 1), 90);
  // HST wall-clock, so computed in SQL from NOW().
  await mysql`
    UPDATE ops_issues SET snoozed_until = NOW() + INTERVAL ${d} DAY,
      updated_at = NOW()
    WHERE id = ${issue.id}
  `;
  await IssueStore.addEvent(issue.id, actor, "snoozed", reason, { days: d });
}

export async function dismissIssue(
  issueId: number,
  actor: Actor,
  reason: string,
): Promise<void> {
  if (!isDevActor(actor)) throw new OpsError("Only devs can dismiss issues");
  if (!reason.trim()) throw new OpsError("Dismissing needs a reason");
  const issue = await mustGet(issueId);
  await IssueStore.update(issue.id, {
    status: "dismissed",
    owner: "none",
    dismissed_reason: reason.slice(0, 500),
  });
  await IssueStore.addEvent(issue.id, actor, "dismissed", reason);
  const updated = (await IssueStore.getById(issue.id))!;
  await postIssueReply(updated, `⚪ Dismissed by ${who(actor)}: ${reason}`);
  await refreshIssueHeadline(updated);
}

/** Assign to a person (they keep it until they unassign), or clear it. */
export async function assignIssue(
  issueId: number,
  actor: Actor,
  userId: number | null,
): Promise<void> {
  const issue = await mustGet(issueId);
  await IssueStore.update(issue.id, {
    assignee_user_id: userId,
    owner: userId ? "human" : "agent",
  });
  await IssueStore.addEvent(issue.id, actor, "assigned", null, {
    assigneeUserId: userId,
  });
}

/** Undo dismiss/snooze, or reopen a resolved issue by hand. */
export async function reopenIssue(
  issueId: number,
  actor: Actor,
  reason: string | null,
): Promise<void> {
  const issue = await mustGet(issueId);
  await IssueStore.update(issue.id, {
    status: "open",
    owner: "agent",
    snoozed_until: null,
    dismissed_reason: null,
    resolved_at: null,
    resolution_path: null,
    resolved_by_user_id: null,
    open_fingerprint: issue.fingerprint,
    reopen_count: issue.reopenCount + 1,
  });
  await IssueStore.addEvent(issue.id, actor, "reopened", reason);
}

/** A finding the detectors can't see (a code bug, suspicious values). */
export async function raiseFinding(
  actor: Actor,
  f: {
    universe: string;
    subjectType: string;
    subjectId: number | null;
    title: string;
    body: string;
  },
): Promise<IssueRow> {
  const slug = f.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
  const cond: DetectedCondition = {
    universe: f.universe,
    kind: "agent_finding",
    subjectType: f.subjectType,
    subjectId: f.subjectId,
    subjectField: slug,
    title: f.title,
    severity: "normal",
    detail: { signature: slug, raisedBy: actor.type },
  };
  const existing = await IssueStore.getByOpenFingerprint(fingerprintOf(cond));
  const issue = existing ?? (await IssueStore.insert(cond));
  await IssueStore.update(issue.id, { owner: "human" });
  await IssueStore.addEvent(issue.id, actor, "detected", f.body);
  return (await IssueStore.getById(issue.id))!;
}

/**
 * A change was made to a subject (a loader edited in the UI, metadata set
 * through ops). Record it on any live issue about that subject; metadata
 * issues are rechecked right away since the edit itself fixes them.
 *
 * Missing-metadata issues are about a measurement, but the fix may be made
 * on its series, so a series edit also rechecks its measurements' issues.
 */
export async function noteSubjectChange(
  subjectType: TargetType,
  subjectId: number,
  actor: Actor,
  description: string,
  payload: Record<string, unknown> | null = null,
  /** Overrides the path derived from the actor (e.g. "agent_proposal"). */
  resolutionPath?: ResolutionPath,
): Promise<void> {
  try {
    const issues = await IssueStore.findLiveBySubject(subjectType, subjectId);
    if (subjectType === "series") {
      const ms = await mysql<{ measurement_id: number }>`
        SELECT measurement_id FROM measurement_series WHERE series_id = ${subjectId}
      `;
      for (const m of ms) {
        issues.push(
          ...(await IssueStore.findLiveBySubject(
            "measurement",
            Number(m.measurement_id),
          )),
        );
      }
    }
    for (const issue of issues) {
      await IssueStore.addEvent(
        issue.id,
        actor,
        "action_applied",
        description,
        payload,
      );
      if (issue.kind === "missing_metadata") {
        const present = await conditionStillPresent(issue);
        if (present === false) {
          await markResolved(
            issue,
            actor,
            resolutionPath ?? pathFor(actor),
            description,
            "verified_resolved",
          );
        }
      }
    }
  } catch (e) {
    // Never let issue bookkeeping break the edit that triggered it.
    log.warn({ err: e, subjectType, subjectId }, "noteSubjectChange failed");
  }
}
