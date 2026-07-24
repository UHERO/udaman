"use client";

import { usePathname } from "next/navigation";

/**
 * usePathname, normalized to always carry the internal "/udaman" route
 * prefix. On the deployed subdomain the reverse proxy strips the prefix
 * from browser URLs, so raw usePathname() returns e.g. "/uhero/uploads"
 * while app hrefs are "/udaman/uhero/uploads" — active-tab comparisons
 * must go through this hook, not usePathname directly.
 */
export function useAppPathname(): string {
  const pathname = usePathname();
  if (pathname.startsWith("/udaman")) return pathname;
  return `/udaman${pathname}`;
}
