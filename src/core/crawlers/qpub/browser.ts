import { mkdirSync } from "fs";
import os from "os";
import path from "path";

import type { BrowserContext, Page } from "playwright-core";
import { chromium, firefox } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("qpub-browser");

// ─── Stealth setup (once) ─────────────────────────────────────────────

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
chromium.use(stealth);
firefox.use(stealth);

// ─── Browser type selection ───────────────────────────────────────────

type BrowserName = "chromium" | "firefox";
let browserName: BrowserName = "chromium";

/** Set which browser engine to use. Must be called before first getPage(). */
export function setBrowserType(name: string): void {
  if (name === "firefox" || name === "chromium") {
    browserName = name;
  } else {
    throw new Error(
      `Unsupported browser: ${name} (use "chromium" or "firefox")`,
    );
  }
}

// ─── Shared browser state ─────────────────────────────────────────────

let context: BrowserContext | null = null;
const idlePages: Page[] = [];

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

// ─── Session warmup ───────────────────────────────────────────────────

/** Visit QPub homepage and county search page to establish session cookies. */
async function warmup(ctx: BrowserContext): Promise<void> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    log.info("Warming up — visiting QPub homepage");
    await page.goto("https://qpublic.schneidercorp.com", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await new Promise((r) => setTimeout(r, 3_000 + Math.random() * 2_000));

    log.info("Warming up — visiting county search page");
    await page.goto(
      "https://qpublic.schneidercorp.com/Application.aspx?App=HonoluluCountyHI&PageType=Search",
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await new Promise((r) => setTimeout(r, 3_000 + Math.random() * 2_000));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn({ error: msg }, "Warmup navigation failed — continuing anyway");
  }

  // Return warmup page to the pool for reuse
  try {
    await page.goto("about:blank");
    idlePages.push(page);
  } catch {
    // discard if broken
  }

  log.info("Warmup complete");
}

// ─── Browser lifecycle ────────────────────────────────────────────────

/** Launch browser with persistent context if not already running. */
async function ensureBrowser(): Promise<BrowserContext> {
  if (context) return context;

  const launcher = browserName === "firefox" ? firefox : chromium;
  const dataDir = path.join(os.homedir(), ".qpub-browser", browserName);
  mkdirSync(dataDir, { recursive: true });

  log.info({ browser: browserName }, "Launching browser with persistent context");

  context = await launcher.launchPersistentContext(dataDir, {
    headless: false,
    viewport: randomViewport(),
    ...(browserName === "chromium"
      ? {
          args: [
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        }
      : {}),
  });

  await warmup(context);
  return context;
}

/** Get a page from the pool, or create a new one if none are idle. */
export async function getPage(): Promise<Page> {
  const ctx = await ensureBrowser();
  return idlePages.pop() ?? ctx.newPage();
}

/** Return a page to the pool for reuse. */
export async function releasePage(page: Page): Promise<void> {
  try {
    await page.goto("about:blank");
    idlePages.push(page);
  } catch {
    // Page is broken/closed — discard it
  }
}

/** Remove a specific page from the idle pool without closing it. */
export function removeFromPool(page: Page): void {
  const idx = idlePages.indexOf(page);
  if (idx !== -1) idlePages.splice(idx, 1);
}

/** Shut down browser and context — called on worker shutdown. */
export async function closeBrowser(): Promise<void> {
  idlePages.length = 0;
  if (context) {
    try {
      await context.close();
    } catch {
      // ignore
    }
    context = null;
  }
  log.info("Browser closed");
}
