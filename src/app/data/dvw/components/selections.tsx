"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DateOptions, SelectedFreq } from "../../dbedt/types";
import DateSelector from "../../shared/date-selector";
import ExportNavBar from "../../shared/export-nav";
import FrequencyRegionSelector from "../../shared/freq-reg-selector";
import DvwResultsTable from "../../shared/results-table";
import { getUpdatedDateRange } from "../../shared/utils";
import {
  Dimension,
  DvwModuleSeries,
  DvwSeries,
  Module,
  ModuleDimension,
  SelectedDimension,
} from "../types";
import {
  categoryDateArray,
  checkUserSelections,
  DIMENSION_MAP,
  formatApiParam,
  formatSeriesData,
  getObsDates,
  isAllDimSelected,
} from "../utils";
import Dvw_Sidebar from "./dvw-sidebar";
import SelectionUnavailable from "./error-inline";

export default function Selections({
  results,
  module,
}: {
  results?: Dimension | {};
  module: Module;
}) {
  const [dimensions, setDimensions] = useState({});
  const [freqs, setFreqs] = useState<SelectedFreq[]>([]);
  const [cachedSeries, setCachedSeries] = useState<Record<string, DvwSeries>>(
    {},
  );
  const [seriesLoaded, setSeriesLoaded] = useState(false);
  const [minObsMo, setMinObsMo] = useState("");
  const [maxObsMo, setMaxObsMo] = useState("");
  const [minObsYr, setMinObsYr] = useState("");
  const [maxObsYr, setMaxObsYr] = useState("");
  const [tableDates, setTableDates] = useState<string[]>([]);

  const [selectedFreq, setSelectedFreq] = useState("");
  const [series, setSeries] = useState<DvwModuleSeries[] | []>([]);
  const [dimensionArr, setDimensionArr] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<Record<string, string>>({
    endMonth: "",
    startMonth: "",
    endQuarter: "",
    startQuarter: "",
    startYear: "",
    endYear: "",
  });

  useEffect(() => {
    const {
      endMonth,
      startMonth,
      endQuarter,
      startQuarter,
      startYear,
      endYear,
    } = dateRange;
    let obsStart = "";
    let obsEnd = "";

    if (selectedFreq === "M" || selectedFreq === "A") {
      obsStart = `${startYear}-${startMonth}-01`;
      obsEnd = `${endYear}-${endMonth}-01`;
    } else {
      obsStart = `${startYear}-${startQuarter}-01`;
      obsEnd = `${endYear}-${endQuarter}-01`;
    }

    function updateSeriesDateRange() {
      const dateArray = categoryDateArray(
        { startDate: obsStart, endDate: obsEnd },
        [selectedFreq],
      );

      setTableDates(dateArray.map((d) => d.tableDate));
      const formattedSeries = formatSeriesData(
        series,
        dateArray,
        dimensions,
        dimensionArr,
      );
      setSeries(formattedSeries);
    }

    if (
      dateRange &&
      dateRange.startYear &&
      dateRange.endYear &&
      series &&
      selectedFreq
    ) {
      updateSeriesDateRange();
    }
  }, [dateRange]);

  useEffect(() => {
    if (Object.keys(dimensions).length > 0) {
      const formattedDimensions = Object.keys(dimensions)
        .map(
          (dimension) => `${dimension[0].toUpperCase()}${dimension.slice(1)}`,
        )
        .reverse();
      setDimensionArr([...formattedDimensions, "Units"]);
    }
    if (selectedFreq && isAllDimSelected(dimensions)) {
      fetchSeriesData();
    }
  }, [selectedFreq, dimensions]);

  useEffect(() => {
    if (dateRange.startYear === dateRange.endYear) {
      setDateRange((prev) =>
        getUpdatedDateRange(
          prev,
          "startYear",
          prev.startYear,
          maxObsYr,
          minObsMo,
        ),
      );
    }
  }, [dateRange.startYear, dateRange.endYear]);

  const handleSelectedDates = (value: string, type: DateOptions) => {
    if (!type) {
      console.error("Invalid date selection type:", type);
      return;
    }

    setDateRange((prev) =>
      getUpdatedDateRange(prev, type, value, maxObsYr, minObsMo),
    );
  };

  async function fetchSeriesData() {
    const apiParam = formatApiParam(dimensions);
    const activeHandles: string[] = [];

    // Get all active handles from selected dimensions
    Object.values(dimensions as SelectedDimension).forEach((group) => {
      Object.values(group).forEach((dim: ModuleDimension) => {
        if (dim.state === true) {
          activeHandles.push(dim.handle);
        }
      });
    });
    // Only return series that are actively selected
    function filterSeries(res: DvwSeries) {
      return res.series.filter((serie) =>
        serie.columns.every((c) => activeHandles.includes(c)),
      );
    }

    // Check cached series first
    if (cachedSeries[apiParam] !== undefined) {
      const res = cachedSeries[apiParam];

      const filteredSeries = filterSeries(res);

      updateSeriesState(filteredSeries);

      return;
    }

    try {
      const [newApiParam, res] = await checkUserSelections(
        dimensions,
        module,
        selectedFreq,
      );
      setSeriesLoaded(true);
      const filteredSeries = filterSeries(res);

      updateSeriesState(filteredSeries);
      setCachedSeries((prev) => ({
        ...prev,
        [newApiParam]: res,
      }));
    } catch (err) {
      console.error("Error fetching series data:", err);
    }
  }

  function updateSeriesState(series: DvwModuleSeries[]) {
    const [minDate, maxDate, startYear, startMonth, endYear, endMonth] =
      getObsDates(series);

    const dateArray = categoryDateArray(
      { startDate: minDate, endDate: maxDate },
      [selectedFreq],
    );

    setTableDates(dateArray.map((d) => d.tableDate));

    const formattedSeries = formatSeriesData(
      series,
      dateArray,
      dimensions,
      dimensionArr,
    );
    setDateRange({
      startYear,
      endYear,
      startMonth,
      endMonth,
      startQuarter: startMonth,
      endQuarter: endMonth,
    });

    setMinObsMo(startMonth);
    setMaxObsMo(endMonth);
    setMinObsYr(startYear);
    setMaxObsYr(endYear);
    setSeries(formattedSeries);
  }

  return (
    <SidebarProvider className="min-h-0 flex-col">
      <div className="mt-1 flex items-center justify-between px-2">
        <h1 className="text-dvw my-2 text-2xl font-bold">
          {DIMENSION_MAP[module]}
        </h1>
        <Button variant={"outline"} asChild className="h-8 w-fit">
          <Link href={"/data/dvw"}>Select Dataset</Link>
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <SidebarTrigger className="ml-2 w-fit px-2 text-gray-400 md:hidden">
          SELECT FILTERS
        </SidebarTrigger>

        <Dvw_Sidebar
          results={results ?? {}}
          module={module}
          handleFrequencies={(curr_freqs, dim, isCleared) => {
            setDimensions(dim);
            if (!selectedFreq || Object.keys(dimensions).length === 0) {
              setFreqs(curr_freqs);
            }
            if (isCleared) {
              setFreqs([]);
              setSelectedFreq("");
            }
          }}
          selectedFreq={selectedFreq}
          handleState={() => {}}
        />

        <div className="grid min-w-0 flex-1 grid-cols-1 grid-rows-[1fr_auto] px-2 md:h-[790px] md:p-0">
          {selectedFreq && isAllDimSelected(dimensions) && seriesLoaded ? (
            <div className="z-10 flex flex-col gap-y-2 overflow-auto pb-2 md:h-full">
              <ExportNavBar
                results={series}
                tableDates={tableDates}
                dimensions={dimensionArr}
                type="dvw"
              />
              {series.length > 0 ? (
                <DvwResultsTable
                  results={series}
                  tableDates={tableDates}
                  dimensions={dimensionArr}
                  isSource={false}
                />
              ) : (
                <SelectionUnavailable />
              )}
            </div>
          ) : (
            <div className="mt-5 mb-2 flex flex-col rounded-md p-5 text-sm text-zinc-500 md:bg-gray-50">
              <div className="m-auto flex flex-col gap-y-3 md:size-3/4">
                <p className="font-semibold">To generate a table:</p>
                <ol className="ml-3 flex flex-col gap-2">
                  <li className="">
                    1. Make at least one selection in each category from the
                    filters panel
                  </li>
                  <li>2. Choose a frequency from the options below</li>
                </ol>
                <p>
                  The table will automatically update with available data as you
                  make selections. Use the buttons above the table to download
                  or print your results.
                </p>
              </div>
            </div>
          )}
          <div className="w-full border border-x-0 border-b-0 border-t-transparent pt-4 md:border-t-gray-200">
            <Tooltip delayDuration={10}>
              <TooltipTrigger asChild>
                {
                  <div
                    className={cn(
                      "flex size-full items-start gap-5 md:flex-row md:gap-y-0",
                    )}
                  >
                    <FrequencyRegionSelector
                      data={freqs}
                      handleFreq={(f) => {
                        setSelectedFreq(f as string);
                        setFreqs((prev) => {
                          const isAlreadySelected = prev.find(
                            (item) => item.id === f,
                          )?.state;
                          return prev.map((item) => ({
                            ...item,
                            state: item.id === f ? !isAlreadySelected : false,
                          }));
                        });
                      }}
                      type="dvw"
                      selector="frequency"
                    />

                    <DateSelector
                      minObsYr={minObsYr}
                      minObsMo={minObsMo}
                      maxObsYr={maxObsYr}
                      maxObsMo={maxObsMo}
                      dateRange={dateRange}
                      handleSelectedDates={(d, type) =>
                        handleSelectedDates(d, type)
                      }
                      frequencies={freqs}
                      showSelector={series.length > 0}
                    />
                  </div>
                }
              </TooltipTrigger>
              {freqs.length === 0 && (
                <TooltipContent
                  className="text-xs text-gray-500"
                  align="center"
                >
                  Select filters on left panel
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
