import {
  criticalQueue,
  defaultQueue,
  heavyQueue,
  JobName,
  lightQueue,
  type AdminActionJobData,
  type ApiDvwReloadJobData,
  type BatchReloadJobData,
  type ClipboardActionJobData,
  type ClipboardLoaderReloadJobData,
  type DbedtUploadJobData,
  type DownloadJobData,
  type DvwUploadJobData,
  type QpubReparseJobData,
  type ReloadJobData,
  type SeriesReloadJobData,
  type TargetedReloadJobData,
  type UniverseArchiveJobData,
  type UniversePurgeJobData,
  type UpdatePublicJobData,
} from "./queues";

export function enqueueSeriesReload(data: SeriesReloadJobData) {
  return lightQueue.add(JobName.SERIES_RELOAD, data);
}

export function enqueueReloadJob(data: ReloadJobData) {
  return heavyQueue.add(JobName.RELOAD_JOB, data);
}

export function enqueueTsdExport() {
  return defaultQueue.add(JobName.TSD_EXPORT, {});
}

/**
 * Enqueue a public data points sweep. Deterministic jobIds so repeated
 * requests collapse instead of stacking full passes behind each other:
 *  - a waiting/delayed sweep hasn't started, so it will see our writes —
 *    reuse it;
 *  - an *active* sweep takes its watermark at run start and may miss
 *    writes made since, so queue one chaser behind it (the chaser slot
 *    dedups the same way, so there is never more than active + 1);
 *  - a finished (completed/failed) job is removed first so re-enqueueing
 *    after completion works.
 */
export async function enqueueUpdatePublic(data: UpdatePublicJobData = {}) {
  const base = `update-public-${data.universe ?? "all"}`;
  for (const jobId of [base, `${base}-chaser`]) {
    const existing = await heavyQueue.getJob(jobId);
    if (!existing) {
      return heavyQueue.add(JobName.UPDATE_PUBLIC, data, { jobId });
    }
    const state = await existing.getState();
    if (state === "waiting" || state === "delayed") return existing;
    if (state === "active") continue;
    await existing.remove();
    return heavyQueue.add(JobName.UPDATE_PUBLIC, data, { jobId });
  }
  // Both slots in flight (the base sweep finishing while the chaser
  // starts) — a raced add dedups against the existing chaser, and the
  // scheduled sweeps are the backstop for anything it misses.
  return heavyQueue.add(JobName.UPDATE_PUBLIC, data, {
    jobId: `${base}-chaser`,
  });
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
  return heavyQueue.add(JobName.API_DVW_RELOAD, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export function enqueueDependencyReset() {
  return heavyQueue.add(JobName.DEPENDENCY_RESET, {});
}

export function enqueuePurgeOld() {
  return defaultQueue.add(JobName.PURGE_OLD, {});
}

export function enqueueBatchReload(data: BatchReloadJobData) {
  return heavyQueue.add(JobName.BATCH_RELOAD, data);
}

export function enqueueTargetedReload(data: TargetedReloadJobData) {
  return heavyQueue.add(JobName.TARGETED_RELOAD, data);
}

export function enqueueDownload(data: DownloadJobData) {
  return defaultQueue.add(JobName.DOWNLOAD, data);
}

export function enqueueKauaiExport() {
  return defaultQueue.add(JobName.KAUAI_EXPORT, {});
}

export function enqueueClipboardAction(data: ClipboardActionJobData) {
  return lightQueue.add(JobName.CLIPBOARD_ACTION, data, { priority: 1 });
}

export function enqueueClipboardLoaderReload(
  data: ClipboardLoaderReloadJobData,
) {
  return lightQueue.add(JobName.CLIPBOARD_LOADER_RELOAD, data, {
    priority: 1,
  });
}

export function enqueueQpubReparse(data: QpubReparseJobData) {
  const id = [data.table, data.island, data.period].filter(Boolean).join("-");
  return defaultQueue.add(JobName.QPUB_REPARSE, data, {
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
  const existing = await heavyQueue.getJob(jobId);
  if (existing) await existing.remove();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  return heavyQueue.add(JobName.UNIVERSE_ARCHIVE, data, { jobId, delay });
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
  const existing = await heavyQueue.getJob(jobId);
  if (existing) await existing.remove();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  return heavyQueue.add(JobName.UNIVERSE_PURGE, data, { jobId, delay });
}
