/**
 * QPub Enqueue — put a TMK into the scrape queue.
 *
 * scrape_status has no writer that creates rows: every row in it came from the
 * one-time seed that copied `properties`. So a TMK discovered after that seed —
 * a parcel the State added, a condo unit listed on a master profile — got a
 * properties row and nothing else, and was never scraped. This is the missing
 * half.
 *
 * Both callers need the same two-step insert, because scrape_status.tmk is
 * FK'd to properties: the stub property row has to exist first. The stub
 * carries only tmk and island_code; the real data lands when the parcel is
 * scraped and loaded.
 */

import fs from "fs/promises";

import {
  getIslandCode,
  latestPeriod,
  listHtmlFiles,
  tmkFromFilePath,
} from "@/core/crawlers/qpub/config";
import { condoUnitRows, parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { looksLikeCondoMaster } from "@/core/crawlers/qpub/scrape";
import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/hhdb";

import { unitParcelToTmk } from "./qpub-load";

const log = createLogger("qpub-enqueue");

const INSERT_CHUNK_SIZE = 500;

/** Concurrent file reads during the backfill. Bounded for the NAS. */
const READ_CONCURRENCY = 24;

/**
 * Head bytes read to decide whether a file is a condo master.
 *
 * The roster table lands ~47–64 KB in on the masters sampled across Oahu,
 * Hawaii and Kauai, so this carries a healthy margin — and it exceeds most
 * files outright, which means the head read doubles as the full read.
 */
const SCAN_HEAD_BYTES = 256 * 1024;

/**
 * Read the first `bytes` of a file without pulling the whole thing over.
 *
 * Reports bytesRead alongside the text because the two don't agree: one
 * multi-byte character anywhere in the head makes the decoded string shorter
 * than the byte count, so string length can't tell a complete small file from
 * a truncated large one.
 */
async function readHead(
  filePath: string,
  bytes: number,
): Promise<{ text: string; bytesRead: number }> {
  const handle = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return { text: buf.subarray(0, bytesRead).toString("utf-8"), bytesRead };
  } finally {
    await handle.close();
  }
}

export type EnqueueEntry = { tmk: string; islandCode: string };

/**
 * Insert queue rows for TMKs we don't already track. Existing rows are left
 * exactly as they are — this only ever adds.
 *
 * New rows are written as 'failed' rather than 'pending' because 'pending'
 * means "claimed by a running scraper" here, and the claim query skips it.
 * With scraped_at NULL and retry_count 0, a 'failed' row is precisely what
 * the runner looks for. (`updated_at` starts at NOW(), so the claim query's
 * 5-minute staleness guard holds it back for one cycle — it becomes
 * claimable on its own.)
 */
export async function enqueueTmks(
  entries: EnqueueEntry[],
  reason: string,
): Promise<{ properties: number; queued: number }> {
  if (entries.length === 0) return { properties: 0, queued: 0 };

  // Guard against a caller handing us the same TMK twice in one batch, which
  // would make the multi-row INSERT trip over its own primary key.
  const seen = new Set<string>();
  const unique = entries.filter((e) =>
    seen.has(e.tmk) ? false : (seen.add(e.tmk), true),
  );

  let properties = 0;
  let queued = 0;

  for (let i = 0; i < unique.length; i += INSERT_CHUNK_SIZE) {
    const batch = unique.slice(i, i + INSERT_CHUNK_SIZE);

    // Stub properties first — scrape_status.tmk is FK'd to it.
    const propValues = batch.map(() => "(?, ?)").join(",");
    const propResult = (await rawQuery(
      `INSERT IGNORE INTO properties (tmk, island_code) VALUES ${propValues}`,
      batch.flatMap((e) => [e.tmk, e.islandCode]),
    )) as unknown as { affectedRows?: number };
    properties += propResult?.affectedRows ?? 0;

    const statusValues = batch
      .map(() => "(?, 'failed', NULL, 'pending', 'pending', 0, ?)")
      .join(",");
    const statusResult = (await rawQuery(
      `INSERT IGNORE INTO scrape_status
         (tmk, scrape_status, scraped_at, parse_status, load_status, retry_count, error)
       VALUES ${statusValues}`,
      batch.flatMap((e) => [e.tmk, `enqueued: ${reason}`]),
    )) as unknown as { affectedRows?: number };
    queued += statusResult?.affectedRows ?? 0;
  }

  return { properties, queued };
}

/**
 * Unit TMKs listed on a condo master profile.
 *
 * The master page carries the roster; each unit shares the master's TMK with
 * its own CPR suffix. Returns [] for anything that isn't a master, and for
 * Maui — whose masters don't publish a roster at all.
 */
