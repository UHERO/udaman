// Ensure all date operations use Hawaii Standard Time.
process.env.TZ = "Pacific/Honolulu";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { processLoad } from "./processors/qpub-load";
import { processParse } from "./processors/qpub-parse";

const log = createLogger("batch-loader");

type StatusRow = {
  tmk: string;
  island_code: string;
};

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
      const msg = e instanceof Error ? e.message : String(e);
      log.error({ tmk: row.tmk, error: msg }, "Parse failed");
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
      const msg = e instanceof Error ? e.message : String(e);
      log.error({ tmk: row.tmk, error: msg }, "Load failed");
    }

    if ((loaded + failed) % 100 === 0) {
      log.info({ loaded, failed, total: rows.length }, "Load progress");
    }
  }

  return { loaded, failed };
}

// ─── Frequency counts ──────────────────────────────────────────────────

async function updateFrequencyCounts(): Promise<void> {
  log.info("Running frequency count stored procedure");
  await rawQuery(`CALL update_frequency_counts()`, []);
  log.info("Frequency counts updated");
}

// ─── Main ──────────────────────────────────────────────────────────────

async function run() {
  log.info("Batch loader started");

  const parseResult = await parseAll();
  log.info(parseResult, "Parse phase complete");

  const loadResult = await loadAll();
  log.info(loadResult, "Load phase complete");

  try {
    await updateFrequencyCounts();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ error: msg }, "Frequency count procedure failed");
  }

  log.info(
    {
      parsed: parseResult.parsed,
      parseFailed: parseResult.failed,
      loaded: loadResult.loaded,
      loadFailed: loadResult.failed,
    },
    "Batch loader complete",
  );

  process.exit(0);
}

run().catch((err) => {
  log.error({ err: err.message }, "Batch loader crashed");
  process.exit(1);
});
