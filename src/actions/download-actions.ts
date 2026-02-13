"use server";

import { getDownloads, getDownloadDetail } from "@catalog/controllers/downloads";
import type { DomainGroup, DownloadDetail } from "@catalog/controllers/downloads";

export async function listDownloads(): Promise<{ domains: DomainGroup[] }> {
  return getDownloads();
}

export async function fetchDownloadDetail(id: number): Promise<DownloadDetail> {
  return getDownloadDetail({ id });
}
