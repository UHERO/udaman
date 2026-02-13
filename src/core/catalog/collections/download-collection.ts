import { mysql } from "@/lib/mysql/db";
import Download from "../models/download";
import type { DownloadAttrs } from "../models/download";

class DownloadCollection {
  /**
   * Fetch all downloads ordered by handle.
   * Includes `hasRelatedSeries` — true if any data_sources.eval references the handle.
   * Date-sensitive downloads skip the check (they are never considered orphaned).
   */
  static async list(): Promise<{ download: Download; hasRelatedSeries: boolean }[]> {
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
}

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
