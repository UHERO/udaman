"use client";

import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

/** Main column for /comms pages; honours the shared full-width toggle. */
export function CommsLayout({ children }: { children: React.ReactNode }) {
  const { fullWidth } = useFullWidth();
  return (
    <main className={cn("space-y-6", !fullWidth && "max-w-4xl")}>
      {children}
    </main>
  );
}
