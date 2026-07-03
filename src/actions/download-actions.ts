"use server";

import type {
  CreateDownloadPayload,
  UpdateDownloadPayload,
} from "@catalog/collections/download-collection";
import {
  createDownload,
  deleteDownload,
  getDownloadDetail,
  getDownloadForEdit,
  getDownloads,
  triggerDownloadToServer,
  updateDownload,
} from "@catalog/controllers/downloads";
import type {
  DomainGroup,
  DownloadDetail,
  DownloadFormData,
} from "@catalog/controllers/downloads";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.downloads");

export async function listDownloads(): Promise<{ domains: DomainGroup[] }> {
  await requirePermission("download", "read");
  return getDownloads();
}

export async function fetchDownloadDetail(id: number): Promise<DownloadDetail> {
  await requirePermission("download", "read");
  return getDownloadDetail({ id });
}

export async function fetchDownloadForEdit(
  id: number,
): Promise<DownloadFormData> {
  await requirePermission("download", "read");
  return getDownloadForEdit({ id });
}

export async function downloadToServer(
  id: number,
): Promise<{ status: number; changed: boolean }> {
  const { userId } = await requirePermission("download", "execute");
  log.info({ id }, "downloadToServer action called");
  try {
    return await triggerDownloadToServer({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "downloadToServer failed");
    AppLogCollection.logError(err, { userId, name: "download.execute" });
    throw err;
  }
}

export async function createDownloadAction(payload: CreateDownloadPayload) {
  const { userId } = await requirePermission("download", "create");
  log.info("createDownloadAction called");
  try {
    const result = await createDownload(payload);
    log.info({ id: result.data.id }, "createDownloadAction completed");
    return { message: result.message, id: result.data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createDownloadAction failed");
    AppLogCollection.logError(err, { userId, name: "download.create" });
    throw err;
  }
}

export async function updateDownloadAction(
  id: number,
  payload: UpdateDownloadPayload,
) {
  const { userId } = await requirePermission("download", "update");
  log.info({ id }, "updateDownloadAction called");
  try {
    const result = await updateDownload(id, payload);
    return { message: result.message, id: result.data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateDownloadAction failed");
    AppLogCollection.logError(err, { userId, name: "download.update" });
    throw err;
  }
}

export async function deleteDownloadAction(id: number) {
  const { userId } = await requirePermission("download", "delete");
  log.info({ id }, "deleteDownloadAction called");
  try {
    const result = await deleteDownload(id);
    log.info({ id }, "deleteDownloadAction completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteDownloadAction failed");
    AppLogCollection.logError(err, { userId, name: "download.delete" });
    throw err;
  }
}
