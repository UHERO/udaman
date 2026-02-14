import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const app = getSubdomainApp(host);

  // ── Subdomain access ──────────────────────────────────────────────
  if (app) {
    // Let NextAuth & static assets pass through untouched
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
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
      // Root = login page, skip auth check
      if (pathname !== "/") {
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
      }
    }

    // Internally rewrite: /foo → /${app}/foo
    // Browser URL stays at /foo; Next.js serves /${app}/foo
    const url = request.nextUrl.clone();
    url.pathname = `/${app}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Direct access (no subdomain / localhost dev) ──────────────────
  // Original behavior: protect /udaman routes
  if (!pathname.startsWith("/udaman") || pathname === "/udaman") {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/udaman", request.url));
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - /_next (static assets, HMR)
     *  - /favicon.ico, images, fonts
     */
    "/((?!_next|favicon\\.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2)$).*)",
  ],
};
