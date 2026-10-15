/**
 * HTTP for fetch strategies and source modules. Everything goes through an
 * injectable `HttpFetch` so runner tests never touch the network.
 */

import { looksLikeHtmlPage } from "@catalog/collections/download-collection";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; UDAMAN/1.0; UHERO Data Manager)";

/** The fetch signature strategies use (globalThis.fetch in production). */
export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** GET (or the given method) with the UDAMAN user agent; throws on non-2xx. */
export async function httpRequest(
  fetchImpl: HttpFetch,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);
  const res = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...init,
    headers,
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

/** File name a response was served as: Content-Disposition, else the URL path. */
export function servedFileName(res: Response, url: string): string | null {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = cd.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i);
  const plain = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
  const fromHeader = star?.[1] ?? plain?.[1];
  if (fromHeader) {
    try {
      return decodeURIComponent(fromHeader.trim());
    } catch {
      return fromHeader.trim();
    }
  }
  try {
    const last = new URL(res.url || url).pathname.split("/").pop() ?? "";
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

/** Lowercase extension of a file name ("report.XLSX" → "xlsx"), or null. */
export function extensionOf(name: string | null | undefined): string | null {
  const m = name?.match(/\.([A-Za-z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * A data file served as a web page — almost always an error or not-found
 * page sent with HTTP 200. Only checked when the expected file is not HTML.
 */
export function isHtmlInsteadOfData(
  bytes: Uint8Array,
  contentType: string | null,
  expectedExt: string | null,
): boolean {
  if (expectedExt === "html" || expectedExt === "htm") return false;
  if (contentType && /text\/html/i.test(contentType)) return true;
  return looksLikeHtmlPage(Buffer.from(bytes));
}
