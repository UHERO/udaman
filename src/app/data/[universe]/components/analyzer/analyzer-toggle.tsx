"use client";

import { ChartLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";

/** Add/remove a series from the Analyzer selection. Shared by category, series, and search views. */
export function AnalyzerToggle({
  seriesId,
  className,
}: {
  seriesId: number;
  className?: string;
}) {
  const { has, toggle } = useAnalyzer();
  const selected = has(seriesId);
  const label = selected ? "Remove from Analyzer" : "Add to Analyzer";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={selected}
          onClick={() => toggle(seriesId)}
          className={cn(
            "size-7 rounded-none",
            selected
              ? "bg-(--portal-primary) text-white hover:bg-(--portal-primary)/90 hover:text-white"
              : "text-muted-foreground hover:text-(--portal-primary)",
            className,
          )}
        >
          <ChartLine className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
