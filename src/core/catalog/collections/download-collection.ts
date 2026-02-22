import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { buildUpdateObject, mysql } from "@/lib/mysql/helpers";

import Download from "../models/download";
import type { DownloadAttrs } from "../models/download";

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
   * Fetch a file from the external URL and save it to the server filesystem.
   * Mirrors the Rails `Download#download` method.
   * Returns a summary of the result.
   */
  static async downloadToServer(
    id: number,
  ): Promise<{ status: number; changed: boolean }> {
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
    const now = new Date();

    if (status === 200) {
      const body = Buffer.from(await resp.arrayBuffer());
      const savePath = dl.savePath();

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

      // Update timestamps
      const updates: Record<string, Date> = { last_download_at: now };
      if (dataChanged || !dl.lastChangeAt) {
        updates.last_change_at = now;
      }
      await mysql`
        UPDATE downloads
        SET last_download_at = ${updates.last_download_at},
            last_change_at = ${updates.last_change_at ?? dl.lastChangeAt}
        WHERE id = ${id}
      `;
    }

    // Create log entry (deduplicate: skip if same url+date+status already logged)
    const today = now.toISOString().slice(0, 10);
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
        VALUES (${id}, ${now}, ${dl.url}, ${location}, ${status}, ${dataChanged}, ${mimetype}, ${now}, ${now})
      `;
    }

    return { status, changed: dataChanged };
  }

  /**
   * Download a file by handle (convenience for scheduled jobs).
   * Finds the download record by handle, then delegates to downloadToServer.
   */
  static async downloadByHandle(
    handle: string,
  ): Promise<{ status: number; changed: boolean }> {
    const dl = await this.getByHandle(handle);
    return this.downloadToServer(dl.id);
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
