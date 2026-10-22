/**
 * HTTP for fetch strategies and source modules. Everything goes through an
 * injectable `HttpFetch` so runner tests never touch the network.
 */

import { looksLikeHtmlPage } from "@catalog/collections/download-collection";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; UDAMAN/1.0; UHERO Data Manager)";

/** The fetch signature strategies use (globalThis.fetch in production). */
export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Query parameters that carry an API key (FRED, BEA, EIA, e-Stat). */
const SECRET_PARAMS = /^(api_?key|userid|appid|registrationkey|key|token)$/i;

/** The URL with API-key query parameters masked, for logs and run records. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_PARAMS.test(k)) u.searchParams.set(k, "***");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export class HttpError extends Error {
  /** The URL with API keys masked */
  readonly url: string;
  constructor(
    readonly status: number,
    url: string,
    /** Start of the response body (APIs put their error message there) */
    readonly body: string = "",
  ) {
    const safe = redactUrl(url);
    super(`HTTP ${status} for ${safe}${body ? `: ${body}` : ""}`);
    this.name = "HttpError";
    this.url = safe;
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(res.status, url, body.trim().slice(0, 300));
  }
  return res;
}

/** Attempts for a request the server answered with a 5xx, and the waits between them. */
export const SERVER_ERROR_ATTEMPTS = 3;
export const SERVER_ERROR_BACKOFF_MS = [10_000, 30_000];

/**
 * httpRequest, retried when the server answers 5xx (BLS sends "The BLS
 * website is busy" as a 503). Anything else, and the last attempt's 5xx,
 * is thrown as before. A retry gets a fresh timeout, since a caller's
 * AbortSignal.timeout has been running through the earlier attempts.
 */
export async function httpRequestWithRetry(
  fetchImpl: HttpFetch,
  url: string,
  init: RequestInit,
  deps: {
    sleep: (ms: number) => Promise<void>;
    log: (msg: string) => void;
    attempts?: number;
  },
): Promise<Response> {
  const attempts = deps.attempts ?? SERVER_ERROR_ATTEMPTS;
  for (let attempt = 1; ; attempt++) {
    try {
      return await httpRequest(
        fetchImpl,
        url,
        attempt === 1
          ? init
          : { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) },
      );
    } catch (e) {
      if (!(e instanceof HttpError) || e.status < 500 || attempt >= attempts) {
        throw e;
      }
      const wait =
        SERVER_ERROR_BACKOFF_MS[
          Math.min(attempt - 1, SERVER_ERROR_BACKOFF_MS.length - 1)
        ];
      deps.log(
        `HTTP ${e.status} for ${e.url}; retrying in ${wait / 1000}s (attempt ${attempt + 1} of ${attempts})`,
      );
      await deps.sleep(wait);
    }
  }
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
