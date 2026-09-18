"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { logPageViewAction } from "@/actions/app-log";

/**
 * Records one page_view per distinct pathname the user lands on.
 *
 * Mounted once in the root layout so every app in the tree — udaman, comms,
 * admin, hhdb, docs, data — is covered by the same instrumentation. Mounting
 * it per-app layout is what previously left whole route trees unlogged.
 *
 * The viewer is resolved from the session inside the action; nothing about the
 * user is passed from the client.
 */
export function PageViewLogger() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    // Fire-and-forget: a failed log must never surface to the user.
    void logPageViewAction(pathname).catch(() => {});
  }, [pathname]);

  return null;
}
