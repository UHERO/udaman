import os from "os";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

const log = createLogger("scraper-heartbeat");

/**
 * Liveness heartbeat for the scrape runner.
 *
 * The runner has no queue backing it — it claims rows from scrape_status
 * directly — so there's nothing to inspect from outside to tell whether a
 * given machine is still working. Each process writes its own row here on a
 * timer and the dashboard reads it back.
 *
 * The timer is deliberately independent of the main loop: the runner spends
 * most of its life inside long sleeps (until 5am, captcha backoff, a week when
 * everything is current), and a heartbeat driven by loop iterations would
 * look dead for hours at a stretch.
 */

/** Coarse phase reported to the dashboard. */
export type ScraperState =
  | "starting"
  | "scraping"
  | "sleeping"
  /** Short pause after 1–2 captchas in a batch. */
  | "captcha-pause"
  /** Long backoff after MAX_CONSECUTIVE_CAPTCHAS — worth looking at the machine. */
  | "captcha-sleep"
  | "blocked-window"
  | "idle";

const HEARTBEAT_INTERVAL_MS = 30_000;

/** Rows older than this are shown as stale/dead by the dashboard. */
export const HEARTBEAT_STALE_SECONDS = 120;

/**
 * Stable identity for this process.
 *
 * os.hostname() is NOT stable on macOS: with `HostName` unset (the default),
 * the OS derives the running hostname from DHCP/reverse-DNS, so the same
 * machine reports 's200n209.soc.hawaii.edu' on one network and 'Kaisers.local'
 * on another — and a new DHCP lease can change it again. Since the heartbeat
 * row is keyed on this, an unstable name means one machine registers under
 * several identities and leaves orphan rows behind.
 *
 * Set WORKER_NAME in each machine's .env to pin it. Hostname is only a fallback.
 */
const osHostname = os.hostname();
const workerName = process.env.WORKER_NAME?.trim() || osHostname;
const pid = process.pid;
const id = `${workerName}:${pid}`;

let timer: ReturnType<typeof setInterval> | null = null;
let state: ScraperState = "starting";
let detail: string | null = null;
let scrapedCount = 0;
let captchaCount = 0;

/** Write the current in-memory state to the heartbeat row. */
async function beat(): Promise<void> {
  try {
    await rawQuery(
      `INSERT INTO scraper_heartbeats
         (id, worker_name, host, pid, state, detail, scraped_count, captcha_count, started_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         host=VALUES(host),
         state=VALUES(state),
         detail=VALUES(detail),
         scraped_count=VALUES(scraped_count),
         captcha_count=VALUES(captcha_count),
         last_seen_at=NOW()`,
      [
        id,
        workerName,
        osHostname,
        pid,
        state,
        detail,
        scrapedCount,
        captchaCount,
      ],
    );
  } catch (e) {
    // Never let heartbeat trouble take the scraper down — it's diagnostics.
    const msg = e instanceof Error ? e.message : String(e);
    log.warn({ error: msg }, "Heartbeat write failed");
  }
}

/**
 * Update the reported phase. Writes immediately so a state change shows up on
 * the dashboard without waiting for the next tick — this matters most right
 * before a long sleep, which is exactly when someone is likely to be looking.
 */
export function setScraperState(next: ScraperState, nextDetail?: string): void {
  state = next;
  detail = nextDetail ?? null;
  void beat();
}

/** Count scrapes that completed successfully. */
export function recordScraped(count = 1): void {
  scrapedCount += count;
}

/** Count captcha/blocked responses. */
export function recordCaptcha(count = 1): void {
  captchaCount += count;
}

/** Begin heartbeating. Safe to call more than once. */
export function startHeartbeat(): void {
  if (timer) return;

  void beat();
  // Deliberately NOT unref'd: the runner should stay alive as long as it is
  // heartbeating, and shutdown goes through process.exit() rather than
  // waiting for the event loop to drain.
  timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);

  if (!process.env.WORKER_NAME) {
    log.warn(
      { osHostname },
      "WORKER_NAME is not set — falling back to the OS hostname, which is not stable across networks. Set WORKER_NAME in .env to keep this worker's dashboard identity consistent.",
    );
  }
  log.info({ id, workerName, osHostname, pid }, "Heartbeat started");
}

/**
 * Stop heartbeating and remove this process's row, so a clean shutdown
 * disappears from the dashboard immediately rather than aging out.
 */
export async function stopHeartbeat(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  try {
    await rawQuery(`DELETE FROM scraper_heartbeats WHERE id = ?`, [id]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn({ error: msg }, "Heartbeat cleanup failed");
  }
}
