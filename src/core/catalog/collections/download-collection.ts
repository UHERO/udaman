import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { buildUpdateObject, mysql } from "@/lib/mysql/helpers";

import Download from "../models/download";
import type { DownloadAttrs } from "../models/download";
import { hstToday, hstToInstant, toHstSql } from "../utils/time";

/**
 * When each download was last *attempted* by `ensureFresh` in this process,
 * whatever the outcome. `last_download_at` is only written on a successful
 * 200, so a handle whose URL now serves a 404 or a "not found" HTML page
 * (the provider moved it without notice) is never fresh by that column —
 * and every loader that references it, and every monthly file of a
 * date-sensitive handle, re-fetched it on every reload. Rails avoided this
 * because `DownloadsCache` memoised download results per process; this map
 * is that memo. The web process and the worker each keep their own, which
 * is fine: the point is one attempt per hour per process, not zero.
 */
const ensureFreshAttemptedAt = new Map<number, number>();
const ENSURE_FRESH_TTL_MS = 60 * 60 * 1000;

/**
 * Downloads currently being fetched by this process. Loaders now run
 * several series at a time, so two loaders can reach `ensureFresh` for
 * the same handle together; the second must wait for the first's write
 * to finish rather than read a half-written file off the mount.
 */
const ensureFreshInFlight = new Map<number, Promise<void>>();

/** Run `fetch` for download `id` unless it is already running; share the result. */
function dedupInFlight(id: number, fetch: () => Promise<void>): Promise<void> {
  const running = ensureFreshInFlight.get(id);
  if (running) return running;
  const p = fetch().finally(() => {
    ensureFreshInFlight.delete(id);
  });
  ensureFreshInFlight.set(id, p);
  return p;
}

