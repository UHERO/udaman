import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { errorMessage, processLoad } from "./qpub-load";
import { processParse } from "./qpub-parse";

const log = createLogger("qpub-nightly");

type StatusRow = {
  tmk: string;
  island_code: string;
};

// ─── Repair phase ──────────────────────────────────────────────────────

/**
 * Fix inconsistent scrape_status records before parsing:
 *
 * 1. Orphaned scrape_status='pending' — no active scraper is claiming these.
 *    Mark scrape_status='failed' so they're visible as problems.
 *
 * 2. Records where scraped_at > parsed_at — re-scraped but never re-parsed.
 *    Reset parse_status='pending' and load_status='pending' so they
 *    re-enter the pipeline.
 */
async function repairStatusRecords(): Promise<void> {
  // 1. Orphaned pending scrapes → failed
  const [orphaned] = await rawQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM scrape_status WHERE scrape_status = 'pending'`,
  );
  if (Number(orphaned?.cnt ?? 0) > 0) {
    await rawQuery(
      `UPDATE scrape_status
       SET scrape_status = 'failed', error = 'orphaned pending record'
       WHERE scrape_status = 'pending'`,
    );
    log.info({ count: Number(orphaned.cnt) }, "Repair: marked orphaned pending scrapes as failed");
  }

  // 2. Re-scraped but not re-parsed → reset parse+load to pending
  const [stale] = await rawQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM scrape_status
     WHERE scrape_status = 'success'
       AND parsed_at IS NOT NULL
       AND scraped_at > parsed_at
       AND parse_status = 'success'`,
  );
  if (Number(stale?.cnt ?? 0) > 0) {
    await rawQuery(
      `UPDATE scrape_status
       SET parse_status = 'pending', load_status = 'pending'
       WHERE scrape_status = 'success'
         AND parsed_at IS NOT NULL
         AND scraped_at > parsed_at
         AND parse_status = 'success'`,
    );
    log.info({ count: Number(stale.cnt) }, "Repair: reset re-scraped records to pending parse+load");
  }
}

// ─── Parse phase ───────────────────────────────────────────────────────

async function parseAll(): Promise<{ parsed: number; failed: number }> {
  const rows = await rawQuery<StatusRow>(
    `SELECT s.tmk, p.island_code
     FROM scrape_status s
     JOIN properties p ON s.tmk = p.tmk
     WHERE s.scrape_status = 'success'
       AND (s.parse_status = 'pending' OR s.parse_status = 'failed')`,
  );

  log.info({ count: rows.length }, "Parse phase: records to process");

  if (rows.length === 0) return { parsed: 0, failed: 0 };

  let parsed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await processParse(
        { tmk: row.tmk, island: row.island_code },
        (msg) => log.info(msg),
      );
      parsed++;
    } catch (e) {
      failed++;
      log.error({ tmk: row.tmk, error: errorMessage(e) }, "Parse failed");
    }

    if ((parsed + failed) % 100 === 0) {
      log.info({ parsed, failed, total: rows.length }, "Parse progress");
    }
  }

  return { parsed, failed };
}

// ─── Load phase ────────────────────────────────────────────────────────

async function loadAll(): Promise<{ loaded: number; failed: number }> {
  const rows = await rawQuery<StatusRow>(
    `SELECT s.tmk, p.island_code
     FROM scrape_status s
     JOIN properties p ON s.tmk = p.tmk
     WHERE s.parse_status = 'success'
       AND (s.load_status = 'pending' OR s.load_status = 'failed')`,
  );

  log.info({ count: rows.length }, "Load phase: records to process");

  if (rows.length === 0) return { loaded: 0, failed: 0 };

  let loaded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await processLoad(
        { tmk: row.tmk },
        (msg) => log.info(msg),
      );
      loaded++;
    } catch (e) {
      failed++;
      log.error({ tmk: row.tmk, error: errorMessage(e) }, "Load failed");
    }

    if ((loaded + failed) % 100 === 0) {
      log.info({ loaded, failed, total: rows.length }, "Load progress");
    }
  }

  return { loaded, failed };
}

// ─── Main entry point ──────────────────────────────────────────────────

/**
 * Run nightly parse+load on freshly scraped records.
 * Called by scrape-runner after 10pm cutoff or when stale records are exhausted,
 * and by qpub-cli for manual runs.
 */
export async function processNightly(): Promise<string> {
  log.info("Nightly parse+load started");

  await repairStatusRecords();

  const parseResult = await parseAll();
  log.info(parseResult, "Parse phase complete");

  const loadResult = await loadAll();
  log.info(loadResult, "Load phase complete");

  const summary = [
    `Nightly complete:`,
    `parsed ${parseResult.parsed} (${parseResult.failed} failed),`,
    `loaded ${loadResult.loaded} (${loadResult.failed} failed)`,
  ].join(" ");

  log.info(summary);
  return summary;
}
