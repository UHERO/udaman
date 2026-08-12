/**
 * QPub Repair — reconcile scrape_status against what's actually on the NAS.
 *
 * scrape_status is written from several directions (the scrape runner, the
 * rebuild pipeline, the dashboard's bulk reset buttons) and none of them read
 * the disk. Drift accumulates: rows claiming a successful scrape whose file is
 * a captcha page, rows still carrying the seed's backdated scraped_at while a
 * good file sits on the NAS — which makes the runner re-download parcels it
 * already has.
 *
 * This pass walks one period's HTML directory, classifies every file from its
 * opening bytes, and brings the table in line:
 *
 *   valid profile  → scrape_status='success', scraped_at = the file's mtime
 *   no qPublic record → retired via no_results, file kept as the record of it
 *   anything else  → back to needing a scrape, and the junk file is deleted
 *
 * Dry-run unless --execute. The dry run writes the full list of doomed files
 * so a few can be eyeballed before anything is removed.
 */

import fs from "fs/promises";
import { statSync } from "fs";
import path from "path";

import { NO_RECORD_TAIL_BYTES } from "@/core/crawlers/qpub/parse-utils";
import {
  CLASSIFY_HEAD_BYTES,
  classifySavedHtml,
  type SavedFileVerdict,
} from "@/core/crawlers/qpub/scrape";
import {
  latestPeriod,
  listHtmlFiles,
  tmkFromFilePath,
} from "@/core/crawlers/qpub/config";
import { createLogger } from "@/core/observability/logger";
import { toHstSql } from "@catalog/utils/time";
import { rawQuery } from "@/lib/mysql/hhdb";

const log = createLogger("qpub-repair");

// ─── Tuning ─────────────────────────────────────────────────────────

/** Files classified at once. Bounded for the NAS, not the CPU. */
const READ_CONCURRENCY = 24;

/** TMKs per UPDATE ... WHERE tmk IN (...) statement. */
const UPDATE_CHUNK_SIZE = 1_000;

const PROGRESS_EVERY = 25_000;

/** Where the dry run leaves its lists for inspection. */
const REPORT_DIR = "tmp";

// ─── Types ──────────────────────────────────────────────────────────

export type RepairOptions = {
  /** NAS period dir. Defaults to the newest one present on disk. */
  period?: string;
  /** Filter by island code ('1'–'4'). */
  island?: string;
  /** Apply changes. Without it nothing is written or deleted. */
  execute?: boolean;
  /** Keep bad files on disk instead of deleting them. */
  keepBadFiles?: boolean;
  /** Also flip rows with no file in this period back to needing a scrape. */
  resetMissing?: boolean;
};

type Classified = {
  tmk: string;
  filePath: string;
  verdict: SavedFileVerdict;
  mtime: Date;
  sizeBytes: number;
};

// ─── File classification ────────────────────────────────────────────

/**
 * Read the opening and closing bytes of a file in one open.
 *
 * The verdict needs both ends: the title near the top identifies a profile,
 * and the "no data available" notice sits 9-13 KB from EOF — the only thing
 * separating a real parcel from a phantom one. Neither end needs the ~200 KB
 * in between.
 */
async function readEnds(
  filePath: string,
  size: number,
): Promise<{ head: string; tail: string }> {
  const handle = await fs.open(filePath, "r");
  try {
    const headLen = Math.min(CLASSIFY_HEAD_BYTES, size);
    const headBuf = Buffer.alloc(headLen);
    await handle.read(headBuf, 0, headLen, 0);

    const tailLen = Math.min(NO_RECORD_TAIL_BYTES, size);
    const tailBuf = Buffer.alloc(tailLen);
    await handle.read(tailBuf, 0, tailLen, size - tailLen);

    return {
      head: headBuf.toString("utf-8"),
      tail: tailBuf.toString("utf-8"),
    };
  } finally {
    await handle.close();
  }
}

async function classifyFile(filePath: string): Promise<Classified> {
  const tmk = tmkFromFilePath(filePath);
  const stat = statSync(filePath);
  const { head, tail } = await readEnds(filePath, stat.size);

  return {
    tmk,
    filePath,
    verdict: classifySavedHtml(head, stat.size, tail),
    mtime: stat.mtime,
    sizeBytes: stat.size,
  };
}

