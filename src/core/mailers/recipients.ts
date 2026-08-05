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
 * Standard recipients for pre-release form submissions.
 *
 * TODO: replace this placeholder with the real comms/leadership list.
 * Submitters can add further addresses per-submission on the form itself,
 * which are CC'd on top of this list.
 */
export const PRE_RELEASE_RECIPIENTS: readonly string[] = ["wood2@hawaii.edu"];
