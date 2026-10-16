import { insertAndGetId, mysql } from "@database/mysql";

import ExtractionRun from "../models/extraction-run";
import type {
  ExtractionRunAttrs,
  ExtractionRunStatus,
  ValidationResult,
} from "../models/extraction-run";
import { jsonParam } from "../models/ingest-columns";

export type StartExtractionRunPayload = {
  extractorId: number;
  triggeredBy: string | null;
  fetchRunId?: number | null;
  inputArtifactIds: number[];
  inputsHash: string;
};

export type FinishExtractionRunPayload = {
  status: Exclude<ExtractionRunStatus, "running">;
  error?: string | null;
  validationResults?: ValidationResult[] | null;
  stats?: Record<string, unknown> | null;
  /** Relative to DATA_DIR */
  outputPath?: string | null;
  outputHash?: string | null;
  rowCount?: number | null;
  seriesCount?: number | null;
};

class ExtractionRunCollection {
  static async start(p: StartExtractionRunPayload): Promise<number> {
    return insertAndGetId(
      `INSERT INTO extraction_runs
         (extractor_id, status, triggered_by, fetch_run_id, input_artifact_ids, inputs_hash, started_at)
       VALUES (?, 'running', ?, ?, ?, ?, NOW())`,
      [
        p.extractorId,
        p.triggeredBy,
        p.fetchRunId ?? null,
        JSON.stringify(p.inputArtifactIds),
        p.inputsHash,
      ],
    );
  }

  static async finish(
    id: number,
    p: FinishExtractionRunPayload,
  ): Promise<void> {
    await mysql`
      UPDATE extraction_runs
      SET status = ${p.status},
          error = ${p.error ?? null},
          validation_results = ${jsonParam(p.validationResults)},
          stats = ${jsonParam(p.stats)},
          output_path = ${p.outputPath ?? null},
          output_hash = ${p.outputHash ?? null},
          row_count = ${p.rowCount ?? null},
          series_count = ${p.seriesCount ?? null},
          finished_at = NOW()
      WHERE id = ${id}
    `;
  }

  static async getById(id: number): Promise<ExtractionRun> {
    const rows = await mysql<ExtractionRunAttrs>`
      SELECT * FROM extraction_runs WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Extraction run not found: ${id}`);
    return new ExtractionRun(rows[0]);
  }

  /** The run loads read: the extractor's latest ok run, or null. */
  static async latestOk(extractorId: number): Promise<ExtractionRun | null> {
    const rows = await mysql<ExtractionRunAttrs>`
      SELECT * FROM extraction_runs
      WHERE extractor_id = ${extractorId} AND status = 'ok'
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows[0] ? new ExtractionRun(rows[0]) : null;
  }

  /** Most recent runs of an extractor, newest first. */
  static async listForExtractor(
    extractorId: number,
    limit = 20,
  ): Promise<ExtractionRun[]> {
    const rows = await mysql<ExtractionRunAttrs>`
      SELECT * FROM extraction_runs
      WHERE extractor_id = ${extractorId}
      ORDER BY id DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => new ExtractionRun(r));
  }

  /** The latest run of each extractor (for list views). */
  static async latestByExtractor(): Promise<Map<number, ExtractionRun>> {
    const rows = await mysql<ExtractionRunAttrs>`
      SELECT r.* FROM extraction_runs r
      JOIN (SELECT extractor_id, MAX(id) AS id FROM extraction_runs GROUP BY extractor_id) last
        ON last.id = r.id
    `;
    return new Map(rows.map((r) => [r.extractor_id, new ExtractionRun(r)]));
  }

  /**
   * Publish a failed run whose failures are all soft checks: it becomes
   * the extractor's latest ok run (if no newer ok run exists, loads read
   * it). The failed checks stay in validation_results.
   */
  static async accept(
    id: number,
    userId: number | null,
  ): Promise<ExtractionRun> {
    const run = await this.getById(id);
    if (!run.canAccept()) {
      throw new Error(
        run.status !== "failed"
          ? `Extraction run ${id} is ${run.status}, not failed`
          : `Extraction run ${id} cannot be accepted: ${
              run.outputPath
                ? "it has hard validation failures"
                : "it did not produce an output"
            }`,
      );
    }
    await mysql`
      UPDATE extraction_runs
      SET status = 'ok', accepted_by = ${userId}, accepted_at = NOW()
      WHERE id = ${id} AND status = 'failed'
    `;
    return this.getById(id);
  }

  /**
   * Mark runs left 'running' by a crashed process as failed. Called when
   * a stale claim is taken over.
   */
  static async failAbandoned(extractorId: number): Promise<void> {
    await mysql`
      UPDATE extraction_runs
      SET status = 'failed', error = 'abandoned (process exited mid-run)', finished_at = NOW()
      WHERE extractor_id = ${extractorId} AND status = 'running'
    `;
  }
}

export default ExtractionRunCollection;
