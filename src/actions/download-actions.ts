"use server";

import {
  getDownloads,
  getDownloadDetail,
  getDownloadForEdit,
  triggerDownloadToServer,
  createDownload,
  updateDownload,
  deleteDownload,
} from "@catalog/controllers/downloads";
import type { DomainGroup, DownloadDetail, DownloadFormData } from "@catalog/controllers/downloads";
import type { CreateDownloadPayload, UpdateDownloadPayload } from "@catalog/collections/download-collection";

export async function listDownloads(): Promise<{ domains: DomainGroup[] }> {
  return getDownloads();
}

export async function fetchDownloadDetail(id: number): Promise<DownloadDetail> {
  return getDownloadDetail({ id });
}

export async function fetchDownloadForEdit(id: number): Promise<DownloadFormData> {
  return getDownloadForEdit({ id });
}

export async function downloadToServer(id: number): Promise<{ status: number; changed: boolean }> {
  return triggerDownloadToServer({ id });
}

export async function createDownloadAction(payload: CreateDownloadPayload): Promise<{ id: number }> {
  const dl = await createDownload(payload);
  return { id: dl.id };
}

export async function updateDownloadAction(id: number, payload: UpdateDownloadPayload): Promise<{ id: number }> {
  const dl = await updateDownload(id, payload);
  return { id: dl.id };
}

export async function deleteDownloadAction(id: number): Promise<void> {
  await deleteDownload(id);
}
