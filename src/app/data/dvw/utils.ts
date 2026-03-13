/***************************************************************************************
 *   HELPER FUNCTIONS FOR THE DVW DATA PORTAL
 *   A bulk of these functions have been replicated from the original portal built
 *   in Angular with slight modifications.
 ***************************************************************************************/

import {
  FileUser,
  HandCoins,
  Hotel,
  ListCollapse,
  MapPinHouse,
  PlaneTakeoff,
  ScrollText,
  Store,
  TrendingUp,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { getFrequencies, getSeries } from "@/actions/data-portal/dvw";
import { Observations } from "@/types/rest-api";

import { addAnnualObs, addQuarterObs } from "../shared/utils";
import {
  Dimension,
  DvwModuleSeries,
  DvwSeries,
  Module,
  ModuleDimension,
  SelectedDimension,
} from "./types";

export const modules: string[] = ["trend", "char", "airseat", "exp", "hotel"];

export const DIMENSION_ICONS: Record<string, LucideIcon> = {
  markets: Store,
  destinations: MapPinHouse,
  indicators: ListCollapse,
  groups: Users,
  categories: ScrollText,
  trend: TrendingUp,
  airseat: PlaneTakeoff,
  char: FileUser,
  hotel: Hotel,
  exp: HandCoins,
  clear: Undo2,
};

export const DIMENSION_MAP: Record<string, string> = {
  trend: "Visitor Trends",
  airseat: "Air Seats to Hawaii",
  exp: "Expenditure Patterns",
  char: "Visitor Characteristics",
  hotel: "Hotel Performance",
};

/***************************************************************************************
 *   RETURNS OBSERVATION DATE RANGES OF ENTIRE SERIES ARRAY FOR RESULTS TABLE AND
 *   DATE SELECTOR
 *   - minObsDate: '1990-01-01'
 *   - maxObsDate: '2005-01-01'
 *   - startYear: '1990'
 *   - startMonth: '01'
 *   - endYear: '2005'
 *   - endMonth: '12'
 *
 *   Note: This function could be shared across both portals, but may need to update
 *   how the series is formatted in order to access the dates correctly
 ***************************************************************************************/

export const getObsDates = (series: DvwModuleSeries[] | Observations[]) => {
  const obsStartDates = series.map((serie) => serie.observationStart);

  const obsEndDates = series.map((serie) => serie.observationEnd);
  const minObsDate = obsStartDates.reduce((min, curr) => {
    return min === "" ? curr : curr.localeCompare(min) < 0 ? curr : min;
  }, "");
  const maxObsDate = obsEndDates.reduce((max, curr) => {
    return max === "" ? curr : curr.localeCompare(max) > 0 ? curr : max;
  }, "");

  const [startYear, startMonth] = minObsDate.split("-");
  const [endYear, endMonth] = maxObsDate.split("-");

  return [minObsDate, maxObsDate, startYear, startMonth, endYear, endMonth];
};

/***************************************************************************************
 *   PRIMARY FUNCTION USED TO FETCH DATA FROM DVW API
 *   1) First checks if all sections are selected in side panel.
 *   2) Once all sections are selected, fetch frequencies (ex response: ['A', 'Q', 'M'])
 *   3) Once all sections and at most one frequency is selected, fetch series
 *
 *   Notes: Only one frequency is selected at a time. formatApiParam() returns a
 *   parameter string used as an endpoint to fetch series / frequencies based on
 *   selected dimensions
 ***************************************************************************************/

export async function checkUserSelections(
  dimensions: SelectedDimension,
  mod: Module,
  frequency?: string,
) {
  let allDimensionsSelected = false;

  if (dimensions && Object.keys(dimensions).length) {
    allDimensionsSelected = isAllDimSelected(dimensions);
  }

  if (allDimensionsSelected && !frequency) {
    // API Frequency endpoint has 5 required parameters
    const reqParams = ["i", "m", "d", "g", "c"];
    const moduleParams = Object.keys(dimensions).map((k) => k.substring(0, 1));
    const unusedParams = reqParams.filter((p) => !moduleParams.includes(p));

    const freqApiParam = formatApiParam(dimensions, unusedParams);

    const frequencies = await getFrequencies(mod, freqApiParam);
    return [freqApiParam, frequencies];
  }

  if (allDimensionsSelected && frequency) {
    const [apiParam, series] = await getSeriesData(mod, dimensions, frequency);

    return [apiParam, series];
  }

  return ["", []];
}

export function isAllDimSelected(dimensions: Dimension | SelectedDimension) {
  return Object.keys(dimensions).every((key) => {
    return Object.values(dimensions[key]).some((d) => d.state === true);
  });
}

async function getSeriesData(mod: string, dimensions: SelectedDimension, frequency: string) {
  const apiParam = formatApiParam(dimensions);
  const series = await getSeries(mod, apiParam, frequency);
  return [apiParam, series ?? {}];
}

export const formatApiParam = (
  dimensions: SelectedDimension,
  unusedFreqParams?: string[],
) => {
  let apiParam = "";
  const dimensionKeys = Object.keys(dimensions);
  dimensionKeys.forEach((key, index) => {
    apiParam += `${key.substring(0, 1)}=`;
    const opts = Object.values(dimensions[key]);
    opts.forEach((opt, optIndex) => {
      apiParam += `${opt.handle}`;
      if (optIndex !== opts.length - 1) {
        apiParam += `,`;
      }
    });
    if (index !== dimensionKeys.length - 1) {
      apiParam += `&`;
    }
  });

  if (unusedFreqParams) {
    unusedFreqParams.forEach((param) => (apiParam += `&${param}=0`));
  }

  return apiParam;
};

/***************************************************************************************
 *   REFORMATS SERIES DATA RETURNED FROM DVW API
 *   Additional keys were added for ease of access when generating results table
 *   - .observations: { tableDate: value }[]      header columns: tableDate
 *   - .dimensions                                from prev dashboard, may not be needed?
 *   - .dimensionArr: ['Indicator', 'Groups']     dimension header columns
 *
 *   Notes: Only one frequency is selected at a time. formatApiParam() returns a
 *   parameter string used as an endpoint to fetch series / frequencies based on
 *   selected dimensions
 ***************************************************************************************/

export const formatSeriesData = (
  series: DvwModuleSeries[],
  dates: Record<string, string>[],
  dimensions: Dimension | SelectedDimension,
  dimensionsArr: string[],
) => {
  return series.map((serie) => {
    identifySeriesColumns(serie, dimensions);
    serie.dimensions = dimensions;

    // Format observations
    const results: Record<string, string> = {};
    dates.forEach((date) => {
      results[date.tableDate] = " ";
      const dateExists = serie.dates.indexOf(date.date);
      if (dateExists > -1) {
        results[date.tableDate] =
          serie.values[dateExists] === Infinity
            ? " "
            : serie.values[dateExists].toLocaleString("en-US", {
                minimumFractionDigits: serie.decimal,
                maximumFractionDigits: serie.decimal,
              });
      }
    });

    serie.dimensionArr = dimensionsArr;
    serie.observations = results;
    setSeriesTableOrder(serie);
    const transformedSerie = { ...serie } as any;

    // Capitalize first letter of the current dimension key, original
    // response is all lowercased
    dimensionsArr.forEach((dimension) => {
      const lowerKey = dimension.toLowerCase();
      const upperKey = `${dimension[0].toUpperCase()}${dimension.slice(1)}`;

      transformedSerie[upperKey] = transformedSerie[lowerKey];
      delete transformedSerie[lowerKey];
    });

    return transformedSerie;
  });
};

function setSeriesTableOrder(serie: DvwModuleSeries) {
  if (!serie.dimensions) return;
  const dimensionKeys = Object.keys(serie.dimensions);
  dimensionKeys.forEach((key) => {
    const items = serie.dimensions![key];
    const dims: ModuleDimension[] = Array.isArray(items) ? items : Object.values(items);
    for (const d of dims) {
      if (serie.columns.includes(d.handle)) {
        serie.order = serie.order
          ? serie.order + formatSeriesOrder(d.level, d.order)
          : formatSeriesOrder(d.level, d.order);
      }
    }
  });
}

function identifySeriesColumns(serie: DvwModuleSeries, dimensions: Dimension | SelectedDimension) {
  serie.columns.forEach((col: string) => {
    findColumnDimension(serie, dimensions, col);
  });
}

function findColumnDimension(serie: DvwModuleSeries, dimensions: Dimension | SelectedDimension, column: string) {
  Object.keys(dimensions).forEach((key) => {
    matchDimensionAndColumn(dimensions, key, column, serie);
  });
}

function matchDimensionAndColumn(
  dimensions: Dimension | SelectedDimension,
  key: string,
  column: string,
  serie: Record<string, unknown>,
) {
  const items = dimensions[key];
  const opts: ModuleDimension[] = Array.isArray(items) ? items : Object.values(items);
  for (const opt of opts) {
    if (opt.handle === column) {
      serie[key] = opt.nameT ?? opt.nameW;
      if (opt.unit) {
        serie.units = opt.unit;
        serie.decimal = opt.decimal;
      }
    }
  }
}

function formatSeriesOrder(level: number, index: number) {
  const ordering = [level, index];
  const pad = "00";
  let result = "";
  ordering.forEach((index) => {
    const str = "" + index;
    const paddedStr = pad.substring(0, pad.length - str.length) + str;
    result += paddedStr;
  });
  return result;
}

/***************************************************************************************
 *   EXTRACTS SERIES DATES
 * - Users can choose between Monthly, Quarterly, and/or Annually
 * - Returns a date array in format
    [
      {date: '2002-01-01', tableDate: '2002'}               // if Annual selected
    ]
 ***************************************************************************************/

export function categoryDateArray(
  selectedDates: Record<string, string>,
  selectedFreqs: Array<string>,
) {
  // Dates used in table header
  const dateArray = [];
  const m: Record<number, string> = {
    1: "01",
    2: "02",
    3: "03",
    4: "04",
    5: "05",
    6: "06",
    7: "07",
    8: "08",
    9: "09",
    10: "10",
    11: "11",
    12: "12",
  };
  const q: Record<number, string> = { 1: "Q1", 4: "Q2", 7: "Q3", 10: "Q4" };
  let startYear = +selectedDates.startDate.substr(0, 4);
  let endYear = +selectedDates.endDate.substr(0, 4);
  let startMonth = +selectedDates.startDate.substr(5, 2);
  let endMonth = +selectedDates.endDate.substr(5, 2);
  const annualSelected = selectedFreqs.indexOf("A") > -1;
  const monthSelected = selectedFreqs.indexOf("M") > -1;
  const quarterSelected = selectedFreqs.indexOf("Q") > -1;
  // Check if selectedDates' properties have values set (i.e. date range selectors have been used)
  const dates = checkSelectedDates(
    selectedDates,
    selectedFreqs[0],
    monthSelected,
    startYear,
    endYear,
    startMonth,
    endMonth,
    q,
  );
  startYear = dates.startYear;
  endYear = dates.endYear;
  startMonth = dates.startMonth;
  endMonth = dates.endMonth;
  while (
    startYear + "-" + m[startMonth] + "-01" <=
    endYear + "-" + m[endMonth] + "-01"
  ) {
    // Frequency display order: M, Q, A
    if (monthSelected) {
      dateArray.push({
        date: startYear.toString() + "-" + m[startMonth] + "-01",
        tableDate: startYear.toString() + "-" + m[startMonth],
      });
    }
    if (quarterSelected) {
      const qMonth = addQuarterObs(startMonth, monthSelected);
      if (qMonth) {
        dateArray.push({
          date: startYear.toString() + "-" + m[qMonth] + "-01",
          tableDate: startYear.toString() + " " + q[qMonth],
        });
      }
    }
    if (annualSelected) {
      const addAnnual = addAnnualObs(
        startMonth,
        monthSelected,
        quarterSelected,
      );
      if (addAnnual) {
        dateArray.push({
          date: startYear.toString() + "-01-01",
          tableDate: startYear.toString(),
        });
      }
    }
    startYear = startMonth === 12 ? (startYear += 1) : startYear;
    startMonth = startMonth === 12 ? 1 : (startMonth += 1);
  }
  return dateArray;
}

function checkSelectedDates(
  selectedDates: Record<string, string>,
  freq: string,
  monthSelected: boolean,
  startYear: number,
  endYear: number,
  startMonth: number,
  endMonth: number,
  quarters: Record<string, string>,
) {
  startYear = selectedDates.selectedStartYear
    ? +selectedDates.selectedStartYear
    : startYear;
  endYear = selectedDates.selectedEndYear
    ? +selectedDates.selectedEndYear
    : endYear;
  startMonth = selectedDates.selectedStartMonth
    ? +selectedDates.selectedStartMonth
    : startMonth;
  endMonth = selectedDates.selectedEndMonth
    ? +selectedDates.selectedEndMonth
    : endMonth;
  if (!monthSelected) {
    startMonth = selectedDates.selectedStartQuarter
      ? setStartMonthQ(quarters, selectedDates, startMonth)
      : startMonth;
    endMonth = selectedDates.selectedEndQuarter
      ? setEndMonthQ(quarters, selectedDates, endMonth)
      : endMonth;
  }
  if (freq === "A") {
    startMonth = 1;
    endMonth = 1;
  }
  return { startYear, endYear, startMonth, endMonth };
}

// Get start month based on selected start quarter
function setStartMonthQ(
  quarters: Record<string, string>,
  selectedDates: Record<string, string>,
  startMonth: number,
) {
  for (const key in quarters) {
    if (quarters[key] === selectedDates.selectedStartQuarter) {
      startMonth = +key;
    }
  }
  return startMonth;
}

// Get end month based on selected end quarter
function setEndMonthQ(
  quarters: Record<string, string>,
  selectedDates: Record<string, string>,
  endMonth: number,
) {
  for (const key in quarters) {
    if (quarters[key] === selectedDates.selectedEndQuarter) {
      endMonth = +key + 2;
    }
  }
  return endMonth;
}

/***************************************************************************************
 *   UPDATES SELECTED DIMENSIONS STATE ON SIDE PANEL
 *   (determines which dimensions are active)
 *
 *   resetAllDimensionStates() sets the current selected dimensions' `state` values
 *   back to false
 *
 *   flipDimensionState() flips the current selected dimensions' state true/false based
 *   on user selection
 ***************************************************************************************/

export function resetAllDimensionStates(
  dimensions: Record<string, Record<string, any>>,
): Record<string, Record<string, any>> {
  const reset: Record<string, Record<string, any>> = {};

  for (const groupKey in dimensions) {
    const group = dimensions[groupKey];
    reset[groupKey] = {};

    for (const itemKey in group) {
      reset[groupKey][itemKey] = {
        ...group[itemKey],
        state: false,
      };
    }
  }

  return reset;
}

export function flipDimensionState(
  dimensions: Record<string, Record<string, any>>,
  groupKey: string,
  itemKey: string,
): Record<string, Record<string, any>> {
  return {
    ...dimensions,
    [groupKey]: {
      ...dimensions[groupKey],
      [itemKey]: {
        ...dimensions[groupKey][itemKey],
        state: !dimensions[groupKey][itemKey].state,
      },
    },
  };
}
