"use client";

import { usePathname } from "next/navigation";

export function useAppPathname(): string {
  const pathname = usePathname();
  if (pathname.startsWith("/udaman")) return pathname;
  return `/udaman${pathname}`;
}
