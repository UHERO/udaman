"use server";

import { requirePermission } from "@/lib/auth/permissions";
import type { HhdbListParams, SummaryViewType } from "@catalog/types/hhdb";
import type { SummaryResult } from "@catalog/types/hhdb";

const SUMMARY_CACHE_TTL_MS =  48 * 60 * 60  * 1000; // 2 days
const summaryCache = new Map<string, { data: SummaryResult; expiresAt: number }>();

const DASHBOARD_CACHE_TTL_MS = 48 * 60 * 60 * 1000; //  2 days
const dashboardCache = new Map<string, { data: unknown; expiresAt: number }>();

async function cachedDashboard<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const data = await fn();
  dashboardCache.set(key, { data, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
  return data;
}
import {
  getPropertiesJSON as getPropertiesCtrl,
  getAssessmentsJSON as getAssessmentsCtrl,
  getSalesJSON as getSalesCtrl,
  getImprovementsJSON as getImprovementsCtrl,
  getPermitsJSON as getPermitsCtrl,
  getCondoProjectsJSON as getCondoProjectsCtrl,
  getCondoUnitsJSON as getCondoUnitsCtrl,
  getMedianAssessedByClass as getMedianAssessedCtrl,
  getMedianSalePriceByIsland as getMedianSalePriceCtrl,
  getPropertyCountByClass as getPropertyCountCtrl,
  getTotalAssessedByIsland as getTotalAssessedCtrl,
  getPermitActivityByYear as getPermitActivityCtrl,
  getCondoAreaByYearBuilt as getCondoAreaCtrl,
  getSummaries as getSummariesCtrl,
  getDistribution as getDistributionCtrl,
  getParcelsJSON as getParcelsCtrl,
  getOwnersJSON as getOwnersCtrl,
  getAppealsJSON as getAppealsCtrl,
  getDedicationsJSON as getDedicationsCtrl,
  getLandClassificationsJSON as getLandClassificationsCtrl,
  getCurrentTaxBillsJSON as getCurrentTaxBillsCtrl,
  getHistoricalTaxSummaryJSON as getHistoricalTaxSummaryCtrl,
  getHistoricalTaxDetailsJSON as getHistoricalTaxDetailsCtrl,
  getHistoricalTaxPaymentsJSON as getHistoricalTaxPaymentsCtrl,
  getHistoricalTaxCreditsJSON as getHistoricalTaxCreditsCtrl,
  getAgriculturalAssessmentsJSON as getAgriculturalAssessmentsCtrl,
  getCommercialDetailsJSON as getCommercialDetailsCtrl,
  getResidentialAdditionsJSON as getResidentialAdditionsCtrl,
  getAccessoryStructuresJSON as getAccessoryStructuresCtrl,
  getYardImprovementsJSON as getYardImprovementsCtrl,
} from "@catalog/controllers/hhdb";

export async function getHhdbProperties(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getPropertiesCtrl(params);
}

export async function getHhdbAssessments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getAssessmentsCtrl(params);
}

export async function getHhdbSales(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getSalesCtrl(params);
}

export async function getHhdbImprovements(
  params: HhdbListParams,
  type: "residential" | "commercial",
) {
  await requirePermission("hhdb", "read");
  return getImprovementsCtrl(params, type);
}

export async function getHhdbResidentialImprovements(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getImprovementsCtrl(params, "residential");
}

export async function getHhdbCommercialImprovements(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getImprovementsCtrl(params, "commercial");
}

export async function getHhdbPermits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getPermitsCtrl(params);
}

export async function getHhdbCondoProjects(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getCondoProjectsCtrl(params);
}

export async function getHhdbCondoUnits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getCondoUnitsCtrl(params);
}

export async function getHhdbMedianAssessed() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("medianAssessed", getMedianAssessedCtrl);
}

export async function getHhdbMedianSalePrice() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("medianSalePrice", getMedianSalePriceCtrl);
}

export async function getHhdbPropertyCount() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("propertyCount", getPropertyCountCtrl);
}

export async function getHhdbTotalAssessed() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("totalAssessed", getTotalAssessedCtrl);
}

export async function getHhdbPermitActivity() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("permitActivity", getPermitActivityCtrl);
}

export async function getHhdbCondoArea() {
  await requirePermission("hhdb", "read");
  return cachedDashboard("condoArea", getCondoAreaCtrl);
}

export async function getHhdbParcels(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getParcelsCtrl(params);
}

export async function getHhdbOwners(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getOwnersCtrl(params);
}

export async function getHhdbAppeals(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getAppealsCtrl(params);
}

export async function getHhdbDedications(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getDedicationsCtrl(params);
}

export async function getHhdbLandClassifications(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getLandClassificationsCtrl(params);
}

export async function getHhdbCurrentTaxBills(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getCurrentTaxBillsCtrl(params);
}

export async function getHhdbHistoricalTaxSummary(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getHistoricalTaxSummaryCtrl(params);
}

export async function getHhdbHistoricalTaxDetails(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getHistoricalTaxDetailsCtrl(params);
}

export async function getHhdbHistoricalTaxPayments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getHistoricalTaxPaymentsCtrl(params);
}

export async function getHhdbHistoricalTaxCredits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getHistoricalTaxCreditsCtrl(params);
}

export async function getHhdbAgriculturalAssessments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getAgriculturalAssessmentsCtrl(params);
}

export async function getHhdbCommercialDetails(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getCommercialDetailsCtrl(params);
}

export async function getHhdbResidentialAdditions(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getResidentialAdditionsCtrl(params);
}

export async function getHhdbAccessoryStructures(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getAccessoryStructuresCtrl(params);
}

export async function getHhdbYardImprovements(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  return getYardImprovementsCtrl(params);
}

export async function getHhdbSummaries(table: string, column: string, viewType: SummaryViewType, sortBy?: string) {
  await requirePermission("hhdb", "read");
  const key = `${table}:${column}:${viewType}:${sortBy ?? "total"}`;
  const cached = summaryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const result = await getSummariesCtrl(table, column, viewType, sortBy);
  summaryCache.set(key, { data: result, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS });
  return result;
}

export async function getHhdbDistribution(table: string, column: string) {
  await requirePermission("hhdb", "read");
  const key = `dist:${table}:${column}`;
  const cached = summaryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const result = await getDistributionCtrl(table, column);
  summaryCache.set(key, { data: result, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS });
  return result;
}
