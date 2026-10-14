import { buildUpdateObject, mysql } from "@/lib/mysql/helpers";

import type { DownloadAttrs } from "../models/download";
import Download from "../models/download";
import Downloader from "../models/downloader";
import type { DownloaderAttrs } from "../models/downloader";

/** A load statement that calls a downloader's load method. */
export type DownloaderLoaderRef = {
  loaderId: number;
  seriesId: number | null;
  seriesName: string | null;
  universe: string;
  eval: string;
  disabled: boolean;
};

export type CreateDownloaderPayload = {
  handle: string;
  config?: Record<string, unknown> | null;
  enabled?: boolean;
  maxAgeMinutes?: number | null;
  notes?: string | null;
};

export type UpdateDownloaderPayload = Partial<
  Omit<CreateDownloaderPayload, "handle">
> & { reloadOnChange?: boolean };

export type DownloaderRunStatus = {
  ok: boolean;
  changed: boolean;
  /** Full (non-keyed) run: also stamps last_success_at. */
  full: boolean;
  seconds: number;
  error?: string | null;
  stats: Record<string, unknown>;
  state?: Record<string, unknown>;
};

/**
 * Stale-claim horizon: a run that crashed without releasing its claim
 * (worker killed mid-run) stops blocking new runs after this long.
 */
const CLAIM_TIMEOUT_HOURS = 3;

class DownloaderCollection {
  static async list(): Promise<Downloader[]> {
    const rows = await mysql<DownloaderAttrs>`
      SELECT * FROM downloaders ORDER BY handle ASC
    `;
    return rows.map((r) => new Downloader(r));
  }

  static async getById(id: number): Promise<Downloader> {
    const rows = await mysql<DownloaderAttrs>`
      SELECT * FROM downloaders WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Downloader not found: ${id}`);
    return new Downloader(rows[0]);
  }

  static async getByHandle(handle: string): Promise<Downloader> {
    const rows = await mysql<DownloaderAttrs>`
      SELECT * FROM downloaders WHERE handle = ${handle} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Downloader '${handle}' does not exist`);
    return new Downloader(rows[0]);
  }

  static async create(payload: CreateDownloaderPayload): Promise<Downloader> {
    await mysql`
      INSERT INTO downloaders (handle, config, enabled, max_age_minutes, notes, created_at, updated_at)
      VALUES (
        ${payload.handle},
        ${payload.config ? JSON.stringify(payload.config) : null},
        ${payload.enabled === false ? 0 : 1},
        ${payload.maxAgeMinutes === undefined ? 1440 : payload.maxAgeMinutes},
        ${payload.notes ?? null},
        NOW(), NOW()
      )
    `;
    return this.getByHandle(payload.handle);
  }

  static async update(
    id: number,
    payload: UpdateDownloaderPayload,
  ): Promise<Downloader> {
    const { config, ...rest } = payload;
    const updateObj: Record<string, string | number | null> =
      buildUpdateObject(rest);
    if (config !== undefined) {
      updateObj.config = config ? JSON.stringify(config) : null;
    }
    const cols = Object.keys(updateObj);
    if (cols.length > 0) {
      await mysql`
        UPDATE downloaders
        SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    return this.getById(id);
  }

  /**
   * Delete the row. Its Downloads are kept (files and history stay
   * useful) but unlinked, so they show up as ordinary downloads.
   */
  static async delete(id: number): Promise<void> {
    await mysql`
      UPDATE downloads SET downloader_id = NULL, downloader_role = NULL
      WHERE downloader_id = ${id}
    `;
    await mysql`DELETE FROM downloaders WHERE id = ${id}`;
  }

  // ─── Run claim + status ────────────────────────────────────────────

  /**
   * Claim the right to run. One UPDATE, so it is atomic across the web
   * process and every worker: false = someone else is running it.
   */
  static async claim(id: number): Promise<boolean> {
    const result = await mysql`
      UPDATE downloaders
      SET running_since = NOW()
      WHERE id = ${id}
        AND (running_since IS NULL
             OR running_since < NOW() - INTERVAL ${CLAIM_TIMEOUT_HOURS} HOUR)
    `;
    return ((result as { affectedRows?: number }).affectedRows ?? 0) === 1;
  }

  /** Release the claim and record the outcome of the run. */
  static async finishRun(id: number, status: DownloaderRunStatus) {
    const stats = JSON.stringify(status.stats);
    const state = status.state ? JSON.stringify(status.state) : null;
    const error = status.error ? status.error.slice(0, 500) : null;
    await mysql`
      UPDATE downloaders
      SET running_since = NULL,
          last_run_at = NOW(),
          last_run_seconds = ${status.seconds.toFixed(3)},
          last_stats = ${stats},
          state = COALESCE(${state}, state),
          last_success_at = IF(${status.ok && status.full ? 1 : 0}, NOW(), last_success_at),
          last_change_at = IF(${status.changed ? 1 : 0}, NOW(), last_change_at),
          last_error = ${error},
          last_error_at = IF(${error ? 1 : 0}, NOW(), last_error_at)
      WHERE id = ${id}
    `;
  }

  /** Drop a claim without recording a run (crash cleanup from the UI). */
  static async releaseClaim(id: number): Promise<void> {
    await mysql`UPDATE downloaders SET running_since = NULL WHERE id = ${id}`;
  }

  /** Replace the implementation-owned state (e.g. reset the BLS history map). */
  static async setState(id: number, state: Record<string, unknown>) {
    await mysql`
      UPDATE downloaders SET state = ${JSON.stringify(state)}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  // ─── Downloads owned by a downloader ───────────────────────────────

  static async getDownloads(
    downloaderId: number,
    role?: "source" | "output",
  ): Promise<Download[]> {
    const rows = role
      ? await mysql<DownloadAttrs>`
          SELECT * FROM downloads
          WHERE downloader_id = ${downloaderId} AND downloader_role = ${role}
          ORDER BY handle ASC
        `
      : await mysql<DownloadAttrs>`
          SELECT * FROM downloads WHERE downloader_id = ${downloaderId}
          ORDER BY downloader_role DESC, handle ASC
        `;
    return rows.map((r) => new Download(r));
  }

  static async setHistorical(downloadId: number, historical: boolean) {
    await mysql`
      UPDATE downloads SET historical = ${historical ? 1 : 0}, updated_at = NOW()
      WHERE id = ${downloadId}
    `;
  }

  // ─── Load statements that use a downloader ─────────────────────────

  /**
   * Load statements whose eval mentions `loadMethod` (e.g.
   * "load_from_bls_api"). A LIKE pre-filter; callers parse the eval to get
   * the exact arguments.
   */
  static async getLoaderRefs(
    loadMethod: string,
    { includeDisabled = false } = {},
  ): Promise<DownloaderLoaderRef[]> {
    const rows = await mysql<{
      id: number;
      series_id: number | null;
      name: string | null;
      universe: string;
      eval: string;
      disabled: number;
    }>`
      SELECT ds.id, ds.series_id, s.name, ds.universe, ds.eval, ds.disabled
      FROM data_sources ds
      LEFT JOIN series s ON s.id = ds.series_id
      WHERE ds.eval LIKE ${`%${loadMethod}%`}
        AND (${includeDisabled ? 1 : 0} = 1 OR NOT ds.disabled)
      ORDER BY s.name ASC
    `;
    return rows.map((r) => ({
      loaderId: r.id,
      seriesId: r.series_id,
      seriesName: r.name,
      universe: r.universe,
      eval: r.eval,
      disabled: Boolean(r.disabled),
    }));
  }
}

export default DownloaderCollection;
