import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { normalizeUniverse } from "@/lib/auth/roles";
import {
  getLandingPath,
  isRouteAllowed,
  toReadableSet,
} from "@/lib/auth/route-access";

/**
 * Subdomain → internal route prefix mapping.
 * Add/remove entries here as new apps are added.
 */
const SUBDOMAIN_MAP: Record<string, string> = {
  udaman: "udaman",
  api: "api",
  analytics: "analytics",
  data: "data",
};

/**
 * Per-app default landing pages for bare-root (`/`) requests via subdomain.
 * The udaman app picks its landing path dynamically from the session token
 * (see the `pathname === "/"` branch below).
 */
const APP_DEFAULTS: Record<string, string> = {
  data: "/",
  analytics: "/",
};

/** Top-level routes that live outside /udaman/{universe} */
const TOP_LEVEL_APPS = ["/admin", "/hhdb", "/docs", "/comms", "/data-registry"];

/**
 * Extract the app name from the request Host header.
 * Handles both staging (`stage-udaman.uhero.hawaii.edu`)
 * and production (`udaman.uhero.hawaii.edu`).
 * Returns null if the host doesn't match a known subdomain.
 */
function getSubdomainApp(host: string): string | null {
  const match = host.match(/^(?:stage-)?(\w+)\.uhero\.hawaii\.edu/);
  if (!match) return null;
  const sub = match[1];
  return sub in SUBDOMAIN_MAP ? SUBDOMAIN_MAP[sub] : null;
}

/**
 * Redirect an unauthenticated request to the login page, remembering where it
 * was headed so the login form can send the user back there afterwards.
 * `loginPath` is "/" on the udaman subdomain and "/udaman" for direct access.
 */
function redirectToLogin(
  request: NextRequest,
  loginPath: string,
): NextResponse {
  const { pathname, search } = request.nextUrl;
  const url = new URL(loginPath, request.url);
  if (pathname !== "/" && pathname !== loginPath) {
    url.searchParams.set("callbackUrl", pathname + search);
  }
  return NextResponse.redirect(url);
}

function hasSessionCookie(request: NextRequest): boolean {
  const cookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");
  return !!cookie?.value;
}

/**
 * Auth.js prefixes the session cookie with `__Secure-` and derives the JWE
 * salt from that name whenever it is issued over HTTPS. `getToken` defaults to
 * the unprefixed name, so without this it looks for a cookie that does not
 * exist in production and returns null — silently turning every route check
 * below into a no-op. Keyed off AUTH_URL, which is what Auth.js itself uses.
 */
function secureCookiesEnabled(): boolean {
  return (process.env.AUTH_URL ?? "").startsWith("https://");
}

function readToken(request: NextRequest) {
  return getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: secureCookiesEnabled(),
  });
}

/**
 * Bounce a denied request to `target`, unless that is where it already is —
 * redirecting a page to itself is an infinite loop. Letting the request
 * through in that case is safe: the only target we bounce to is a homepage,
 * which every authenticated user may see, and the page's own `requireAuth`
 * still handles a session that is genuinely broken.
 */
function denyTo(request: NextRequest, target: string): NextResponse | null {
  const url = new URL(target, request.url);
  if (url.pathname === request.nextUrl.pathname) return null;
  return NextResponse.redirect(url);
}

/**
 * Check route-level access using the JWT token claims.
 * Returns a redirect response if denied, or null if allowed.
 *
 * Cross-universe policy: UHERO users (internal/admin/dev) can access any
 * universe. All other users are restricted to their own universe.
 */
