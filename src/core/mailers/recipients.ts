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
