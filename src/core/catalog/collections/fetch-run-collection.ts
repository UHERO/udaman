import { insertAndGetId, mysql, rawQuery } from "@database/mysql";

import FetchRun from "../models/fetch-run";
import type { FetchRunAttrs, FetchRunStatus } from "../models/fetch-run";
import { jsonParam } from "../models/ingest-columns";
import RawArtifact from "../models/raw-artifact";
import type { RawArtifactAttrs } from "../models/raw-artifact";
import { ladderChunks } from "./ingest-sql";

export type FinishFetchRunPayload = {
  status: Exclude<FetchRunStatus, "running">;
  error?: string | null;
  stats?: Record<string, unknown> | null;
};

/** An artifact a run stored or saw again. */
export type FetchRunArtifactLink = { artifactId: number; changed: boolean };

class FetchRunCollection {
  static async start(
    downloaderId: number,
    triggeredBy: string | null,
  ): Promise<number> {
    return insertAndGetId(
      `INSERT INTO fetch_runs (downloader_id, status, triggered_by, started_at)
       VALUES (?, 'running', ?, NOW())`,
      [downloaderId, triggeredBy],
    );
  }

  static async finish(id: number, p: FinishFetchRunPayload): Promise<void> {
    await mysql`
      UPDATE fetch_runs
      SET status = ${p.status},
          error = ${p.error ?? null},
          stats = ${jsonParam(p.stats)},
          finished_at = NOW()
      WHERE id = ${id}
    `;
  }

  /** Link the artifacts a run stored or saw again (idempotent). */
  static async linkArtifacts(
    runId: number,
    links: readonly FetchRunArtifactLink[],
  ): Promise<void> {
    for (const chunk of ladderChunks(links)) {
      const params: number[] = [];
      for (const l of chunk)
        params.push(runId, l.artifactId, l.changed ? 1 : 0);
      await rawQuery(
        `INSERT INTO fetch_run_artifacts (fetch_run_id, raw_artifact_id, changed)
         VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")}
         ON DUPLICATE KEY UPDATE changed = GREATEST(changed, VALUES(changed))`,
        params,
      );
    }
  }

  static async getById(id: number): Promise<FetchRun> {
    const rows = await mysql<FetchRunAttrs>`
      SELECT * FROM fetch_runs WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Fetch run not found: ${id}`);
    return new FetchRun(rows[0]);
  }

  /** Most recent runs of a downloader, newest first. */
  static async listForDownloader(
    downloaderId: number,
    limit = 20,
  ): Promise<FetchRun[]> {
    const rows = await mysql<FetchRunAttrs>`
      SELECT * FROM fetch_runs
      WHERE downloader_id = ${downloaderId}
      ORDER BY started_at DESC, id DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => new FetchRun(r));
  }

  /** The latest run of each downloader (for list views). */
  static async latestByDownloader(): Promise<Map<number, FetchRun>> {
    const rows = await mysql<FetchRunAttrs>`
      SELECT f.* FROM fetch_runs f
      JOIN (SELECT downloader_id, MAX(id) AS id FROM fetch_runs GROUP BY downloader_id) last
        ON last.id = f.id
    `;
    return new Map(rows.map((r) => [r.downloader_id, new FetchRun(r)]));
  }

  /** Artifacts a run stored or saw, with whether each was a new vintage. */
  static async artifactsOf(
    runId: number,
  ): Promise<Array<{ artifact: RawArtifact; changed: boolean }>> {
    const rows = await mysql<RawArtifactAttrs & { run_changed: number }>`
      SELECT a.*, fra.changed AS run_changed
      FROM fetch_run_artifacts fra
      JOIN raw_artifacts a ON a.id = fra.raw_artifact_id
      WHERE fra.fetch_run_id = ${runId}
      ORDER BY a.artifact_key ASC
    `;
    return rows.map((r) => ({
      artifact: new RawArtifact(r),
      changed: Boolean(r.run_changed),
    }));
  }

  /**
   * Mark runs left 'running' by a crashed process as failed. Called when
   * a stale claim is taken over.
   */
  static async failAbandoned(downloaderId: number): Promise<void> {
    await mysql`
      UPDATE fetch_runs
      SET status = 'failed', error = 'abandoned (process exited mid-run)', finished_at = NOW()
      WHERE downloader_id = ${downloaderId} AND status = 'running'
    `;
  }
}

export default FetchRunCollection;
