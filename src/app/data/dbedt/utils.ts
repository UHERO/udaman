/***************************************************************************************
 *   HELPER FUNCTIONS FOR THE DBEDT DATA PORTAL
 *   A bulk of these functions have been replicated from the original portal built
 *   in Angular with slight modifications
 ***************************************************************************************/

import {
  Activity,
  Binoculars,
  BriefcaseBusiness,
  Cable,
  CircleDollarSign,
  GraduationCap,
  HammerIcon,
  IdCard,
  Landmark,
  Leaf,
  type LucideIcon,
} from "lucide-react";

import { addAnnualObs, addQuarterObs } from "../shared/utils";
import { Series, TransformationResults } from "./types";

export const CAT_ICON_MAP: Record<string, LucideIcon> = {
  Agriculture: Leaf,
  "Business and Insurance": BriefcaseBusiness,
  "Construction and Housing": HammerIcon,
  Education: GraduationCap,
  Employment: IdCard,
  Energy: Cable,
  "GDP, Income, and Prices": CircleDollarSign,
  "Population and Vital Statistics": Activity,
  "Tax Collection": Landmark,
  Tourism: Binoculars,
};

/***************************************************************************************
 *   RETURNS OBSERVATION DATE RANGES OF ENTIRE SERIES ARRAY FOR RESULTS TABLE AND
 *   DATE SELECTOR
 *   - startYear: '1990'
 *   - startMonth: '01'
 *   - endYear: '2005'
 *   - endMonth: '12'
 *
 *   Note: This function could be shared across both portals, but may need to update
 *   how the series is formatted in order to access the dates correctly
 ***************************************************************************************/

export const getObsDates = (series: Series[]) => {
  const obsStartDates = series.map(
    (serie) => serie.seriesObservations.observationStart,
  );

  const obsEndDates = series.map(
    (serie) => serie.seriesObservations.observationEnd,
  );
  const minObsDate = obsStartDates.reduce((min, curr) => {
    return min === "" ? curr : curr.localeCompare(min) < 0 ? curr : min;
  }, "");
  const maxObsDate = obsEndDates.reduce((max, curr) => {
    return max === "" ? curr : curr.localeCompare(max) > 0 ? curr : max;
  }, "");

  const [startYear, startMonth] = minObsDate.split("-");
  const [endYear, endMonth] = maxObsDate.split("-");

  return [startYear, startMonth, endYear, endMonth];
};

export const formatObservations = (
  indicatorLevel: TransformationResults,
  dateArray: Record<string, string>[],
  decimals: number,
) => {
  // Return array of of dates with their corresponding values
  const { dates, values } = indicatorLevel;

  const results: Record<string, string> = {};
  dateArray.forEach((date) => {
    results[date.tableDate] = " ";
    const dateExists = dates.indexOf(date.date);
    if (dateExists > -1) {
      const parsed = parseFloat(values[dateExists]);
      results[date.tableDate] = !isFinite(parsed)
        ? " "
        : parsed.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
    }
  });

  return results;
};

/***************************************************************************************
 *   EXTRACTS SERIES DATES
 * - Users can choose between Monthly, Quarterly, and/or Annually
 * - Returns a date array in format
    [
      {date: '2002-01-01', tableDate: '2002'}               // if Annual selected
    ]
 ***************************************************************************************/

export function setDateArray(
  dateFormValues: Record<string, string>,
  annualSelected: boolean,
  quarterSelected: boolean,
  monthSelected: boolean,
) {
  const dateArray = [];
  const m: Record<string, string> = {
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
  const q: Record<string, string> = { 1: "Q1", 4: "Q2", 7: "Q3", 10: "Q4" };

  const { startYear, endYear, startQuarter, endQuarter, startMonth, endMonth } =
    dateFormValues;
  let minYear = +startYear;
  let minMonth = monthSelected
    ? +startMonth
    : quarterSelected
      ? +startQuarter
      : 1;
  const maxMonth = monthSelected ? +endMonth : quarterSelected ? +endQuarter : 1;
  while (`${minYear}-${m[minMonth]}-01` <= `${endYear}-${m[maxMonth]}-01`) {
    // Frequency display order: M, Q, A
    if (monthSelected) {
      dateArray.push({
        date: `${minYear}-${m[minMonth]}-01`,
        tableDate: `${minYear}-${m[minMonth]}`,
      });
    }
    if (quarterSelected) {
      const qMonth = addQuarterObs(minMonth, monthSelected);
      if (qMonth) {
        dateArray.push({
          date: `${minYear}-${m[qMonth]}-01`,
          tableDate: `${minYear} ${q[qMonth]}`,
        });
      }
    }
    if (annualSelected) {
      const addAnnual = addAnnualObs(minMonth, monthSelected, quarterSelected);
      if (addAnnual) {
        dateArray.push({ date: `${minYear}-01-01`, tableDate: `${minYear}` });
      }
    }
    minYear = minMonth === 12 ? (minYear += 1) : minYear;
    minMonth = minMonth === 12 ? 1 : (minMonth += 1);
  }
  return dateArray;
}
