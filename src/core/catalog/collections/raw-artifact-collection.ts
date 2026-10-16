import { mysql, rawQuery } from "@database/mysql";

import { jsonParam } from "../models/ingest-columns";
import RawArtifact from "../models/raw-artifact";
import type { RawArtifactAttrs } from "../models/raw-artifact";
import { ladderChunks, placeholders } from "./ingest-sql";

export type RecordArtifactPayload = {
  downloaderId: number;
  artifactKey: string;
  contentHash: string;
  /** Relative to DATA_DIR; the file must already be written there */
  storagePath: string;
  size: number;
  resolvedUrl?: string | null;
  originalName?: string | null;
  contentType?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Mark the key final with this fetch (never refetched again) */
  final?: boolean;
};

export type RecordArtifactResult = {
  artifact: RawArtifact;
  /**
   * The content differs from the key's newest vintage before this fetch
   * (a new key, a revision, or a flip back to an older vintage).
   */
  changed: boolean;
};

/**
 * Newest vintage per (downloader, key): the latest last_seen_at, then the
 * highest id (two vintages seen in the same second).
 */
const LATEST_SQL = (where: string) => `
  SELECT * FROM (
    SELECT a.*, ROW_NUMBER() OVER (
      PARTITION BY a.downloader_id, a.artifact_key
      ORDER BY a.last_seen_at DESC, a.id DESC
    ) AS rn
    FROM raw_artifacts a
    WHERE ${where}
  ) ranked
  WHERE rn = 1
  ORDER BY downloader_id ASC, artifact_key ASC`;

