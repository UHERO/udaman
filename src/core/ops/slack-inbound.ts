/*************************************************************************
 * Slack → ops (inbound): thread replies become issue comments, and the
 * Approve/Reject buttons on proposals review them. Slack users are mapped
 * to UDAMAN users by email; only reviewers can approve.
 *
 * Slack app setup: subscribe to `message.channels` (bot event) for the ops
 * channel, enable Interactivity with the same /api/webhooks/slack URL, and
 * grant `users:read.email`.
 *************************************************************************/

import { mysql } from "@database/mysql";

import { getSlackUserEmail } from "@/core/mailers/slack";
import { createLogger } from "@/core/observability/logger";

import { IssueStore } from "./issue-store";
import { commentOnIssue, OpsError } from "./issues";
import { ProposalStore } from "./proposal-store";
import { reviewProposal } from "./proposals";
import { canReview } from "./settings";
import type { Actor } from "./types";

/** v1 scope: the UHERO universe only. */
const OPS_UNIVERSE = "UHERO";

const log = createLogger("ops.slack-inbound");

export interface SlackMessageEvent {
  type: "message";
  subtype?: string;
  bot_id?: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  channel: string;
}

async function actorForSlackUser(slackUserId: string): Promise<Actor> {
  const email = await getSlackUserEmail(slackUserId);
  const user = email
    ? (
        await mysql<{ id: number; role: string; email: string }>`
          SELECT id, role, email FROM users WHERE email = ${email} LIMIT 1
        `
      )[0]
    : undefined;
  return {
    type: "user",
    userId: user ? Number(user.id) : null,
    email: user?.email ?? email ?? `slack:${slackUserId}`,
    role: user?.role ?? "",
    via: "slack",
  };
}

/** A reply in an issue or proposal thread → a comment on the issue. */
export async function ingestSlackMessage(
  event: SlackMessageEvent,
): Promise<void> {
  if (!event.thread_ts || event.thread_ts === event.ts) return; // top-level
  if (event.bot_id || (event.subtype && event.subtype !== "thread_broadcast"))
    return;
  if (!event.user || !event.text?.trim()) return;

  let issue = await IssueStore.getBySlackTs(event.thread_ts);
  if (!issue) {
    const proposal = await ProposalStore.getBySlackTs(event.thread_ts);
    if (proposal?.issueId) issue = await IssueStore.getById(proposal.issueId);
  }
  if (!issue) return; // not an ops thread

  const actor = await actorForSlackUser(event.user);
  await commentOnIssue(issue.id, actor, event.text, "comment", {
    slackTs: event.ts,
  });
  log.info(
    { issueId: issue.id, ts: event.ts },
    "Slack reply recorded on issue",
  );
}

export interface SlackBlockActionPayload {
  type: "block_actions";
  user: { id: string };
  response_url?: string;
  container?: { message_ts?: string };
  actions: Array<{ action_id: string; value?: string }>;
}

async function respondEphemeral(url: string | undefined, text: string) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        replace_original: false,
        text,
      }),
    });
  } catch (e) {
    log.warn({ err: e }, "response_url post failed");
  }
}

/** Approve/Reject buttons on proposal messages. */
export async function handleSlackInteraction(
  payload: SlackBlockActionPayload,
): Promise<void> {
  const action = payload.actions?.[0];
  if (!action || !action.action_id.startsWith("ops_proposal_")) return;
  const decision =
    action.action_id === "ops_proposal_approve" ? "approve" : "reject";
  const actor = await actorForSlackUser(payload.user.id);
  if (!(await canReview(OPS_UNIVERSE, actor))) {
    await respondEphemeral(
      payload.response_url,
      "Only reviewers can approve or reject proposals. You can still reply in the thread.",
    );
    return;
  }

  const proposal = await ProposalStore.getById(Number(action.value));
  if (!proposal) {
    await respondEphemeral(
      payload.response_url,
      "That proposal no longer exists.",
    );
    return;
  }
  try {
    await reviewProposal(proposal.id, actor, decision, null);
  } catch (e) {
    const msg =
      e instanceof OpsError ? e.message : "Review failed; see the app.";
    if (!(e instanceof OpsError)) log.error({ err: e }, "Slack review failed");
    await respondEphemeral(payload.response_url, msg);
  }
}
