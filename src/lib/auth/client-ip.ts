import { AsyncLocalStorage } from "node:async_hooks";

import { headers } from "next/headers";

/**
 * Client IP capture for the auth route.
 *
 * Auth.js callbacks and events receive no request object, so the IP has to
 * reach them another way. The route handler wraps each request in this store
 * (deterministic), and `resolveClientIp` falls back to Next's `headers()` for
 * any sign-in that reaches the event outside that wrapper.
 */
const ipStore = new AsyncLocalStorage<string | null>();

/** IPv6 is at most 45 chars; the column is varchar(255). Guard anyway. */
const MAX_IP_LENGTH = 45;

/**
 * Pull the client address out of proxy headers.
 *
 * nginx sits in front of the app (see `getPublicOrigin`), appending to
 * `x-forwarded-for`, so the left-most entry is the original client. Note that
 * entry is client-supplied and therefore spoofable if the app is ever reached
 * without the proxy in front — fine for observability, not for authorization.
 */
export function clientIpFromHeaders(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  const candidate = forwarded
    ? forwarded.split(",")[0]
    : (h.get("x-real-ip") ?? "");
  const ip = candidate.trim();
  if (!ip) return null;
  return ip.slice(0, MAX_IP_LENGTH);
}

/** Run `fn` with the request's client IP available to `resolveClientIp`. */
export function withClientIp<T>(request: Request, fn: () => T): T {
  return ipStore.run(clientIpFromHeaders(request.headers), fn);
}

/** The current request's client IP, or null if it can't be determined. */
export async function resolveClientIp(): Promise<string | null> {
  const fromStore = ipStore.getStore();
  if (fromStore !== undefined) return fromStore;

  try {
    return clientIpFromHeaders(await headers());
  } catch {
    // Outside a request scope (or headers() unavailable) — record the sign-in
    // without an address rather than failing it.
    return null;
  }
}
