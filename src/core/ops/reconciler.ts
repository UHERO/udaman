/*************************************************************************
 * Ops reconciler (worker job, no model). Runs after the nightly batch and
 * hourly during the day:
 *   1. run each detector; insert new issues, touch ones still present
 *   2. resolve live issues whose condition is gone (crediting a claim if
 *      someone made one), and close out their Slack threads
 *   3. reopen a resolved issue that recurs within 30 days (same thread)
 *   4. close issues resolved > 14 days ago; lift expired snoozes
 *   5. missed-poll alert: the agent hasn't asked for work in 26h
 *   6. withdraw proposals that no longer apply and show the next one;
 *      nightly also re-runs their dry runs and posts the digest
 *************************************************************************/

import { hstToday, hstToInstant } from "@catalog/utils/time";
import { mysql, rawQuery } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";

import { DETECTORS } from "./detectors";
import {
  fingerprintOf,
  IssueStore,
  type DetectedCondition,
} from "./issue-store";
import { markResolved } from "./issues";
import { agentAdminUrl } from "./links";
import { revalidateQueue, syncQueue } from "./proposals";
import { postDailyDigest } from "./runs";
import { getOpsSettings, getRawSettings, setOpsSetting } from "./settings";
import {
  postIssueReply,
  postOpsMessage,
  refreshIssueHeadline,
} from "./slack-sync";
import {
  ACTIVE_DETECTOR_KINDS,
  SYSTEM_ACTOR,
  type Actor,
  type IssueRow,
  type ResolutionPath,
} from "./types";

const log = createLogger("ops.reconciler");

const REOPEN_WINDOW_DAYS = 30;
const CLOSE_AFTER_DAYS = 14;
/** A group at least this big makes its load errors high severity. */
const HIGH_SEVERITY_GROUP = 10;
const MISSED_RUN_HOURS = 26;

export interface ReconcileSummary {
  detected: Record<string, number>;
  created: number;
  reopened: number;
  cleared: number;
  closed: number;
  proposals?: { kept: number; dropped: number };
}

interface FingerprintRow {
  id: number;
  status: string;
  open_fingerprint: string;
  resolved_at: Date | string | null;
  severity: string;
  detail: string | null;
}

async function loadByFingerprint(
  universe: string,
  kind: string,
): Promise<Map<string, FingerprintRow>> {
  const rows = await mysql<FingerprintRow>`
    SELECT id, status, open_fingerprint, resolved_at, severity, detail
    FROM ops_issues
    WHERE universe = ${universe} AND kind = ${kind} AND open_fingerprint IS NOT NULL
  `;
  return new Map(rows.map((r) => [String(r.open_fingerprint), r]));
}

async function bulkTouch(ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    await rawQuery(
      `UPDATE ops_issues SET last_seen_at = NOW(), last_checked_at = NOW(),
         occurrence_count = occurrence_count + 1
       WHERE id IN (${chunk.map(() => "?").join(",")})`,
      chunk,
    );
  }
}

/** Credit the most recent claim, if there is one; otherwise "cleared". */
async function creditFor(
  issue: IssueRow,
): Promise<{ actor: Actor; path: ResolutionPath }> {
  const events = await IssueStore.listEvents(issue.id);
  // The latest claim-related event decides: a claim that was already
  // rejected (or superseded by a recurrence) earns no credit.
  const claim = [...events]
    .reverse()
    .find((e) =>
      [
        "resolution_claimed",
        "action_applied",
        "claim_rejected",
        "recurred",
        "reopened",
      ].includes(e.type),
    );
  if (
    claim &&
    ["resolution_claimed", "action_applied"].includes(claim.type) &&
    claim.actorType !== "system"
  ) {
    const actor: Actor = {
      type: claim.actorType,
      userId: claim.actorUserId,
      email: claim.actorEmail,
      role: "",
      via: claim.via,
    };
    const claimed = claim.payload?.path as ResolutionPath | undefined;
    const path: ResolutionPath = claimed
      ? claimed
      : actor.type === "agent"
        ? "agent"
        : actor.via === "slack"
          ? "user_slack"
          : actor.via === "mcp"
            ? "user_mcp"
            : "user_ui";
    return { actor, path };
  }
  return { actor: SYSTEM_ACTOR, path: "condition_cleared" };
}

