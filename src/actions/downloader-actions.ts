"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import type {
  CreateDownloaderPayload,
  UpdateDownloaderPayload,
} from "@catalog/collections/downloader-collection";
import {
  createDownloader,
  deleteDownloader,
  getDownloaderDetail,
  getDownloaderForEdit,
  getDownloaders,
  getUnconfiguredHandles,
  releaseDownloaderClaim,
  setDownloadHistorical,
  triggerDownloaderRun,
  updateDownloader,
} from "@catalog/controllers/downloaders";
import type {
  DownloaderDetail,
  DownloaderFormData,
  DownloaderSummary,
} from "@catalog/controllers/downloaders";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.downloaders");

/** Run `fn`, logging and recording failures like the other actions. */
async function logged<T>(
  name: string,
  userId: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, `${name} failed`);
    AppLogCollection.logError(err, { userId, name });
    throw err;
  }
}

export async function listDownloaders(): Promise<DownloaderSummary[]> {
  await requirePermission("downloader", "read");
  return getDownloaders();
}

export async function fetchDownloaderDetail(
  id: number,
): Promise<DownloaderDetail> {
  await requirePermission("downloader", "read");
  return getDownloaderDetail({ id });
}

export async function fetchDownloaderForEdit(
  id: number,
): Promise<DownloaderFormData> {
  await requirePermission("downloader", "read");
  return getDownloaderForEdit({ id });
}

export async function fetchUnconfiguredHandles(): Promise<string[]> {
  await requirePermission("downloader", "read");
  return getUnconfiguredHandles();
}

export async function runDownloaderAction(
  id: number,
  opts: { force?: boolean; full?: boolean } = {},
) {
  const { userId } = await requirePermission("downloader", "update");
  log.info({ id, ...opts }, "runDownloaderAction called");
  return logged("downloader.run", userId, () => triggerDownloaderRun(id, opts));
}

export async function createDownloaderAction(payload: CreateDownloaderPayload) {
  const { userId } = await requirePermission("downloader", "create");
  return logged("downloader.create", userId, async () => {
    const result = await createDownloader(payload);
    return { message: result.message, id: result.data.id };
  });
}

export async function updateDownloaderAction(
  id: number,
  payload: UpdateDownloaderPayload,
) {
  const { userId } = await requirePermission("downloader", "update");
  return logged("downloader.update", userId, async () => {
    const result = await updateDownloader(id, payload);
    return { message: result.message, id: result.data.id };
  });
}

export async function deleteDownloaderAction(id: number) {
  const { userId } = await requirePermission("downloader", "delete");
  return logged("downloader.delete", userId, () => deleteDownloader(id));
}

export async function setDownloadHistoricalAction(
  downloadId: number,
  historical: boolean,
) {
  const { userId } = await requirePermission("download", "update");
  return logged("download.historical", userId, () =>
    setDownloadHistorical(downloadId, historical),
  );
}

export async function releaseDownloaderClaimAction(id: number) {
  const { userId } = await requirePermission("downloader", "update");
  return logged("downloader.release", userId, () => releaseDownloaderClaim(id));
}
