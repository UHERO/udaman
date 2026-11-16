import { createLogger } from "@/core/observability/logger";

import type { SendResult } from "./transport";

const log = createLogger("mailer.slack");

function slackDisabled(): boolean {
  return (
    process.env.SLACK_DISABLED === "1" || process.env.SLACK_DISABLED === "true"
  );
}

/** POST a Web API method with the bot token; throws on HTTP or `ok: false`. */
async function callSlackApi(
  method: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("Slack not configured: SLACK_BOT_TOKEN is required");
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Slack API HTTP error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();

  if (!data.ok) {
    const detail = data.needed
      ? ` (needed: "${data.needed}", provided: "${data.provided}")`
      : "";
    throw new Error(`Slack API error: ${data.error}${detail}`);
  }

  return data;
}

export async function sendSlackMessage(opts: {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
  unfurlLinks?: boolean;
}): Promise<SendResult> {
  if (slackDisabled()) {
    log.info(
      { channel: opts.channel, textLength: opts.text.length },
      "SLACK_DISABLED — skipping send",
    );
    return { skipped: true };
  }

  const body: Record<string, unknown> = {
    channel: opts.channel,
    text: opts.text,
  };
  if (opts.blocks) body.blocks = opts.blocks;
  if (opts.threadTs) body.thread_ts = opts.threadTs;
  if (opts.unfurlLinks !== undefined) body.unfurl_links = opts.unfurlLinks;

  const data = await callSlackApi("chat.postMessage", body);

  log.info({ channel: opts.channel, ts: data.ts }, "Slack message sent");
  return { skipped: false };
}

/**
 * Attach previews to links in a message (response to a `link_shared` event).
 * Slack identifies the message either by channel + ts (posted messages) or by
 * unfurl_id + source (links still in the composer) — pass whichever the event
 * carried. `unfurls` maps each URL exactly as received to its preview.
 * @see https://api.slack.com/methods/chat.unfurl
 */
export async function sendSlackUnfurl(opts: {
  channel?: string;
  ts?: string;
  unfurlId?: string;
  source?: string;
  unfurls: Record<string, { blocks: unknown[] }>;
}): Promise<SendResult> {
  if (slackDisabled()) {
    log.info(
      { urls: Object.keys(opts.unfurls) },
      "SLACK_DISABLED — skipping unfurl",
    );
    return { skipped: true };
  }

  const body: Record<string, unknown> = { unfurls: opts.unfurls };
  if (opts.unfurlId && opts.source) {
    body.unfurl_id = opts.unfurlId;
    body.source = opts.source;
  } else {
    body.channel = opts.channel;
    body.ts = opts.ts;
  }

  await callSlackApi("chat.unfurl", body);

  log.info({ urls: Object.keys(opts.unfurls) }, "Slack unfurl sent");
  return { skipped: false };
}

/**
 * Post a message and return its `ts` and channel ID, which the ops issue
 * threads need (`sendSlackMessage` only reports skipped/sent). Returns null
 * when Slack is disabled.
 */
export async function postSlackMessage(opts: {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}): Promise<{ ts: string; channel: string } | null> {
  if (slackDisabled()) {
    log.info(
      { channel: opts.channel, textLength: opts.text.length },
      "SLACK_DISABLED — skipping post",
    );
    return null;
  }
  const body: Record<string, unknown> = {
    channel: opts.channel,
    text: opts.text,
    unfurl_links: false,
  };
  if (opts.blocks) body.blocks = opts.blocks;
  if (opts.threadTs) body.thread_ts = opts.threadTs;
  const data = await callSlackApi("chat.postMessage", body);
  return { ts: String(data.ts), channel: String(data.channel) };
}

/** Edit a posted message (e.g. an issue's status line). */
export async function updateSlackMessage(opts: {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}): Promise<void> {
  if (slackDisabled()) return;
  const body: Record<string, unknown> = {
    channel: opts.channel,
    ts: opts.ts,
    text: opts.text,
  };
  if (opts.blocks) body.blocks = opts.blocks;
  await callSlackApi("chat.update", body);
}

/** Permalink to a message, or null when Slack is disabled or it fails. */
export async function getSlackPermalink(
  channel: string,
  ts: string,
): Promise<string | null> {
  if (slackDisabled()) return null;
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    const res = await fetch(
      `https://slack.com/api/chat.getPermalink?channel=${encodeURIComponent(channel)}&message_ts=${encodeURIComponent(ts)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return data.ok ? String(data.permalink) : null;
  } catch {
    return null;
  }
}

const slackEmailCache = new Map<string, string | null>();

/** A Slack user's email (needs the `users:read.email` scope). Cached. */
export async function getSlackUserEmail(
  slackUserId: string,
): Promise<string | null> {
  if (slackEmailCache.has(slackUserId)) {
    return slackEmailCache.get(slackUserId) ?? null;
  }
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    const res = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    const email: string | null = data.ok
      ? (data.user?.profile?.email ?? null)
      : null;
    slackEmailCache.set(slackUserId, email);
    return email;
  } catch (e) {
    log.warn({ err: e, slackUserId }, "users.info failed");
    return null;
  }
}
