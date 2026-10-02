/**
 * The ONE place portal URLs are built. Every internal link in the portal
 * must go through `portalHref` so the prefix can change in one spot.
 *
 * The UHERO portal lives at the root (`/data`, `/data/series?id=1`, served by
 * the `src/app/data/(uhero)` route group); every other universe keeps its
 * segment (`/data/nta/series?id=1`, via `src/app/data/[universe]`).
 * `/data/uhero/*` permanently redirects to `/data/*` (src/proxy.ts).
 *
 * Routing context (src/proxy.ts): on the `data.uhero.hawaii.edu` subdomain
 * the proxy rewrites `/foo` → `/data/foo` internally, and redirects any
 * browser request that already starts with `/data` to the clean path. So
 * `/data/series?id=1` works everywhere (localhost and subdomain) at the cost
 * of one redirect on the subdomain. If that redirect becomes a concern, make
 * PORTAL_BASE host-aware here.
 */

export const PORTAL_BASE = "/data";

/** The universe served at the portal root (no URL segment). */
export const ROOT_UNIVERSE = "uhero";

export type PortalRoute =
  "" | "category" | "series" | "analyzer" | "search" | "graph";

export type HrefParamValue = string | number | boolean | null | undefined;
export type HrefParams = Record<string, HrefParamValue | HrefParamValue[]>;

/**
 * Serialize params the way the Angular router did: null/undefined/"" are
 * dropped, booleans become "true"/"false", arrays of ids join with "-"
 * (analyzerSeries=1-2-3).
 */
export function serializeParams(params: HrefParams = {}): string {
  const usp = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === null || raw === undefined || raw === "") continue;
    if (Array.isArray(raw)) {
      const parts = raw.filter(
        (v) => v !== null && v !== undefined && v !== "",
      );
      if (parts.length) usp.set(key, parts.join("-"));
      continue;
    }
    usp.set(key, String(raw));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

const ROUTES: readonly PortalRoute[] = [
  "",
  "category",
  "series",
  "analyzer",
  "search",
  "graph",
];

/** Path (no query) of a portal route: "/data/series", "/data/nta/series". */
export function portalPath(universe: string, route: PortalRoute = ""): string {
  const base =
    universe === ROOT_UNIVERSE ? PORTAL_BASE : `${PORTAL_BASE}/${universe}`;
  return route ? `${base}/${route}` : base;
}

/**
 * Build an internal portal link:
 *   portalHref("uhero", "series", { id: 1 }) → "/data/series?id=1"
 *   portalHref("nta", "series", { id: 1 })   → "/data/nta/series?id=1"
 */
export function portalHref(
  universe: string,
  route: PortalRoute = "",
  params?: HrefParams,
): string {
  return `${portalPath(universe, route)}${serializeParams(params)}`;
}

/**
 * Which portal route a pathname is on ("" = landing). Works for every URL
 * shape the portal is reached at: `/data`, `/data/series`, `/data/nta/series`
 * and the subdomain's `/`, `/series`, `/nta/series` — portal routes are
 * always the last segment.
 */
export function routeFromPathname(pathname: string): PortalRoute {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return (ROUTES as readonly string[]).includes(last)
    ? (last as PortalRoute)
    : "";
}

/**
 * Absolute public link for share/embed snippets (uses config.exportLabels.
 * publicUrl: "https://data.uhero.hawaii.edu" for UHERO,
 * "https://data.uhero.hawaii.edu/nta" for NTA).
 */
export function publicPortalUrl(
  publicUrl: string,
  route: PortalRoute,
  params?: HrefParams,
): string {
  const base = publicUrl.replace(/\/$/, "");
  return `${route ? `${base}/${route}` : base}${serializeParams(params)}`;
}

/**
 * Translate an old Angular hash URL fragment into a new portal href.
 *   "#/category?id=42&data_list_id=43" → "/data/category?id=42&data_list_id=43"
 *   "#/series?id=1"                    → "/data/series?id=1"      (uhero)
 *   "#/series?id=1"                    → "/data/nta/series?id=1"  (nta)
 * Returns null when the hash is not an Angular route.
 */
export function translateHashUrl(
  universe: string,
  hash: string,
): string | null {
  const m = hash.match(/^#\/?([a-z]*)(\?.*)?$/i);
  if (!m) return null;
  const route = m[1].toLowerCase();
  if (!(ROUTES as readonly string[]).includes(route)) return null;
  return `${portalPath(universe, route as PortalRoute)}${m[2] ?? ""}`;
}

const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/**
 * Absolute link for share/embed snippets. Uses the canonical public URL
 * (config.exportLabels.publicUrl) everywhere except on a dev host, where it
 * uses the current origin + portalHref so copied links/iframes work locally.
 * Server-side (no window) → the public URL.
 */
export function absolutePortalUrl(
  universe: string,
  publicUrl: string,
  route: PortalRoute,
  params?: HrefParams,
): string {
  if (
    typeof window !== "undefined" &&
    DEV_HOSTS.has(window.location.hostname)
  ) {
    return `${window.location.origin}${portalHref(universe, route, params)}`;
  }
  return publicPortalUrl(publicUrl, route, params);
}
