// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

import { closeBrowser } from "@/core/crawlers/qpub/browser";
import {
  buildUrl,
  isBlockedTime,
  ISLANDS,
  isScrapePeriodActive,
  msUntilUnblocked,
  type IslandCode,
} from "@/core/crawlers/qpub/config";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { processScrape, type ScrapeResult } from "./processors/qpub-scrape";
import {
  recordCaptcha,
  recordScraped,
  setScraperState,
  startHeartbeat,
  stopHeartbeat,
} from "./scraper-heartbeat";

const log = createLogger("scrape-runner");

const CLAIM_SIZE = 3;
const STALE_MONTHS = 6;
const CLAIM_TIMEOUT_MINUTES = 5;
const MAX_RETRIES = 10;
const SCRAPE_CUTOFF_HOUR = 22; // 10pm — stop scraping for the day
const WEEKLY_SLEEP_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_SLEEP_MS = 30_000;
const CAPTCHA_DELAY_MS = 5 * 60_000;

// Captchas cluster: once one appears the next requests usually get them too,
// and short 5-minute pauses just burn through claims without clearing the
// block. After this many in a row, back off properly instead.
const MAX_CONSECUTIVE_CAPTCHAS = 3;
const CAPTCHA_BACKOFF_MS = 45 * 60_000; // 45 minutes
const CAPTCHA_BACKOFF_JITTER_MIN_MS = 60_000; // + 1 minute
const CAPTCHA_BACKOFF_JITTER_MAX_MS = 15 * 60_000; // + up to 15 minutes

// Occasional long pause between batches. The per-request 4–20s jitter keeps a
// steady rhythm that becomes recognizable over a multi-week scrape, so rarely
// dropping offline for a stretch breaks up the long-run traffic pattern.
const LONG_SLEEP_CHANCE = 1 / 1000;
const LONG_SLEEP_MIN_MS = 60_000; // 1 minute
const LONG_SLEEP_MAX_MS = 60 * 60_000; // 60 minutes

let running = true;

/** Captchas/blocks seen since the last successful scrape. */
let consecutiveCaptchas = 0;

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

/**
 * With low probability, go offline for 1–60 minutes before claiming the next
 * batch. Closes the browser first so we're not holding an idle session, which
 * also means the next batch comes back with a fresh viewport/fingerprint.
 */
async function maybeLongSleep(): Promise<void> {
  if (Math.random() >= LONG_SLEEP_CHANCE) return;

  const ms =
    LONG_SLEEP_MIN_MS + Math.random() * (LONG_SLEEP_MAX_MS - LONG_SLEEP_MIN_MS);

  const minutes = +(ms / 60_000).toFixed(1);
  log.info(
    { sleepMinutes: minutes },
    "Random long sleep — pausing between batches",
  );
  setScraperState("sleeping", `random long sleep ${minutes}m`);
  await closeBrowser();
  await sleep(ms);
}

// ─── Captcha backoff ───────────────────────────────────────────────────

/**
 * Close any pages processScrape handed back on captcha/blocked.
 *
 * Those pages are deliberately not returned to the idle pool — a page sitting
 * on a captcha shouldn't be recycled — which makes disposing of them the
 * caller's job. Skipping this leaks one window per captcha, and captchas
 * arrive in clusters.
 */
async function disposeCaptchaPages(
  results: PromiseSettledResult<ScrapeResult | null>[],
): Promise<void> {
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value?.page) continue;
    try {
      await r.value.page.close();
    } catch {
      // Already gone (context torn down elsewhere) — nothing to clean up.
    }
  }
}

/**
 * Tally a finished batch's outcomes into the consecutive-captcha counter.
 *
 * Results are walked in order so a success mid-batch resets the streak —
 * only an unbroken run of captchas/blocks counts toward the backoff.
 * Hard errors are ignored: they say nothing about whether we're blocked.
 */
function tallyCaptchas(
  results: PromiseSettledResult<{ status: string } | null>[],
): void {
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const { status } = r.value;
    if (status === "captcha" || status === "blocked") {
      consecutiveCaptchas++;
      recordCaptcha();
    } else if (status === "success") {
      consecutiveCaptchas = 0;
      recordScraped();
    }
  }
}

/**
 * After MAX_CONSECUTIVE_CAPTCHAS in a row, stop hammering: shut the browser
 * down entirely and sit out 45 minutes plus 1–15 minutes of jitter. Returns
 * true if the long backoff ran.
 */
