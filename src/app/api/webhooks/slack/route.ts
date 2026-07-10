import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/core/observability/logger";

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

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
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
      log.info({ type: payload.type }, "Unhandled Slack event type");
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  // Slash commands send application/x-www-form-urlencoded
  const params = new URLSearchParams(rawBody);
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
