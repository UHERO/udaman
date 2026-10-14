import { blsApi } from "./bls-api";
import { dotaxArchive } from "./dotax/archive";
import { dotaxCurrent } from "./dotax/current";
import { dotaxSheet } from "./dotax/sheet";
import type { DownloaderImpl } from "./types";

/** Downloader implementations by handle (= downloaders.handle). */
export const DOWNLOADERS: Record<string, DownloaderImpl> = {
  [blsApi.handle]: blsApi,
  [dotaxSheet.handle]: dotaxSheet,
  [dotaxCurrent.handle]: dotaxCurrent,
  [dotaxArchive.handle]: dotaxArchive,
};

export function getImpl(handle: string): DownloaderImpl {
  const impl = DOWNLOADERS[handle];
  if (!impl) {
    throw new Error(
      `No downloader implementation for "${handle}" (known: ${Object.keys(DOWNLOADERS).join(", ")})`,
    );
  }
  return impl;
}

/** Load method (Ruby verb) → downloader handle, e.g. load_from_bls_api → bls_api. */
export function handleForLoadMethod(method: string): string | null {
  return (
    Object.values(DOWNLOADERS).find((d) => d.loadMethod === method)?.handle ??
    null
  );
}
