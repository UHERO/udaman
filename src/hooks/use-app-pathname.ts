"use client";

import { usePathname } from "next/navigation";

export function useAppPathname(): string {
  return usePathname();
}
