"use server";

import {
  getAccessoryStructuresJSON as getAccessoryStructuresCtrl,
  getAgriculturalAssessmentsJSON as getAgriculturalAssessmentsCtrl,
  getAppealsJSON as getAppealsCtrl,
  getAssessmentsJSON as getAssessmentsCtrl,
  getCommercialDetailsJSON as getCommercialDetailsCtrl,
  getCondoAreaByYearBuilt as getCondoAreaCtrl,
  getCondoProjectsJSON as getCondoProjectsCtrl,
  getCondoUnitsJSON as getCondoUnitsCtrl,
  getCurrentTaxBillsJSON as getCurrentTaxBillsCtrl,
  getDedicationsJSON as getDedicationsCtrl,
  getFreqSummary as getFreqSummaryCtrl,
  getHistoricalTaxCreditsJSON as getHistoricalTaxCreditsCtrl,
  getHistoricalTaxDetailsJSON as getHistoricalTaxDetailsCtrl,
  getHistoricalTaxPaymentsJSON as getHistoricalTaxPaymentsCtrl,
  getHistoricalTaxSummaryJSON as getHistoricalTaxSummaryCtrl,
  getImprovementsJSON as getImprovementsCtrl,
  getLandClassificationsJSON as getLandClassificationsCtrl,
  getMedianAssessedByClass as getMedianAssessedCtrl,
  getMedianSalePriceByIsland as getMedianSalePriceCtrl,
  getOwnersJSON as getOwnersCtrl,
  getParcelsJSON as getParcelsCtrl,
  getPermitActivityByYear as getPermitActivityCtrl,
  getPermitsJSON as getPermitsCtrl,
  getPropertiesJSON as getPropertiesCtrl,
  getPropertyCountByClass as getPropertyCountCtrl,
  getResidentialAdditionsJSON as getResidentialAdditionsCtrl,
  getSalesJSON as getSalesCtrl,
  getTotalAssessedByIsland as getTotalAssessedCtrl,
  getYardImprovementsJSON as getYardImprovementsCtrl,
} from "@catalog/controllers/hhdb";
import type {
  FreqSummaryParams,
  FreqSummaryResult,
  HhdbListParams,
} from "@catalog/types/hhdb";

import { requirePermission } from "@/lib/auth/permissions";

const DASHBOARD_CACHE_TTL_MS = 48 * 60 * 60 * 1000; //  2 days
const dashboardCache = new Map<string, { data: unknown; expiresAt: number }>();

async function cachedDashboard<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const data = await fn();
  dashboardCache.set(key, {
    data,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  });
  return data;
}

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

export async function getHhdbFreqSummary(
  table: string,
  column: string,
  params: FreqSummaryParams,
): Promise<FreqSummaryResult> {
  await requirePermission("hhdb", "read");
  return getFreqSummaryCtrl(table, column, params);
}
