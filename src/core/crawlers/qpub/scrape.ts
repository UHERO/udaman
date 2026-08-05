import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

import type { Page } from "playwright-core";

import { getHtmlPath, QPUB_CONFIG } from "./config";

// ─── Types ────────────────────────────────────────────────────────────

export type ScrapeResult = {
  status: "success" | "no_data" | "captcha" | "blocked" | "error";
  tmk: string;
  htmlSaved: boolean;
  error?: string;
  /**
   * The scrape itself may have worked, but the HTML couldn't be written to the
   * NAS. Nothing was kept, so the TMK has to be scraped again — and every
   * subsequent scrape on this machine will fail the same way until the mount
   * is fixed. Callers should stop rather than burn through claims.
   */
  storageFailure?: boolean;
};

// ─── Storage failures ─────────────────────────────────────────────────

/**
 * Thrown when the scraped HTML can't be written to the NAS.
 *
 * Distinct from a scrape error so the runner can tell "this parcel failed"
 * from "this machine can't save anything" — typically an unmounted share, where
 * mkdir -p walks up to /Volumes and comes back EACCES.
 */
export class StorageError extends Error {
  readonly path: string;

  constructor(message: string, path: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
    this.path = path;
  }
}

// ─── Delay ────────────────────────────────────────────────────────────

