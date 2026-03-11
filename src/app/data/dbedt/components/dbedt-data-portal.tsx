"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import ExportNavBar from "../../shared/export-nav";
import ResultsTable from "../../shared/results-table";
import { CategoryType, Series } from "../types";
import AreaFreqSelector from "./area-freq-selector";
import DbedtSidebar from "./dbedt-sidebar";

export default function DbedtDataPortal({
  categories,
}: {
  categories: CategoryType[];
}) {
  const [selectedIndicators, setSelectedIndicators] = useState<Series[]>([]);
  const [tableDates, setTableDates] = useState<string[]>([]);
  const [results, setResults] = useState<Series[]>([]);
  const [selectors, setSelectors] = useState<Record<string, boolean>>({
    regions: false,
    frequencies: false,
  });
  const [clearSelection, setClearSelection] = useState(false);

  const populateAreaFreq = (series: Series[], id?: number, state?: boolean) => {
    if (series.length === 0) {
      setSelectedIndicators([]);
      setResults([]);
      setSelectors({ regions: false, frequencies: false });
      return;
    }
    setSelectedIndicators((prev) =>
      state ? [...prev, ...series] : prev.filter((p) => p.measurementId != id),
    );
  };

  return (
    <>
      <DbedtSidebar
        categories={categories}
        handleSelectedIndicators={(series, id, state) =>
          populateAreaFreq(series, id, state)
        }
        clearSelection={clearSelection}
        selectionCleared={() => setClearSelection(false)}
      />
      <SidebarInset className="flex h-[567px] flex-col px-2">
        <SidebarTrigger className="mt-3 w-fit p-3 text-gray-400 md:hidden">
          SELECT INDICATORS
        </SidebarTrigger>
        <div className="mt-2 flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {results.length > 0 && selectors.regions && selectors.frequencies ? (
            <div className="m-1 flex min-h-0 w-full min-w-0 flex-col">
              <div className="my-1 flex items-center justify-between">
                <ExportNavBar
                  results={results}
                  tableDates={tableDates}
                  dimensions={["Indicator", "Area", "Units"]}
                  type="dbedt"
                />
                <Button
                  variant="outline"
                  onClick={() => setClearSelection(true)}
                  className="ml-auto text-xs"
                >
                  Clear All Selections
                </Button>
              </div>
              <div className="mt-2 min-h-0 flex-1 overflow-auto">
                <ResultsTable
                  results={results}
                  tableDates={tableDates}
                  dimensions={["Indicator", "Area", "Units"]}
                  isSource={true}
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto my-5 w-full p-6">
              <h1 className="font-semibold text-orange-500">
                Welcome to the DBEDT Data Warehouse
              </h1>
              <p className="mt-2 text-left text-xs">
                Please select indicator(s), frequency(s), period, and area(s) to
                get data.
              </p>
              <p className="mt-2 text-left text-xs">
                If no data appears after you have completed your selection,
                please check that you have made the proper selections such as
                the &ldquo;From&hellip;&rdquo; date is earlier than the
                &ldquo;To&hellip;&rdquo; date.
              </p>
              <p className="mt-2 text-left text-xs">
                If you modify your selection, the table will be updated
                automatically after each modification. If you would like to
                start a new data query, press the &ldquo;Clear All
                Selections&rdquo; button.
              </p>
              <p className="mt-2 text-left text-xs">
                This Data Warehouse site works best in Chrome. For assistance,
                please contact the Research &amp; Economic Analysis Division,
                DBEDT at 808-586-2466.
              </p>
            </div>
          )}
        </div>
        <Tooltip delayDuration={10}>
          <TooltipTrigger asChild>
            <div className="ml-5 rounded-lg">
              <AreaFreqSelector
                selectedIndicators={selectedIndicators}
                handleResultsData={(dates: string[], res: Series[]) => {
                  setTableDates(dates);
                  setResults(res);
                }}
                handleSelectionChange={(isRegionsSel, isFreqSel) => {
                  setSelectors({
                    regions: isRegionsSel,
                    frequencies: isFreqSel,
                  });
                }}
              />
            </div>
          </TooltipTrigger>
          {selectedIndicators.length === 0 && (
            <TooltipContent className="text-xs text-white" align="center">
              Select an indicator
            </TooltipContent>
          )}
        </Tooltip>
      </SidebarInset>
    </>
  );
}
