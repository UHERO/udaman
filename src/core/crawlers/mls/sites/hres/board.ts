/**
 * Which MLS issued a listing number on hawaiirealestatesearch.com.
 *
 * The site serves one combined feed of all three Hawaii MLSs and never prints
 * the board as a field. The dependable signal is the photo CDN path — every
 * photo URL is `feed-images.rewhosting.com/<feed>/…` and the feed names the
 * source MLS. Shared by the list and detail parsers.
 */

import type { MlsBoard } from "../../types";

export const HRES_PHOTO_FEED_BOARDS: Readonly<Record<string, MlsBoard>> = {
  trestle_webapi_plus: "HBR",
  his_acortez: "HIS",
  ramaui: "RAM",
};

const PHOTO_FEED = /feed-images\.rewhosting\.com\\?\/([a-z0-9_]+)\\?\//i;

/** Board from a photo URL (or any text containing one); null when none. */
export function boardFromPhotoUrl(
  text: string | null | undefined,
): MlsBoard | null {
  const m = PHOTO_FEED.exec(text ?? "");
  if (!m) return null;
  const feed = m[1].toLowerCase();
  return Object.hasOwn(HRES_PHOTO_FEED_BOARDS, feed)
    ? HRES_PHOTO_FEED_BOARDS[feed]
    : null;
}

/**
 * Board from the number's shape alone: HBR issues 9-digit numbers
 * (2026xxxxx); HIS and RAM both issue 6-digit ones, so those stay null.
 */
export function boardFromNumberShape(mlsNumber: string): MlsBoard | null {
  return /^\d{9}$/.test(mlsNumber) ? "HBR" : null;
}

/** Board named by an MLS disclaimer paragraph; null for boilerplate ones. */
export function boardFromDisclaimer(
  text: string | null | undefined,
): MlsBoard | null {
  const s = text ?? "";
  if (/HiCentral\s+MLS/i.test(s)) return "HBR";
  if (/Hawaii\s+Information\s+Service/i.test(s)) return "HIS";
  if (/Association\s+of\s+Maui/i.test(s)) return "RAM";
  return null;
}
