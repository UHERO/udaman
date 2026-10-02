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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ScreenshotPlaceholder } from "../ui/screenshot-placeholder";

/**
 * "Category View Help" dialog (landing-page p-dialog). Copy follows the
 * Angular template, adjusted for the new controls. The old screenshots showed
 * the previous UI, so their slots are placeholders — pass `src` to
 * ScreenshotPlaceholder once new ones exist in public/data-portal/help/.
 */
export function CategoryHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Category view help"
          className="text-muted-foreground size-7 rounded-none"
        >
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Category View Help</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="category">
          <TabsList className="rounded-none">
            <TabsTrigger value="category" className="rounded-none">
              Category View
            </TabsTrigger>
            <TabsTrigger value="chart" className="rounded-none">
              Chart View
            </TabsTrigger>
            <TabsTrigger value="table" className="rounded-none">
              Table View
            </TabsTrigger>
          </TabsList>
          <div className="text-muted-foreground space-y-3 pt-2 text-sm leading-relaxed">
            <TabsContent value="category" className="space-y-3">
              <p>
                This is the category view of the Data Portal. Use the menu on
                the left hand side of the screen to display data related to each
                category.
              </p>
              <ScreenshotPlaceholder caption="Category selectors" aspect={6} />
              <p>
                At the top of the page are selectors to change the region and
                frequency (if applicable) for the series that are displayed.
                Next to the selectors is a toggle to switch between &ldquo;Table
                View&rdquo; and &ldquo;Chart View.&rdquo;{" "}
                <em>
                  Note that changing the frequency or region may result in a
                  different subset of series being displayed in the chart/table
                  view, as not all data are available at all frequencies and for
                  all regions.
                </em>
              </p>
              <p>
                This is followed by a date slider where the date range for the
                displayed data can be modified to your desired starting or
                ending period. This can be done by either dragging the handles
                of the slider or typing a date into the input boxes.
              </p>
            </TabsContent>
            <TabsContent value="chart" className="space-y-3">
              <ScreenshotPlaceholder caption="Chart view" aspect={4} />
              <p>
                By default, the Data Portal loads into the Chart View. At the
                top of each chart you will find the name of the indicator
                displayed, the date of the last value in the chart (with units
                in parentheses), and the year-to-date percent change (or
                absolute change where appropriate). Hovering your mouse cursor
                over a series will display values at different points in time.
                Click on a chart to view more detailed data.
              </p>
              <p>
                In the upper right corner of each chart is the Analyzer button.
                When selected, the button is filled solid and the indicator is
                added to the Analyzer used for grouping and comparing multiple
                indicators.
              </p>
            </TabsContent>
            <TabsContent value="table" className="space-y-3">
              <ScreenshotPlaceholder caption="Table view" aspect={4} />
              <p>
                In the Table View, in addition to the selectors described above,
                there are toggles to display year-over-year percent change
                (absolute change where appropriate), and year-to-date growth
                rate for indicators at the monthly or quarterly frequency. You
                can change your sample size using the same controls available in
                Chart View. If the sample selected is too large to fit on the
                screen, you can scroll the table horizontally to display the
                remaining observations.
              </p>
              <p>
                The Download CSV button saves a Comma Separated Values formatted
                file of the table to your downloads folder. A CSV file easily
                loads in Excel or other software programs. Selecting the
                information icon next to the Analyzer button pops up a box with
                more information about the selected indicator including source
                links. Click on the name of the indicator to view the chart and
                table of the data.
              </p>
              <p>
                Any indicator in the table can be added to the Analyzer by
                selecting the Analyzer button, located to the right of the name
                of each indicator.
              </p>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
