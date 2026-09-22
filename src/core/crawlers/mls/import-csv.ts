import { existsSync, statSync } from "fs";
import path from "path";

import { hstToday, toHstSql } from "@/core/catalog/utils/time";
import { createLogger } from "@/core/observability/logger";

import { resilient } from "./db-retry";
import { MlsFetchAbort } from "./fetcher";
import * as db from "./load";
import { listingKey } from "./load";
import { readHtml } from "./nas-cache";
import { parseMoney } from "./normalize";
import { assertPermanentCacheAvailable, makeFetcher } from "./pipeline";
import { getSiteAdapter } from "./registry";
import type { MlsBoard, SiteAdapter } from "./types";

const log = createLogger("mls-import");

const loadListing = resilient("loadListing", db.loadListing);
const getKnownListings = resilient("getKnownListings", db.getKnownListings);

/**
 * One-off import of listings from an earlier scrape, given a CSV of MLS
 * numbers (+ optional sourceUrl) and a directory of pages saved back then.
 *
 *   1. Dedupe: one entry per MLS number; anything already in mls_listings
 *      (any site, any status) is dropped.
 *   2. Saved page: `<pagesDir>/listing-<mls>.html` exists → parse + insert,
 *      backdating first_seen/last_seen/fetched to the file's mtime.
 *   3. Otherwise fetch it now — the CSV's sourceUrl when it is a URL, else
 *      the site's number-only URL — through the normal fetcher (permanent
 *      NAS cache, crawl delay, redirects), parse + insert.
 *
 * Rerunnable: step 1 skips everything a previous run inserted, and step 3
 * serves same-day pages from the cache.
 */
export interface MlsImportOptions {
  site: string;
  csvPath: string;
  pagesDir: string;
  /** CSV column holding the MLS number. */
  mlsColumn?: string;
  /** CSV column holding the page URL (file paths / blanks are ignored). */
  urlColumn?: string;
  /**
   * CSV column holding the asking price seen back then. A listing fetched
   * today that has since closed shows only its closing price; this fills
   * list_price so the pair survives.
   */
  priceColumn?: string;
  /** Stop after this many network fetches (smoke test). */
  maxFetches?: number;
  /** Parse everything, write nothing. */
  dryRun?: boolean;
  /** Path for the CSV of numbers that could not be resolved. */
  unresolvedPath?: string;
}

export interface MlsImportSummary {
  site: string;
  csvRows: number;
  distinct: number;
  alreadyInTable: number;
  fromSavedPages: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skippedLowerPriority: number;
  gone: number;
  parseFailures: number;
  unresolvedPath: string | null;
}

interface CsvEntry {
  mlsNumber: string;
  url: string | null;
  /** Asking price recorded by the earlier scrape, if the CSV has one. */
  listPrice: number | null;
}

/** RFC-4180-ish: handles quoted fields with commas and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

/**
 * One entry per MLS number. When a number appears more than once (the CSV is
 * a series of monthly scrapes), the LAST row's URL wins — slugs drift and the
 * newest is most likely to still resolve.
 */
export function dedupeCsv(
  rows: string[][],
  mlsColumn: string,
  urlColumn: string,
  priceColumn = "price",
): { entries: CsvEntry[]; csvRows: number } {
  const header = rows[0]?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
  const mi = header.indexOf(mlsColumn);
  const ui = header.indexOf(urlColumn);
  const pi = header.indexOf(priceColumn);
  if (mi < 0) {
    throw new Error(
      `CSV has no "${mlsColumn}" column (columns: ${header.join(", ")})`,
    );
  }
  const byNumber = new Map<string, CsvEntry>();
  for (const r of rows.slice(1)) {
    const mlsNumber = (r[mi] ?? "").trim();
    if (!/^\d{5,9}$/.test(mlsNumber)) continue;
    const raw = ui < 0 ? "" : (r[ui] ?? "").trim();
    const url = /^https?:\/\//.test(raw) ? raw : null;
    const price = pi < 0 ? null : parseMoney(r[pi] ?? "");
    const prev = byNumber.get(mlsNumber);
    byNumber.set(mlsNumber, {
      mlsNumber,
      url: url ?? prev?.url ?? null,
      listPrice: price ?? prev?.listPrice ?? null,
    });
  }
  return { entries: [...byNumber.values()], csvRows: rows.length - 1 };
}

function boardsFor(adapter: SiteAdapter, mlsNumber: string): MlsBoard[] {
  // 9 digits is HBR's shape; a shorter number could be any 6-digit board.
  if (mlsNumber.length === 9 && adapter.boards.includes("HBR")) return ["HBR"];
  return adapter.boards.filter((b) => b !== "HBR");
}

