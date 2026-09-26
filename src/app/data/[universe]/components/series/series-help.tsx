"use client";

import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ScreenshotPlaceholder } from "../ui/screenshot-placeholder";

/** "Series View Help" dialog (copy adapted from single-series.component.html). */
export function SeriesHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Series view help"
          className="text-muted-foreground size-7 rounded-none"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Series View Help</DialogTitle>
        </DialogHeader>
        <div className="text-foreground/85 space-y-3 text-sm leading-relaxed">
          <p>
            The series view plots a single indicator as a line, with the
            year-over-year percent change (or absolute change) drawn as bars in
            the panel beneath it.
          </p>
          <ScreenshotPlaceholder caption="Series view" aspect={16 / 9} />
          <p>
            Above the chart, the selectors switch geography and frequency. You
            can also toggle whether the chart shows the seasonally adjusted or
            the non-seasonally adjusted indicator when both are available. The
            Share button opens a static link to this series, which can be
            bookmarked or shared to reproduce the chart as it appears on screen,
            along with an embed code. To add the indicator to the Analyzer,
            toggle the analyzer button next to the title.
          </p>
          <p>
            To control the selected sample, drag the handles of the navigator
            beneath the chart or type dates into the From and To boxes. The Zoom
            buttons set the range to 1 year (for non-annual series), 5 years, or
            10 years ending at the selected end date; All displays all available
            data.
          </p>
          <p>
            Below the chart are the source of the data, a link to the source
            agency, and any relevant notes, followed by summary statistics for
            the selected range and a table of the data, which can be sorted by
            date ascending or descending. The CSV button downloads the selected
            data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
