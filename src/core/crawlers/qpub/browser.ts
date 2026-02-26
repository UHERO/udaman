import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("qpub-browser");

// ─── Stealth setup (once) ─────────────────────────────────────────────

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
chromium.use(stealth);

// ─── Shared browser state ─────────────────────────────────────────────

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/** Random desktop viewport (same strategy as old scraper) */
function randomViewport() {
  const widths = [1280, 1366, 1440, 1536];
  const heights = [720, 768, 900, 960, 1024];
  const w = widths[Math.floor(Math.random() * widths.length)];
  const h = heights[Math.floor(Math.random() * heights.length)];
  return {
    width: w + Math.floor(Math.random() * 100) - 50,
    height: h + Math.floor(Math.random() * 100) - 50,
  };
}

/** Launch browser + context if not already running */
async function ensureBrowser(): Promise<BrowserContext> {
  if (browser && context) return context;

  log.info("Launching headless Chromium with stealth plugin");
  browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
  context = await browser.newContext({ viewport: randomViewport() });
  log.info("Browser ready");
  return context;
}

/** Get a fresh page (tab) from the shared browser context. */
export async function getPage(): Promise<Page> {
  const ctx = await ensureBrowser();
  return ctx.newPage();
}

/** Close the page after use */
export async function releasePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {
    // page may already be closed
  }
}

/** Shut down browser and context — called on worker shutdown */
export async function closeBrowser(): Promise<void> {
  if (context) {
    try {
      await context.close();
    } catch {
      // ignore
    }
    context = null;
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    browser = null;
  }
  log.info("Browser closed");
}
