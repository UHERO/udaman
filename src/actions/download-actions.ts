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
  return triggerDownloadToServer({ id });
}

export async function createDownloadAction(payload: CreateDownloadPayload) {
  const result = await createDownload(payload);
  return { message: result.message, id: result.data.id };
}

export async function updateDownloadAction(
  id: number,
  payload: UpdateDownloadPayload,
) {
  const result = await updateDownload(id, payload);
  return { message: result.message, id: result.data.id };
}

export async function deleteDownloadAction(id: number) {
  const result = await deleteDownload(id);
  return { message: result.message };
}