export async function reconcile(
  universe: string,
  opts: { daily?: boolean } = {},
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    detected: {},
    created: 0,
    reopened: 0,
    cleared: 0,
    closed: 0,
  };

  for (const kind of ACTIVE_DETECTOR_KINDS) {
    const detector = DETECTORS[kind];
    if (!detector) continue;
    let conds: DetectedCondition[];
    try {
      conds = await detector.detectAll(universe);
    } catch (e) {
      log.error({ err: e, kind }, "detector failed; skipping this kind");
      continue;
    }
    summary.detected[kind] = conds.length;

    const groupSize = new Map<string, number>();
    for (const c of conds)
      if (c.groupKey)
        groupSize.set(c.groupKey, (groupSize.get(c.groupKey) ?? 0) + 1);
    for (const c of conds) {
      if (
        kind === "load_error" &&
        (groupSize.get(c.groupKey ?? "") ?? 0) >= HIGH_SEVERITY_GROUP
      ) {
        c.severity = "high";
      }
    }

    const existing = await loadByFingerprint(universe, kind);
    const seen = new Set<string>();
    const touchIds: number[] = [];
    const fresh: DetectedCondition[] = [];

    for (const c of conds) {
      const fp = fingerprintOf(c);
      seen.add(fp);
      const row = existing.get(fp);
      if (!row) {
        fresh.push(c);
        continue;
      }
      const id = Number(row.id);
      const prevSig = (JSON.parse(row.detail ?? "{}") as { signature?: string })
        .signature;
      if (row.status === "resolved") {
        // resolved_at is HST wall-clock; convert before comparing to now.
        const resolvedAt = row.resolved_at
          ? hstToInstant(row.resolved_at).getTime()
          : 0;
        const withinWindow =
          Date.now() - resolvedAt < REOPEN_WINDOW_DAYS * 86400000;
        if (withinWindow) {
          const issue = (await IssueStore.getById(id))!;
          await IssueStore.update(id, {
            status: "open",
            owner: "agent",
            resolved_at: null,
            resolution_path: null,
            resolved_by_user_id: null,
            reopen_count: issue.reopenCount + 1,
          });
          await IssueStore.touch(id, c);
          await IssueStore.addEvent(
            id,
            SYSTEM_ACTOR,
            "recurred",
            "The condition came back.",
            c.detail,
          );
          const updated = (await IssueStore.getById(id))!;
          await postIssueReply(updated, "↩️ This came back; reopened.");
          await refreshIssueHeadline(updated);
          summary.reopened++;
        } else {
          await IssueStore.update(id, {
            status: "closed",
            open_fingerprint: null,
          });
          const issue = await IssueStore.insert(c);
          await IssueStore.addEvent(
            issue.id,
            SYSTEM_ACTOR,
            "detected",
            null,
            c.detail,
          );
          summary.created++;
        }
        continue;
      }
      if (row.status === "dismissed") {
        if (
          prevSig !== undefined &&
          c.detail.signature !== undefined &&
          prevSig !== c.detail.signature
        ) {
          await IssueStore.update(id, {
            status: "open",
            owner: "agent",
            dismissed_reason: null,
          });
          await IssueStore.touch(id, c);
          await IssueStore.addEvent(
            id,
            SYSTEM_ACTOR,
            "reopened",
            "Dismissed earlier, but the condition changed.",
            c.detail,
          );
          summary.reopened++;
        } else {
          touchIds.push(id);
        }
        continue;
      }
      // Live: refresh the snapshot only when it changed (cheap path for the
      // thousands of unchanged missing-metadata rows).
      if (
        prevSig !== c.detail.signature ||
        (c.severity && c.severity !== row.severity)
      ) {
        await IssueStore.touch(id, c);
        if (c.severity && c.severity !== row.severity) {
          await IssueStore.update(id, { severity: c.severity });
        }
      } else {
        touchIds.push(id);
      }
    }
    await bulkTouch(touchIds);
    summary.created += await IssueStore.bulkInsert(fresh);

    // Live issues of this kind whose condition is gone.
    const live = await IssueStore.listLiveByKinds(universe, [kind]);
    for (const issue of live) {
      if (seen.has(issue.fingerprint)) continue;
      // Double-check with the per-issue check (the sweep and an edit can race).
      if (await detector.checkOne(issue)) continue;
      const { actor, path } = await creditFor(issue);
      await markResolved(
        issue,
        actor,
        path,
        null,
        path === "condition_cleared"
          ? "condition_cleared"
          : "verified_resolved",
      );
      summary.cleared++;
    }
  }

  // Close old resolved issues; their fingerprint is freed for new ones.
  const closing = await mysql<{ id: number }>`
    SELECT id FROM ops_issues
    WHERE universe = ${universe} AND status = 'resolved'
      AND resolved_at < NOW() - INTERVAL ${CLOSE_AFTER_DAYS} DAY
  `;
  for (const r of closing) {
    await IssueStore.update(Number(r.id), {
      status: "closed",
      open_fingerprint: null,
    });
    await IssueStore.addEvent(Number(r.id), SYSTEM_ACTOR, "closed", null);
  }
  summary.closed = closing.length;

  await mysql`
    UPDATE ops_issues SET snoozed_until = NULL, updated_at = NOW()
    WHERE universe = ${universe} AND snoozed_until IS NOT NULL AND snoozed_until < NOW()
  `;

  await missedRunAlert(universe);

  if (opts.daily) {
    summary.proposals = await revalidateQueue(universe);
    await postDailyDigest(universe).catch((e) =>
      log.warn({ err: e }, "daily digest failed"),
    );
  } else {
    await syncQueue(universe);
  }

  log.info({ universe, ...summary }, "ops reconcile complete");
  return summary;
}

/**
 * The runner polls for work every few minutes, whether or not there is
 * any. No poll in 26h (and the agent isn't paused) → one alert per day.
 */
async function missedRunAlert(universe: string): Promise<void> {
  const settings = await getOpsSettings(universe);
  if (settings.agentPaused) return;
  const raw = await getRawSettings(universe);
  const last = raw["agent.last_poll_at"];
  if (!last) return; // agent never set up yet
  // Stored as an HST wall-clock string; read it the way the driver reads a
  // DATETIME (as if UTC) so hstToInstant applies.
  const wall = new Date(`${last.replace(" ", "T")}Z`);
  const hours = (Date.now() - hstToInstant(wall).getTime()) / 3600000;
  if (hours < MISSED_RUN_HOURS) return;
  const today = hstToday();
  if (raw["alert.missed_run_posted_on"] === today) return;
  await postOpsMessage(
    `⚠️ *Ops agent:* the runner hasn't asked for work in ${Math.floor(hours)}h (last: ${last} HST). Check the \`udaman-ops-agent\` service on the workstation. <${agentAdminUrl()}|Agent dashboard>`,
  );
  await setOpsSetting(universe, "alert.missed_run_posted_on", today, null);
}
