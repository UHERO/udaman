import { buildUpdateObject, mysql } from "@/lib/mysql/helpers";

import DataDownloader, { isIngestStrategy } from "../models/data-downloader";
import type {
  DataDownloaderAttrs,
  IngestStrategy,
} from "../models/data-downloader";
import { jsonParam } from "../models/ingest-columns";

export type CreateDataDownloaderPayload = {
  handle: string;
  sourceKey?: string | null;
  strategy?: IngestStrategy;
  config?: Record<string, unknown> | null;
  schedule?: string | null;
  enabled?: boolean;
  notes?: string | null;
};

export type UpdateDataDownloaderPayload = Partial<
  Omit<CreateDataDownloaderPayload, "handle">
>;

/** Handles appear in load statements and paths: keep them simple. */
const HANDLE_RE = /^[a-z][a-z0-9_]{1,63}$/;

/**
 * Stale-claim horizon: a run that crashed without releasing its claim
 * (worker killed mid-run) stops blocking new runs after this long.
 */
export const CLAIM_TIMEOUT_HOURS = 3;

function checkPayload(p: UpdateDataDownloaderPayload & { handle?: string }) {
  if (p.handle !== undefined && !HANDLE_RE.test(p.handle)) {
    throw new Error(
      `Invalid downloader handle "${p.handle}": use lowercase letters, digits and _ (2-64 chars, starting with a letter)`,
    );
  }
  if (p.strategy !== undefined && !isIngestStrategy(p.strategy)) {
    throw new Error(`Unknown fetch strategy "${String(p.strategy)}"`);
  }
}

class DataDownloaderCollection {
  static async list(): Promise<DataDownloader[]> {
    const rows = await mysql<DataDownloaderAttrs>`
      SELECT * FROM data_downloaders ORDER BY handle ASC
    `;
    return rows.map((r) => new DataDownloader(r));
  }

  static async getById(id: number): Promise<DataDownloader> {
    const rows = await mysql<DataDownloaderAttrs>`
      SELECT * FROM data_downloaders WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Data downloader not found: ${id}`);
    return new DataDownloader(rows[0]);
  }

  static async getByHandle(handle: string): Promise<DataDownloader> {
    const rows = await mysql<DataDownloaderAttrs>`
      SELECT * FROM data_downloaders WHERE handle = ${handle} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Data downloader '${handle}' does not exist`);
    return new DataDownloader(rows[0]);
  }

  /**
   * Insert a row. The source module named by sourceKey is checked by the
   * caller against the registry (src/core/ingest/registry.ts), which the
   * catalog layer does not import.
   */
  static async create(
    payload: CreateDataDownloaderPayload,
  ): Promise<DataDownloader> {
    checkPayload(payload);
    await mysql`
      INSERT INTO data_downloaders
        (handle, source_key, strategy, config, schedule, enabled, notes, created_at, updated_at)
      VALUES (
        ${payload.handle},
        ${payload.sourceKey ?? null},
        ${payload.strategy ?? "custom"},
        ${jsonParam(payload.config)},
        ${payload.schedule?.trim() || null},
        ${payload.enabled === false ? 0 : 1},
        ${payload.notes ?? null},
        NOW(), NOW()
      )
    `;
    return this.getByHandle(payload.handle);
  }

  static async update(
    id: number,
    payload: UpdateDataDownloaderPayload,
  ): Promise<DataDownloader> {
    checkPayload(payload);
    const { config, schedule, ...rest } = payload;
    const updateObj: Record<string, string | number | null> =
      buildUpdateObject(rest);
    if (config !== undefined) updateObj.config = jsonParam(config);
    if (schedule !== undefined) updateObj.schedule = schedule?.trim() || null;
    const cols = Object.keys(updateObj);
    if (cols.length > 0) {
      await mysql`
        UPDATE data_downloaders
        SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    return this.getById(id);
  }

  /**
   * Delete a downloader that never stored anything. One with raw
   * artifacts keeps its history: disable it instead. One an extractor
   * reads must be unlinked from that extractor first.
   */
  static async delete(id: number): Promise<void> {
    const [refs] = await mysql<{ artifacts: number; extractors: number }>`
      SELECT
        (SELECT COUNT(*) FROM raw_artifacts WHERE downloader_id = ${id}) AS artifacts,
        (SELECT COUNT(*) FROM extractor_inputs WHERE downloader_id = ${id}) AS extractors
    `;
    if (Number(refs.extractors) > 0) {
      throw new Error(
        `Data downloader ${id} is an input of ${refs.extractors} extractor(s); remove it from them first`,
      );
    }
    if (Number(refs.artifacts) > 0) {
      throw new Error(
        `Data downloader ${id} has ${refs.artifacts} stored artifact(s); disable it instead of deleting`,
      );
    }
    await mysql`DELETE FROM fetch_runs WHERE downloader_id = ${id}`;
    await mysql`DELETE FROM data_downloaders WHERE id = ${id}`;
  }

  /** Replace the implementation-owned state. */
  static async setState(
    id: number,
    state: Record<string, unknown>,
  ): Promise<void> {
    await mysql`
      UPDATE data_downloaders SET state = ${jsonParam(state)} WHERE id = ${id}
    `;
  }

  // ─── Run claim ─────────────────────────────────────────────────────

  /**
   * Claim the right to fetch. One UPDATE, so it is atomic across the web
   * process and every worker: false = someone else is running it.
   */
  static async claim(id: number): Promise<boolean> {
    const result = await mysql`
      UPDATE data_downloaders
      SET running_since = NOW()
      WHERE id = ${id}
        AND (running_since IS NULL
             OR running_since < NOW() - INTERVAL ${CLAIM_TIMEOUT_HOURS} HOUR)
    `;
    return ((result as { affectedRows?: number }).affectedRows ?? 0) === 1;
  }

  static async releaseClaim(id: number): Promise<void> {
    await mysql`UPDATE data_downloaders SET running_since = NULL WHERE id = ${id}`;
  }
}

export default DataDownloaderCollection;
