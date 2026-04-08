import nodemailer, { type Transporter } from "nodemailer";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("mailer.transport");

/**
 * SMTP-backed mail transport (nodemailer).
 *
 * Configured via env vars:
 *   SMTP_HOST           — e.g. smtp.gmail.com
 *   SMTP_PORT           — e.g. 587
 *   SMTP_USER           — SMTP username
 *   SMTP_PASS           — SMTP password / app password
 *   SMTP_SECURE         — "1" / "true" → use TLS on connect (port 465)
 *   MAIL_FROM           — default From: address (e.g. "udaman.bot@gmail.com")
 *   MAIL_DISABLED       — "1" / "true" → no-op all sends (logs only)
 *
 * Safety: in non-production environments (NODE_ENV !== "production") all
 * outbound mail is unconditionally redirected to DEV_MAIL_RECIPIENT, so a
 * `bun dev` session can never accidentally email real people.
 */

const DEV_MAIL_RECIPIENT = "wood2@hawaii.edu";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure =
    process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured: SMTP_HOST, SMTP_USER, SMTP_PASS are required",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  /** HTML body. Plain-text alternative is auto-derived from this. */
  html: string;
  /** Optional explicit plain-text body (overrides auto-derivation). */
  text?: string;
};

/**
 * Low-level mail send. All higher-level mailer modules should call this.
 *
 * Honors MAIL_DISABLED (no-op) and MAIL_OVERRIDE_TO (redirect) so dev/staging
 * sessions can never accidentally email real recipients.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const disabled =
    process.env.MAIL_DISABLED === "1" || process.env.MAIL_DISABLED === "true";
  if (disabled) {
    log.info(
      { to: opts.to, subject: opts.subject },
      "MAIL_DISABLED — skipping send",
    );
    return;
  }

  // Hard safety: in non-production environments, force all mail to the dev
  // recipient regardless of what the caller passed.
  const isProd = process.env.NODE_ENV === "production";
  const to = isProd ? opts.to : DEV_MAIL_RECIPIENT;
  if (!isProd) {
    log.info(
      { originalTo: opts.to, devRecipient: DEV_MAIL_RECIPIENT },
      "Non-production env — redirecting outbound mail to dev recipient",
    );
  }

  const from = process.env.MAIL_FROM ?? "udaman.bot@uhero.hawaii.edu";
  const text = opts.text ?? htmlToText(opts.html);

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject: opts.subject,
    html: opts.html,
    text,
  });
  log.info(
    { to, subject: opts.subject, messageId: info.messageId },
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
