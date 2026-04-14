import {
  criticalQueue,
  defaultQueue,
  JobName,
  scraperQueue,
  type AdminActionJobData,
  type ApiDvwReloadJobData,
  type BatchReloadJobData,
  type ClipboardActionJobData,
  type ClipboardLoaderReloadJobData,
  type DbedtUploadJobData,
  type DownloadJobData,
  type DvwUploadJobData,
  type QpubLoadJobData,
  type QpubParseJobData,
  type QpubReparseJobData,
  type QpubScrapeJobData,
  type ReloadJobData,
  type SeriesReloadJobData,
  type TargetedReloadJobData,
  type UniverseArchiveJobData,
  type UniversePurgeJobData,
  type UpdatePublicJobData,
} from "./queues";

export function enqueueSeriesReload(data: SeriesReloadJobData) {
  return defaultQueue.add(JobName.SERIES_RELOAD, data);
}

export function enqueueReloadJob(data: ReloadJobData) {
  return defaultQueue.add(JobName.RELOAD_JOB, data);
}

export function enqueueTsdExport() {
  return defaultQueue.add(JobName.TSD_EXPORT, {});
}

export function enqueueUpdatePublic(data: UpdatePublicJobData = {}) {
  return defaultQueue.add(JobName.UPDATE_PUBLIC, data);
}

export function enqueueAdminAction(data: AdminActionJobData) {
  return defaultQueue.add(JobName.ADMIN_ACTION, data);
}

export function enqueueDbedtUpload(data: DbedtUploadJobData) {
  return criticalQueue.add(JobName.DBEDT_UPLOAD, data, {
    jobId: `dbedt-upload-${data.uploadId}`,
  });
}

export function enqueueDvwUpload(data: DvwUploadJobData) {
  return criticalQueue.add(JobName.DVW_UPLOAD, data, {
    jobId: `dvw-upload-${data.uploadId}`,
  });
}

export function enqueueApiDvwReload(data: ApiDvwReloadJobData) {
  return defaultQueue.add(JobName.API_DVW_RELOAD, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export function enqueueDependencyReset() {
  return defaultQueue.add(JobName.DEPENDENCY_RESET, {});
}

export function enqueuePurgeOld() {
  return defaultQueue.add(JobName.PURGE_OLD, {});
}

export function enqueueBatchReload(data: BatchReloadJobData) {
  return defaultQueue.add(JobName.BATCH_RELOAD, data);
}

export function enqueueTargetedReload(data: TargetedReloadJobData) {
  return defaultQueue.add(JobName.TARGETED_RELOAD, data);
}

export function enqueueDownload(data: DownloadJobData) {
  return defaultQueue.add(JobName.DOWNLOAD, data);
}

export function enqueueKauaiExport() {
  return defaultQueue.add(JobName.KAUAI_EXPORT, {});
}

export function enqueueQpubScrape(data: QpubScrapeJobData) {
  return scraperQueue.add(JobName.QPUB_SCRAPE, data, {
    jobId: `qpub-scrape-${data.tmk}`,
  });
}

export function enqueueQpubSeed() {
  return scraperQueue.add(JobName.QPUB_SEED, {});
}

export function enqueueQpubParse(data: QpubParseJobData) {
  return scraperQueue.add(JobName.QPUB_PARSE, data, {
    jobId: `qpub-parse-${data.tmk}`,
  });
}

export function enqueueQpubLoad(data: QpubLoadJobData) {
  return scraperQueue.add(JobName.QPUB_LOAD, data, {
    jobId: `qpub-load-${data.tmk}`,
  });
}

export function enqueueClipboardAction(data: ClipboardActionJobData) {
  return defaultQueue.add(JobName.CLIPBOARD_ACTION, data, { priority: 1 });
}

export function enqueueClipboardLoaderReload(
  data: ClipboardLoaderReloadJobData,
) {
  return defaultQueue.add(JobName.CLIPBOARD_LOADER_RELOAD, data, {
    priority: 1,
  });
}

export function enqueueQpubReparse(data: QpubReparseJobData) {
  const id = [data.table, data.island, data.period].filter(Boolean).join("-");
  return scraperQueue.add(JobName.QPUB_REPARSE, data, {
    jobId: `qpub-reparse-${id}`,
    attempts: 1,
  });
}

/**
 * Enqueue a universe archive delayed until `scheduledAt` (ISO datetime).
 * Removes any existing delayed job for the same universe first so the
 * user can reschedule without getting a duplicate-jobId error.
 */
export async function enqueueUniverseArchive(
  data: UniverseArchiveJobData,
  scheduledAt: Date,
) {
  const jobId = `universe-archive-${data.universe}`;
  const existing = await defaultQueue.getJob(jobId);
  if (existing) await existing.remove();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  return defaultQueue.add(JobName.UNIVERSE_ARCHIVE, data, { jobId, delay });
}

/**
 * Enqueue a universe purge delayed until `scheduledAt` (ISO datetime).
 * Removes any existing delayed job for the same universe first so the
 * user can reschedule without getting a duplicate-jobId error.
 */
export async function enqueueUniversePurge(
  data: UniversePurgeJobData,
  scheduledAt: Date,
) {
  const jobId = `universe-purge-${data.universe}`;
  const existing = await defaultQueue.getJob(jobId);
  if (existing) await existing.remove();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  return defaultQueue.add(JobName.UNIVERSE_PURGE, data, { jobId, delay });
}
