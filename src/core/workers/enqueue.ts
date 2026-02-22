import {
  criticalQueue,
  defaultQueue,
  JobName,
  type AdminActionJobData,
  type ApiDvwReloadJobData,
  type BatchReloadJobData,
  type DbedtUploadJobData,
  type DownloadJobData,
  type DvwUploadJobData,
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
  return criticalQueue.add(JobName.DBEDT_UPLOAD, data);
}

export function enqueueDvwUpload(data: DvwUploadJobData) {
  return criticalQueue.add(JobName.DVW_UPLOAD, data);
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
