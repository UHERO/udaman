"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Square segmented control (one option active, filled with the theme
 * color). Used for Chart / Table on category & search and Gallery /
 * Compare in the Analyzer.
 */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("border-input flex divide-x border", className)}
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => value !== v && onChange(v)}
          className={cn(
            "flex h-8 items-center gap-1.5 px-3 text-sm transition-colors",
            value === v
              ? "bg-(--portal-primary) text-white"
              : "text-muted-foreground hover:text-foreground bg-white",
          )}
        >
          {Icon && <Icon className="size-4" />}
          {label}
        </button>
      ))}
    </div>
  );
}
