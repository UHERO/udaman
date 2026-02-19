"use server";

import {
  getFilterOptions,
  getMeasurementFrequencies,
  getMeasurementOptions,
  getPrefixOptions,
  resolveCompareFilters,
  searchPrefixes,
  type FilterRow,
} from "@catalog/controllers/compare-filters";
import type { Universe } from "@catalog/types/shared";

export async function getFilterOptionsAction(universe: string) {
  return getFilterOptions({ universe: universe as Universe });
}

export async function getMeasurementFrequenciesAction(measurementId: number) {
  return getMeasurementFrequencies({ measurementId });
}

export async function getMeasurementOptionsAction(measurementId: number) {
  return getMeasurementOptions({ measurementId });
}

export async function resolveCompareFiltersAction(rows: FilterRow[]) {
  return resolveCompareFilters({ rows });
}

export async function searchPrefixesAction(text: string, universe: string) {
  return searchPrefixes({ text, universe });
}

export async function getPrefixOptionsAction(prefix: string, universe: string) {
  return getPrefixOptions({ prefix, universe });
}
