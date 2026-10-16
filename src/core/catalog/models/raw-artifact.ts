import { isAbsolute, join, normalize, sep } from "node:path";

import { getDataDir } from "@/lib/data-dir";

import { isoOrNull, jsonObject, toDate } from "./ingest-columns";

export type RawArtifactAttrs = {
  id: number;
  downloader_id: number;
  artifact_key: string;
  content_hash: string;
  storage_path: string;
  resolved_url?: string | null;
  original_name?: string | null;
  content_type?: string | null;
  size: number | string | bigint;
  final?: boolean | number | null;
  metadata?: unknown;
  fetched_at: Date | string;
  last_seen_at: Date | string;
};

export type SerializedRawArtifact = ReturnType<RawArtifact["toJSON"]>;

/**
 * One stored vintage of one logical file of a downloader: the bytes as
 * fetched, never modified. `artifactKey` names the logical file (e.g.
 * `collec/2025-12`, a BLS series id); a key has one row per distinct
 * content hash, and its newest vintage is the one with the latest
 * `lastSeenAt`.
 */
class RawArtifact {
  readonly id: number;
  downloaderId: number;
  artifactKey: string;
  /** sha256 hex of the stored bytes */
  contentHash: string;
  /** Relative to DATA_DIR */
  storagePath: string;
  resolvedUrl: string | null;
  originalName: string | null;
  contentType: string | null;
  size: number;
  /** The source will not change this key again: never refetched. */
  final: boolean;
  metadata: Record<string, unknown>;
  /** First fetch that returned this content (HST wall-clock) */
  fetchedAt: Date;
  /** Latest fetch that returned this content (HST wall-clock) */
  lastSeenAt: Date;

  constructor(attrs: RawArtifactAttrs) {
    this.id = attrs.id;
    this.downloaderId = attrs.downloader_id;
    this.artifactKey = attrs.artifact_key;
    this.contentHash = attrs.content_hash;
    this.storagePath = attrs.storage_path;
    this.resolvedUrl = attrs.resolved_url ?? null;
    this.originalName = attrs.original_name ?? null;
    this.contentType = attrs.content_type ?? null;
    this.size = Number(attrs.size);
    this.final = Boolean(attrs.final);
    this.metadata = jsonObject(attrs.metadata);
    this.fetchedAt = toDate(attrs.fetched_at)!;
    this.lastSeenAt = toDate(attrs.last_seen_at)!;
  }

  /** Absolute path of the stored file, confined to DATA_DIR. */
  absolutePath(): string {
    const rel = normalize(this.storagePath);
    if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === "..") {
      throw new Error(
        `RawArtifact#${this.id}: storage_path escapes DATA_DIR: ${this.storagePath}`,
      );
    }
    return join(/*turbopackIgnore: true*/ getDataDir(), rel);
  }

  toString(): string {
    return `RawArtifact#${this.id} <${this.artifactKey} ${this.contentHash.slice(0, 12)}>`;
  }

  toJSON() {
    return {
      id: this.id,
      downloaderId: this.downloaderId,
      artifactKey: this.artifactKey,
      contentHash: this.contentHash,
      storagePath: this.storagePath,
      resolvedUrl: this.resolvedUrl,
      originalName: this.originalName,
      contentType: this.contentType,
      size: this.size,
      final: this.final,
      metadata: this.metadata,
      fetchedAt: isoOrNull(this.fetchedAt),
      lastSeenAt: isoOrNull(this.lastSeenAt),
    };
  }
}

export default RawArtifact;
