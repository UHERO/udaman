// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

import {
  closeBrowser,
} from "@/core/crawlers/qpub/browser";
import {
  buildUrl,
  isBlockedTime,
  isScrapePeriodActive,
  msUntilUnblocked,
  type IslandCode,
  ISLANDS,
} from "@/core/crawlers/qpub/config";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { processScrape } from "./processors/qpub-scrape";

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

// ─── Main loop ─────────────────────────────────────────────────────────

async function run() {
  log.info("Scrape runner started");

  while (running) {
    // 1. Check if there's anything stale to scrape
    const staleCount = await countStale();
    if (staleCount === 0) {
      log.info("All records current — sleeping 1 week");
      await sleep(WEEKLY_SLEEP_MS);
      continue;
    }

    log.info({ staleCount }, "Stale records found");

    // 2. Check scrape period
    if (!isScrapePeriodActive()) {
      log.info(
        "Outside scrape period (blocked in Jan/Feb/Aug) — exiting",
      );
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

    // 4. Past 10pm cutoff — close browser and sleep until 5am
    if (isPastCutoff()) {
      log.info("Past 10pm scrape cutoff — sleeping until 5am");
      await closeBrowser();
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

    // 6. Process each claimed item
    for (const item of claimed) {
      if (!running) break;

      // Re-check time constraints before each scrape
      if (isBlockedTime() || isPastCutoff()) break;

      const islandCode = item.island_code as IslandCode;
      if (!(islandCode in ISLANDS)) {
        log.warn({ tmk: item.tmk, island: islandCode }, "Unknown island code — skipping");
        continue;
      }

      const url = buildUrl(item.tmk, islandCode);

      try {
        const result = await processScrape(
          { tmk: item.tmk, url, island: islandCode },
          (msg) => log.info(msg),
        );

        if (result.status === "captcha" || result.status === "blocked") {
          log.warn(
            { tmk: item.tmk, status: result.status },
            "Captcha/blocked — pausing before next item",
          );
          await sleep(CAPTCHA_DELAY_MS);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error({ tmk: item.tmk, error: msg }, "Scrape error");
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