/** Random jitter delay (4–20 s ± 0.5 s variance) */
export function randomDelay(): Promise<void> {
  const base =
    QPUB_CONFIG.DELAY_MIN +
    Math.random() * (QPUB_CONFIG.DELAY_MAX - QPUB_CONFIG.DELAY_MIN);
  const variance = (Math.random() - 0.5) * 1000;
  const ms = Math.max(QPUB_CONFIG.DELAY_MIN - 500, base + variance);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Blocker detection ────────────────────────────────────────────────

export type BlockerResult = { blocked: boolean; type?: string };

/** Check the page for reCAPTCHA / QPub captcha / Cloudflare challenge */
export async function checkForBlockers(page: Page): Promise<BlockerResult> {
  try {
    // Cloudflare challenge page — title is "Just a moment..."
    const title = await page.title();
    if (title.includes("Just a moment")) {
      return { blocked: true, type: "cloudflare_challenge" };
    }

    if (await page.$(".g-recaptcha")) {
      return { blocked: true, type: "qpub_captcha" };
    }
    if (await page.$("a#btnSubmit")) {
      return { blocked: true, type: "qpub_captcha" };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

// ─── Page status ──────────────────────────────────────────────────────

export type PageStatus = {
  status: "success" | "blocked" | "unknown";
  html: string | null;
};

/** Determine whether the page has valid parcel data, a block, or unknown */
export async function checkPageStatus(page: Page): Promise<PageStatus> {
  try {
    const html = await page.content();

    // Cloudflare block
    if (
      html.includes("Sorry, you have been blocked") ||
      html.includes("Cloudflare Ray ID")
    ) {
      return { status: "blocked", html: null };
    }

    // Check <title> for reliable identification:
    //   Success: "qPublic - <County> - Report: <parcel>"
    //   Challenge: "Just a moment..." (Cloudflare)
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    if (title.includes("Just a moment")) {
      return { status: "blocked", html: null };
    }

    // A valid parcel profile page has "qPublic" and "Report:" in the title
    if (title.includes("qPublic") && title.includes("Report:")) {
      return { status: "success", html };
    }

    // Fallback: check for Parcel Number table row (in case title format changes)
    const parcelRowPattern =
      /<tr[^>]*>[\s\S]*?<th[^>]*>[\s\S]*?Parcel Number[\s\S]*?<\/th>[\s\S]*?<td[^>]*>[\s\S]*?\d+[\s\S]*?<\/td>[\s\S]*?<\/tr>/;
    if (parcelRowPattern.test(html)) {
      return { status: "success", html };
    }

    return { status: "unknown", html: null };
  } catch {
    return { status: "unknown", html: null };
  }
}

// ─── Save to NAS ──────────────────────────────────────────────────────

/**
 * Save HTML file to the NAS filesystem.
 *
 * Any failure here is raised as a StorageError: the page has already been
 * fetched at this point, so a write that doesn't land means the request was
 * spent for nothing and the TMK still needs scraping.
 */
export async function saveHtml(tmk: string, html: string): Promise<void> {
  const htmlDir = getHtmlPath(tmk);

  try {
    if (!existsSync(htmlDir)) {
      await fs.mkdir(htmlDir, { recursive: true });
    }

    const safeName = tmk.replace(/\//g, "-");
    await fs.writeFile(path.join(htmlDir, `${safeName}.html`), html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new StorageError(`Cannot save HTML to ${htmlDir}: ${msg}`, htmlDir, {
      cause: e,
    });
  }
}

/**
 * Verify the NAS is mounted and writable before the runner starts working.
 *
 * Catches the common case — the share isn't mounted, so QPUB_CONFIG.NAS_PATH
 * points at a directory that doesn't exist and can't be created — before we
 * spend requests fetching pages we'd have nowhere to put.
 */
export async function checkStorageWritable(): Promise<{
  ok: boolean;
  path: string;
  error?: string;
}> {
  const dir = path.join(QPUB_CONFIG.NAS_PATH, QPUB_CONFIG.HTML_DIR);
  const probe = path.join(dir, `.write-probe-${process.pid}`);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(probe, "");
    await fs.unlink(probe);
    return { ok: true, path: dir };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, path: dir, error: msg };
  }
}

// ─── Saved-file classification ───────────────────────────────────────

/**
 * What a file sitting on the NAS actually turned out to be.
 *
 * "valid" covers both parcel profiles and condo-project pages — the repair
 * pass only cares whether the scrape produced something worth keeping.
 */
export type SavedFileVerdict =
  | "valid"
  | "cloudflare-challenge"
  | "cloudflare-block"
  | "captcha"
  | "shell"
  | "unknown";

/** Bytes of the file the verdict can be reached from. */
export const CLASSIFY_HEAD_BYTES = 32 * 1024;

/** Below this a page is too small to be a profile — see detectPageStatus. */
export const MIN_PROFILE_BYTES = 5_000;

/**
 * Classify a saved HTML file from its opening bytes.
 *
 * Only the head is needed: a real qPublic profile announces itself in
 * `<title>qPublic - <County> - Report: <parcel></title>`, which lands within
 * the first ~6 KB of every known-good file (condo-project pages included).
 * That matters at ~600k files on a network share, where reading each 200 KB
 * file in full is the difference between minutes and hours.
 *
 * Deliberately stricter than parse.ts's detectPageStatus, which only spots a
 * captcha via "recaptcha" + "we're sorry" and a shell via a length check — a
 * Cloudflare "Just a moment..." interstitial is ~32 KB and has neither, so it
 * reads as "unknown" there and gets silently skipped instead of re-scraped.
 */
export function classifySavedHtml(
  head: string,
  sizeBytes: number,
): SavedFileVerdict {
  if (sizeBytes < MIN_PROFILE_BYTES) return "shell";

  const lower = head.toLowerCase();

  // Checked before the title: a block page has a <title> of its own.
  if (
    lower.includes("sorry, you have been blocked") ||
    lower.includes("cloudflare ray id")
  ) {
    return "cloudflare-block";
  }

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";
  if (title.includes("qPublic") && title.includes("Report:")) return "valid";

  if (
    title.includes("Just a moment") ||
    lower.includes("cf_chl") ||
    lower.includes("challenge-platform")
  ) {
    return "cloudflare-challenge";
  }

  if (
    lower.includes("g-recaptcha") ||
    lower.includes('id="btnsubmit"') ||
    (lower.includes("recaptcha") && lower.includes("we're sorry"))
  ) {
    return "captcha";
  }

  if (!lower.includes("<body")) return "shell";

  return "unknown";
}

// ─── Captcha resolution check ────────────────────────────────────────

/** Re-check whether a captcha page has been solved (e.g. manually by the user). */
export async function isCaptchaResolved(page: Page): Promise<boolean> {
  try {
    const blocker = await checkForBlockers(page);
    if (blocker.blocked) return false;
    const pageResult = await checkPageStatus(page);
    return pageResult.status === "success";
  } catch {
    return false;
  }
}

// ─── Main scrape function ─────────────────────────────────────────────

/**
 * Navigate to a QPub URL, detect blockers, and save HTML on success.
 * Pure function — no BullMQ awareness.
 */
export async function scrapeTmk(
  page: Page,
  tmk: string,
  url: string,
): Promise<ScrapeResult> {
  try {
    // Navigate with generous timeout
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: QPUB_CONFIG.DELAY_MAX + 3_000,
    });

    // Captcha / blocker check
    const blocker = await checkForBlockers(page);
    if (blocker.blocked) {
      return { status: "captcha", tmk, htmlSaved: false, error: blocker.type };
    }

    // Page status
    const pageResult = await checkPageStatus(page);

    if (pageResult.status === "blocked") {
      return {
        status: "blocked",
        tmk,
        htmlSaved: false,
        error: "Cloudflare block",
      };
    }

    if (pageResult.status === "success" && pageResult.html) {
      // Jitter after successful page load — simulates dwell time
      await randomDelay();
      await saveHtml(tmk, pageResult.html);
      return { status: "success", tmk, htmlSaved: true };
    }

    // Unknown / no data — still save what we got for debugging
    await randomDelay();
    const html = await page.content();
    await saveHtml(tmk, html);
    return { status: "no_data", tmk, htmlSaved: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof StorageError) {
      return {
        status: "error",
        tmk,
        htmlSaved: false,
        error: msg,
        storageFailure: true,
      };
    }
    return { status: "error", tmk, htmlSaved: false, error: msg };
  }
}
