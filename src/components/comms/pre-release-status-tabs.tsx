"use client";

import Link from "next/link";
import type { ApprovalStatusFilter } from "@catalog/models/approval";
import {
  APPROVAL_STATUS_FILTERS,
  APPROVAL_STATUS_LABELS,
} from "@catalog/models/approval";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullWidth } from "@/hooks/use-full-width";
import { cn } from "@/lib/utils";

/**
 * Status filter tabs for the pre-release list, with the shared width toggle
 * on the right (same arrangement as the hhdb/catalog tab bars). Filters live
 * in the URL so a view can be bookmarked or shared.
 */
export function PreReleaseStatusTabs({
  active,
  counts,
}: {
  active: ApprovalStatusFilter;
  counts: Record<ApprovalStatusFilter, number>;
}) {
  const { fullWidth, toggleWidth } = useFullWidth();

  return (
    <div className="flex items-center border-b">
      <nav
        aria-label="Filter by status"
        className="flex min-w-0 flex-1 flex-wrap gap-1"
      >
        {APPROVAL_STATUS_FILTERS.map((f) => {
          const isActive = f === active;
          return (
            <Link
              key={f}
              href={f === "all" ? "/comms" : `/comms?status=${f}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-primary text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {APPROVAL_STATUS_LABELS[f]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  isActive ? "bg-primary/10" : "bg-muted",
                )}
              >
                {counts[f]}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleWidth}
          title={fullWidth ? "Constrain width" : "Full width"}
        >
          {fullWidth ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