class RawArtifactCollection {
  static async getById(id: number): Promise<RawArtifact> {
    const rows = await mysql<RawArtifactAttrs>`
      SELECT * FROM raw_artifacts WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Raw artifact not found: ${id}`);
    return new RawArtifact(rows[0]);
  }

  /** Artifacts by id, in the order given; throws if any is missing. */
  static async getByIds(ids: readonly number[]): Promise<RawArtifact[]> {
    const byId = new Map<number, RawArtifact>();
    for (const chunk of ladderChunks([...new Set(ids)])) {
      const rows = await rawQuery<RawArtifactAttrs>(
        `SELECT * FROM raw_artifacts WHERE id IN (${placeholders(chunk.length)})`,
        chunk,
      );
      for (const r of rows) byId.set(r.id, new RawArtifact(r));
    }
    return ids.map((id) => {
      const a = byId.get(id);
      if (!a) throw new Error(`Raw artifact not found: ${id}`);
      return a;
    });
  }

  /** The newest vintage of every key of the given downloaders. */
  static async latestPerKey(
    downloaderIds: readonly number[],
  ): Promise<RawArtifact[]> {
    const out: RawArtifact[] = [];
    for (const chunk of ladderChunks([...new Set(downloaderIds)])) {
      const rows = await rawQuery<RawArtifactAttrs>(
        LATEST_SQL(`a.downloader_id IN (${placeholders(chunk.length)})`),
        chunk,
      );
      out.push(...rows.map((r) => new RawArtifact(r)));
    }
    return out;
  }

  /** Every retained vintage of the given downloaders, oldest first per key. */
  static async allVintages(
    downloaderIds: readonly number[],
  ): Promise<RawArtifact[]> {
    const out: RawArtifact[] = [];
    for (const chunk of ladderChunks([...new Set(downloaderIds)])) {
      const rows = await rawQuery<RawArtifactAttrs>(
        `SELECT * FROM raw_artifacts
         WHERE downloader_id IN (${placeholders(chunk.length)})
         ORDER BY downloader_id ASC, artifact_key ASC, last_seen_at ASC, id ASC`,
        chunk,
      );
      out.push(...rows.map((r) => new RawArtifact(r)));
    }
    return out;
  }

  /** Newest vintage of one key, or null if the key was never stored. */
  static async latestForKey(
    downloaderId: number,
    artifactKey: string,
  ): Promise<RawArtifact | null> {
    const rows = await mysql<RawArtifactAttrs>`
      SELECT * FROM raw_artifacts
      WHERE downloader_id = ${downloaderId} AND artifact_key = ${artifactKey}
      ORDER BY last_seen_at DESC, id DESC
      LIMIT 1
    `;
    return rows[0] ? new RawArtifact(rows[0]) : null;
  }

  /** Every vintage of one key, newest first. */
  static async vintagesOfKey(
    downloaderId: number,
    artifactKey: string,
  ): Promise<RawArtifact[]> {
    const rows = await mysql<RawArtifactAttrs>`
      SELECT * FROM raw_artifacts
      WHERE downloader_id = ${downloaderId} AND artifact_key = ${artifactKey}
      ORDER BY last_seen_at DESC, id DESC
    `;
    return rows.map((r) => new RawArtifact(r));
  }

  /** Keys whose newest vintage is final (a fetch skips these). */
  static async finalKeys(downloaderId: number): Promise<Set<string>> {
    const rows = await rawQuery<RawArtifactAttrs>(
      LATEST_SQL("a.downloader_id = ?"),
      [downloaderId],
    );
    return new Set(
      rows.filter((r) => Boolean(r.final)).map((r) => r.artifact_key),
    );
  }

  /**
   * Record a fetched file whose bytes are already stored at storagePath.
   * New content inserts a vintage; content already stored for this key
   * only bumps last_seen_at (and keeps or sets `final`), so retention is
   * one row per distinct hash.
   */
  static async record(p: RecordArtifactPayload): Promise<RecordArtifactResult> {
    const before = await this.latestForKey(p.downloaderId, p.artifactKey);
    await mysql`
      INSERT INTO raw_artifacts
        (downloader_id, artifact_key, content_hash, storage_path, resolved_url,
         original_name, content_type, size, final, metadata, fetched_at, last_seen_at)
      VALUES (
        ${p.downloaderId}, ${p.artifactKey}, ${p.contentHash}, ${p.storagePath},
        ${p.resolvedUrl ?? null}, ${p.originalName ?? null}, ${p.contentType ?? null},
        ${p.size}, ${p.final ? 1 : 0}, ${jsonParam(p.metadata)}, NOW(), NOW()
      )
      ON DUPLICATE KEY UPDATE
        last_seen_at = NOW(),
        final = GREATEST(final, VALUES(final)),
        resolved_url = COALESCE(VALUES(resolved_url), resolved_url),
        metadata = COALESCE(VALUES(metadata), metadata)
    `;
    const rows = await mysql<RawArtifactAttrs>`
      SELECT * FROM raw_artifacts
      WHERE downloader_id = ${p.downloaderId}
        AND artifact_key = ${p.artifactKey}
        AND content_hash = ${p.contentHash}
      LIMIT 1
    `;
    return {
      artifact: new RawArtifact(rows[0]),
      changed: before?.contentHash !== p.contentHash,
    };
  }

  /** Mark a key's newest vintage final. */
  static async markFinal(downloaderId: number, artifactKey: string) {
    const latest = await this.latestForKey(downloaderId, artifactKey);
    if (!latest || latest.final) return;
    await mysql`UPDATE raw_artifacts SET final = 1 WHERE id = ${latest.id}`;
  }

  /** Clear `final` on every vintage of a key (refetch it again). */
  static async unmarkFinal(downloaderId: number, artifactKey: string) {
    await mysql`
      UPDATE raw_artifacts SET final = 0
      WHERE downloader_id = ${downloaderId} AND artifact_key = ${artifactKey}
    `;
  }

  /** Per-downloader counts for list views. */
  static async countsByDownloader(): Promise<
    Map<number, { keys: number; vintages: number; bytes: number }>
  > {
    const rows = await mysql<{
      downloader_id: number;
      keys: number;
      vintages: number;
      bytes: number | string;
    }>`
      SELECT downloader_id,
             COUNT(DISTINCT artifact_key) AS \`keys\`,
             COUNT(*) AS vintages,
             SUM(size) AS bytes
      FROM raw_artifacts
      GROUP BY downloader_id
    `;
    return new Map(
      rows.map((r) => [
        Number(r.downloader_id),
        {
          keys: Number(r.keys),
          vintages: Number(r.vintages),
          bytes: Number(r.bytes),
        },
      ]),
    );
  }
}

export default RawArtifactCollection;
