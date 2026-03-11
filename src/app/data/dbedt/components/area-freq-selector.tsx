"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import SelectionUnavailable from "../../dvw/components/error-inline";
import DateSelector from "../../shared/date-selector";
import FrequencyRegionSelector from "../../shared/freq-reg-selector";
import { getUpdatedDateRange } from "../../shared/utils";
import { DateOptions, SelectedFreq, SelectedGeo, Series } from "../types";
import { formatObservations, getObsDates, setDateArray } from "../utils";

export default function AreaFreqSelector({
  selectedIndicators,
  handleResultsData,
  handleSelectionChange,
}: {
  selectedIndicators: Series[];
  handleResultsData: (tableDates: string[], results: Series[]) => void;
  handleSelectionChange: (regions: boolean, frequencies: boolean) => void;
}) {
  const [frequencies, setFrequencies] = useState<SelectedFreq[]>([]);
  const [regions, setRegions] = useState<SelectedGeo[]>([]);
  const [results, setResults] = useState<Series[]>([]);
  const [minObsMo, setMinObsMo] = useState("");
  const [maxObsMo, setMaxObsMo] = useState("");
  const [minObsYr, setMinObsYr] = useState("");
  const [maxObsYr, setMaxObsYr] = useState("");

  const [tableDates, setTableDates] = useState<string[]>([]);

  const [dateRange, setDateRange] = useState<Record<string, string>>({
    endMonth: "",
    startMonth: "",
    endQuarter: "",
    startQuarter: "",
    startYear: "",
    endYear: "",
  });

  useEffect(() => {
    const [startYear, startMonth, endYear, endMonth] =
      getObsDates(selectedIndicators);
    setDateRange(() => ({
      endMonth: endMonth,
      startMonth: startMonth,
      endQuarter: endMonth,
      startQuarter: startMonth,
      startYear: startYear,
      endYear: endYear,
    }));
    setMinObsMo(startMonth);
    setMaxObsMo(endMonth);
    setMinObsYr(startYear);
    setMaxObsYr(endYear);
  }, [selectedIndicators]);

  useEffect(() => {
    if (
      results.length === 0 ||
      !results[0].observations ||
      Object.keys(results[0].observations).length === 0
    )
      return;

    handleResultsData(tableDates, results);
  }, [tableDates, results]);

  useEffect(() => {
    const newRegions: SelectedGeo[] = [];
    const newFreq: SelectedFreq[] = [];

    if (selectedIndicators.length === 0) {
      setFrequencies([]);
      setRegions([]);
      return;
    }

    // Create lookup maps of existing state
    const prevFreqMap = new Map(frequencies.map((f) => [f.id, f.state]));
    const prevRegionMap = new Map(regions.map((r) => [r.id, r.state]));

    selectedIndicators.forEach((serie) => {
      const { geography, frequencyShort, frequency } = serie;

      // Only push if it's not already in the new list
      if (!newFreq.some((freq) => freq.id === frequencyShort)) {
        newFreq.push({
          id: frequencyShort,
          label: frequency,
          state: prevFreqMap.get(frequencyShort) ?? false,
        });
      }

      if (!newRegions.some((geo) => geo.id === geography.handle)) {
        newRegions.push({
          id: geography.handle,
          text: geography.name,
          state: prevRegionMap.get(geography.handle) ?? false,
        });
      }
    });

    setRegions(newRegions);
    setFrequencies(newFreq);
  }, [selectedIndicators]);

  useEffect(() => {
    if (Object.values(dateRange).includes("")) return;
    const isFreqSel = frequencies.some((f) => f.state === true);
    if (isFreqSel) {
      const annualSelected = frequencies.some(
        (freq) => freq.id === "A" && freq.state,
      );
      const quarterlySelected = frequencies.some(
        (freq) => freq.id === "Q" && freq.state,
      );
      const monthlySelected = frequencies.some(
        (freq) => freq.id === "M" && freq.state,
      );

      const dateArr = setDateArray(
        dateRange,
        annualSelected,
        quarterlySelected,
        monthlySelected,
      );

      const tableDates = dateArr.map((d) => d.tableDate);

      setTableDates(tableDates);
    }
  }, [dateRange]);

  useEffect(() => {
    if (Object.values(dateRange).includes("")) return;
    const isFreqSel = frequencies.some((f) => f.state === true);
    const isRegionsSel = regions.some((r) => r.state === true);
    if (isFreqSel) {
      const annualSelected = frequencies.some(
        (freq) => freq.id === "A" && freq.state,
      );
      const quarterlySelected = frequencies.some(
        (freq) => freq.id === "Q" && freq.state,
      );
      const monthlySelected = frequencies.some(
        (freq) => freq.id === "M" && freq.state,
      );

      const dateArr = setDateArray(
        dateRange,
        annualSelected,
        quarterlySelected,
        monthlySelected,
      );

      setTableDates(dateArr.map((d) => d.tableDate));
      if (isFreqSel && isRegionsSel && dateArr.length > 0) {
        handleResults(dateArr);
      }
    }
    handleSelectionChange(isRegionsSel, isFreqSel);
  }, [regions, frequencies]);

  useEffect(() => {
    if (results.length === 0) return;

    const [startYear, startMonth, endYear, endMonth] = getObsDates(results);

    setDateRange(() => ({
      endMonth: endMonth,
      startMonth: startMonth,
      endQuarter: endMonth,
      startQuarter: startMonth,
      startYear: startYear,
      endYear: endYear,
    }));

    setMinObsMo(startMonth);
    setMaxObsMo(endMonth);
    setMinObsYr(startYear);
    setMaxObsYr(endYear);

    if (
      results.length === 0 ||
      !results[0].observations ||
      Object.keys(results[0].observations).length === 0
    )
      return;

    handleResultsData(tableDates, results);
  }, [results]);

  const handleResults = (dates: Record<string, string>[]) => {
    const displayedSeries = selectedIndicators.filter((indicator) => {
      const levelData = indicator.seriesObservations.transformationResults.find(
        (transforms) => transforms.transformation === "lvl",
      );

      if (!levelData) return false;

      indicator.observations = formatObservations(
        levelData,
        dates,
        indicator.decimals,
      );
      indicator.Area = indicator.geography.shortName;
      indicator.Indicator = indicator.description;
      indicator.Units = indicator.unitsLabelShort;
      return (
        regions.some(
          (geo) => geo.id === indicator.geography.handle && geo.state,
        ) &&
        frequencies.some(
          (freq) => freq.id === indicator.frequencyShort && freq.state,
        ) &&
        levelData.dates &&
        levelData.values
      );
    });

    setResults(displayedSeries);
  };

  const handleSelectedAreaFreq = (
    selection: SelectedFreq | SelectedGeo,
    value: "frequencies" | "regions",
  ) => {
    switch (value) {
      case "frequencies":
        setFrequencies((prev) =>
          prev.map((item) =>
            item.id === selection.id ? { ...item, state: !item.state } : item,
          ),
        );
        break;
      case "regions":
        setRegions((prev) =>
          prev.map((item) =>
            item.id === selection.id ? { ...item, state: !item.state } : item,
          ),
        );
        break;
      default:
        console.error("Invalid selection");
        break;
    }
  };

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

  return (
    <div
      className={cn(
        "z-50 flex w-full flex-col gap-10 border border-r-0 border-b-0 border-l-0 pt-5 md:flex-row",
      )}
    >
      <div
        className={cn(
          selectedIndicators.length > 0
            ? "pointer-events-auto"
            : "pointer-events-none",
          "flex gap-x-2 md:gap-x-10",
        )}
      >
        <FrequencyRegionSelector
          data={regions}
          handleFreq={(dataPt) =>
            handleSelectedAreaFreq(dataPt as SelectedGeo, "regions")
          }
          type="dbedt"
          selector="area"
        />
        <FrequencyRegionSelector
          data={frequencies}
          handleFreq={(dataPt) =>
            handleSelectedAreaFreq(dataPt as SelectedFreq, "frequencies")
          }
          type="dbedt"
          selector="frequency"
        />
      </div>
      {results.length === 0 && frequencies.some((f) => f.state === true) ? (
        <SelectionUnavailable />
      ) : (
        <DateSelector
          minObsYr={minObsYr}
          minObsMo={minObsMo}
          maxObsYr={maxObsYr}
          maxObsMo={maxObsMo}
          dateRange={dateRange}
          handleSelectedDates={(d, type) => handleSelectedDates(d, type)}
          frequencies={frequencies}
          showSelector={true}
          regions={regions}
        />
      )}
    </div>
  );
}
