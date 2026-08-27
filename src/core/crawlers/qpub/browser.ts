import { mkdirSync } from "fs";
import os from "os";
import path from "path";

import type { BrowserContext, Page } from "playwright-core";
import { chromium, firefox, webkit } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("qpub-browser");

// ─── Stealth setup (once) ─────────────────────────────────────────────

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
chromium.use(stealth);
firefox.use(stealth);
webkit.use(stealth);

// ─── Browser type selection ───────────────────────────────────────────

const SUPPORTED_BROWSERS = ["chromium", "firefox", "webkit"] as const;
type BrowserName = (typeof SUPPORTED_BROWSERS)[number];
let browserName: BrowserName = "chromium";

/** Set which browser engine to use. Must be called before first getPage(). */
export function setBrowserType(name: string): void {
  if (SUPPORTED_BROWSERS.includes(name as BrowserName)) {
    browserName = name as BrowserName;
  } else {
    throw new Error(
      `Unsupported browser: "${name}" (use ${SUPPORTED_BROWSERS.join(", ")})`,
    );
  }
}

// ─── Shared browser state ─────────────────────────────────────────────

let context: BrowserContext | null = null;
/** In-flight launch, shared by concurrent ensureBrowser() callers. */
let launchPromise: Promise<BrowserContext> | null = null;
const idlePages: Page[] = [];

/** Cap on how long a browser launch may hang before we treat it as failed. */
const LAUNCH_TIMEOUT_MS = 60_000;

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

/** Do the actual launch + warmup. Only ever called via ensureBrowser(). */
async function launchContext(): Promise<BrowserContext> {
  const launchers = { chromium, firefox, webkit } as const;
  const launcher = launchers[browserName];
  const dataDir = path.join(os.homedir(), ".qpub-browser", browserName);
  mkdirSync(dataDir, { recursive: true });

  log.info(
    { browser: browserName, dataDir },
    "Launching browser with persistent context",
  );

  const startedAt = Date.now();
  const ctx = await launcher.launchPersistentContext(dataDir, {
    headless: false,
    viewport: randomViewport(),
    // Fail instead of hanging forever when the profile is already in use.
    timeout: LAUNCH_TIMEOUT_MS,
    ...(browserName === "chromium"
      ? {
          args: [
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ],
        }
      : {}),
  });

  // Logged before warmup so "launch hung" and "warmup hung" are distinguishable
  // in the log rather than both looking like silence after the launch line.
  log.info(
    { launchMs: Date.now() - startedAt, pages: ctx.pages().length },
    "Browser launched — starting warmup",
  );

  await warmup(ctx);
  return ctx;
}

/**
 * Launch the browser if not already running, safely under concurrency.
 *
 * The runner scrapes CLAIM_SIZE items at once, so several callers hit this at
 * the same instant on a cold start. Checking `context` alone is not enough —
 * it is only assigned after the await, so every caller would pass the guard
 * and launch its own browser against the SAME persistent dataDir. Chromium
 * single-instance-locks that directory, so the extra launches block on the
 * profile lock (silently, and indefinitely on Windows).
 *
 * Memoising the in-flight promise means concurrent callers all await one launch.
 */
async function ensureBrowser(): Promise<BrowserContext> {
  if (context) return context;

  if (!launchPromise) {
    launchPromise = launchContext().then(
      (ctx) => {
        context = ctx;
        launchPromise = null;
        return ctx;
      },
      (err) => {
        // Clear on failure so a later batch can retry rather than reusing a
        // permanently rejected promise.
        launchPromise = null;
        throw err;
      },
    );
  }

  return launchPromise;
}

/**
 * Thrown when the browser itself can't be started.
 *
 * Distinct from a page-level failure because it says nothing about the parcel
 * and everything about the machine: a missing executable, a Playwright/driver
 * version mismatch, a profile lock. None of those clear by retrying, so the
 * runner treats this as fatal rather than moving on to the next TMK.
 */
export class BrowserUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BrowserUnavailableError";
  }
}

/** Get a page from the pool, or create a new one if none are idle. */
export async function getPage(): Promise<Page> {
  let ctx: BrowserContext;
  try {
    ctx = await ensureBrowser();
  } catch (e) {
    // Typed at the boundary rather than matched on message text later —
    // "Executable doesn't exist", version mismatches and profile-lock timeouts
    // all word themselves differently, but all mean the same thing here.
    const msg = e instanceof Error ? e.message : String(e);
    throw new BrowserUnavailableError(`Browser failed to launch: ${msg}`, {
      cause: e,
    });
  }
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

  // If a launch is still in flight, wait for it before tearing down —
  // otherwise it completes after this returns and leaves an orphan browser
  // holding the profile lock, which blocks every future launch.
  if (launchPromise) {
    try {
      await launchPromise;
    } catch {
      // Launch failed; nothing to close.
    }
  }

  if (context) {
    try {
      await context.close();
    } catch {
      // ignore
    }
    context = null;
  }

  launchPromise = null;
  log.info("Browser closed");
}
