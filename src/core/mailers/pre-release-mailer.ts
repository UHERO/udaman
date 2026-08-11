import type { PreReleaseFormData } from "@catalog/models/approval";
import { formatPublicationType } from "@catalog/models/approval";

import { createLogger } from "@/core/observability/logger";

import { Mailer } from "./mailer";
import { resolvePreReleaseRecipients } from "./recipients";

/**
 * Notification mailer for UHERO Pre-Release Form submissions.
 *
 * Submitting the form is the approval, so there's a single notification, sent
 * to whichever addresses the submitter left on the form's recipient list.
 */

const log = createLogger("mailer.pre-release");

/**
 * Public base URL for links back into udaman.
 *
 * Note the missing `/udaman` prefix — the deployed subdomain strips it from
 * browser URLs and rewrites internally (see src/proxy.ts), so an emailed link
 * must use the external form.
 */
const BASE_URL =
  process.env.UDAMAN_BASE_URL ?? "https://udaman.uhero.hawaii.edu";

/** HTML escape so submitter-provided text is safe to embed. */
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
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 720px;">
    <h2 style="margin-bottom: 8px;">${esc(title)}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0 12px;" />
    <p style="font-size: 12px; color: #666;">
      Sent automatically by udaman at ${esc(new Date().toISOString())}.
    </p>
  </body>
</html>`;
}

function section(heading: string, rowsHtml: string): string {
  return `
    <h3 style="margin: 24px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #555;">${esc(heading)}</h3>
    <table style="border-collapse: collapse; width: 100%;">${rowsHtml}</table>`;
}

/** One label/value row. Multi-line disclosure text keeps its line breaks. */
function row(label: string, value: string | null | undefined): string {
  const shown = value && String(value).trim() ? esc(value) : "—";
  return `<tr>
    <td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top; width: 220px;">${esc(label)}</td>
    <td style="padding: 4px 0; white-space: pre-wrap;">${shown}</td>
  </tr>`;
}

function checkRow(label: string, checked: boolean): string {
  return `<tr>
    <td style="padding: 4px 12px 4px 0; vertical-align: top; width: 220px;">${checked ? "&#10003;" : "&#9744;"}</td>
    <td style="padding: 4px 0;">${esc(label)}</td>
  </tr>`;
}

export type PreReleaseSubmittedInput = {
  approvalId: number;
  universe: string;
  /** Publication title */
  name: string;
  /** Lead author, who is also the submitter and certifier */
  author: string;
  targetReleaseDate: string | null;
  submittedAt: Date;
  formData: PreReleaseFormData;
  /** Addresses to notify. Falls back to the list stored on the form. */
  recipients?: string[];
};

export async function sendPreReleaseSubmitted(
  input: PreReleaseSubmittedInput,
): Promise<void> {
  const { formData: d } = input;
  const subject = `Pre-Release Form: ${input.name}`;
  const url = `${BASE_URL}/${input.universe.toLowerCase()}/comms/pub-form/${input.approvalId}`;

  const html = shell(
    subject,
    `
    <p>
      <strong>${esc(input.author)}</strong> submitted a pre-release form for
      <strong>${esc(input.name)}</strong>.
      <a href="${esc(url)}">View it in udaman</a>.
    </p>

    ${section(
      "A. Publication details",
      row("Title", input.name) +
        row("Publication type", formatPublicationType(d)) +
        row("Lead author", input.author) +
        row("Contributors", d.contributors) +
        row("Target release date", input.targetReleaseDate) +
        row("Link to draft", d.documentUrl),
    )}

    ${section(
      "B. Disclosures",
      row("Conflicts of interest", d.conflictsOfInterest) +
        row("Funding sources", d.fundingSources) +
        row("Data restrictions", d.dataRestrictions) +
        row(
          "AI use",
          d.aiUsage === "none"
            ? "No AI used in preparing the work"
            : "AI used; followed applicable University of Hawaiʻi guidance",
        ),
    )}

    ${section(
      "C. Development and prior review",
      row("Reviewers / contributors", d.reviewers) +
        row("Stakeholder input", d.stakeholderInput),
    )}

    ${section(
      "D. Lead author certification",
      checkRow(
        "The work is accurate, has integrity, and is appropriately presented, including any AI-assisted content.",
        d.certAccurate,
      ) +
        checkRow(
          "The evidence and methods support the conclusions.",
          d.certEvidence,
        ) +
        checkRow(
          "Uncertainties, assumptions, and limitations are clearly stated.",
          d.certUncertainties,
        ) +
        checkRow(
          "The work complies with applicable UH policies, research protocols, disclosure requirements, and professional standards.",
          d.certCompliance,
        ) +
        row(
          "Certified by",
          `${input.author} — ${input.submittedAt.toLocaleString("en-US", {
            timeZone: "Pacific/Honolulu",
          })} HST`,
        ),
    )}

    ${section(
      "E. Availability and dissemination",
      row(
        "Available on release day for media",
        d.availableOnRelease === "yes" ? "Yes" : "No",
      ) +
        row("Contact name", d.mediaContactName) +
        row("Contact email", d.mediaContactEmail) +
        row("Contact phone", d.mediaContactPhone),
    )}
    `,
  );

  const to = (input.recipients ?? resolvePreReleaseRecipients(d)).filter(
    Boolean,
  );

  // The submitter can clear the whole list, so there is nowhere to send. Say so
  // rather than handing the transport an empty To:.
  if (!to.length) {
    log.warn(
      { approvalId: input.approvalId },
      "Pre-release submission has no recipients; skipping email",
    );
    return;
  }

  log.info(
    { approvalId: input.approvalId, recipientCount: to.length },
    "Sending pre-release submitted email",
  );
  await Mailer.email({ to, subject, html });
}
