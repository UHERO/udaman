import { NextRequest, NextResponse } from "next/server";

const appDefaults: Record<string, string> = {
  udaman: "/uhero/series",
  data: "/",
  analytics: "/",
};

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const subdomain = host.split(".")[0];
  const defaultPath = appDefaults[subdomain];

  if (defaultPath === undefined) return;

  const { pathname } = request.nextUrl;

  // Redirect bare root to the app's default page
  if (pathname === "/") {
    return NextResponse.redirect(new URL(defaultPath, request.url));
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files
     */
    "/((?!_next|favicon.ico|.*\\.).*)",
  ],
};
