import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { errorMessage, processLoad } from "./qpub-load";
import { processParse } from "./qpub-parse";
import { runPipeline } from "./qpub-pipeline";

const log = createLogger("qpub-nightly");

type StatusRow = {
  tmk: string;
  island_code: string;
  parse_status: string;
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

// ─── Main entry point ──────────────────────────────────────────────────

/**
 * Run nightly parse+load on freshly scraped records.
 * Called by scrape-runner after 10pm cutoff or when stale records are exhausted,
 * and by qpub-cli for manual runs.
 */
export async function processNightly(): Promise<string> {
  log.info("Nightly parse+load started");

  await repairStatusRecords();

  // Query TMKs needing work: scrape succeeded but parse or load still pending/failed
  const rows = await rawQuery<StatusRow>(
    `SELECT s.tmk, p.island_code, s.parse_status
     FROM scrape_status s
     JOIN properties p ON s.tmk = p.tmk
     WHERE s.scrape_status = 'success'
       AND (s.parse_status IN ('pending','failed') OR s.load_status IN ('pending','failed'))`,
  );

  // Build a tmk → island_code map for processParse
  const islandMap = new Map<string, string>();
  const parseStatusMap = new Map<string, string>();
  for (const row of rows) {
    islandMap.set(row.tmk, row.island_code);
    parseStatusMap.set(row.tmk, row.parse_status);
  }

  const tmks = rows.map((r) => r.tmk);

  const result = await runPipeline({
    label: "Nightly",
    tmks,
    processFn: async (tmk) => {
      const island = islandMap.get(tmk)!;
      const parseStatus = parseStatusMap.get(tmk)!;

      // Parse if needed
      if (parseStatus !== "success") {
        try {
          await processParse(
            { tmk, island },
            (msg) => log.info(msg),
          );
        } catch (e) {
          // Parse failed — can't load, propagate error
          throw new Error(`Parse failed: ${errorMessage(e)}`);
        }
      }

      // Load with skipStatusUpdate — pipeline handles batch status updates
      await processLoad(
        { tmk },
        (msg) => log.debug(msg),
        { skipStatusUpdate: true },
      );

      return "done";
    },
    log,
  });

  const summary = [
    `Nightly complete:`,
    `${result.done} done, ${result.skipped} skipped, ${result.failed} failed`,
    `(${result.total} total)`,
  ].join(" ");

  log.info(summary);
  return summary;
}
