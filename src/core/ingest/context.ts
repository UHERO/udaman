/**
 * Builds the FetchContext a strategy or source module fetches through, and
 * collects what it did: the artifacts stored or seen, keys that failed,
 * warnings and the state patch.
 */

import type DataDownloader from "@catalog/models/data-downloader";
import { parse as parseHtml } from "node-html-parser";

import type { IngestDb } from "./db";
import {
  extensionOf,
  httpRequest,
  isHtmlInsteadOfData,
  servedFileName,
} from "./http";
import type { HttpFetch } from "./http";
import type { RawStore } from "./raw-store";
import type { FetchContext, StoredArtifact, StoreInfo } from "./types";

export type FetchCollector = {
  /** artifact id → whether any store of it in this run was a new vintage */
  links: Map<number, boolean>;
  keyErrors: Array<{ key: string; message: string }>;
  warnings: string[];
  statePatch: Record<string, unknown>;
  requests: number;
};

export function createFetchContext(
  downloader: DataDownloader,
  deps: {
    db: IngestDb;
    store: RawStore;
    http: HttpFetch;
    sleep: (ms: number) => Promise<void>;
  },
  opts: {
    force: boolean;
    full: boolean;
    /** Restrict referencedFilters() to these (a load fetching one series) */
    only?: Array<Record<string, string>> | null;
    log: (msg: string) => void;
  },
): { ctx: FetchContext; collected: FetchCollector } {
  const { db, store, http } = deps;
  const collected: FetchCollector = {
    links: new Map(),
    keyErrors: [],
    warnings: [],
    statePatch: {},
    requests: 0,
  };

  const get = (url: string, init?: RequestInit) => {
    collected.requests++;
    return httpRequest(http, url, init);
  };

  const storeBytes = async (
    artifactKey: string,
    bytes: Uint8Array,
    info: StoreInfo = {},
  ): Promise<StoredArtifact> => {
    if (!artifactKey) throw new Error("store: an artifact key is required");
    const ext =
      extensionOf(info.originalName) ??
      extensionOf(info.resolvedUrl?.split("?")[0]) ??
      null;
    const put = store.put(downloader.handle, bytes, ext);
    const res = await db.recordArtifact({
      downloaderId: downloader.id,
      artifactKey,
      contentHash: put.hash,
      storagePath: put.relPath,
      size: put.size,
      resolvedUrl: info.resolvedUrl ?? null,
      originalName: info.originalName ?? null,
      contentType: info.contentType ?? null,
      metadata: info.metadata ?? null,
      final: info.final ?? false,
    });
    const id = res.artifact.id;
    collected.links.set(id, (collected.links.get(id) ?? false) || res.changed);
    if (res.changed) opts.log(`${artifactKey}: new vintage`);
    return res;
  };

  const ctx: FetchContext = {
    downloader,
    force: opts.force,
    full: opts.full,
    get,
    async getPage(url) {
      const res = await get(url);
      return parseHtml(await res.text());
    },
    store: storeBytes,
    async download(url, artifactKey, info = {}) {
      const res = await get(url);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type");
      const originalName = info.originalName ?? servedFileName(res, url);
      const ext = extensionOf(originalName) ?? extensionOf(url.split("?")[0]);
      if (isHtmlInsteadOfData(bytes, contentType, ext)) {
        throw new Error(`${url}: got an HTML page instead of a data file`);
      }
      const lastModified = new Date(res.headers.get("last-modified") ?? "");
      const lastModifiedIso = Number.isNaN(lastModified.getTime())
        ? null
        : lastModified.toISOString();
      return storeBytes(artifactKey, bytes, {
        ...info,
        originalName,
        resolvedUrl: res.url || url,
        contentType,
        metadata: {
          ...(lastModifiedIso ? { lastModified: lastModifiedIso } : {}),
          ...(info.metadata ?? {}),
        },
      });
    },
    latest: (key) => db.latestArtifact(downloader.id, key),
    finalKeys: () => db.finalKeys(downloader.id),
    markFinal: (key) => db.markFinal(downloader.id, key),
    async referencedFilters() {
      if (opts.only) return opts.only.map((f) => ({ ...f }));
      const extractors = await db.dependentsOf(downloader.id);
      const fromLoads = await db.referencedFilters(
        extractors.map((e) => e.handle),
      );
      // config.extraFilters: fetch these too (no load statement yet)
      const extra = downloader.config.extraFilters;
      const extras = Array.isArray(extra)
        ? extra
            .filter((f) => f && typeof f === "object" && !Array.isArray(f))
            .map((f) =>
              Object.fromEntries(
                Object.entries(f as Record<string, unknown>).map(([k, v]) => [
                  k,
                  String(v),
                ]),
              ),
            )
        : [];
      return [...fromLoads, ...extras];
    },
    state: { ...downloader.state },
    setState(patch) {
      Object.assign(collected.statePatch, patch);
      Object.assign(ctx.state, patch);
    },
    keyFailed(key, message) {
      collected.keyErrors.push({ key, message });
      opts.log(`${key}: ${message}`);
    },
    warn(message) {
      collected.warnings.push(message);
      opts.log(`warning: ${message}`);
    },
    sleep: deps.sleep,
    log: opts.log,
  };
  return { ctx, collected };
}
