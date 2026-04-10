"use client";

import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

export function DataToolsLayout({ children }: { children: React.ReactNode }) {
  const { fullWidth } = useFullWidth();

  return (
    <main className={cn("space-y-6", !fullWidth && "max-w-5xl")}>
      {children}
    </main>
  );
}