export async function importCsv(
  opts: MlsImportOptions,
): Promise<MlsImportSummary> {
  const adapter = getSiteAdapter(opts.site);
  const mlsColumn = opts.mlsColumn ?? "mlsNumber";
  const urlColumn = opts.urlColumn ?? "sourceUrl";
  if (!existsSync(opts.pagesDir)) {
    throw new Error(`pages directory not found: ${opts.pagesDir}`);
  }
  assertPermanentCacheAvailable();

  const { entries, csvRows } = dedupeCsv(
    parseCsv(await Bun.file(opts.csvPath).text()),
    mlsColumn,
    urlColumn,
    opts.priceColumn,
  );
  const known = await getKnownListings(adapter.boards);
  const todo = entries.filter(
    (e) =>
      !boardsFor(adapter, e.mlsNumber).some((b) =>
        known.has(listingKey(b, e.mlsNumber)),
      ),
  );
  const summary: MlsImportSummary = {
    site: adapter.site,
    csvRows,
    distinct: entries.length,
    alreadyInTable: entries.length - todo.length,
    fromSavedPages: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skippedLowerPriority: 0,
    gone: 0,
    parseFailures: 0,
    unresolvedPath: null,
  };
  log.info(
    { csvRows, distinct: entries.length, todo: todo.length },
    "MLS import plan",
  );

  const unresolved: { mlsNumber: string; reason: string }[] = [];
  const fetcher = makeFetcher(adapter);
  const runDate = hstToday();

  async function load(
    html: string,
    e: CsvEntry,
    htmlPath: string,
    observedAt?: string,
  ): Promise<void> {
    let listing;
    try {
      listing = adapter.parseDetail(html);
    } catch (err) {
      summary.parseFailures++;
      unresolved.push({ mlsNumber: e.mlsNumber, reason: "parse error" });
      log.error(
        { mlsNumber: e.mlsNumber, htmlPath, err },
        "Import: page failed to parse",
      );
      return;
    }
    if (listing === null) {
      summary.gone++;
      unresolved.push({
        mlsNumber: e.mlsNumber,
        reason: "listing not found page",
      });
      return;
    }
    if (listing.mlsNumber !== e.mlsNumber) {
      summary.parseFailures++;
      unresolved.push({
        mlsNumber: e.mlsNumber,
        reason: `page is for ${listing.mlsNumber}`,
      });
      return;
    }
    if (
      listing.status === "sold" &&
      (listing.fields.list_price ?? null) === null &&
      e.listPrice !== null
    ) {
      listing.fields.list_price = e.listPrice;
    }
    if (opts.dryRun) return;
    const outcome = await loadListing(listing, {
      site: adapter.site,
      priority: adapter.priority,
      sourceUrl: adapter.detailUrl(e.mlsNumber),
      htmlPath,
      observedAt,
    });
    if (outcome === "inserted") summary.inserted++;
    else if (outcome === "updated") summary.updated++;
    else if (outcome === "unchanged") summary.unchanged++;
    else summary.skippedLowerPriority++;
  }

  let n = 0;
  try {
    for (const e of todo) {
      n++;
      if (n % 250 === 0)
        log.info({ n, of: todo.length, ...summary }, "Import progress");

      const saved = path.join(opts.pagesDir, `listing-${e.mlsNumber}.html`);
      const html = await readHtml(saved);
      if (html !== null) {
        summary.fromSavedPages++;
        await load(
          html,
          e,
          saved,
          toHstSql(statSync(saved).mtime).slice(0, 19),
        );
        continue;
      }

      if (opts.maxFetches !== undefined && summary.fetched >= opts.maxFetches) {
        unresolved.push({
          mlsNumber: e.mlsNumber,
          reason: "not fetched (--max-fetches)",
        });
        continue;
      }
      summary.fetched++;
      const res = await fetcher.fetchDetail(
        e.url ?? adapter.detailUrl(e.mlsNumber),
        e.mlsNumber,
        runDate,
      );
      if (res.kind === "gone") {
        summary.gone++;
        unresolved.push({
          mlsNumber: e.mlsNumber,
          reason: `HTTP ${res.status}`,
        });
        continue;
      }
      if (res.kind === "redirect") {
        summary.parseFailures++;
        unresolved.push({
          mlsNumber: e.mlsNumber,
          reason: `redirected to ${res.location ?? "?"}`,
        });
        continue;
      }
      await load(res.html, e, res.path);
    }
  } catch (err) {
    if (!(err instanceof MlsFetchAbort)) throw err;
    log.error(
      { err },
      "Import aborted by fetch circuit breaker — rerun to resume",
    );
  }

  if (unresolved.length > 0) {
    const out =
      opts.unresolvedPath ??
      opts.csvPath.replace(/\.csv$/i, "") + ".unresolved.csv";
    await Bun.write(
      out,
      "mlsNumber,reason\n" +
        unresolved
          .map((u) => `${u.mlsNumber},"${u.reason.replace(/"/g, '""')}"`)
          .join("\n") +
        "\n",
    );
    summary.unresolvedPath = out;
  }
  log.info({ ...summary }, "MLS import summary");
  return summary;
}
