import { createLogger } from "@/core/observability/logger";

const log = createLogger("mailer.slack");

export async function sendSlackMessage(opts: {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
  unfurlLinks?: boolean;
}): Promise<void> {
  const disabled =
    process.env.SLACK_DISABLED === "1" || process.env.SLACK_DISABLED === "true";
  if (disabled) {
    log.info(
      { channel: opts.channel, textLength: opts.text.length },
      "SLACK_DISABLED — skipping send",
    );
    return;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("Slack not configured: SLACK_BOT_TOKEN is required");
  }

  const body: Record<string, unknown> = {
    channel: opts.channel,
    text: opts.text,
  };
  if (opts.blocks) body.blocks = opts.blocks;
  if (opts.threadTs) body.thread_ts = opts.threadTs;
  if (opts.unfurlLinks !== undefined) body.unfurl_links = opts.unfurlLinks;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
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

  log.info({ channel: opts.channel, ts: data.ts }, "Slack message sent");
}
