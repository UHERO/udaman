/*************************************************************************
 * DOWNLOADS Controller
 * For downloading the file a series is derived from.
 *************************************************************************/

import DownloadCollection from "@catalog/collections/download-collection";
import type {
  CreateDownloadPayload,
  RelatedSeries,
  UpdateDownloadPayload,
} from "@catalog/collections/download-collection";
import DownloaderCollection from "@catalog/collections/downloader-collection";
import type Download from "@catalog/models/download";

export type DownloadSummary = {
  id: number;
  handle: string | null;
  url: string | null;
  filenameExt: string | null;
  dateSensitive: boolean;
  freezeFile: boolean;
  lastDownloadAt: string | null;
  lastChangeAt: string | null;
  notes: string | null;
  hasRelatedSeries: boolean;
  downloaderId: number | null;
  downloaderRole: "source" | "output" | null;
  historical: boolean;
};

export type DomainGroup = {
  domain: string;
  hasOrphans: boolean;
  downloads: DownloadSummary[];
};

function toSummary(dl: {
  download: Download;
  hasRelatedSeries: boolean;
}): DownloadSummary {
  const d = dl.download;
  return {
    id: d.id,
    handle: d.handle,
    url: d.url,
    filenameExt: d.filenameExt,
    dateSensitive: d.dateSensitive,
    freezeFile: d.freezeFile,
    lastDownloadAt: d.lastDownloadAt?.toISOString() ?? null,
    lastChangeAt: d.lastChangeAt?.toISOString() ?? null,
    notes: d.notes,
    // downloader-owned files are referenced through the downloader's load
    // method, not by handle — never orphans
    hasRelatedSeries: dl.hasRelatedSeries || d.downloaderId != null,
    downloaderId: d.downloaderId,
    downloaderRole: d.downloaderRole,
    historical: d.historical,
  };
}

export async function getDownloads(): Promise<{ domains: DomainGroup[] }> {
  const rows = await DownloadCollection.list();

  // Group by domain
  const domainMap = new Map<string, DownloadSummary[]>();
  for (const row of rows) {
    const domain = row.download.domain ?? "(no URL)";
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(toSummary(row));
  }

  // Sort domains alphabetically, build groups
  const domains: DomainGroup[] = [...domainMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, downloads]) => ({
      domain,
      hasOrphans: downloads.some(
        (d) => !d.hasRelatedSeries && !d.dateSensitive,
      ),
      downloads,
    }));

  return { domains };
}

export type DownloadDetail = {
  id: number;
  handle: string | null;
  url: string | null;
  filenameExt: string | null;
  dateSensitive: boolean;
  freezeFile: boolean;
  fileToExtract: string | null;
  sheetOverride: string | null;
  notes: string | null;
  historical: boolean;
  downloaderRole: "source" | "output" | null;
  downloader: { id: number; handle: string } | null;
  savePath: string;
  savePathRelative: string;
  logEntries: LogEntrySerialized[];
  relatedSeries: RelatedSeries[];
};

export type LogEntrySerialized = {
  id: number;
  url: string | null;
  time: string | null;
  status: number | null;
  dlChanged: boolean;
};

export async function getDownloadDetail({
  id,
}: {
  id: number;
}): Promise<DownloadDetail> {
  const download = await DownloadCollection.getById(id);

  const [logEntries, relatedSeries, downloader] = await Promise.all([
    DownloadCollection.getLogEntries(id),
    download.handle ? DownloadCollection.getRelatedSeries(download.handle) : [],
    download.downloaderId
      ? DownloaderCollection.getById(download.downloaderId).catch(() => null)
      : null,
  ]);

  return {
    id: download.id,
    handle: download.handle,
    url: download.url,
    filenameExt: download.filenameExt,
    dateSensitive: download.dateSensitive,
    freezeFile: download.freezeFile,
    fileToExtract: download.fileToExtract,
    sheetOverride: download.sheetOverride,
    notes: download.notes,
    historical: download.historical,
    downloaderRole: download.downloaderRole,
    downloader: downloader
      ? { id: downloader.id, handle: downloader.handle }
      : null,
    savePath: download.savePath(),
    savePathRelative: `rawdata/${download.sanitizeHandle()}.${download.filenameExt ?? "ext"}`,
    logEntries: logEntries.map((e) => ({
      id: e.id,
      url: e.url,
      time: e.time ? new Date(e.time as string | Date).toISOString() : null,
      status: e.status,
      dlChanged: Boolean(e.dl_changed),
    })),
    relatedSeries,
  };
}

export async function triggerDownloadToServer({ id }: { id: number }) {
  return DownloadCollection.downloadToServer(id);
}

/** Serialized download data for populating the edit form */
export type DownloadFormData = {
  id: number;
  handle: string;
  url: string;
  filenameExt: string;
  dateSensitive: boolean;
  freezeFile: boolean;
  sort1: number | null;
  sort2: number | null;
  fileToExtract: string;
  sheetOverride: string;
  postParameters: string;
  notes: string;
  historical: boolean;
};

export async function getDownloadForEdit({
  id,
}: {
  id: number;
}): Promise<DownloadFormData> {
  const dl = await DownloadCollection.getById(id);
  return {
    id: dl.id,
    handle: dl.handle ?? "",
    url: dl.url ?? "",
    filenameExt: dl.filenameExt ?? "xlsx",
    dateSensitive: dl.dateSensitive,
    freezeFile: dl.freezeFile,
    sort1: dl.sort1,
    sort2: dl.sort2,
    fileToExtract: dl.fileToExtract ?? "",
    sheetOverride: dl.sheetOverride ?? "",
    postParameters: dl.postParameters ?? "",
    notes: dl.notes ?? "",
    historical: dl.historical,
  };
}

export async function createDownload(payload: CreateDownloadPayload) {
  const data = await DownloadCollection.create(payload);
  return { message: "Download created", data };
}

export async function updateDownload(
  id: number,
  payload: UpdateDownloadPayload,
) {
  const data = await DownloadCollection.update(id, payload);
  return { message: "Download updated", data };
}

export async function deleteDownload(id: number) {
  await DownloadCollection.delete(id);
  return { message: "Download deleted" };
}
