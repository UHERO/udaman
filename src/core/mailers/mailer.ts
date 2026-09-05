import { createLogger } from "@/core/observability/logger";

import { buildMessageRecord, withMessageLog } from "./message-log";
import { sendSlackMessage } from "./slack";
import { sendSms } from "./sms";
import { getFromAddress, sendMail } from "./transport";

const log = createLogger("mailer");

export type EmailOptions = {
  to: string | string[];
  subject: string;
  /** HTML body (at least one of html/text required). */
  html?: string;
  /** Plain text body (auto-derived from html if omitted). */
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  /** Override the sender's default from address. */
  from?: string;
  /** Named sender key (default: "default"). */
  sender?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  /** User who triggered the send, recorded in the `messages` audit row. */
  userId?: number | null;
};

export type SlackOptions = {
  channel: string;
  /** Plain text fallback (required). */
  text: string;
  /** Slack Block Kit blocks for rich formatting. */
  blocks?: unknown[];
  /** Reply in a thread. */
  threadTs?: string;
  unfurlLinks?: boolean;
  /** User who triggered the send, recorded in the `messages` audit row. */
  userId?: number | null;
};

export type SmsOptions = {
  /** E.164 format phone number. */
  to: string;
  body: string;
  /** User who triggered the send, recorded in the `messages` audit row. */
  userId?: number | null;
};

/** Resolve the from-address for the audit row without failing the send here;
 * an unconfigured sender is reported by the transport (and recorded as failed). */
function safeFromAddress(sender: string | undefined, override?: string) {
  if (override) return override;
  try {
    return getFromAddress(sender ?? "default");
  } catch {
    return null;
  }
}

/**
 * Unified notification gateway for email, Slack, and SMS.
 *
 * Every send is recorded in the `messages` table (pending → sent / failed /
 * skipped) for auditability. Recording is best-effort: if the row cannot be
 * written the send still goes out. Each method resolves to the audit row id,
 * or `undefined` if the row could not be written.
 *
 * All methods are fire-and-forget friendly — callers should use `.catch()`
 * so notification failures never break business logic.
 */
export class Mailer {
  /**
   * Send an email via a named sender (or the default sender).
   *
   * @example
   * await Mailer.email({
   *   to: "user@hawaii.edu",
   *   subject: "Upload Complete",
   *   html: "<h1>Done</h1>",
   * });
   *
   * @example
   * await Mailer.email({
   *   sender: "uherosrv",
   *   to: "user@hawaii.edu",
   *   subject: "Report Ready",
   *   html: "<p>Your report is ready.</p>",
   * });
   */
  static async email(opts: EmailOptions): Promise<number | undefined> {
    if (!opts.html && !opts.text) {
      throw new Error(
        "Mailer.email: at least one of `html` or `text` is required",
      );
    }

    log.info(
      { to: opts.to, subject: opts.subject, sender: opts.sender ?? "default" },
      "Sending email",
    );

    const record = buildMessageRecord({
      channel: "email",
      to: opts.to,
      subject: opts.subject,
      body: opts.text ?? opts.html ?? "",
      sender: opts.sender ?? "default",
      fromAddr: safeFromAddress(opts.sender, opts.from),
      userId: opts.userId,
    });

    return withMessageLog(record, () =>
      sendMail({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        cc: opts.cc,
        bcc: opts.bcc,
        replyTo: opts.replyTo,
        from: opts.from,
        sender: opts.sender,
        attachments: opts.attachments,
      }),
    );
  }

  /**
   * Send a Slack message via Bot Token.
   *
   * @example
   * await Mailer.slack({
   *   channel: "#udaman",
   *   text: "Upload complete!",
   * });
   */
  static async slack(opts: SlackOptions): Promise<number | undefined> {
    if (!opts.channel || !opts.text) {
      throw new Error("Mailer.slack: `channel` and `text` are required");
    }

    log.info(
      { channel: opts.channel, textLength: opts.text.length },
      "Sending Slack message",
    );

    const record = buildMessageRecord({
      channel: "slack",
      to: opts.channel,
      body: opts.text,
      userId: opts.userId,
    });

    return withMessageLog(record, () =>
      sendSlackMessage({
        channel: opts.channel,
        text: opts.text,
        blocks: opts.blocks,
        threadTs: opts.threadTs,
        unfurlLinks: opts.unfurlLinks,
      }),
    );
  }

  /**
   * Send an SMS via Twilio.
   *
   * @example
   * await Mailer.sms({ to: "+18081234567", body: "Hello from UDAMAN" });
   */
  static async sms(opts: SmsOptions): Promise<number | undefined> {
    if (!opts.to || !opts.body) {
      throw new Error("Mailer.sms: `to` and `body` are required");
    }

    log.info({ to: opts.to, bodyLength: opts.body.length }, "Sending SMS");

    const record = buildMessageRecord({
      channel: "sms",
      to: opts.to,
      body: opts.body,
      userId: opts.userId,
    });

    return withMessageLog(record, () =>
      sendSms({ to: opts.to, body: opts.body }),
    );
  }
}
