"use client";

import { CircleQuestionMark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ScreenshotPlaceholder } from "../ui/screenshot-placeholder";

/** "Analyzer View Help" dialog (copy from analyzer.component.html). */
export function AnalyzerHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Analyzer help"
          className="text-muted-foreground size-7 rounded-none"
        >
          <CircleQuestionMark className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Analyzer View Help</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="analyzer" className="text-sm leading-relaxed">
          <TabsList className="rounded-none">
            <TabsTrigger value="analyzer" className="rounded-none">
              Analyzer
            </TabsTrigger>
            <TabsTrigger value="gallery" className="rounded-none">
              Gallery View
            </TabsTrigger>
            <TabsTrigger value="compare" className="rounded-none">
              Compare View
            </TabsTrigger>
          </TabsList>
          <TabsContent value="analyzer" className="space-y-2 pt-2">
            <p>
              The Data Portal&apos;s Analyzer consists of 2 views: Gallery and
              Compare. Click on the Compare/Gallery button at the top to toggle
              between them.
            </p>
            <ScreenshotPlaceholder caption="Analyzer tables" aspect={2.4} />
            <p>
              The lower half of both Analyzer views contains two tables. The
              first table lists each indicator that was selected with all the
              data for the current selected date range. There are controls above
              this table to toggle the display of growth rates and a link to
              download the data in CSV format. The second table contains summary
              statistics for each indicator: selected date range, minimum value,
              maximum value, percent change, change, total, average, and
              compound annual growth rate.
            </p>
          </TabsContent>
          <TabsContent value="gallery" className="space-y-2 pt-2">
            <ScreenshotPlaceholder caption="Gallery view" aspect={3} />
            <p>
              The Gallery view shows small charts of all the series that have
              been selected for the analyzer. If all the indicators in the
              analyzer are of the same frequency, the frequency selector
              switches every indicator to another frequency, and the Index
              checkbox becomes available. The date slider controls the sample
              and &lsquo;Remove All Series&rsquo; clears the analyzer.
            </p>
            <p>
              The column-chart icon on each chart toggles whether an indicator
              is drawn in the Compare view; by default the first 2 indicators
              are. With Index checked, series are indexed to 100 at the selected
              start date. If data is not available for all comparison indicators
              at that date, indexing is based on the earliest common date of the
              indicators selected for comparison.
            </p>
          </TabsContent>
          <TabsContent value="compare" className="space-y-2 pt-2">
            <ScreenshotPlaceholder caption="Compare view" aspect={16 / 9} />
            <p>
              The Compare view draws every series added to the comparison in a
              single chart. The Zoom buttons set the range to 1, 5 or 10 years
              ending at the selected end date; &lsquo;All&rsquo; shows all
              available data. Download exports PNG, JPEG or SVG images, or the
              chart data as CSV. The Level/YOY/YTD buttons draw the same values
              for every series.
            </p>
            <p>
              The legend lists all indicators in the analyzer. The settings icon
              next to each name opens its options: draw it on the left or right
              y-axis, change the chart type (line, column, or area), change the
              values drawn (level or growth rates), and remove it from the
              comparison or the analyzer. Below the chart, set a minimum and
              maximum for each y-axis.
            </p>
            <p>
              The Share button opens a link that reproduces the analyzer as it
              appears on screen, and an embed code for the Compare chart.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
