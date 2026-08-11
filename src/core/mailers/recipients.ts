import "server-only";

/**
 * Hardcoded notification recipient lists.
 *
 * Kept in code (not the DB) for now — small, infrequent changes, and the same
 * pattern as the legacy Rails mailers. If non-engineers need to edit these we
 * can move to a `notification_recipients` table later.
 */

export const DBEDT_UPLOAD_RECIPIENTS: readonly string[] = [
  "wood2@hawaii.edu",
  "vward@hawaii.edu",
  "paul.t.oshiro@hawaii.gov", // Paul uploads the files from DBEDT 1-2x per month
];

/**
 * Default recipients for pre-release form submissions.
 *
 * These seed the notification list on the form. Submitters can add addresses
 * or remove any of these per-submission, so this is a default rather than a
 * floor — the list actually mailed is stored on the submission itself.
 */
export const PRE_RELEASE_RECIPIENTS: readonly string[] = [
  "wood2@hawaii.edu",
  "kburnett@hawaii.edu",
  "cawada@hawaii.edu",
  "bondsmit@hawaii.edu",
  "cdmoore@hawaii.edu",
  "kracoma2@hawaii.edu",
  "vward@hawaii.edu",
];

/**
 * The address list to mail for a pre-release submission.
 *
 * Current forms carry the whole list in `recipients`. Submissions saved before
 * the list became editable only stored the extras, with PRE_RELEASE_RECIPIENTS
 * implied — hence the fallback.
 */
export function resolvePreReleaseRecipients(formData: {
  recipients?: string[];
  additionalRecipients?: string[];
}): string[] {
  const clean = (list: readonly string[]) =>
    list.map((a) => a.trim()).filter(Boolean);

  if (Array.isArray(formData.recipients)) {
    return [...new Set(clean(formData.recipients))];
  }
  return [
    ...new Set([
      ...PRE_RELEASE_RECIPIENTS,
      ...clean(formData.additionalRecipients ?? []),
    ]),
  ];
}