async function captchaBackoffIfNeeded(): Promise<boolean> {
  if (consecutiveCaptchas < MAX_CONSECUTIVE_CAPTCHAS) return false;

  const ms =
    CAPTCHA_BACKOFF_MS +
    CAPTCHA_BACKOFF_JITTER_MIN_MS +
    Math.random() *
      (CAPTCHA_BACKOFF_JITTER_MAX_MS - CAPTCHA_BACKOFF_JITTER_MIN_MS);

  const minutes = +(ms / 60_000).toFixed(1);
  log.warn(
    { consecutiveCaptchas, sleepMinutes: minutes },
    "Consecutive captcha limit hit — closing browser and backing off",
  );
  // Distinct from the short pause: this is the state worth walking over to the
  // machine for, so it gets its own label rather than sharing "captcha-pause".
  setScraperState(
    "captcha-sleep",
    `${consecutiveCaptchas} captchas in a row — sleeping ${minutes}m`,
  );

  await closeBrowser();
  await sleep(ms);
  consecutiveCaptchas = 0;
  return true;
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
  startHeartbeat();

  while (running) {
    // 1. Check if there's anything stale to scrape
    const staleCount = await countStale();
    if (staleCount === 0) {
      log.info("All records current — sleeping 1 week");
      setScraperState("idle", "all records current — sleeping 1 week");
      await closeBrowser();
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
      const delayMinutes = Math.round(delayMs / 60_000);
      log.info({ delayMinutes }, "Blocked time window — sleeping");
      setScraperState(
        "blocked-window",
        `blocked window — ${delayMinutes}m left`,
      );
      await closeBrowser();
      await sleep(delayMs);
      continue;
    }

    // 4. Past 10pm cutoff — close browser and sleep until 5am
    if (isPastCutoff()) {
      log.info("Past 10pm scrape cutoff — sleeping until 5am");
      setScraperState("sleeping", "past 10pm cutoff — until 5am");
      await closeBrowser();
      await sleep(msUntil5am());
      continue;
    }

    // 5. Occasional long pause to vary the long-run request pattern
    await maybeLongSleep();
    if (!running) break;

    // 6. Claim items
    const claimed = await claimItems();
    if (claimed.length === 0) {
      log.info("All items locked by other workers — retrying in 30s");
      setScraperState("idle", "waiting on claims held by other workers");
      await sleep(RETRY_SLEEP_MS);
      continue;
    }

    setScraperState(
      "scraping",
      `${staleCount.toLocaleString()} stale remaining`,
    );

    // 7. Scrape all claimed items concurrently (each opens its own browser tab)
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

    const results = await Promise.allSettled(scrapeJobs);

    // 8. Every job has settled, so it's now safe to tear down browser state —
    //    doing it mid-batch would pull the context out from under siblings.
    await disposeCaptchaPages(results);
    tallyCaptchas(results);

    // 9. Escalate to a long backoff once captchas stack up; otherwise fall
    //    back to the short pause when this batch saw any captcha/block.
    if (await captchaBackoffIfNeeded()) continue;

    const wasBlocked = results.some(
      (r) =>
        r.status === "fulfilled" &&
        r.value &&
        (r.value.status === "captcha" || r.value.status === "blocked"),
    );
    if (wasBlocked) {
      log.warn(
        { consecutiveCaptchas },
        "Captcha/block in batch — pausing before next claim",
      );
      setScraperState(
        "captcha-pause",
        `captcha pause (${consecutiveCaptchas} of ${MAX_CONSECUTIVE_CAPTCHAS} before long sleep)`,
      );
      // Drop the session so the next batch starts fresh. processScrape used to
      // do this itself, mid-batch, which is what tore the context out from
      // under the other concurrent jobs and forced a relaunch each time.
      await closeBrowser();
      await sleep(CAPTCHA_DELAY_MS);
    }
  }

  log.info("Scrape runner shutting down");
  shuttingDown = true;
  await closeBrowser();
  await stopHeartbeat();
  process.exit(0);
}

// ─── Graceful shutdown ─────────────────────────────────────────────────

function shutdown() {
  log.info("Received shutdown signal");
  running = false;
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Exit diagnostics ──────────────────────────────────────────────────

// This process is supposed to run for weeks. Any exit that isn't our own
// shutdown path is a bug, and the default behaviour — a silent exit(0) when
// the event loop drains — leaves nothing in the log to work from.

/** Set once we intentionally tear down, so the exit hook can stay quiet. */
let shuttingDown = false;

process.on("uncaughtException", (err) => {
  log.error(
    { err: err?.message ?? String(err), stack: err?.stack },
    "Uncaught exception",
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason as Error | undefined;
  log.error(
    { err: err?.message ?? String(reason), stack: err?.stack },
    "Unhandled promise rejection",
  );
  process.exit(1);
});

// beforeExit fires when the loop has drained but the process could still be
// revived — the signature of a silent exit, and the case we can't otherwise see.
process.on("beforeExit", (code) => {
  if (shuttingDown) return;
  log.error(
    { code, running },
    "Event loop drained unexpectedly — nothing left to keep the runner alive",
  );
});

process.on("exit", (code) => {
  if (shuttingDown) return;
  log.error({ code, running }, "Scrape runner exited unexpectedly");
});

// ─── Start ─────────────────────────────────────────────────────────────

run().catch((err) => {
  log.error(
    { err: err?.message ?? String(err), stack: err?.stack },
    "Scrape runner crashed",
  );
  process.exit(1);
});
