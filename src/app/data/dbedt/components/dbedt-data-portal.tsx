"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
      state ? [...prev, ...series] : prev.filter((p) => p.measurementId != id)
    );
  };

  return (
    <div className="flex h-[567px] w-full max-w-[960px] flex-col justify-between">
      <div className="flex size-full">
        <DbedtSidebar
          categories={categories}
          handleSelectedIndicators={(series, id, state) =>
            populateAreaFreq(series, id, state)
          }
          clearSelection={clearSelection}
          selectionCleared={() => setClearSelection(false)}
        />
        {results.length > 0 && selectors.regions && selectors.frequencies ? (
          <div className="m-1 grid grid-rows-[auto,1fr] items-start md:h-[500px]">
            <div className="my-1 flex items-center justify-between">
              <ExportNavBar
                results={results}
                tableDates={tableDates}
                dimensions={["Indicator", "Area", "Units"]}
                type="dbedt"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setClearSelection(true);
                }}
                className="ml-auto text-xs"
              >
                Clear All Selections
              </Button>{" "}
            </div>

            <ResultsTable
              results={results}
              tableDates={tableDates}
              dimensions={["Indicator", "Area", "Units"]}
              isSource={true}
            />
          </div>
        ) : (
          <div className="mx-auto my-5 w-full rounded-md bg-slate-50 p-6">
            <h1 className="font-semibold text-orange-500">
              Welcome to the DBEDT Data Warehouse
            </h1>
            <p className="mt-2 text-left text-xs">
              Please select indicator(s), frequency(s), period, and area(s) to
              get data.
            </p>

            <p className="mt-2 text-left text-xs">
              If no data appears after you have completed your selection, please
              check that you have made the proper selections such as the “From…”
              date is earlier than the “To….” date.
            </p>
            <p className="mt-2 text-left text-xs">
              If you modify your selection, the table will be updated
              automatically after each modification. If you would like to start
              a new data query, press the “Clear All Selections” button.
            </p>
            <p className="mt-2 text-left text-xs">
              This Data Warehouse site works best in Chrome. For assistance,
              please contact the Research & Economic Analysis Division, DBEDT at
              808-586-2466.
            </p>
          </div>
        )}
      </div>
      <Tooltip delayDuration={10}>
        <TooltipTrigger asChild>
          <div className="max-w-4/5 ml-5 rounded-lg">
            <div>
              <AreaFreqSelector
                selectedIndicators={selectedIndicators}
                handleResultsData={(
                  tableDates: string[],
                  results: Series[]
                ) => {
                  setTableDates(tableDates);
                  setResults(results);
                }}
                handleSelectionChange={(isRegionsSel, isFreqSel) => {
                  setSelectors({
                    regions: isRegionsSel,
                    frequencies: isFreqSel,
                  });
                }}
              />
            </div>
          </div>
        </TooltipTrigger>
        {selectedIndicators.length === 0 && (
          <TooltipContent className="text-xs text-gray-500" align="center">
            Select an indicator
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
