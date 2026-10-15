/**
 * In-memory IngestDb for runner tests: the same semantics as the catalog
 * collections (one artifact row per distinct hash per key, newest vintage
 * = latest last_seen_at, claims, latest ok run) without MySQL. Timestamps
 * come from a counter so ordering is deterministic.
 */

import type {
  FinishExtractionRunPayload,
  StartExtractionRunPayload,
} from "@catalog/collections/extraction-run-collection";
import type { FinishFetchRunPayload } from "@catalog/collections/fetch-run-collection";
import type { RecordArtifactPayload } from "@catalog/collections/raw-artifact-collection";
import DataDownloader from "@catalog/models/data-downloader";
import type { DataDownloaderAttrs } from "@catalog/models/data-downloader";
import DataExtractor from "@catalog/models/data-extractor";
import type { DataExtractorAttrs } from "@catalog/models/data-extractor";
import ExtractionRun from "@catalog/models/extraction-run";
import type { ExtractionRunAttrs } from "@catalog/models/extraction-run";
import ExtractorInput from "@catalog/models/extractor-input";
import FetchRun from "@catalog/models/fetch-run";
import type { FetchRunAttrs } from "@catalog/models/fetch-run";
import RawArtifact from "@catalog/models/raw-artifact";
import type { RawArtifactAttrs } from "@catalog/models/raw-artifact";

import type { IngestDb } from "../db";

export class MemoryDb implements IngestDb {
  private tick = 0;
  downloaders = new Map<number, DataDownloaderAttrs>();
  extractors = new Map<number, DataExtractorAttrs>();
  inputs: Array<{
    extractor_id: number;
    downloader_id: number;
    role: string | null;
  }> = [];
  artifacts: RawArtifactAttrs[] = [];
  fetchRuns: FetchRunAttrs[] = [];
  runLinks: Array<{ runId: number; artifactId: number; changed: boolean }> = [];
  extractionRuns: ExtractionRunAttrs[] = [];
  /** What referencedFilters returns, per extractor handle */
  filters = new Map<string, Array<Record<string, string>>>();

  /** A strictly increasing timestamp, one second per call. */
  now(): Date {
    return new Date(Date.UTC(2026, 9, 14, 0, 0, this.tick++));
  }

  addDownloader(attrs: Omit<DataDownloaderAttrs, "id">): DataDownloader {
    const id = this.downloaders.size + 1;
    this.downloaders.set(id, { enabled: 1, ...attrs, id });
    return new DataDownloader(this.downloaders.get(id)!);
  }

  addExtractor(
    attrs: Omit<DataExtractorAttrs, "id">,
    inputs: Array<{ downloaderId: number; role?: string | null }>,
  ): DataExtractor {
    const id = this.extractors.size + 1;
    this.extractors.set(id, { enabled: 1, ...attrs, id });
    for (const i of inputs) {
      this.inputs.push({
        extractor_id: id,
        downloader_id: i.downloaderId,
        role: i.role ?? null,
      });
    }
    return new DataExtractor(this.extractors.get(id)!);
  }

  async getDownloader(handle: string) {
    const a = [...this.downloaders.values()].find((d) => d.handle === handle);
    if (!a) throw new Error(`Data downloader '${handle}' does not exist`);
    return new DataDownloader(a);
  }
  async getDownloaderById(id: number) {
    return new DataDownloader(this.downloaders.get(id)!);
  }
  async claimDownloader(id: number) {
    const d = this.downloaders.get(id)!;
    if (d.running_since) return false;
    d.running_since = this.now();
    return true;
  }
  async releaseDownloader(id: number) {
    this.downloaders.get(id)!.running_since = null;
  }
  async setDownloaderState(id: number, state: Record<string, unknown>) {
    this.downloaders.get(id)!.state = state;
  }

  async startFetchRun(downloaderId: number, triggeredBy: string | null) {
    const id = this.fetchRuns.length + 1;
    this.fetchRuns.push({
      id,
      downloader_id: downloaderId,
      status: "running",
      triggered_by: triggeredBy,
      started_at: this.now(),
    });
    return id;
  }
  async finishFetchRun(id: number, p: FinishFetchRunPayload) {
    Object.assign(this.fetchRuns[id - 1], {
      status: p.status,
      error: p.error ?? null,
      stats: p.stats ?? null,
      finished_at: this.now(),
    });
  }
  async linkArtifacts(
    runId: number,
    links: Array<{ artifactId: number; changed: boolean }>,
  ) {
    for (const l of links) this.runLinks.push({ runId, ...l });
  }
  async failAbandonedFetchRuns(downloaderId: number) {
    for (const r of this.fetchRuns) {
      if (r.downloader_id === downloaderId && r.status === "running")
        r.status = "failed";
    }
  }

  private vintages(downloaderId: number, key: string): RawArtifactAttrs[] {
    return this.artifacts
      .filter((a) => a.downloader_id === downloaderId && a.artifact_key === key)
      .sort(
        (a, b) =>
          +new Date(b.last_seen_at) - +new Date(a.last_seen_at) || b.id - a.id,
      );
  }

