import {
  closeBrowser,
  releasePage,
  setBrowserType,
} from "@/core/crawlers/qpub/browser";
import {
  buildUrl,
  isBlockedTime,
  ISLANDS,
  isScrapePeriodActive,
  msUntilUnblocked,
  type IslandCode,
} from "@/core/crawlers/qpub/config";
import { isCaptchaResolved } from "@/core/crawlers/qpub/scrape";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import type { Page } from "playwright-core";

import { errorMessage, processLoad } from "./processors/qpub-load";
import { processNightly } from "./processors/qpub-nightly";
import { processParse } from "./processors/qpub-parse";
import { processScrape } from "./processors/qpub-scrape";

// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

// ─── Browser selection (CLI arg) ──────────────────────────────────────
// Usage: bun run scraper [chromium|firefox|webkit]

const browserArg = process.argv[2];
if (browserArg) {
  try {
    setBrowserType(browserArg);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

const log = createLogger("scrape-runner");

const CLAIM_SIZE = 3;
const STALE_MONTHS = 6;
const CLAIM_TIMEOUT_MINUTES = 5;
const MAX_RETRIES = 10;
const SCRAPE_CUTOFF_HOUR = 22; // 10pm — stop scraping, let batch loader work
const WEEKLY_SLEEP_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_SLEEP_MS = 30_000;
const CAPTCHA_DELAY_MS = 5 * 60_000;

let running = true;

/** Track which calendar day we last ran nightly parse+load (YYYY-MM-DD) */
let lastNightlyDate: string | null = null;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Run nightly parse+load if we haven't already done so today.
 * Called when scraping is done for the day (10pm cutoff or no stale records).
 */
async function runNightlyIfNeeded(): Promise<void> {
  const today = todayStr();
  if (lastNightlyDate === today) {
    log.info("Nightly parse+load already ran today — skipping");
    return;
  }

  try {
    const result = await processNightly();
    log.info(result);
    lastNightlyDate = today;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ error: msg }, "Nightly parse+load failed");
    // Don't set lastNightlyDate — allow retry on next iteration
  }
}

// ─── Claiming ─────────────────────────────────────────────────────────

type ClaimedItem = {
  tmk: string;
  island_code: string;
};

async function claimItems(): Promise<ClaimedItem[]> {
  // Use a single query to claim items atomically.
  // MariaDB doesn't support SKIP LOCKED in the same way as MySQL 8+,
  // so we use a transaction with FOR UPDATE SKIP LOCKED.
  const rows = await rawQuery<ClaimedItem>(
    `SELECT s.tmk, p.island_code
     FROM scrape_status s
     JOIN properties p ON s.tmk = p.tmk
     WHERE (s.scraped_at < NOW() - INTERVAL ${STALE_MONTHS} MONTH OR s.scraped_at IS NULL)
       AND s.scrape_status != 'pending'
       AND s.updated_at < NOW() - INTERVAL ${CLAIM_TIMEOUT_MINUTES} MINUTE
       AND s.retry_count < ${MAX_RETRIES}
     ORDER BY s.scraped_at ASC
     LIMIT ${CLAIM_SIZE}
     FOR UPDATE SKIP LOCKED`,
  );

  if (rows.length === 0) return [];

  const tmks = rows.map((r) => r.tmk);
  const placeholders = tmks.map(() => "?").join(",");
  await rawQuery(
    `UPDATE scrape_status
     SET scrape_status = 'pending', error = NULL
     WHERE tmk IN (${placeholders})`,
    tmks,
  );

  return rows;
}

// ─── Time helpers ──────────────────────────────────────────────────────

function isPastCutoff(): boolean {
  return new Date().getHours() >= SCRAPE_CUTOFF_HOUR;
}

function msUntil5am(): number {
  const now = new Date();
  const target = new Date(now);
  // If it's past midnight, 5am is today; otherwise it's tomorrow
  if (now.getHours() < 5) {
    target.setHours(5, 0, 0, 0);
  } else {
    target.setDate(target.getDate() + 1);
    target.setHours(5, 0, 0, 0);
  }
  return target.getTime() - now.getTime();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Allow shutdown to interrupt sleep
    const check = setInterval(() => {
      if (!running) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 1000);
  });
}

// ─── Stale count ───────────────────────────────────────────────────────

