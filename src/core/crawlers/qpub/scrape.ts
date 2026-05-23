import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

import type { Page } from "playwright-core";

import {
  getHtmlPath,
  QPUB_CONFIG,
} from "./config";

// ─── Types ────────────────────────────────────────────────────────────

export type ScrapeResult = {
  status: "success" | "no_data" | "captcha" | "blocked" | "error";
  tmk: string;
  htmlSaved: boolean;
  error?: string;
};

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

/** Save HTML file to the NAS filesystem */
export async function saveHtml(tmk: string, html: string): Promise<void> {
  const htmlDir = getHtmlPath(tmk);

  if (!existsSync(htmlDir)) {
    await fs.mkdir(htmlDir, { recursive: true });
  }

  const safeName = tmk.replace(/\//g, "-");
  await fs.writeFile(path.join(htmlDir, `${safeName}.html`), html);
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
    return { status: "error", tmk, htmlSaved: false, error: msg };
  }
}
