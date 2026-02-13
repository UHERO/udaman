import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight middleware — optimistic session cookie check.
 * The authoritative DB-backed check happens in the DAL (requireAuth / getSession).
 *
 * Rules:
 *  - udaman routes (except /login and /api/auth): require session cookie
 *  - data / analytics routes: pass through (public)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /udaman routes (except /udaman itself — it's the login page)
  if (!pathname.startsWith("/udaman") || pathname === "/udaman") {
    return NextResponse.next();
  }

  // Check for the Auth.js session cookie (database strategy uses this name)
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/udaman", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all /udaman paths EXCEPT:
     *  - /api/auth (Auth.js handlers)
     *  - /_next (static assets)
     *  - favicon, images, etc.
     */
    "/udaman/:path*",
  ],
};