class DownloadCollection {
  /**
   * Fetch all downloads ordered by handle.
   * Includes `hasRelatedSeries` — true if any data_sources.eval references the handle.
   * Date-sensitive downloads skip the check (they are never considered orphaned).
   */
  static async list(): Promise<
    { download: Download; hasRelatedSeries: boolean }[]
  > {
    // 1. Fetch all downloads
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads ORDER BY handle ASC
    `;

    // 2. Fetch all non-null evals in one pass
    const evalRows = await mysql<{ eval: string }>`
      SELECT DISTINCT eval FROM data_sources WHERE eval IS NOT NULL
    `;
    const evals = evalRows.map((r) => r.eval);

    // 3. Check each non-date-sensitive handle against the eval list in memory
    return rows.map((row) => {
      const dl = new Download(row);
      let hasRelatedSeries = true; // date-sensitive downloads default to true (never orphaned)
      if (!dl.dateSensitive && dl.handle) {
        hasRelatedSeries = evals.some((e) => e.includes(dl.handle!));
      }
      return { download: dl, hasRelatedSeries };
    });
  }

  /** Fetch a single download by exact handle match */
  static async getByHandle(handle: string): Promise<Download> {
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE handle = ${handle} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Download handle '${handle}' does not exist`);
    return new Download(rows[0]);
  }

  /**
   * Find downloads matching a date-sensitive handle pattern.
   * Converts strftime-style placeholders (%Y, %y, %b, %m) to MySQL regex.
   * Returns results ordered by sort1 DESC, sort2 DESC, handle DESC.
   */
  static async findByPattern(pattern: string): Promise<Download[]> {
    const regexes: Record<string, string> = {
      "%Y": "[12][0-9]{3}",
      "%y": "[0-9]{2}",
      "%b": "[A-Z]{3}",
      "%m": "[01][0-9]",
    };
    let regexPattern = pattern;
    for (const [op, re] of Object.entries(regexes)) {
      regexPattern = regexPattern.replaceAll(op, re);
    }
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads
      WHERE handle REGEXP ${regexPattern}
      ORDER BY sort1 DESC, sort2 DESC, handle DESC
    `;
    return rows.map((row) => new Download(row));
  }

  /**
   * Get a download (or set of downloads) by handle.
   * If the handle contains date format codes (%), treats it as a pattern.
   */
  static async get(handle: string): Promise<Download | Download[]> {
    if (handle.includes("%")) {
      return this.findByPattern(handle);
    }
    return this.getByHandle(handle);
  }

  /** Fetch a download by ID */
  static async getById(id: number): Promise<Download> {
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Download not found: ${id}`);
    return new Download(rows[0]);
  }

  /** Fetch DSD log entries for a download, ordered by time DESC */
  static async getLogEntries(downloadId: number): Promise<DsdLogEntry[]> {
    return mysql<DsdLogEntry>`
      SELECT id, download_id, time, url, location, status, dl_changed, mimetype
      FROM dsd_log_entries
      WHERE download_id = ${downloadId}
      ORDER BY time DESC
    `;
  }

  /**
   * Does this response body look like an HTML page rather than a data file?
   * Used to catch "soft 404s": HTTP 200 whose body is a not-found page.
   */
  static isHtmlPage(body: Buffer): boolean {
    return looksLikeHtmlPage(body);
  }

  /**
   * Fetch a file from the external URL and save it to the server filesystem.
   * Mirrors the Rails `Download#download` method.
   * Returns a summary of the result.
   *
   * `htmlPage: true` means the server answered 200 but the body is an HTML
   * page while we expected a data file — a "soft 404" (typical after a site
   * moves domains and old URLs redirect to a not-found page). The cached
   * file is NOT overwritten in that case; without this guard the HTML page
   * replaces the last good spreadsheet and later surfaces as a baffling
   * "Cannot find header" during parsing (hta.hawaii.gov move, 2026-08).
   */
  static async downloadToServer(
    id: number,
  ): Promise<{ status: number; changed: boolean; htmlPage?: boolean }> {
    const dl = await this.getById(id);
    if (dl.freezeFile) {
      throw new Error(`Download "${dl.handle}" is temporarily frozen`);
    }
    if (!dl.url) {
      throw new Error(`Download "${dl.handle}" has no URL`);
    }

    const resp = await fetch(dl.url.trim(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; UDAMAN/1.0; UHERO Data Manager)",
      },
      signal: AbortSignal.timeout(120_000),
    });

    const status = resp.status;
    let dataChanged = false;
    let htmlPage = false;
    const now = new Date();

    if (status === 200) {
      const body = Buffer.from(await resp.arrayBuffer());
      const savePath = dl.savePath();

      const ext = (dl.filenameExt ?? "").toLowerCase();
      if (ext !== "html" && ext !== "htm" && looksLikeHtmlPage(body)) {
        htmlPage = true;
        console.warn(
          `[download] ${dl.handle}: got an HTML page instead of a .${ext || "?"} file (soft 404 — site moved?) — keeping cached file`,
        );
        // Fall through to the log entry below (content-type header records
        // the evidence) without writing the file or bumping timestamps.
      } else {
        // Check if content changed
        if (existsSync(savePath)) {
          const existing = readFileSync(savePath);
          dataChanged = !body.equals(existing);
        } else {
          dataChanged = true;
        }

        // Ensure directory exists and write file
        mkdirSync(dirname(savePath), { recursive: true });
        await Bun.write(savePath, body);

        // Update timestamps (HST wall-clock, consistent with NOW())
        const updates: Record<string, string> = {
          last_download_at: toHstSql(now),
        };
        if (dataChanged || !dl.lastChangeAt) {
          updates.last_change_at = toHstSql(now);
        }
        await mysql`
        UPDATE downloads
        SET last_download_at = ${updates.last_download_at},
            last_change_at = ${updates.last_change_at ?? dl.lastChangeAt}
        WHERE id = ${id}
      `;
      }
    }

    // Create log entry (deduplicate: skip if same url+date+status already logged)
    const today = hstToday();
    const existingLog = await mysql<{ id: number }>`
      SELECT id FROM dsd_log_entries
      WHERE download_id = ${id}
        AND url = ${dl.url}
        AND DATE(time) = ${today}
        AND status = ${status}
      LIMIT 1
    `;
    if (!existingLog[0]) {
      const location = resp.headers.get("location");
      const mimetype = resp.headers.get("content-type");
      await mysql`
        INSERT INTO dsd_log_entries (download_id, time, url, location, status, dl_changed, mimetype, created_at, updated_at)
        VALUES (${id}, ${toHstSql(now)}, ${dl.url}, ${location}, ${status}, ${dataChanged}, ${mimetype}, ${toHstSql(now)}, ${toHstSql(now)})
      `;
    }

    return { status, changed: dataChanged, htmlPage };
  }

  /**
   * Download a file by handle (convenience for scheduled jobs).
   * Finds the download record by handle, then delegates to downloadToServer.
   */
  static async downloadByHandle(
    handle: string,
  ): Promise<{ status: number; changed: boolean; htmlPage?: boolean }> {
    const dl = await this.getByHandle(handle);
    return this.downloadToServer(dl.id);
  }

  /**
   * Ensure a download's file is fresh before reading it.
   * Mirrors Rails `DownloadsCache#download_handle` freshness gate:
   * if last_download_at is within the past hour, skip the HTTP request.
   * Otherwise fetch a fresh copy.
   *
   * If the HTTP request returns a non-200 status AND no cached file exists
   * on disk, throws an error so the loader surfaces the failure.
   * If a cached file exists, logs a warning and continues with stale data.
   *
   * For frozen or URL-less downloads, silently returns (reads existing file).
   * For date-sensitive handles (containing %), ensures freshness for ALL
   * matching downloads (individual failures are non-fatal).
   */
  static async ensureFresh(handle: string): Promise<void> {
    const now = Date.now();
    const oneHourAgo = new Date(now - ENSURE_FRESH_TTL_MS);
    // Fresh if the last successful download OR the last attempt from this
    // process was within the hour. A failed attempt is not retried until
    // the hour is up; the cached file (if any) is used meanwhile.
    const isFresh = (dl: Download): boolean => {
      if (dl.lastDownloadAt && hstToInstant(dl.lastDownloadAt) > oneHourAgo)
        return true;
      const attempted = ensureFreshAttemptedAt.get(dl.id);
      return attempted != null && now - attempted < ENSURE_FRESH_TTL_MS;
    };
    const markAttempted = (dl: Download): void => {
      ensureFreshAttemptedAt.set(dl.id, now);
    };

    if (handle.includes("%")) {
      // Date-sensitive: refresh all matching downloads
      const downloads = await this.findByPattern(handle);
      for (const dl of downloads) {
        if (dl.freezeFile || !dl.url) continue;
        if (ensureFreshInFlight.has(dl.id)) {
          await dedupInFlight(dl.id, async () => {});
          continue;
        }
        if (isFresh(dl)) continue;
        markAttempted(dl);
        await dedupInFlight(dl.id, async () => {
          try {
            const result = await this.downloadToServer(dl.id);
            if (
              (result.status !== 200 || result.htmlPage) &&
              !existsSync(dl.effectivePath())
            ) {
              console.warn(
                `[ensureFresh] ${dl.handle}: ${result.htmlPage ? "HTML page (soft 404)" : `HTTP ${result.status}`}, no cached file`,
              );
            }
          } catch {
            // Non-fatal for date-sensitive: file may already exist from prior download
          }
        });
      }
    } else {
      const dl = await this.getByHandle(handle);
      if (dl.freezeFile || !dl.url) return;
      // Another loader is fetching this handle right now: wait for it,
      // then use whatever it produced (the file, or the cached one).
      if (ensureFreshInFlight.has(dl.id)) {
        await dedupInFlight(dl.id, async () => {});
        if (!existsSync(dl.effectivePath())) {
          throw new Error(
            `Download "${handle}" failed and no cached file exists at ${dl.effectivePath()}`,
          );
        }
        return;
      }
      if (isFresh(dl)) return;
      markAttempted(dl);

      await dedupInFlight(dl.id, async () => {
        let result: { status: number; changed: boolean; htmlPage?: boolean };
        try {
          result = await this.downloadToServer(dl.id);
        } catch (e) {
          // downloadToServer throws for frozen/URL-less (already checked above)
          // or network-level failures (DNS, timeout, etc.)
          if (!existsSync(dl.effectivePath())) {
            throw new Error(
              `Download "${handle}" failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
          console.warn(
            `[ensureFresh] ${handle}: fetch error, using cached file — ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        }

        if (result.status !== 200 || result.htmlPage) {
          const what = result.htmlPage
            ? "an HTML page instead of a data file (soft 404 — has the site moved?)"
            : `HTTP ${result.status}`;
          if (!existsSync(dl.effectivePath())) {
            throw new Error(
              `Download "${handle}" returned ${what} and no cached file exists at ${dl.effectivePath()}`,
            );
          }
          console.warn(`[ensureFresh] ${handle}: ${what}, using cached file`);
        }
      });
    }
  }

  /**
   * Find series whose data_sources.eval references the given handle.
   * Returns series id, name, aremos_diff, aremos_missing.
   */
  static async getRelatedSeries(handle: string): Promise<RelatedSeries[]> {
    const rows = await mysql<RelatedSeries>`
      SELECT DISTINCT s.id, s.name, xs.aremos_diff, xs.aremos_missing
      FROM data_sources ds
      JOIN series s ON s.id = ds.series_id
      LEFT JOIN xseries xs ON xs.id = s.xseries_id
      WHERE ds.eval LIKE ${`%${handle}%`}
      ORDER BY s.name ASC
    `;
    return rows;
  }

  /** Create a new download */
  static async create(payload: CreateDownloadPayload): Promise<Download> {
    await mysql`
      INSERT INTO downloads (
        handle, url, filename_ext, date_sensitive, freeze_file,
        sort1, sort2, file_to_extract, sheet_override,
        post_parameters, notes, created_at, updated_at
      ) VALUES (
        ${payload.handle ?? null},
        ${payload.url ?? null},
        ${payload.filenameExt ?? null},
        ${payload.dateSensitive ? 1 : 0},
        ${payload.freezeFile ? 1 : 0},
        ${payload.sort1 ?? null},
        ${payload.sort2 ?? null},
        ${payload.fileToExtract ?? null},
        ${payload.sheetOverride ?? null},
        ${payload.postParameters ?? null},
        ${payload.notes ?? null},
        NOW(), NOW()
      )
    `;

    // Fetch by handle since we don't have insertId from tagged templates
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE handle = ${payload.handle ?? ""} ORDER BY id DESC LIMIT 1
    `;
    if (!rows[0]) throw new Error("Failed to create download");
    return new Download(rows[0]);
  }

  /** Update an existing download */
  static async update(
    id: number,
    payload: UpdateDownloadPayload,
  ): Promise<Download> {
    const updateObj = buildUpdateObject(payload);
    const cols = Object.keys(updateObj);
    if (cols.length === 0) return this.getById(id);

    await mysql`
      UPDATE downloads
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return this.getById(id);
  }

  /** Delete a download by ID */
  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM dsd_log_entries WHERE download_id = ${id}`;
    await mysql`DELETE FROM downloads WHERE id = ${id}`;
  }
}

export type CreateDownloadPayload = {
  handle?: string | null;
  url?: string | null;
  filenameExt?: string | null;
  dateSensitive?: boolean;
  freezeFile?: boolean;
  sort1?: number | null;
  sort2?: number | null;
  fileToExtract?: string | null;
  sheetOverride?: string | null;
  postParameters?: string | null;
  notes?: string | null;
};

export type UpdateDownloadPayload = Partial<CreateDownloadPayload>;

export type DsdLogEntry = {
  id: number;
  download_id: number | null;
  time: string | Date | null;
  url: string | null;
  location: string | null;
  status: number | null;
  dl_changed: boolean | number | null;
  mimetype: string | null;
};

export type RelatedSeries = {
  id: number;
  name: string;
  aremos_diff: number | null;
  aremos_missing: number | null;
};

export default DownloadCollection;

/**
 * Sniff a response body / file head for HTML. Data files we ingest (xls,
 * xlsx, csv, txt, zip) never open with an HTML tag; a body that does is a
 * web page — almost always an error/not-found page served with HTTP 200.
 */
export function looksLikeHtmlPage(body: Buffer): boolean {
  // Skip a UTF-8 BOM if present, then inspect the first bytes as text.
  let start = 0;
  if (
    body.length >= 3 &&
    body[0] === 0xef &&
    body[1] === 0xbb &&
    body[2] === 0xbf
  ) {
    start = 3;
  }
  const head = body
    .subarray(start, start + 512)
    .toString("latin1")
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    (head.startsWith("<") && head.includes("<html"))
  );
}
