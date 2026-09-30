"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { seriesInfoLines, seriesInfoTitle } from "../../lib/series";
import type { PortalSeries } from "../../lib/types";

/**
 * Series info popover (table-helper.showPopover): title with geo/freq/units,
 * "Seasonally Adjusted", source description, source link, source details.
 * `sourceDetails` is rendered as text (Angular injected it as HTML).
 */
export function SeriesInfoPopover({
  series,
  className,
}: {
  series: PortalSeries;
  className?: string;
}) {
  const info = seriesInfoLines(series);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`About ${series.title}`}
          className={cn("text-muted-foreground size-7 rounded-none", className)}
        >
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-80 rounded-none p-0 text-xs"
      >
        <div className="border-b px-3 py-2 text-sm font-semibold">
          {seriesInfoTitle(series)}
        </div>
        <div className="space-y-1 px-3 py-2 break-words">
          {info.seasonallyAdjusted && <p>Seasonally Adjusted</p>}
          {info.source && <p>Source: {info.source}</p>}
          {info.sourceLink && (
            <p>
              <a
                href={info.sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                {info.sourceLink}
              </a>
            </p>
          )}
          {info.sourceDetails && (
            <p className="text-muted-foreground">{info.sourceDetails}</p>
          )}
          {!info.seasonallyAdjusted &&
            !info.source &&
            !info.sourceLink &&
            !info.sourceDetails && (
              <p className="text-muted-foreground">No source information.</p>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
