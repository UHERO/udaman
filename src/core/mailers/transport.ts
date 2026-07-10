import nodemailer, { type Transporter } from "nodemailer";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("mailer.transport");

/**
 * SMTP-backed mail transport (nodemailer) with multi-sender support.
 *
 * Default sender env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM
 *
 * Named sender "uherosrv" env vars:
 *   SMTP_UHEROSRV_HOST, SMTP_UHEROSRV_PORT, SMTP_UHEROSRV_USER,
 *   SMTP_UHEROSRV_PASS, SMTP_UHEROSRV_SECURE, SMTP_UHEROSRV_FROM
 *
 * Safety: non-production envs redirect all mail to DEV_MAIL_RECIPIENT.
 * MAIL_DISABLED=1 prevents all sends (logs only).
 */

const DEV_MAIL_RECIPIENT = "wood2@hawaii.edu";

const transporterCache = new Map<string, Transporter>();

type SenderConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function getSenderConfig(sender: string): SenderConfig {
  if (sender === "default") {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error(
        "Default mail sender not configured: SMTP_HOST, SMTP_USER, SMTP_PASS are required",
      );
    }
    return {
      host,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure:
        process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
      user,
      pass,
      from: process.env.MAIL_FROM ?? user,
    };
  }

  if (sender === "uherosrv") {
    const host = process.env.SMTP_UHEROSRV_HOST;
    const user = process.env.SMTP_UHEROSRV_USER;
    const pass = process.env.SMTP_UHEROSRV_PASS;
    if (!host || !user || !pass) {
      throw new Error(
        "Sender 'uherosrv' not configured: SMTP_UHEROSRV_HOST, SMTP_UHEROSRV_USER, SMTP_UHEROSRV_PASS are required",
      );
    }
    return {
      host,
      port: parseInt(process.env.SMTP_UHEROSRV_PORT ?? "587", 10),
      secure:
        process.env.SMTP_UHEROSRV_SECURE === "1" ||
        process.env.SMTP_UHEROSRV_SECURE === "true",
      user,
      pass,
      from: process.env.SMTP_UHEROSRV_FROM ?? user,
    };
  }

  throw new Error(`Unknown mail sender: '${sender}'`);
}

export function getTransporter(sender: string = "default"): Transporter {
  const cached = transporterCache.get(sender);
  if (cached) return cached;

  const config = getSenderConfig(sender);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  transporterCache.set(sender, transporter);
  return transporter;
}

export function getFromAddress(sender: string = "default"): string {
  return getSenderConfig(sender).from;
}

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  /** HTML body. Plain-text alternative is auto-derived from this if `text` is omitted. */
  html?: string;
  /** Explicit plain-text body (overrides auto-derivation). */
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
};

/**
 * Low-level mail send. All higher-level mailer modules should call this.
 *
 * Honors MAIL_DISABLED (no-op) and dev-safety redirect so dev/staging
 * sessions can never accidentally email real recipients.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const disabled =
    process.env.MAIL_DISABLED === "1" || process.env.MAIL_DISABLED === "true";
  if (disabled) {
    log.info(
      { to: opts.to, subject: opts.subject, sender: opts.sender },
      "MAIL_DISABLED — skipping send",
    );
    return;
  }

  const senderKey = opts.sender ?? "default";

  // Hard safety: in non-production environments, force all mail to the dev
  // recipient regardless of what the caller passed.
  const isProd = process.env.NODE_ENV === "production";
  const to = isProd ? opts.to : DEV_MAIL_RECIPIENT;
  const cc = isProd ? opts.cc : undefined;
  const bcc = isProd ? opts.bcc : undefined;
  if (!isProd) {
    log.info(
      { originalTo: opts.to, devRecipient: DEV_MAIL_RECIPIENT },
      "Non-production env — redirecting outbound mail to dev recipient",
    );
  }

  const from = opts.from ?? getFromAddress(senderKey);
  const text = opts.text ?? (opts.html ? htmlToText(opts.html) : "");

  const transporter = getTransporter(senderKey);
  const info = await transporter.sendMail({
    from,
    to,
    cc,
    bcc,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
    text,
    attachments: opts.attachments,
  });
  log.info(
    {
      to,
      subject: opts.subject,
      sender: senderKey,
      messageId: info.messageId,
    },
    "Mail sent",
  );
}

/** Naive HTML → text fallback for the plain-text body. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
