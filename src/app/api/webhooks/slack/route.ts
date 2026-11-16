import crypto from "node:crypto";

import { after, NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/core/observability/logger";
import {
  handleSlackInteraction,
  ingestSlackMessage,
  type SlackBlockActionPayload,
  type SlackMessageEvent,
} from "@/core/ops/slack-inbound";
import {
  unfurlSeriesLinks,
  type LinkSharedEvent,
} from "@/lib/slack/series-unfurl";

const log = createLogger("webhook.slack");

/**
 * Verify that the request actually came from Slack.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const expected = `v0=${hmac}`;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Handle Slack Events API url_verification challenge.
 */
function handleChallenge(payload: { challenge: string }) {
  return NextResponse.json({ challenge: payload.challenge });
}

/**
 * Handle the `/udaman` slash command.
 */
function handleSlashCommand(params: URLSearchParams): NextResponse {
  const commandText = (params.get("text") ?? "").trim().toLowerCase();

  if (commandText === "help" || commandText === "") {
    return NextResponse.json({
      response_type: "ephemeral",
      text: [
        "*UDAMAN Notification Channels*",
        "",
        "UDAMAN can send notifications via:",
        "\u2022 *Email* \u2014 SMTP with multi-sender support",
        "\u2022 *Slack* \u2014 Bot messages to any channel",
        "\u2022 *SMS* \u2014 Text messages via Twilio",
        "",
        "Manage notifications at: <https://udaman.uhero.hawaii.edu/admin/messages|Admin \u203a Messages>",
        "",
        "*Commands:*",
        "\u2022 `/udaman help` \u2014 Show this message",
      ].join("\n"),
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: `Unknown command: \`${commandText}\`. Try \`/udaman help\`.`,
  });
}

/**
 * `link_shared` (Events API): preview udaman series links. Slack wants an ack
 * within 3s and retries otherwise, so the lookup runs after the response.
 * Retries are acked and dropped — the first delivery's `after` is still
 * running or already done, and a second chat.unfurl would be redundant.
 */
function handleLinkShared(
  event: LinkSharedEvent,
  retryNum: string | null,
): NextResponse {
  if (retryNum) {
    log.info({ retryNum }, "Ignoring link_shared retry");
    return NextResponse.json({ ok: true });
  }
  after(async () => {
    try {
      await unfurlSeriesLinks(event);
    } catch (e) {
      log.error({ err: e }, "Series unfurl failed");
    }
  });
  return NextResponse.json({ ok: true });
}

/**
 * `message` (Events API): a reply in an ops issue/proposal thread becomes an
 * issue comment. Retries are dropped (the first delivery is handling it;
 * comments are also deduped by Slack ts).
 */
function handleOpsMessage(
  event: SlackMessageEvent,
  retryNum: string | null,
): NextResponse {
  if (retryNum) return NextResponse.json({ ok: true });
  after(async () => {
    try {
      await ingestSlackMessage(event);
    } catch (e) {
      log.error({ err: e }, "Ops Slack message ingest failed");
    }
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    log.error("SLACK_SIGNING_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
    log.warn("Invalid Slack signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Events API sends JSON (url_verification challenge)
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = JSON.parse(rawBody);
      if (payload.type === "url_verification") {
        return handleChallenge(payload);
      }
      if (
        payload.type === "event_callback" &&
        payload.event?.type === "link_shared"
      ) {
        return handleLinkShared(
          payload.event,
          request.headers.get("x-slack-retry-num"),
        );
      }
      if (
        payload.type === "event_callback" &&
        payload.event?.type === "message"
      ) {
        return handleOpsMessage(
          payload.event,
          request.headers.get("x-slack-retry-num"),
        );
      }
      log.info({ type: payload.type }, "Unhandled Slack event type");
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  // Slash commands and interactivity send application/x-www-form-urlencoded
  const params = new URLSearchParams(rawBody);

  // Interactivity (button clicks) arrive as a `payload` JSON field.
  const interaction = params.get("payload");
  if (interaction) {
    try {
      const parsed = JSON.parse(interaction) as SlackBlockActionPayload;
      if (parsed.type === "block_actions") {
        // Ack within 3s; the review (and Slack updates) run after.
        after(async () => {
          try {
            await handleSlackInteraction(parsed);
          } catch (e) {
            log.error({ err: e }, "Slack interaction failed");
          }
        });
      }
      return new NextResponse(null, { status: 200 });
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }
  const command = params.get("command");

  if (command === "/udaman") {
    log.info(
      { user: params.get("user_name"), text: params.get("text") },
      "Slash command received",
    );
    return handleSlashCommand(params);
  }

  log.warn({ command }, "Unknown slash command");
  return NextResponse.json({ error: "Unknown command" }, { status: 400 });
}
