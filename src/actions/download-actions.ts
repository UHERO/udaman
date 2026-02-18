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

import { requirePermission } from "@/lib/auth/permissions";

export async function listDownloads(): Promise<{ domains: DomainGroup[] }> {
  return getDownloads();
}

export async function fetchDownloadDetail(id: number): Promise<DownloadDetail> {
  return getDownloadDetail({ id });
}

export async function fetchDownloadForEdit(
  id: number,
): Promise<DownloadFormData> {
  return getDownloadForEdit({ id });
}

export async function downloadToServer(
  id: number,
): Promise<{ status: number; changed: boolean }> {
  await requirePermission("download", "execute");
  return triggerDownloadToServer({ id });
}

export async function createDownloadAction(payload: CreateDownloadPayload) {
  await requirePermission("download", "create");
  const result = await createDownload(payload);
  return { message: result.message, id: result.data.id };
}

export async function updateDownloadAction(
  id: number,
  payload: UpdateDownloadPayload,
) {
  await requirePermission("download", "update");
  const result = await updateDownload(id, payload);
  return { message: result.message, id: result.data.id };
}

export async function deleteDownloadAction(id: number) {
  await requirePermission("download", "delete");
  const result = await deleteDownload(id);
  return { message: result.message };
}
