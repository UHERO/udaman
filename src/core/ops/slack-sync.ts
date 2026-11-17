/*************************************************************************
 * Ops → Slack (outbound). Every function here swallows Slack failures:
 * a Slack outage must never break a resolve, an approval or a reconcile.
 *
 * Threads: only issues that need a person (a question, the active proposal)
 * get a top-level message; everything else shows up in the digest.
 *************************************************************************/

import { postSlackMessage, updateSlackMessage } from "@/core/mailers/slack";
import { createLogger } from "@/core/observability/logger";

import { IssueStore } from "./issue-store";
import { issueUrl, proposalsUrl } from "./links";
import { ProposalStore } from "./proposal-store";
import { OPS_SLACK_CHANNEL } from "./settings";
import type { IssueRow, ProposalRow } from "./types";

const log = createLogger("ops.slack");

const STATUS_LABEL: Record<string, string> = {
  open: "🔴 open",
  investigating: "🔎 investigating",
  awaiting_human: "🙋 waiting on a person",
  resolving: "⏳ verifying fix",
  resolved: "✅ resolved",
  closed: "✅ closed",
  dismissed: "⚪ dismissed",
};

function headline(issue: IssueRow): string {
  return [
    `*<${issueUrl(issue.universe, issue.id)}|#${issue.id}> ${issue.title}*`,
    `${STATUS_LABEL[issue.status] ?? issue.status} · ${issue.kind}`,
  ].join("\n");
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    log.warn({ err: e }, `Slack ${label} failed`);
    return null;
  }
}

/** Create the issue's thread if it has none. Returns the thread ts. */
export async function ensureIssueThread(
  issue: IssueRow,
): Promise<string | null> {
  if (issue.slackTs) return issue.slackTs;
  const posted = await safe("issue thread", () =>
    postSlackMessage({ channel: OPS_SLACK_CHANNEL, text: headline(issue) }),
  );
  if (!posted) return null;
  await IssueStore.update(issue.id, {
    slack_channel: posted.channel,
    slack_ts: posted.ts,
  });
  issue.slackChannel = posted.channel;
  issue.slackTs = posted.ts;
  return posted.ts;
}

/**
 * Reply in the issue's thread. With `createThread`, a thread is started
 * first if needed; otherwise issues without a thread are left alone.
 */
export async function postIssueReply(
  issue: IssueRow,
  text: string,
  opts: { createThread?: boolean } = {},
): Promise<string | null> {
  const ts = opts.createThread ? await ensureIssueThread(issue) : issue.slackTs;
  if (!ts || !issue.slackChannel) return null;
  const posted = await safe("issue reply", () =>
    postSlackMessage({
      channel: issue.slackChannel!,
      text,
      threadTs: ts,
    }),
  );
  return posted?.ts ?? null;
}

/** Refresh the parent message's status line. */
export async function refreshIssueHeadline(issue: IssueRow): Promise<void> {
  if (!issue.slackTs || !issue.slackChannel) return;
  await safe("headline update", () =>
    updateSlackMessage({
      channel: issue.slackChannel!,
      ts: issue.slackTs!,
      text: headline(issue),
    }),
  );
}

// ─── Proposals ────────────────────────────────────────────────────────

function proposalText(p: ProposalRow): string {
  const n = p.targets.length;
  return [
    `*Proposal #${p.id}* (${p.kind}, ${n} target${n === 1 ? "" : "s"})`,
    p.summary,
    `<${proposalsUrl(p.universe)}|Review in the app>${p.issueId ? ` · <${issueUrl(p.universe, p.issueId)}|issue #${p.issueId}>` : ""}`,
  ].join("\n");
}

function proposalBlocks(p: ProposalRow): unknown[] {
  return [
    { type: "section", text: { type: "mrkdwn", text: proposalText(p) } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Approve" },
          action_id: "ops_proposal_approve",
          value: String(p.id),
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "Reject" },
          action_id: "ops_proposal_reject",
          value: String(p.id),
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Reviewers can approve or reject. Fixing it yourself also works: the proposal is withdrawn when the issue clears. Reply in this thread to discuss; the agent picks replies up within minutes.",
        },
      ],
    },
  ];
}

/** Post the proposal that just became active. */
export async function postProposal(p: ProposalRow): Promise<void> {
  const posted = await safe("proposal post", () =>
    postSlackMessage({
      channel: OPS_SLACK_CHANNEL,
      text: proposalText(p),
      blocks: proposalBlocks(p),
    }),
  );
  await ProposalStore.setStatus(p.id, "pending", {
    markPosted: true,
    slackChannel: posted?.channel ?? null,
    slackTs: posted?.ts ?? null,
  });
}

/** Replace the buttons with an outcome line once a proposal is decided. */
export async function closeProposalMessage(
  p: ProposalRow,
  outcome: string,
): Promise<void> {
  if (!p.slackTs || !p.slackChannel) return;
  const text = `${proposalText(p)}\n*${outcome}*`;
  await safe("proposal close", () =>
    updateSlackMessage({
      channel: p.slackChannel!,
      ts: p.slackTs!,
      text,
      blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
    }),
  );
}

// ─── Digest / alerts ──────────────────────────────────────────────────

export async function postOpsMessage(
  text: string,
): Promise<{ ts: string; channel: string } | null> {
  return safe("ops message", () =>
    postSlackMessage({ channel: OPS_SLACK_CHANNEL, text }),
  );
}
