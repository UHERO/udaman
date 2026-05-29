import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isRouteAllowed } from "@/lib/auth/route-access";

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
const TOP_LEVEL_APPS = ["/admin", "/hhdb", "/docs"];

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

function hasSessionCookie(request: NextRequest): boolean {
  const cookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");
  return !!cookie?.value;
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
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  if (!token) return null; // No token — session check already handles redirect

  const role = (token.role as string) ?? "external";
  const userUniverse = (token.universe as string) ?? "UHERO";

  // Extract the URL universe from the internal pathname (/udaman/{universe}/...)
  const uniMatch = internalPathname.match(/^\/udaman\/([^/]+)/);
  const urlUniverse = uniMatch ? uniMatch[1].toUpperCase() : null;

  // Cross-universe guard: non-UHERO users can only access their own universe
  if (
    urlUniverse &&
    urlUniverse !== userUniverse.toUpperCase() &&
    userUniverse.toUpperCase() !== "UHERO"
  ) {
    // Redirect to their own universe homepage
    const ownUniverse = userUniverse.toLowerCase();
    const ownHomepage = homepageUrl.includes("/udaman/")
      ? `/udaman/${ownUniverse}`
      : `/${ownUniverse}`;
    return NextResponse.redirect(new URL(ownHomepage, request.url));
  }

  if (!isRouteAllowed(role, userUniverse, internalPathname)) {
    return NextResponse.redirect(new URL(homepageUrl, request.url));
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
      pathname.startsWith("/_next")
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
      // Top-level app routes (/admin, /hhdb, /docs) — rewrite directly
      const isTopLevel = TOP_LEVEL_APPS.some((p) => pathname.startsWith(p));

      if (isTopLevel) {
        // Auth check
        if (!hasSessionCookie(request)) {
          return NextResponse.redirect(new URL("/", request.url));
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
          const token = await getToken({
            req: request,
            secret: process.env.AUTH_SECRET,
          });
          const role = (token?.role as string) ?? "external";
          const universe = (
            (token?.universe as string) ?? "uhero"
          ).toLowerCase();
          // External users (e.g. DBEDT) → universe homepage; internal+ → /series
          const landingPath =
            role === "external" ? `/${universe}` : `/${universe}/series`;
          return NextResponse.redirect(new URL(landingPath, request.url));
        }
        // No session — fall through to rewrite (serves login page)
      } else {
        if (!hasSessionCookie(request)) {
          return NextResponse.redirect(new URL("/", request.url));
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
  const protectedPrefixes = ["/udaman", "/admin", "/hhdb", "/docs"];
  const isProtected = protectedPrefixes.some(
    (p) => pathname.startsWith(p) && pathname !== "/udaman",
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/udaman", request.url));
  }

  // Top-level routes: /admin, /hhdb, /docs
  const isTopLevel = TOP_LEVEL_APPS.some((p) => pathname.startsWith(p));
  if (isTopLevel) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });
    const role = (token?.role as string) ?? "external";
    const userUniverse = (token?.universe as string) ?? "UHERO";

    if (!isRouteAllowed(role, userUniverse, pathname)) {
      const universe = userUniverse.toLowerCase();
      return NextResponse.redirect(
        new URL(`/udaman/${universe}`, request.url),
      );
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
