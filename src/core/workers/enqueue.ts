import {
  criticalQueue,
  defaultQueue,
  JobName,
  scraperQueue,
  type AdminActionJobData,
  type ApiDvwReloadJobData,
  type BatchReloadJobData,
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

export function enqueueQpubReparse(data: QpubReparseJobData) {
  const id = [data.table, data.island, data.period].filter(Boolean).join("-");
  return scraperQueue.add(JobName.QPUB_REPARSE, data, {
    jobId: `qpub-reparse-${id}`,
    attempts: 1,
  });
}
