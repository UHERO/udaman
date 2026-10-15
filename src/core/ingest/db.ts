/**
 * The runner's view of the database. Production uses the catalog
 * collections (catalogDb); runner tests pass an in-memory implementation
 * so they need neither MySQL nor the network.
 */

import DataDownloaderCollection from "@catalog/collections/data-downloader-collection";
import DataExtractorCollection from "@catalog/collections/data-extractor-collection";
import ExtractionRunCollection from "@catalog/collections/extraction-run-collection";
import type {
  FinishExtractionRunPayload,
  StartExtractionRunPayload,
} from "@catalog/collections/extraction-run-collection";
import FetchRunCollection from "@catalog/collections/fetch-run-collection";
import type {
  FetchRunArtifactLink,
  FinishFetchRunPayload,
} from "@catalog/collections/fetch-run-collection";
import RawArtifactCollection from "@catalog/collections/raw-artifact-collection";
import type {
  RecordArtifactPayload,
  RecordArtifactResult,
} from "@catalog/collections/raw-artifact-collection";
import type DataDownloader from "@catalog/models/data-downloader";
import type DataExtractor from "@catalog/models/data-extractor";
import type ExtractionRun from "@catalog/models/extraction-run";
import type ExtractorInput from "@catalog/models/extractor-input";
import type RawArtifact from "@catalog/models/raw-artifact";

import { referencedFilters } from "./references";

export interface IngestDb {
  getDownloader(handle: string): Promise<DataDownloader>;
  getDownloaderById(id: number): Promise<DataDownloader>;
  claimDownloader(id: number): Promise<boolean>;
  releaseDownloader(id: number): Promise<void>;
  setDownloaderState(id: number, state: Record<string, unknown>): Promise<void>;

  startFetchRun(
    downloaderId: number,
    triggeredBy: string | null,
  ): Promise<number>;
  finishFetchRun(id: number, p: FinishFetchRunPayload): Promise<void>;
  linkArtifacts(runId: number, links: FetchRunArtifactLink[]): Promise<void>;
  failAbandonedFetchRuns(downloaderId: number): Promise<void>;

  recordArtifact(p: RecordArtifactPayload): Promise<RecordArtifactResult>;
  latestArtifact(
    downloaderId: number,
    key: string,
  ): Promise<RawArtifact | null>;
  finalKeys(downloaderId: number): Promise<Set<string>>;
  markFinal(downloaderId: number, key: string): Promise<void>;
  latestPerKey(downloaderIds: number[]): Promise<RawArtifact[]>;
  allVintages(downloaderIds: number[]): Promise<RawArtifact[]>;

  getExtractor(handle: string): Promise<DataExtractor>;
  extractorInputs(extractorId: number): Promise<ExtractorInput[]>;
  dependentsOf(downloaderId: number): Promise<DataExtractor[]>;
  claimExtractor(id: number): Promise<boolean>;
  releaseExtractor(id: number): Promise<void>;

  startExtractionRun(p: StartExtractionRunPayload): Promise<number>;
  finishExtractionRun(id: number, p: FinishExtractionRunPayload): Promise<void>;
  latestOkExtraction(extractorId: number): Promise<ExtractionRun | null>;
  failAbandonedExtractionRuns(extractorId: number): Promise<void>;

  /** Filters of enabled load statements that call load_from_extract(handle, …). */
  referencedFilters(
    extractorHandles: string[],
  ): Promise<Array<Record<string, string>>>;
}

export const catalogDb: IngestDb = {
  getDownloader: (h) => DataDownloaderCollection.getByHandle(h),
  getDownloaderById: (id) => DataDownloaderCollection.getById(id),
  claimDownloader: (id) => DataDownloaderCollection.claim(id),
  releaseDownloader: (id) => DataDownloaderCollection.releaseClaim(id),
  setDownloaderState: (id, s) => DataDownloaderCollection.setState(id, s),

  startFetchRun: (id, t) => FetchRunCollection.start(id, t),
  finishFetchRun: (id, p) => FetchRunCollection.finish(id, p),
  linkArtifacts: (id, links) => FetchRunCollection.linkArtifacts(id, links),
  failAbandonedFetchRuns: (id) => FetchRunCollection.failAbandoned(id),

  recordArtifact: (p) => RawArtifactCollection.record(p),
  latestArtifact: (id, k) => RawArtifactCollection.latestForKey(id, k),
  finalKeys: (id) => RawArtifactCollection.finalKeys(id),
  markFinal: (id, k) => RawArtifactCollection.markFinal(id, k),
  latestPerKey: (ids) => RawArtifactCollection.latestPerKey(ids),
  allVintages: (ids) => RawArtifactCollection.allVintages(ids),

  getExtractor: (h) => DataExtractorCollection.getByHandle(h),
  extractorInputs: (id) => DataExtractorCollection.getInputs(id),
  dependentsOf: (id) => DataExtractorCollection.dependentsOf(id),
  claimExtractor: (id) => DataExtractorCollection.claim(id),
  releaseExtractor: (id) => DataExtractorCollection.releaseClaim(id),

  startExtractionRun: (p) => ExtractionRunCollection.start(p),
  finishExtractionRun: (id, p) => ExtractionRunCollection.finish(id, p),
  latestOkExtraction: (id) => ExtractionRunCollection.latestOk(id),
  failAbandonedExtractionRuns: (id) =>
    ExtractionRunCollection.failAbandoned(id),

  referencedFilters: (handles) => referencedFilters(handles),
};
