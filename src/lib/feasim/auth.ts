/**
 * Checks the API key on feasim API requests. Uses the same keys as UHERO's
 * data API: the ones listed at /admin/api-keys. No udaman login is needed.
 *
 * - Callers send their key as `Authorization: Bearer <key>`.
 * - Scripts and servers can use a key from anywhere.
 * - Browsers can only use a key from the website it was registered for
 *   (or its subdomains), or from localhost. A key with no website is for
 *   servers only.
 * - Each key is also rate-limited (see rate-limit.ts).
 */
import ApiApplicationCollection from "@catalog/collections/api-application-collection";

import { createLogger } from "@/core/observability/logger";

import { checkRateLimit } from "./rate-limit";

const log = createLogger("api.feasim.auth");

export type ApiApp = {
  id: number;
  name: string | null;
  hostname: string | null;
  universe: string;
};

type Lookup = (key: string) => Promise<ApiApp[]>;

const dbLookup: Lookup = async (key) =>
  (await ApiApplicationCollection.getByApiKey(key)).map((a) => ({
    id: a.id,
    name: a.name,
    hostname: a.hostname,
    universe: a.universe,
  }));

let lookup: Lookup = dbLookup;

/** Swap the key lookup (tests). Pass nothing to restore the database. */
export function setApiKeyLookup(fn?: Lookup) {
  lookup = fn ?? dbLookup;
  cache.clear();
}

// ── lookup cache ─────────────────────────────────────────────────────
// Keys are checked on every request; cache the answer briefly so a busy
// client doesn't cost a query per call. A key deleted in the admin stops
// working within TTL_MS.

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;
const cache = new Map<string, { apps: ApiApp[]; expires: number }>();

async function findApps(key: string): Promise<ApiApp[]> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.apps;
  const apps = await lookup(key);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { apps, expires: now + TTL_MS });
  return apps;
}

// ── request checks ───────────────────────────────────────────────────

const BEARER = /^Bearer\s+(\S{1,255})\s*$/i;

/** The bearer key on a request, or null. */
export function bearerKey(request: Request): string | null {
  return BEARER.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
}

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Is `host` the app's hostname or a subdomain of it? Stricter than the older
 * rest-api, which only checks that the origin *contains* the hostname (so
 * evil-example.com would pass for example.com) and lets an app with no
 * hostname be used from any website.
 */
function hostMatches(host: string, hostname: string): boolean {
  const want = hostname
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[:/].*$/, "");
  if (!want) return false;
  return host === want || host.endsWith(`.${want}`);
}

/**
 * The Origin a browser may read the response from, or null to withhold
 * Access-Control-Allow-Origin (the browser then blocks the response).
 */
export function allowedOrigin(
  origin: string | null,
  apps: ApiApp[],
): string | null {
  if (!origin) return null; // not a browser request: no CORS header needed
  if (LOCALHOST.test(origin)) return origin;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
  return apps.some((a) => a.hostname && hostMatches(host, a.hostname))
    ? origin
    : null;
}

export type AuthResult =
  | { ok: true; app: ApiApp; headers: Record<string, string> }
  | { ok: false; response: Response };

/** CORS on errors: let any page read why it was refused. */
const ERROR_HEADERS = { "Access-Control-Allow-Origin": "*" };

/** Response headers a browser page may read (CORS hides others). */
const EXPOSE_HEADERS = {
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
};

function refuse(
  status: number,
  error: string,
  detail: string,
  headers: Record<string, string> = {},
): AuthResult {
  return {
    ok: false,
    response: Response.json(
      { error, issues: [detail] },
      {
        status,
        headers: {
          ...ERROR_HEADERS,
          ...(status === 401 && {
            "WWW-Authenticate": 'Bearer realm="feasim"',
          }),
          ...headers,
        },
      },
    ),
  };
}

/**
 * Check the request's API key. On success, the headers to add to the
 * response (CORS for the app's hostname; results vary by key and origin).
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  const key = bearerKey(request);
  if (!key) {
    return refuse(
      401,
      "Unauthorized",
      "Send your API key as `Authorization: Bearer <key>`. Keys are issued by UHERO.",
    );
  }
  let apps: ApiApp[];
  try {
    apps = await findApps(key);
  } catch (err) {
    log.error({ err }, "API key lookup failed");
    return refuse(503, "Unavailable", "Could not verify the API key; retry.");
  }
  if (!apps.length) {
    log.info({ key: `${key.slice(0, 6)}…` }, "invalid API key");
    return refuse(401, "Unauthorized", "Invalid API key.");
  }

  const origin = request.headers.get("origin");
  const allowed = allowedOrigin(origin, apps);
  const app = apps[0];

  const rate = checkRateLimit(app.id);
  if (!rate.ok) {
    log.warn({ app: app.name, appId: app.id }, "feasim rate limit exceeded");
    return refuse(
      429,
      "Too Many Requests",
      `Over this key's limit of ${rate.headers["X-RateLimit-Limit"]} requests a minute; retry in ${rate.headers["Retry-After"]} s.`,
      { ...rate.headers, ...EXPOSE_HEADERS },
    );
  }

  log.info(
    { app: app.name, appId: app.id, origin: origin ?? undefined },
    "feasim request",
  );
  return {
    ok: true,
    app,
    headers: {
      ...(allowed && { "Access-Control-Allow-Origin": allowed }),
      // per-key results must not be served to others by a shared cache
      Vary: "Authorization, Origin",
      ...rate.headers,
      ...(Object.keys(rate.headers).length && EXPOSE_HEADERS),
    },
  };
}

/**
 * CORS preflight: a browser sending `Authorization` asks first. Allow it
 * from anywhere; the real request is still refused unless the key's
 * hostname matches.
 */
export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