/**
 * Classify every file with a bounded number of reads in flight.
 *
 * A plain Promise.all over 600k paths would open 600k handles at once; a
 * sequential loop would spend the whole run waiting on network round trips.
 */
async function classifyAll(filePaths: string[]): Promise<Classified[]> {
  const out: Classified[] = new Array(filePaths.length);
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= filePaths.length) return;
      try {
        out[i] = await classifyFile(filePaths[i]);
      } catch (e) {
        // An unreadable file is as good as a missing one — flag it for rescrape
        // rather than aborting a pass over hundreds of thousands of files.
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ filePath: filePaths[i], error: msg }, "Could not read file");
        out[i] = {
          tmk: tmkFromFilePath(filePaths[i]),
          filePath: filePaths[i],
          verdict: "unknown",
          mtime: new Date(0),
          sizeBytes: 0,
        };
      }
      if (++done % PROGRESS_EVERY === 0) {
        log.info(
          { classified: done, total: filePaths.length },
          `Classified ${done.toLocaleString()}/${filePaths.length.toLocaleString()}`,
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(READ_CONCURRENCY, filePaths.length) }, worker),
  );
  return out;
}

// ─── Writes ─────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Point scraped_at at the file's mtime and mark the scrape good.
 *
 * TMKs arrive bucketed by HST calendar day so one statement can serve a
 * thousand rows. Nothing reads scraped_at at finer than day granularity — the
 * claim query works in months, the dashboard counters in DATE() — so the
 * rounding is lossless for every current consumer.
 *
 * `error` is only cleared where the scrape itself was previously failing:
 * most rows carry a parse or load error instead, and blanket-clearing would
 * wipe the dashboard's record of those. The SET order matters — MySQL assigns
 * left to right, so scrape_status has to be written after the CASE reads it.
 */