async function countStale(): Promise<number> {
  const rows = await rawQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM scrape_status
     WHERE (scraped_at < NOW() - INTERVAL ${STALE_MONTHS} MONTH OR scraped_at IS NULL)
       AND retry_count < ${MAX_RETRIES}`,
  );
  return Number(rows[0]?.cnt ?? 0);
}

// ─── Inline parse+load ────────────────────────────────────────────────

type PendingRow = { tmk: string; island_code: string; parse_status: string };

/**
 * Process previously-scraped records (parse → load) until the stop signal
 * fires or no pending records remain. Runs concurrently with the scrape
 * batch so the 4–20 s delay per page is used productively.
 */
async function processPendingRecords(signal: {
  stop: boolean;
}): Promise<number> {
  let count = 0;
  while (!signal.stop && running) {
    const rows = await rawQuery<PendingRow>(
      `SELECT s.tmk, p.island_code, s.parse_status
       FROM scrape_status s
       JOIN properties p ON s.tmk = p.tmk
       WHERE s.scrape_status = 'success'
         AND (s.parse_status IN ('pending','failed')
              OR s.load_status IN ('pending','failed'))
       LIMIT 1`,
    );
    if (rows.length === 0) break;

    const { tmk, island_code, parse_status } = rows[0];
    try {
      if (parse_status !== "success") {
        await processParse({ tmk, island: island_code }, (msg) =>
          log.debug(msg),
        );
      }
      await processLoad({ tmk }, (msg) => log.debug(msg));
      count++;
    } catch (e) {
      log.error(
        { tmk, error: errorMessage(e) },
        "Inline parse+load failed",
      );
    }
  }
  return count;
}

// ─── Main loop ─────────────────────────────────────────────────────────

async function run() {
  log.info("Scrape runner started");

  while (running) {
    // 1. Check if there's anything stale to scrape
    const staleCount = await countStale();
    if (staleCount === 0) {
      log.info("All records current — running nightly then sleeping 1 week");
      await runNightlyIfNeeded();
      await sleep(WEEKLY_SLEEP_MS);
      continue;
    }

    log.info({ staleCount }, "Stale records found");

    // 2. Check scrape period
    if (!isScrapePeriodActive()) {
      log.info("Outside scrape period (blocked in Jan/Feb/Aug) — exiting");
      break;
    }

    // 3. Check blocked time (backup 7-8pm, night 11pm-5am)
    if (isBlockedTime()) {
      const delayMs = msUntilUnblocked();
      log.info(
        { delayMinutes: Math.round(delayMs / 60_000) },
        "Blocked time window — sleeping",
      );
      await closeBrowser();
      await sleep(delayMs);
      continue;
    }

    // 4. Past 10pm cutoff — close browser, run nightly, sleep until 5am
    if (isPastCutoff()) {
      log.info("Past 10pm scrape cutoff — running nightly parse+load");
      await closeBrowser();
      await runNightlyIfNeeded();
      await sleep(msUntil5am());
      continue;
    }

    // 5. Claim items
    const claimed = await claimItems();
    if (claimed.length === 0) {
      log.info("All items locked by other workers — retrying in 30s");
      await sleep(RETRY_SLEEP_MS);
      continue;
    }

    // 6. Scrape all claimed items concurrently (each opens its own browser tab)
    const scrapeJobs = claimed
      .filter((item) => {
        const islandCode = item.island_code as IslandCode;
        if (!(islandCode in ISLANDS)) {
          log.warn(
            { tmk: item.tmk, island: islandCode },
            "Unknown island code — skipping",
          );
          return false;
        }
        return true;
      })
      .map(async (item) => {
        const islandCode = item.island_code as IslandCode;
        const url = buildUrl(item.tmk, islandCode);
        try {
          const result = await processScrape(
            { tmk: item.tmk, url, island: islandCode },
            (msg) => log.info(msg),
          );
          if (result.status === "captcha" || result.status === "blocked") {
            log.warn(
              { tmk: item.tmk, status: result.status },
              "Captcha/blocked detected",
            );
            return result;
          }
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.error({ tmk: item.tmk, error: msg }, "Scrape error");
          return null;
        }
      });

    // Run parse+load for previously scraped records while this batch scrapes.
    // The scrape jobs spend most of their time on network I/O and randomDelay(),
    // so we use that idle time to process pending records concurrently.
    const inlineSignal = { stop: false };
    const [results] = await Promise.all([
      Promise.allSettled(scrapeJobs).then((r) => {
        inlineSignal.stop = true;
        return r;
      }),
      processPendingRecords(inlineSignal).then((count) => {
        if (count > 0)
          log.info({ count }, "Inline parse+load completed during scrape");
      }),
    ]);

    // Collect captcha pages from batch results
    const captchaPages: Page[] = results
      .filter(
        (r) =>
          r.status === "fulfilled" &&
          r.value?.page &&
          (r.value.status === "captcha" || r.value.status === "blocked"),
      )
      .map((r) => (r as PromiseFulfilledResult<{ page: Page }>).value.page);

    if (captchaPages.length > 0) {
      log.warn(
        { count: captchaPages.length },
        "Captcha detected — pages left open for manual solving. Monitoring...",
      );

      const pollInterval = 5_000;
      const maxPolls = CAPTCHA_DELAY_MS / pollInterval;
      let resolved = false;

      for (let i = 0; i < maxPolls && running; i++) {
        await sleep(pollInterval);

        for (const page of captchaPages) {
          if (await isCaptchaResolved(page)) {
            log.info("Captcha solved by user — resuming scraping");
            resolved = true;
            break;
          }
        }
        if (resolved) break;
      }

      if (!resolved) {
        log.info("Captcha backoff expired — releasing pages");
      }

      for (const page of captchaPages) {
        await releasePage(page);
      }
    }
  }

  log.info("Scrape runner shutting down");
  await closeBrowser();
  process.exit(0);
}

// ─── Graceful shutdown ─────────────────────────────────────────────────

function shutdown() {
  log.info("Received shutdown signal");
  running = false;
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Start ─────────────────────────────────────────────────────────────

run().catch((err) => {
  log.error({ err: err.message }, "Scrape runner crashed");
  process.exit(1);
});
