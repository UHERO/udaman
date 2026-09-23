/**
 * DCCA Real Estate Branch "Condo Reports" — the public register of every
 * condominium project in Hawaii (https://web3.dcca.hawaii.gov/reb/public/).
 *
 * Two page kinds:
 *   index    /reb/public/result?search=      one page, every project (~9.3k rows)
 *   profile  /reb/public/result2?reg=<n>     one project, keyed by its
 *                                            registration number
 *
 * The register replaced the old DPR.Net site (ShowPublic.aspx?PROJTEXT=…)
 * whose links the condominium_projects.dcca_link column used to hold.
 */

export const DCCA_BASE_URL = "https://web3.dcca.hawaii.gov";

export const DCCA_INDEX_URL = `${DCCA_BASE_URL}/reb/public/result?search=`;

export function dccaProfileUrl(reg: string): string {
  return `${DCCA_BASE_URL}/reb/public/result2?reg=${encodeURIComponent(reg)}`;
}

export const DCCA_USER_AGENT =
  "UHERO-research-scraper/1.0 (University of Hawaii Economic Research Organization; uhero.hawaii.edu)";

/** Minimum pause between requests; a random 0..DCCA_JITTER_MS is added. */
export const DCCA_MIN_DELAY_MS = 750;
export const DCCA_JITTER_MS = 750;

/** Per-request timeout so one hung socket cannot stall the run. */
export const DCCA_TIMEOUT_MS = 30_000;

/** A profile page is ~4.5–6.5 KB; the index is ~2.4 MB. Smaller is an error stub. */
export const DCCA_MIN_PROFILE_BYTES = 1_000;
export const DCCA_MIN_INDEX_BYTES = 100_000;
