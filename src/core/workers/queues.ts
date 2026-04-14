import { Queue } from "bullmq";

import { redisConnection } from "./connection";

// ─── Job name constants ──────────────────────────────────────────────

export const JobName = {
  SERIES_RELOAD: "series.reload",
  RELOAD_JOB: "reload-job.process",
  TSD_EXPORT: "tsd.export",
  UPDATE_PUBLIC: "public.update",
  ADMIN_ACTION: "admin.action",
  DBEDT_UPLOAD: "upload.dbedt",
  DVW_UPLOAD: "upload.dvw",
  API_DVW_RELOAD: "reload.api-dvw",
  DEPENDENCY_RESET: "admin.dependency-reset",
  PURGE_OLD: "admin.purge-old",
  BATCH_RELOAD: "reload.batch",
  TARGETED_RELOAD: "reload.targeted",
  DOWNLOAD: "download.file",
  KAUAI_EXPORT: "export.kauai",
  QPUB_SCRAPE: "scraper.qpub-scrape",
  QPUB_SEED: "scraper.qpub-seed",
  QPUB_PARSE: "scraper.qpub-parse",
  QPUB_LOAD: "scraper.qpub-load",
  QPUB_REPARSE: "scraper.qpub-reparse",
  CLIPBOARD_ACTION: "clipboard.action",
  CLIPBOARD_LOADER_RELOAD: "clipboard.loader-reload",
  UNIVERSE_ARCHIVE: "universe.archive",
  UNIVERSE_PURGE: "universe.purge",
} as const;

export type JobNameValue = (typeof JobName)[keyof typeof JobName];

// ─── Job data types ──────────────────────────────────────────────────

export type SeriesReloadJobData = {
  seriesId: number;
  loaderId: number;
  clearFirst: boolean;
  batchId?: string;
};

export type DbedtUploadJobData = {
  uploadId: number;
  filePath: string;
};

export type DvwUploadJobData = {
  uploadId: number;
  filePath: string;
};

export type ReloadJobData = {
  reloadJobId: number;
};

export type TsdExportJobData = Record<string, never>;

export type UpdatePublicJobData = {
  universe?: string;
};

export type AdminActionJobData = {
  action: "clear_cache" | "restart_rest" | "restart_dvw" | "sync_nas";
};

export type ApiDvwReloadJobData = {
  dvwUploadId: number;
};

export type DependencyResetJobData = Record<string, never>;

export type PurgeOldJobData = Record<string, never>;

export type BatchReloadJobData = {
  excludeSearches: string[];
  updatePublic: boolean;
};

export type TargetedReloadJobData = {
  name: string;
  search: string;
  nightly: boolean;
  updatePublic: boolean;
  groupSize?: number;
};

export type DownloadJobData = {
  handle: string;
};

export type KauaiExportJobData = Record<string, never>;

export type QpubScrapeJobData = {
  tmk: string;
  url: string;
  island: string;
};

export type QpubSeedJobData = Record<string, never>;

export type QpubParseJobData = {
  tmk: string;
  island: string;
};

export type QpubLoadJobData = {
  tmk: string;
  island: string;
};

export type ClipboardActionJobData = {
  reloadJobId: number;
  action:
    | "reload"
    | "reload_with_deps"
    | "reset"
    | "clear_data"
    | "restrict"
    | "unrestrict"
    | "destroy";
  seriesIds: number[];
};

export type ClipboardLoaderReloadJobData = {
  reloadJobId: number;
  loaderIds: number[];
};

export type QpubReparseJobData = {
  /** Key from TABLE_LOADERS (e.g., 'residential_improvements', 'parcels') */
  table: string;
  /** Filter by island code ('1','2','3','4') */
  island?: string;
  /** NAS period dir (e.g., '2026-1'). Default: all available periods */
  period?: string;
  /** Progress report interval (default: 500) */
  batchSize?: number;
};

export type UniverseArchiveJobData = {
  universe: string;
};

export type UniversePurgeJobData = {
  universe: string;
};

// ─── Queue instances ─────────────────────────────────────────────────

const defaultOpts = {
  connection: redisConnection,
  prefix: "udaman",
  defaultJobOptions: {
    removeOnComplete: { age: 7 * 24 * 60 * 60 }, // 7 days
    removeOnFail: { age: 30 * 24 * 60 * 60 }, // 30 days
    attempts: 1,
  },
};

export const defaultQueue = new Queue("default", defaultOpts);
export const criticalQueue = new Queue("critical", defaultOpts);
export const scraperQueue = new Queue("scraper", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
  },
});