async function checkRouteAccess(
  request: NextRequest,
  internalPathname: string,
  homepageUrl: string,
): Promise<NextResponse | null> {
  const token = await readToken(request);
  // A session cookie was present (the caller checked) but it did not decode.
  // Treat that as no access rather than full access — failing open here is
  // what let any role reach any route.
  if (!token) {
    return denyTo(request, homepageUrl);
  }

  const role = (token.role as string) ?? "external";
  const userUniverse = (token.universe as string) ?? "UHERO";
  const readable = toReadableSet(token.readable as string[] | undefined);

  // Extract the URL universe from the internal pathname (/udaman/{universe}/...)
  const uniMatch = internalPathname.match(/^\/udaman\/([^/]+)/);
  const urlUniverse = uniMatch ? normalizeUniverse(uniMatch[1]) : null;
  const homeUniverse = normalizeUniverse(userUniverse);

  // Cross-universe guard: non-UHERO users can only access their own universe
  if (urlUniverse && urlUniverse !== homeUniverse && homeUniverse !== "UHERO") {
    // Redirect to their own universe homepage
    const ownUniverse = homeUniverse.toLowerCase();
    const ownHomepage = homepageUrl.includes("/udaman/")
      ? `/udaman/${ownUniverse}`
      : `/${ownUniverse}`;
    return denyTo(request, ownHomepage);
  }

  if (!isRouteAllowed(role, userUniverse, internalPathname, readable)) {
    return denyTo(request, homepageUrl);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const app = getSubdomainApp(host);

  // ── Subdomain access ──────────────────────────────────────────────
  if (app) {
    // Let NextAuth & static assets pass through untouched
    if (
      (pathname.startsWith("/api/") && app !== "api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/.well-known")
    ) {
      return NextResponse.next();
    }

    // If the path already contains the internal prefix (from app-generated
    // links or redirects like `redirect("/udaman/uhero/series")`), strip it
    // so the browser URL stays clean.
    if (pathname.startsWith(`/${app}`)) {
      const cleanPath = pathname.slice(app.length + 1) || "/";
      return NextResponse.redirect(new URL(cleanPath + search, request.url));
    }

    // ── App-specific logic (udaman: auth + universe normalization) ──
    if (app === "udaman") {
      // Top-level app routes (/admin, /hhdb, /docs, /comms, /data-registry) — rewrite directly
      const isTopLevel = TOP_LEVEL_APPS.some((p) => pathname.startsWith(p));

      if (isTopLevel) {
        // Auth check
        if (!hasSessionCookie(request)) {
          return redirectToLogin(request, "/");
        }

        // Route-level access check (pathname is already the internal path)
        const denied = await checkRouteAccess(request, pathname, "/");
        if (denied) return denied;

        // No rewrite needed — these are already top-level Next.js routes
        const response = NextResponse.next();
        response.headers.set("x-pathname", pathname);
        return response;
      }

      // Root → redirect to a role+universe-aware landing page, or login if no session
      if (pathname === "/") {
        if (hasSessionCookie(request)) {
          const token = await readToken(request);
          const role = (token?.role as string) ?? "external";
          const universe = (token?.universe as string) ?? "uhero";
          const readable = toReadableSet(
            token?.readable as string[] | undefined,
          );
          // Same policy as the login page; strip the internal /udaman prefix
          // so the browser URL stays clean on the subdomain.
          const landingPath = getLandingPath(role, universe, readable).replace(
            /^\/udaman/,
            "",
          );
          return NextResponse.redirect(new URL(landingPath, request.url));
        }
        // No session — fall through to rewrite (serves login page)
      } else {
        if (!hasSessionCookie(request)) {
          return redirectToLogin(request, "/");
        }

        // Normalize universe to lowercase: /UHERO/... → /uhero/...
        const uniMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
        if (uniMatch) {
          const universe = uniMatch[1];
          const lower = universe.toLowerCase();
          if (universe !== lower) {
            const rest = uniMatch[2] ?? "";
            return NextResponse.redirect(
              new URL(`/${lower}${rest}${search}`, request.url),
              308,
            );
          }
        }

        // Route-level access check (pathname here is without /udaman prefix)
        const internalPathname = `/udaman${pathname}`;
        const uniSegment = pathname.match(/^\/([^/]+)/)?.[1] ?? "uhero";
        const denied = await checkRouteAccess(
          request,
          internalPathname,
          `/${uniSegment}`,
        );
        if (denied) return denied;
      }
    } else if (pathname === "/" && app in APP_DEFAULTS) {
      // Non-udaman apps: redirect bare root to app-specific default
      const defaultPath = APP_DEFAULTS[app];
      if (defaultPath && defaultPath !== "/") {
        return NextResponse.redirect(new URL(defaultPath, request.url));
      }
    }

    // Internally rewrite: /foo → /${app}/foo
    // Browser URL stays at /foo; Next.js serves /${app}/foo
    const url = request.nextUrl.clone();
    url.pathname = `/${app}${pathname}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-pathname", `/${app}${pathname}`);
    return response;
  }

  // ── Direct access (no subdomain / localhost dev) ──────────────────
  const protectedPrefixes = [
    "/udaman",
    "/admin",
    "/hhdb",
    "/docs",
    "/comms",
    "/data-registry",
  ];
  const isProtected = protectedPrefixes.some(
    (p) => pathname.startsWith(p) && pathname !== "/udaman",
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    return redirectToLogin(request, "/udaman");
  }

  // Top-level routes: /admin, /hhdb, /docs, /comms, /data-registry
  const isTopLevel = TOP_LEVEL_APPS.some((p) => pathname.startsWith(p));
  if (isTopLevel) {
    const token = await readToken(request);
    const role = (token?.role as string) ?? "external";
    const userUniverse = (token?.universe as string) ?? "UHERO";
    const readable = toReadableSet(token?.readable as string[] | undefined);

    if (!isRouteAllowed(role, userUniverse, pathname, readable)) {
      const universe = userUniverse.toLowerCase();
      return NextResponse.redirect(new URL(`/udaman/${universe}`, request.url));
    }

    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // /udaman/... routes
  // Normalize universe: /udaman/UHERO/... → /udaman/uhero/...
  const match = pathname.match(/^\/udaman\/([^/]+)(\/.*)?$/);
  if (match) {
    const universe = match[1];
    const lower = universe.toLowerCase();
    if (universe !== lower) {
      const rest = match[2] ?? "";
      const url = new URL(`/udaman/${lower}${rest}`, request.url);
      url.search = search;
      return NextResponse.redirect(url, 308);
    }
  }

  // Route-level access check
  const uniSegment = match?.[1] ?? "uhero";
  const denied = await checkRouteAccess(
    request,
    pathname,
    `/udaman/${uniSegment}`,
  );
  if (denied) return denied;

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - /_next (static assets, HMR)
     *  - /api/uploads
     *  - /favicon.ico, images, fonts
     */
    "/((?!_next|api/uploads|favicon\\.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2)$).*)",
  ],
};
