"use client";

import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";

/**
 * Selected-series count for Analyzer links (header + sidebar): accent fill
 * when anything is selected, muted when empty.
 */
export function AnalyzerCountBadge({ className }: { className?: string }) {
  const { count } = useAnalyzer();
  return (
    <span
      className={cn(
        "min-w-5 rounded px-1 text-center text-xs font-semibold tabular-nums",
        count
          ? "bg-(--portal-accent) text-neutral-900"
          : "bg-neutral-100 text-neutral-500",
        className,
      )}
      aria-label={`${count} series selected`}
    >
      {count}
    </span>
  );
}