  async recordArtifact(p: RecordArtifactPayload) {
    const before = this.vintages(p.downloaderId, p.artifactKey)[0];
    const now = this.now();
    let row = this.artifacts.find(
      (a) =>
        a.downloader_id === p.downloaderId &&
        a.artifact_key === p.artifactKey &&
        a.content_hash === p.contentHash,
    );
    if (row) {
      row.last_seen_at = now;
      row.final = Boolean(row.final) || Boolean(p.final);
      if (p.metadata) row.metadata = p.metadata;
    } else {
      row = {
        id: this.artifacts.length + 1,
        downloader_id: p.downloaderId,
        artifact_key: p.artifactKey,
        content_hash: p.contentHash,
        storage_path: p.storagePath,
        resolved_url: p.resolvedUrl ?? null,
        original_name: p.originalName ?? null,
        content_type: p.contentType ?? null,
        size: p.size,
        final: Boolean(p.final),
        metadata: p.metadata ?? null,
        fetched_at: now,
        last_seen_at: now,
      };
      this.artifacts.push(row);
    }
    return {
      artifact: new RawArtifact(row),
      changed: before?.content_hash !== p.contentHash,
    };
  }
  async latestArtifact(downloaderId: number, key: string) {
    const a = this.vintages(downloaderId, key)[0];
    return a ? new RawArtifact(a) : null;
  }
  private keysOf(ids: number[]): Array<[number, string]> {
    const seen = new Set<string>();
    const out: Array<[number, string]> = [];
    for (const a of this.artifacts) {
      if (!ids.includes(a.downloader_id)) continue;
      const k = `${a.downloader_id}|${a.artifact_key}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([a.downloader_id, a.artifact_key]);
      }
    }
    return out;
  }
  async finalKeys(downloaderId: number) {
    return new Set(
      this.keysOf([downloaderId])
        .map(([d, k]) => this.vintages(d, k)[0])
        .filter((a) => a.final)
        .map((a) => a.artifact_key),
    );
  }
  async markFinal(downloaderId: number, key: string) {
    const a = this.vintages(downloaderId, key)[0];
    if (a) a.final = true;
  }
  async latestPerKey(ids: number[]) {
    return this.keysOf(ids).map(
      ([d, k]) => new RawArtifact(this.vintages(d, k)[0]),
    );
  }
  async allVintages(ids: number[]) {
    return this.keysOf(ids).flatMap(([d, k]) =>
      this.vintages(d, k)
        .reverse()
        .map((a) => new RawArtifact(a)),
    );
  }

  async getExtractor(handle: string) {
    const a = [...this.extractors.values()].find((e) => e.handle === handle);
    if (!a) throw new Error(`Data extractor '${handle}' does not exist`);
    return new DataExtractor(a);
  }
  async extractorInputs(extractorId: number) {
    return this.inputs
      .filter((i) => i.extractor_id === extractorId)
      .map(
        (i) =>
          new ExtractorInput({
            ...i,
            downloader_handle: this.downloaders.get(i.downloader_id)?.handle,
          }),
      );
  }
  async dependentsOf(downloaderId: number) {
    return this.inputs
      .filter((i) => i.downloader_id === downloaderId)
      .map((i) => this.extractors.get(i.extractor_id)!)
      .filter((e) => e.enabled)
      .map((e) => new DataExtractor(e));
  }
  async claimExtractor(id: number) {
    const e = this.extractors.get(id)!;
    if (e.running_since) return false;
    e.running_since = this.now();
    return true;
  }
  async releaseExtractor(id: number) {
    this.extractors.get(id)!.running_since = null;
  }

  async startExtractionRun(p: StartExtractionRunPayload) {
    const id = this.extractionRuns.length + 1;
    this.extractionRuns.push({
      id,
      extractor_id: p.extractorId,
      status: "running",
      triggered_by: p.triggeredBy,
      fetch_run_id: p.fetchRunId ?? null,
      input_artifact_ids: p.inputArtifactIds,
      inputs_hash: p.inputsHash,
      started_at: this.now(),
    });
    return id;
  }
  async finishExtractionRun(id: number, p: FinishExtractionRunPayload) {
    Object.assign(this.extractionRuns[id - 1], {
      status: p.status,
      error: p.error ?? null,
      validation_results: p.validationResults ?? null,
      stats: p.stats ?? null,
      output_path: p.outputPath ?? null,
      output_hash: p.outputHash ?? null,
      row_count: p.rowCount ?? null,
      series_count: p.seriesCount ?? null,
      finished_at: this.now(),
    });
  }
  async latestOkExtraction(extractorId: number) {
    const r = [...this.extractionRuns]
      .reverse()
      .find((x) => x.extractor_id === extractorId && x.status === "ok");
    return r ? new ExtractionRun(r) : null;
  }
  async failAbandonedExtractionRuns(extractorId: number) {
    for (const r of this.extractionRuns) {
      if (r.extractor_id === extractorId && r.status === "running")
        r.status = "failed";
    }
  }

  async referencedFilters(handles: string[]) {
    return handles.flatMap((h) => this.filters.get(h) ?? []);
  }

  fetchRun(id: number) {
    return new FetchRun(this.fetchRuns[id - 1]);
  }
  extractionRun(id: number) {
    return new ExtractionRun(this.extractionRuns[id - 1]);
  }
}