async function markScraped(day: string, tmks: string[]): Promise<number> {
  const scrapedAt = `${day} 00:00:00`;
  let affected = 0;

  for (const batch of chunk(tmks, UPDATE_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "?").join(",");
    const result = (await rawQuery(
      `UPDATE scrape_status
       SET scraped_at = ?,
           retry_count = 0,
           error = CASE WHEN scrape_status <> 'success' THEN NULL ELSE error END,
           scrape_status = 'success'
       WHERE tmk IN (${placeholders})
         AND (scraped_at IS NULL
              OR scraped_at <> ?
              OR scrape_status <> 'success'
              OR retry_count <> 0)`,
      [scrapedAt, ...batch, scrapedAt],
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

/**
 * Send rows back to the front of the queue.
 *
 * scraped_at=NULL plus retry_count=0 is exactly what the runner's claim query
 * looks for, and the retry reset frees anything that had burned through
 * MAX_RETRIES. Parse and load go back to pending because their source file is
 * about to be deleted — whatever they last succeeded on was this same junk.
 */
async function markNeedsScrape(
  tmks: string[],
  reason: string,
): Promise<number> {
  let affected = 0;

  for (const batch of chunk(tmks, UPDATE_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "?").join(",");
    const result = (await rawQuery(
      `UPDATE scrape_status
       SET scrape_status = 'failed',
           scraped_at = NULL,
           retry_count = 0,
           parse_status = 'pending',
           parsed_at = NULL,
           load_status = 'pending',
           loaded_at = NULL,
           error = ?
       WHERE tmk IN (${placeholders})`,
      [`repair: ${reason}`, ...batch],
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

/**
 * Retire TMKs the county has no parcel for.
 *
 * Only sets the flag: scraped_at was already stamped from the file's mtime
 * alongside the valid files, because the page genuinely was fetched then. The
 * no_results flag, not a falsified timestamp, is what keeps these out of the
 * queues.
 */
async function markNoRecord(tmks: string[]): Promise<number> {
  let affected = 0;

  for (const batch of chunk(tmks, UPDATE_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "?").join(",");
    const result = (await rawQuery(
      `UPDATE scrape_status
       SET scrape_status='success', retry_count=0,
           no_results=1, no_results_at=NOW(), error=?
       WHERE tmk IN (${placeholders})`,
      ["repair: no qPublic record for this TMK", ...batch],
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

/**
 * Clear rows whose file never showed up for this period.
 *
 * Unlike the bad-file path this leaves parse/load alone: those may reflect
 * good data loaded from an earlier period, and there's no file here to
 * contradict them.
 */
async function markMissing(tmks: string[], period: string): Promise<number> {
  let affected = 0;

  for (const batch of chunk(tmks, UPDATE_CHUNK_SIZE)) {
    const placeholders = batch.map(() => "?").join(",");
    const result = (await rawQuery(
      `UPDATE scrape_status
       SET scrape_status = 'failed',
           scraped_at = NULL,
           retry_count = 0,
           error = ?
       WHERE tmk IN (${placeholders})`,
      [`repair: no HTML file on disk for period ${period}`, ...batch],
    )) as unknown as { affectedRows?: number };
    affected += result?.affectedRows ?? 0;
  }

  return affected;
}

// ─── Reporting ──────────────────────────────────────────────────────

async function writeList(name: string, lines: string[]): Promise<string> {
  const file = path.join(REPORT_DIR, name);
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(file, lines.join("\n") + (lines.length ? "\n" : ""));
  return file;
}

function countBy<T, K extends string>(items: T[], key: (t: T) => K) {
  const counts = {} as Record<K, number>;
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// ─── Entry point ────────────────────────────────────────────────────

export async function runRepair(opts: RepairOptions = {}): Promise<string> {
  const {
    island,
    execute = false,
    keepBadFiles = false,
    resetMissing = false,
  } = opts;

  const period = opts.period ?? latestPeriod();
  if (!period) {
    throw new Error(
      "No period directories found on the NAS — is the share mounted?",
    );
  }

  const startMs = Date.now();
  log.info(
    { period, island, execute, keepBadFiles, resetMissing },
    execute ? "Repair started (EXECUTE)" : "Repair started (dry run)",
  );

  // 1. Enumerate this period's files
  const filePaths = Array.from(listHtmlFiles(period, island));
  if (filePaths.length === 0) {
    const msg = `Repair: no HTML files found for period ${period}`;
    log.warn({ period, island }, msg);
    return msg;
  }
  log.info(
    { period, files: filePaths.length },
    `Found ${filePaths.length.toLocaleString()} files in period ${period}`,
  );

  // 2. Classify from each file's opening bytes
  const classified = await classifyAll(filePaths);
  const verdicts = countBy(classified, (c) => c.verdict);

  // 3. Which of those TMKs the table actually knows about. Files whose TMK has
  //    no row can't be repaired — scrape_status is FK'd to properties, so
  //    there's nothing to insert against. They get reported instead.
  const rows = await rawQuery<{ tmk: string }>(
    `SELECT tmk FROM scrape_status`,
  );
  const knownTmks = new Set(rows.map((r) => r.tmk));

  const orphans = classified.filter((c) => !knownTmks.has(c.tmk));
  const known = classified.filter((c) => knownTmks.has(c.tmk));

  const valid = known.filter((c) => c.verdict === "valid");
  // A phantom parcel is a real answer, not junk: its file stays on disk and
  // its row is retired instead of being sent back round the queue.
  const noRecord = known.filter((c) => c.verdict === "no-record");
  const bad = known.filter(
    (c) => c.verdict !== "valid" && c.verdict !== "no-record",
  );

  // Rows the table claims but this period has no file for.
  const onDisk = new Set(classified.map((c) => c.tmk));
  const missing = Array.from(knownTmks).filter((t) => !onDisk.has(t));

  // 4. Report before touching anything
  console.log(`
─── QPub repair — period ${period}${island ? ` island ${island}` : ""} ───

Files on disk        ${filePaths.length.toLocaleString()}
${Object.entries(verdicts)
  .sort((a, b) => b[1] - a[1])
  .map(([v, n]) => `  ${v.padEnd(20)} ${n.toLocaleString()}`)
  .join("\n")}

Valid, in table      ${valid.length.toLocaleString()}   → scraped_at set from file mtime
No qPublic record    ${noRecord.length.toLocaleString()}   → retired from the queue, file kept
Bad, in table        ${bad.length.toLocaleString()}   → back to needing a scrape${keepBadFiles ? "" : ", file deleted"}
Files w/o a row      ${orphans.length.toLocaleString()}   → reported only (TMK not in properties)
Rows w/o a file      ${missing.length.toLocaleString()}   → ${resetMissing ? "back to needing a scrape" : "reported only (pass --reset-missing to clear)"}
`);

  if (bad.length > 0) {
    const file = await writeList(
      `qpub-repair-${period}-bad-files.txt`,
      bad.map((c) => `${c.verdict}\t${c.sizeBytes}\t${c.filePath}`),
    );
    console.log(`Bad files listed in ${file}`);
    for (const c of bad.slice(0, 10)) {
      console.log(`  ${c.verdict.padEnd(20)} ${c.sizeBytes} B  ${c.filePath}`);
    }
    if (bad.length > 10) console.log(`  … and ${bad.length - 10} more`);
  }

  if (orphans.length > 0) {
    const file = await writeList(
      `qpub-repair-${period}-orphans.txt`,
      orphans.map((c) => c.tmk),
    );
    console.log(`\nOrphan TMKs listed in ${file}`);
  }

  if (!execute) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const summary = `Repair (dry run): ${valid.length} valid, ${noRecord.length} no-record, ${bad.length} bad, ${orphans.length} orphan files, ${missing.length} rows without a file (${elapsed}s). Re-run with --execute to apply.`;
    console.log(`\n${summary}\n`);
    log.info(summary);
    return summary;
  }

  // 5. Apply — stamp scraped_at from mtime, bucketed by HST day.
  //    Phantom parcels are included: the page really was fetched on that date,
  //    and it's the no_results flag rather than staleness that retires them.
  const byDay = new Map<string, string[]>();
  for (const c of [...valid, ...noRecord]) {
    const day = toHstSql(c.mtime).slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(c.tmk);
    else byDay.set(day, [c.tmk]);
  }

  let scrapedUpdated = 0;
  for (const [day, tmks] of byDay) {
    scrapedUpdated += await markScraped(day, tmks);
  }
  log.info(
    { rows: scrapedUpdated, days: byDay.size },
    `Marked ${scrapedUpdated.toLocaleString()} rows scraped from file mtimes`,
  );

  // 5b. Phantom parcels — flagged, file left alone.
  let retired = 0;
  if (noRecord.length > 0) {
    retired = await markNoRecord(noRecord.map((c) => c.tmk));
    log.info(
      { rows: retired },
      `Retired ${retired.toLocaleString()} TMKs with no qPublic record`,
    );
  }

  // 6. Bad files — one statement per verdict so the stored error says which
  let rescrapeUpdated = 0;
  const badByVerdict = new Map<SavedFileVerdict, string[]>();
  for (const c of bad) {
    const list = badByVerdict.get(c.verdict);
    if (list) list.push(c.tmk);
    else badByVerdict.set(c.verdict, [c.tmk]);
  }
  for (const [verdict, tmks] of badByVerdict) {
    rescrapeUpdated += await markNeedsScrape(tmks, verdict);
  }
  if (bad.length > 0) {
    log.info(
      { rows: rescrapeUpdated },
      `Sent ${rescrapeUpdated.toLocaleString()} rows back for re-scraping`,
    );
  }

  // 7. Delete the junk. After the DB write, so a crash here leaves files that
  //    the next pass simply classifies again — the harmless direction.
  let deleted = 0;
  let deleteFailed = 0;
  if (!keepBadFiles) {
    for (const c of bad) {
      try {
        await fs.unlink(c.filePath);
        deleted++;
      } catch (e) {
        deleteFailed++;
        const msg = e instanceof Error ? e.message : String(e);
        log.warn({ filePath: c.filePath, error: msg }, "Could not delete file");
      }
    }
    log.info({ deleted, deleteFailed }, `Deleted ${deleted} bad files`);
  }

  // 8. Rows with no file, only when asked
  let missingUpdated = 0;
  if (resetMissing && missing.length > 0) {
    missingUpdated = await markMissing(missing, period);
    log.info(
      { rows: missingUpdated },
      `Cleared ${missingUpdated.toLocaleString()} rows with no file on disk`,
    );
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const summary =
    `Repair: ${scrapedUpdated} rows synced to disk, ${retired} retired (no qPublic record), ${rescrapeUpdated} sent back for re-scraping, ` +
    `${deleted} files deleted${deleteFailed ? ` (${deleteFailed} failed)` : ""}` +
    `${resetMissing ? `, ${missingUpdated} missing-file rows cleared` : ""} ` +
    `(${elapsed}s)`;
  console.log(`\n${summary}\n`);
  log.info(summary);
  return summary;
}
