"use server";

import { insertAndGetId, mysql } from "@database/mysql";

import { Mailer } from "@/core/mailers/mailer";
import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/auth/dal";
import { AuthorizationError } from "@/lib/errors";

const log = createLogger("action.messages");

async function requireDev() {
  const role = await getCurrentUserRole();
  if (role !== "dev")
    throw new AuthorizationError("Unauthorized: dev role required");
}

export type SendMessagePayload =
  | {
      channel: "email";
      to: string;
      subject: string;
      body: string;
      sender?: string;
      from?: string;
    }
  | {
      channel: "slack";
      to: string;
      body: string;
    }
  | {
      channel: "sms";
      to: string;
      body: string;
    };

export async function sendMessageAction(
  payload: SendMessagePayload,
): Promise<{ success: boolean; message: string }> {
  await requireDev();
  const userId = await getCurrentUserId();

  let messageId: number | undefined;

  try {
    // Insert a pending message record
    messageId = await insertAndGetId(
      `INSERT INTO messages (channel, sender, from_addr, recipient, subject, body, status, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [
        payload.channel,
        payload.channel === "email" ? (payload.sender ?? "default") : null,
        payload.channel === "email" ? (payload.from ?? null) : null,
        payload.to,
        payload.channel === "email" ? payload.subject : null,
        payload.body,
        userId,
      ],
    );

    switch (payload.channel) {
      case "email":
        await Mailer.email({
          to: payload.to,
          subject: payload.subject,
          text: payload.body,
          sender: payload.sender,
          from: payload.from,
        });
        break;
      case "slack":
        await Mailer.slack({
          channel: payload.to,
          text: payload.body,
        });
        break;
      case "sms":
        await Mailer.sms({
          to: payload.to,
          body: payload.body,
        });
        break;
    }

    await mysql`
      UPDATE messages
      SET status = 'sent'
      WHERE id = ${messageId}
    `;

    log.info(
      { messageId, channel: payload.channel, to: payload.to, userId },
      "Message sent",
    );
    return {
      success: true,
      message: `Message sent successfully (id: ${messageId})`,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (messageId) {
      await mysql`
        UPDATE messages
        SET status = 'failed', error = ${errorMessage}
        WHERE id = ${messageId}
      `.catch(() => {}); // best-effort status update
    }

    log.error(
      { messageId, channel: payload.channel, err: errorMessage, userId },
      "Message send failed",
    );
    return { success: false, message: errorMessage };
  }
}

type MessageRow = {
  id: number;
  channel: string;
  sender: string | null;
  from_addr: string | null;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  user_id: number | null;
  created_at: Date;
};

export async function listMessagesAction(): Promise<MessageRow[]> {
  await requireDev();
  const rows = await mysql<MessageRow>`
    SELECT id, channel, sender, from_addr, recipient, subject, body, status, error, user_id, created_at
    FROM messages
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows;
}
