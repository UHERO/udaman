import { createLogger } from "@/core/observability/logger";

import { DBEDT_UPLOAD_RECIPIENTS } from "./recipients";
import { sendMail } from "./transport";

/**
 * Notification mailer for DBEDT uploads (Econ + Tour).
 *
 * Named after the legacy Rails `DbedtUploadMailer`. Covers both the DBEDT
 * Econ and DBEDT Tour uploads, which share the same upload pipeline. The
 * `label` field on each input distinguishes them in subject lines / bodies.
 */

const log = createLogger("mailer.dbedt-upload");

/** HTML escape so user-provided strings (filenames, errors) are safe to embed. */
function esc(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 640px;">
    <h2 style="margin-bottom: 8px;">${esc(title)}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0 12px;" />
    <p style="font-size: 12px; color: #666;">
      Sent automatically by udaman at ${esc(new Date().toISOString())}.
    </p>
  </body>
</html>`;
}

// ─── upload_started ───────────────────────────────────────────────────

export type UploadStartedInput = {
  label: string;
  uploadId: number;
  filename: string;
};

export async function sendDbedtUploadStarted(
  input: UploadStartedInput,
): Promise<void> {
  const subject = `${input.label} Upload Started: ${input.filename}`;
  const html = shell(
    subject,
    `
    <p>A ${esc(input.label)} upload has started.</p>
    <table style="border-collapse: collapse;">
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Upload ID</td><td style="padding: 4px 0;">${esc(input.uploadId)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Filename</td><td style="padding: 4px 0; font-family: monospace;">${esc(input.filename)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Started at</td><td style="padding: 4px 0;">${esc(new Date().toLocaleString())}</td></tr>
    </table>
    `,
  );

  log.info(
    { label: input.label, uploadId: input.uploadId },
    "Sending upload-started email",
  );
  await sendMail({
    to: [...DBEDT_UPLOAD_RECIPIENTS],
    subject,
    html,
  });
}

// ─── upload_completed ─────────────────────────────────────────────────

export type UploadCompletedInput = {
  label: string;
  uploadId: number;
  filename: string;
} & (
  | { status: "ok"; dataPointCount: number; error?: never }
  | { status: "failed"; error: string; dataPointCount?: never }
);

export async function sendDbedtUploadCompleted(
  input: UploadCompletedInput,
): Promise<void> {
  const ok = input.status === "ok";
  const subject = ok
    ? `${input.label} Upload Successful: ${input.filename}`
    : `${input.label} Upload Failed: ${input.filename}`;

  const detailsRow = ok
    ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Data points loaded</td><td style="padding: 4px 0;">${esc(input.dataPointCount.toLocaleString())}</td></tr>`
    : `<tr>
        <td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top;">Error</td>
        <td style="padding: 4px 0; color: #b00; font-family: monospace; white-space: pre-wrap;">${esc(input.error)}</td>
      </tr>`;

  const html = shell(
    subject,
    `
    <p>${ok ? `The ${esc(input.label)} upload completed successfully.` : `The ${esc(input.label)} upload failed.`}</p>
    <table style="border-collapse: collapse;">
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Upload ID</td><td style="padding: 4px 0;">${esc(input.uploadId)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Filename</td><td style="padding: 4px 0; font-family: monospace;">${esc(input.filename)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Finished at</td><td style="padding: 4px 0;">${esc(new Date().toLocaleString())}</td></tr>
      ${detailsRow}
    </table>
    `,
  );

  log.info(
    { label: input.label, uploadId: input.uploadId, status: input.status },
    "Sending upload-completed email",
  );
  await sendMail({
    to: [...DBEDT_UPLOAD_RECIPIENTS],
    subject,
    html,
  });
}
