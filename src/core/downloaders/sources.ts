/**
 * Source Downloads: the files a downloader fetches from the outside (one
 * DOTAX XLSX, one archive zip). Each is an ordinary `downloads` row owned
 * by the downloader, so fetching reuses downloadToServer (change
 * detection, soft-404 guard, dsd_log_entries) and the Downloads UI shows
 * its history. `historical` rows are final and never refetched here.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import DownloadCollection from "@catalog/collections/download-collection";
import Download from "@catalog/models/download";
import type { DownloadAttrs } from "@catalog/models/download";

import { mysql } from "@/lib/mysql/helpers";

export type SourceSpec = {
  handle: string;
  url: string;
  filenameExt: "xlsx" | "xls" | "zip" | "csv" | "txt" | "pdf";
  notes?: string | null;
};

export type SourceFetchResult = {
  download: Download;
  /** "historical" = skipped because it is final */
  status: "fetched" | "historical" | "error";
  changed: boolean;
  httpStatus?: number;
  error?: string;
};

export interface SourceHelpers {
  /** Create or update the source row for a file (url / ext may change). */
  upsert(spec: SourceSpec): Promise<Download>;
  /** All source rows owned by this downloader. */
  list(): Promise<Download[]>;
  /**
   * Fetch unless historical (or `full`). A changed file's previous copy is
   * kept under <cacheDir>/superseded/.
   */
  fetch(dl: Download): Promise<SourceFetchResult>;
  markHistorical(dl: Download): Promise<void>;
}

export function sourceHelpers(opts: {
  downloaderId: number;
  cacheDir: string;
  full: boolean;
  log: (msg: string) => void;
}): SourceHelpers {
  const { downloaderId, cacheDir, full, log } = opts;

  const getByHandle = async (handle: string) => {
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE handle = ${handle} LIMIT 1
    `;
    return rows[0] ?? null;
  };

  return {
    async upsert(spec) {
      const existing = await getByHandle(spec.handle);
      if (!existing) {
        await mysql`
          INSERT INTO downloads (handle, url, filename_ext, notes, downloader_id,
                                 downloader_role, historical, created_at, updated_at)
          VALUES (${spec.handle}, ${spec.url}, ${spec.filenameExt},
                  ${spec.notes ?? null}, ${downloaderId}, 'source', 0, NOW(), NOW())
        `;
      } else if (
        existing.url !== spec.url ||
        existing.filename_ext !== spec.filenameExt ||
        existing.downloader_id !== downloaderId
      ) {
        await mysql`
          UPDATE downloads
          SET url = ${spec.url}, filename_ext = ${spec.filenameExt},
              downloader_id = ${downloaderId}, downloader_role = 'source',
              updated_at = NOW()
          WHERE id = ${existing.id}
        `;
      }
      return DownloadCollection.getByHandle(spec.handle);
    },

    async list() {
      const rows = await mysql<DownloadAttrs>`
        SELECT * FROM downloads
        WHERE downloader_id = ${downloaderId} AND downloader_role = 'source'
        ORDER BY handle ASC
      `;
      return rows.map((r) => new Download(r));
    },

    async fetch(dl) {
      if (dl.historical && !full && existsSync(dl.savePath())) {
        return { download: dl, status: "historical", changed: false };
      }
      try {
        const res = await DownloadCollection.downloadToServer(dl.id, {
          keepSupersededIn: join(cacheDir, "superseded"),
        });
        const fresh = await DownloadCollection.getById(dl.id);
        if (res.status !== 200 || res.htmlPage) {
          const error = res.htmlPage
            ? "got an HTML page instead of a data file"
            : `HTTP ${res.status}`;
          log(`${dl.handle}: ${error}`);
          return {
            download: fresh,
            status: "error",
            changed: false,
            httpStatus: res.status,
            error,
          };
        }
        if (res.changed) log(`${dl.handle}: changed`);
        return {
          download: fresh,
          status: "fetched",
          changed: res.changed,
          httpStatus: res.status,
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        log(`${dl.handle}: ${error}`);
        return { download: dl, status: "error", changed: false, error };
      }
    },

    async markHistorical(dl) {
      if (dl.historical) return;
      await mysql`
        UPDATE downloads SET historical = 1, updated_at = NOW() WHERE id = ${dl.id}
      `;
      dl.historical = true;
    },
  };
}
