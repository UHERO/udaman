import { insertAndGetId, mysql } from "@database/mysql";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("mailer.message-log");

export type MessageChannel = "email" | "slack" | "sms";
export type MessageStatus = "pending" | "sent" | "failed" | "skipped";

/** Column lengths from the `messages` migration. */
const RECIPIENT_MAX = 500;
const SUBJECT_MAX = 500;
const SENDER_MAX = 100;
const FROM_MAX = 255;

/** Insert payload for one row in the `messages` audit table. */
export type MessageRecord = {
  channel: MessageChannel;
  /** Named sender key (email only). */
  sender: string | null;
  /** Resolved from-address (email only). */
  fromAddr: string | null;
  /** Requested recipient(s); arrays are joined with ", ". */
  recipient: string;
  subject: string | null;
  body: string;
  /** User who triggered the send, when known. Workers pass null. */
  userId: number | null;
};

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

function clipNullable(value: string | null | undefined, max: number) {
  return value == null ? null : clip(value, max);
}

/**
 * Normalise Mailer options into an insert-ready record. Pure, so it can be
 * unit-tested without a database.
 */
export function buildMessageRecord(input: {
  channel: MessageChannel;
  to: string | string[];
  body: string;
  subject?: string | null;
  sender?: string | null;
  fromAddr?: string | null;
  userId?: number | null;
}): MessageRecord {
  const recipient = Array.isArray(input.to) ? input.to.join(", ") : input.to;
  return {
    channel: input.channel,
    sender: clipNullable(input.sender, SENDER_MAX),
    fromAddr: clipNullable(input.fromAddr, FROM_MAX),
    recipient: clip(recipient, RECIPIENT_MAX),
    subject: clipNullable(input.subject, SUBJECT_MAX),
    body: input.body,
    userId: input.userId ?? null,
  };
}

/**
 * Insert a `pending` row for a send that is about to happen. Best-effort:
 * returns `undefined` (after logging) if the insert fails, so a missing table
 * or a DB outage never stops a notification from going out.
 */
export async function beginMessage(
  record: MessageRecord,
): Promise<number | undefined> {
  try {
    return await insertAndGetId(
      `INSERT INTO messages (channel, sender, from_addr, recipient, subject, body, status, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [
        record.channel,
        record.sender,
        record.fromAddr,
        record.recipient,
        record.subject,
        record.body,
        record.userId,
      ],
    );
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), record },
      "Failed to record outbound message (send will continue)",
    );
    return undefined;
  }
}

/** Mark a previously-begun row as sent/failed/skipped. Best-effort. */
export async function completeMessage(
  messageId: number | undefined,
  status: Exclude<MessageStatus, "pending">,
  error?: string,
): Promise<void> {
  if (messageId === undefined) return;
  try {
    await mysql`
      UPDATE messages
      SET status = ${status}, error = ${error ?? null}
      WHERE id = ${messageId}
    `;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), messageId },
      "Failed to update outbound message status",
    );
  }
}

/**
 * Run `send` with an audit row around it. The row is inserted as `pending`
 * first, then flipped to `sent`, `skipped` (a *_DISABLED flag short-circuited
 * the transport) or `failed` (with the error message). Errors from `send`
 * are re-thrown after being recorded.
 *
 * Returns the row id, or `undefined` if the row could not be written.
 */
export async function withMessageLog(
  record: MessageRecord,
  send: () => Promise<{ skipped: boolean }>,
): Promise<number | undefined> {
  const messageId = await beginMessage(record);
  try {
    const result = await send();
    await completeMessage(messageId, result.skipped ? "skipped" : "sent");
    return messageId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeMessage(messageId, "failed", message);
    throw err;
  }
}