export function condoUnitTmksFromHtml(
  html: string,
  parentTmk: string,
): string[] {
  if (!looksLikeCondoMaster(html)) return [];

  const parsed = parsePropertyHTML(html, parentTmk);
  if (parsed.status !== "condo_project") return [];

  const tmks: string[] = [];
  for (const unit of condoUnitRows(parsed)) {
    const unitParcel = unit.parcel_number;
    if (typeof unitParcel !== "string" || !unitParcel.trim()) continue;

    const unitTmk = unitParcelToTmk(parentTmk, unitParcel.trim());
    // A roster row echoing the master itself would otherwise queue a scrape
    // of the page we just read.
    if (unitTmk !== parentTmk) tmks.push(unitTmk);
  }

  return tmks;
}

/**
 * Backfill: walk the HTML already on the NAS and queue every condo unit found.
 *
 * The live hook only fires on new scrapes, so masters captured before it
 * existed — which is all of them — would never surrender their rosters
 * otherwise. Dry run unless `execute`.
 */
export async function backfillCondoUnits(
  opts: { period?: string; island?: string; execute?: boolean } = {},
): Promise<string> {
  const { island, execute = false } = opts;
  const period = opts.period ?? latestPeriod();
  if (!period) {
    throw new Error(
      "No period directories found on the NAS — is the share mounted?",
    );
  }

  const startMs = Date.now();
  log.info(
    { period, island, execute },
    execute
      ? "Condo unit backfill started (EXECUTE)"
      : "Condo unit backfill started (dry run)",
  );

  const filePaths = Array.from(listHtmlFiles(period, island));
  log.info(
    { period, files: filePaths.length },
    `Scanning ${filePaths.length.toLocaleString()} files`,
  );

  let scanned = 0;
  let masters = 0;
  let listed = 0;
  let queued = 0;
  let pending: EnqueueEntry[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    if (execute) {
      const result = await enqueueTmks(batch, "condo unit backfill");
      queued += result.queued;
    }
  };

  /** Units listed by one file, or [] if it isn't a master. */
  const unitsInFile = async (filePath: string): Promise<string[]> => {
    // Read a generous head first. The roster table appears ~47–64 KB in on
    // every master seen, so this decides the question for a fraction of the
    // bytes — and for files at or under the cap it IS the whole document, so
    // masters that small need no second read.
    const { text, bytesRead } = await readHead(filePath, SCAN_HEAD_BYTES);
    if (!looksLikeCondoMaster(text)) return [];

    // Only a short read proves we hold the whole file. A full-length read may
    // have stopped mid-document — and mid-roster — so re-read it properly.
    const parentTmk = tmkFromFilePath(filePath);
    const html =
      bytesRead < SCAN_HEAD_BYTES
        ? text
        : await fs.readFile(filePath, "utf-8");
    return condoUnitTmksFromHtml(html, parentTmk);
  };

  // Reads run concurrently — over a network share the per-file round trip
  // dominates, so a sequential walk of ~600k files would take hours.
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= filePaths.length) return;
      const filePath = filePaths[i];

      try {
        const unitTmks = await unitsInFile(filePath);
        if (unitTmks.length > 0) {
          const parentTmk = tmkFromFilePath(filePath);
          const islandCode = getIslandCode(parentTmk);
          masters++;
          listed += unitTmks.length;
          pending.push(...unitTmks.map((tmk) => ({ tmk, islandCode })));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ filePath, error: msg }, "Could not read file");
      }

      if (++scanned % 25_000 === 0) {
        log.info(
          { scanned, masters, listed },
          `Scanned ${scanned.toLocaleString()}/${filePaths.length.toLocaleString()} — ${masters.toLocaleString()} masters, ${listed.toLocaleString()} units listed`,
        );
      }

      if (pending.length >= INSERT_CHUNK_SIZE * 4) await flush();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(READ_CONCURRENCY, filePaths.length) }, worker),
  );
  await flush();

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary = execute
    ? `Condo unit backfill: ${masters.toLocaleString()} masters, ${listed.toLocaleString()} units listed, ${queued.toLocaleString()} newly queued (${scanned.toLocaleString()} files, ${elapsed}s)`
    : `Condo unit backfill (dry run): ${masters.toLocaleString()} masters, ${listed.toLocaleString()} units listed across ${scanned.toLocaleString()} files (${elapsed}s). Re-run with --execute to queue them.`;

  log.info(summary);
  console.log(`\n${summary}\n`);
  return summary;
}

/**
 * Queue every unit a condo master lists. Safe to call on any scraped page —
 * non-masters return without touching the database.
 */
export async function enqueueCondoUnits(
  parentTmk: string,
  html: string,
): Promise<number> {
  const unitTmks = condoUnitTmksFromHtml(html, parentTmk);
  if (unitTmks.length === 0) return 0;

  const islandCode = getIslandCode(parentTmk);
  const { queued } = await enqueueTmks(
    unitTmks.map((tmk) => ({ tmk, islandCode })),
    `condo unit of ${parentTmk}`,
  );

  if (queued > 0) {
    log.info(
      { parentTmk, listed: unitTmks.length, queued },
      `Queued ${queued} new condo units from ${parentTmk}`,
    );
  }

  return queued;
}
