import { transaction } from "@database/mysql";

import { buildUpdateObject, mysql } from "@/lib/mysql/helpers";

import DataExtractor from "../models/data-extractor";
import type { DataExtractorAttrs } from "../models/data-extractor";
import ExtractorInput from "../models/extractor-input";
import type { ExtractorInputAttrs } from "../models/extractor-input";
import { jsonParam } from "../models/ingest-columns";
import { CLAIM_TIMEOUT_HOURS } from "./data-downloader-collection";

export type ExtractorInputSpec = { downloaderId: number; role?: string | null };

export type CreateDataExtractorPayload = {
  handle: string;
  sourceKey: string;
  config?: Record<string, unknown> | null;
  enabled?: boolean;
  notes?: string | null;
  inputs?: ExtractorInputSpec[];
};

export type UpdateDataExtractorPayload = Partial<
  Omit<CreateDataExtractorPayload, "handle">
>;

/** Handles appear in load statements and paths: keep them simple. */
const HANDLE_RE = /^[a-z][a-z0-9_]{1,63}$/;

class DataExtractorCollection {
  static async list(): Promise<DataExtractor[]> {
    const rows = await mysql<DataExtractorAttrs>`
      SELECT * FROM data_extractors ORDER BY handle ASC
    `;
    return rows.map((r) => new DataExtractor(r));
  }

  static async getById(id: number): Promise<DataExtractor> {
    const rows = await mysql<DataExtractorAttrs>`
      SELECT * FROM data_extractors WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Data extractor not found: ${id}`);
    return new DataExtractor(rows[0]);
  }

  static async getByHandle(handle: string): Promise<DataExtractor> {
    const rows = await mysql<DataExtractorAttrs>`
      SELECT * FROM data_extractors WHERE handle = ${handle} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Data extractor '${handle}' does not exist`);
    return new DataExtractor(rows[0]);
  }

  /**
   * Insert a row (and its inputs). The parser module named by sourceKey is
   * checked by the caller against the registry.
   */
  static async create(
    payload: CreateDataExtractorPayload,
  ): Promise<DataExtractor> {
    if (!HANDLE_RE.test(payload.handle)) {
      throw new Error(
        `Invalid extractor handle "${payload.handle}": use lowercase letters, digits and _ (2-64 chars, starting with a letter)`,
      );
    }
    if (!payload.sourceKey) throw new Error("An extractor needs a source key");
    await mysql`
      INSERT INTO data_extractors
        (handle, source_key, config, enabled, notes, created_at, updated_at)
      VALUES (
        ${payload.handle},
        ${payload.sourceKey},
        ${jsonParam(payload.config)},
        ${payload.enabled === false ? 0 : 1},
        ${payload.notes ?? null},
        NOW(), NOW()
      )
    `;
    const extractor = await this.getByHandle(payload.handle);
    if (payload.inputs) await this.setInputs(extractor.id, payload.inputs);
    return extractor;
  }

  static async update(
    id: number,
    payload: UpdateDataExtractorPayload,
  ): Promise<DataExtractor> {
    const { config, inputs, ...rest } = payload;
    if (rest.sourceKey !== undefined && !rest.sourceKey) {
      throw new Error("An extractor needs a source key");
    }
    const updateObj: Record<string, string | number | null> =
      buildUpdateObject(rest);
    if (config !== undefined) updateObj.config = jsonParam(config);
    const cols = Object.keys(updateObj);
    if (cols.length > 0) {
      await mysql`
        UPDATE data_extractors
        SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
    if (inputs) await this.setInputs(id, inputs);
    return this.getById(id);
  }

  /**
   * Delete an extractor that never ran. One with runs keeps its history
   * (load statements may still read its last output): disable it instead.
   */
  static async delete(id: number): Promise<void> {
    const [refs] = await mysql<{ runs: number }>`
      SELECT COUNT(*) AS runs FROM extraction_runs WHERE extractor_id = ${id}
    `;
    if (Number(refs.runs) > 0) {
      throw new Error(
        `Data extractor ${id} has ${refs.runs} run(s); disable it instead of deleting`,
      );
    }
    await mysql`DELETE FROM extractor_inputs WHERE extractor_id = ${id}`;
    await mysql`DELETE FROM data_extractors WHERE id = ${id}`;
  }

  // ─── Inputs ────────────────────────────────────────────────────────

  static async getInputs(extractorId: number): Promise<ExtractorInput[]> {
    const rows = await mysql<ExtractorInputAttrs>`
      SELECT i.extractor_id, i.downloader_id, i.role, d.handle AS downloader_handle
      FROM extractor_inputs i
      LEFT JOIN data_downloaders d ON d.id = i.downloader_id
      WHERE i.extractor_id = ${extractorId}
      ORDER BY d.handle ASC
    `;
    return rows.map((r) => new ExtractorInput(r));
  }

  /** Replace an extractor's inputs. */
  static async setInputs(
    extractorId: number,
    inputs: readonly ExtractorInputSpec[],
  ): Promise<void> {
    const seen = new Set<number>();
    for (const i of inputs) {
      if (seen.has(i.downloaderId)) {
        throw new Error(
          `Downloader ${i.downloaderId} listed twice as an input`,
        );
      }
      seen.add(i.downloaderId);
    }
    await transaction(async (tx) => {
      await tx`DELETE FROM extractor_inputs WHERE extractor_id = ${extractorId}`;
      for (const i of inputs) {
        await tx`
          INSERT INTO extractor_inputs (extractor_id, downloader_id, role)
          VALUES (${extractorId}, ${i.downloaderId}, ${i.role ?? null})
        `;
      }
    });
  }

  /** Enabled extractors that read a downloader (run after it fetches). */
  static async dependentsOf(downloaderId: number): Promise<DataExtractor[]> {
    const rows = await mysql<DataExtractorAttrs>`
      SELECT e.* FROM data_extractors e
      JOIN extractor_inputs i ON i.extractor_id = e.id
      WHERE i.downloader_id = ${downloaderId} AND e.enabled = 1
      ORDER BY e.handle ASC
    `;
    return rows.map((r) => new DataExtractor(r));
  }

  // ─── Run claim ─────────────────────────────────────────────────────

  /** Atomic claim, as for downloaders: false = already running. */
  static async claim(id: number): Promise<boolean> {
    const result = await mysql`
      UPDATE data_extractors
      SET running_since = NOW()
      WHERE id = ${id}
        AND (running_since IS NULL
             OR running_since < NOW() - INTERVAL ${CLAIM_TIMEOUT_HOURS} HOUR)
    `;
    return ((result as { affectedRows?: number }).affectedRows ?? 0) === 1;
  }

  static async releaseClaim(id: number): Promise<void> {
    await mysql`UPDATE data_extractors SET running_since = NULL WHERE id = ${id}`;
  }
}

export default DataExtractorCollection;
