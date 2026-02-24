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

import { requirePermission } from "@/lib/auth/permissions";

export async function getFilterOptionsAction(universe: string) {
  await requirePermission("series", "read");
  return getFilterOptions({ universe: universe as Universe });
}

export async function getMeasurementFrequenciesAction(measurementId: number) {
  await requirePermission("series", "read");
  return getMeasurementFrequencies({ measurementId });
}

export async function getMeasurementOptionsAction(measurementId: number) {
  await requirePermission("series", "read");
  return getMeasurementOptions({ measurementId });
}

export async function resolveCompareFiltersAction(rows: FilterRow[]) {
  await requirePermission("series", "read");
  return resolveCompareFilters({ rows });
}

export async function searchPrefixesAction(text: string, universe: string) {
  await requirePermission("series", "read");
  return searchPrefixes({ text, universe });
}

export async function getPrefixOptionsAction(prefix: string, universe: string) {
  await requirePermission("series", "read");
  return getPrefixOptions({ prefix, universe });
}
