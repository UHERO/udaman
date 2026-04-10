"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { logPageViewAction } from "@/actions/app-log";

export function PageViewLogger({ userId }: { userId: number }) {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    logPageViewAction(pathname, userId);
  }, [pathname, userId]);

  return null;
}
