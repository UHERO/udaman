"use server";

import { requirePermission } from "@/lib/auth/permissions";
import type { HhdbListParams } from "@catalog/types/hhdb";
import type { FactorResult } from "@catalog/types/hhdb";

const FACTOR_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const factorCache = new Map<string, { data: FactorResult; expiresAt: number }>();

const DASHBOARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const dashboardCache = new Map<string, { data: unknown; expiresAt: number }>();

async function cachedDashboard<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = dashboardCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const data = await fn();
  dashboardCache.set(key, { data, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
  return data;
}
import {
  getProperties as getPropertiesCtrl,
  getAssessments as getAssessmentsCtrl,
  getSales as getSalesCtrl,
  getImprovements as getImprovementsCtrl,
  getPermits as getPermitsCtrl,
  getCondoProjects as getCondoProjectsCtrl,
  getCondoUnits as getCondoUnitsCtrl,
  getMedianAssessedByClass as getMedianAssessedCtrl,
  getMedianSalePriceByIsland as getMedianSalePriceCtrl,
  getPropertyCountByClass as getPropertyCountCtrl,
  getTotalAssessedByIsland as getTotalAssessedCtrl,
  getPermitActivityByYear as getPermitActivityCtrl,
  getCondoAreaByYearBuilt as getCondoAreaCtrl,
  getFactors as getFactorsCtrl,
  getParcels as getParcelsCtrl,
  getOwners as getOwnersCtrl,
  getAppeals as getAppealsCtrl,
  getDedications as getDedicationsCtrl,
  getLandClassifications as getLandClassificationsCtrl,
  getCurrentTaxBills as getCurrentTaxBillsCtrl,
  getHistoricalTaxSummary as getHistoricalTaxSummaryCtrl,
  getHistoricalTaxDetails as getHistoricalTaxDetailsCtrl,
  getHistoricalTaxPayments as getHistoricalTaxPaymentsCtrl,
  getHistoricalTaxCredits as getHistoricalTaxCreditsCtrl,
  getAgriculturalAssessments as getAgriculturalAssessmentsCtrl,
  getCommercialDetails as getCommercialDetailsCtrl,
  getResidentialAdditions as getResidentialAdditionsCtrl,
  getAccessoryStructures as getAccessoryStructuresCtrl,
  getYardImprovements as getYardImprovementsCtrl,
} from "@catalog/controllers/hhdb";

export async function getHhdbProperties(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getPropertiesCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbAssessments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getAssessmentsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbSales(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getSalesCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbImprovements(
  params: HhdbListParams,
  type: "residential" | "commercial",
) {
  await requirePermission("hhdb", "read");
  const result = await getImprovementsCtrl(params, type);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbPermits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getPermitsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbCondoProjects(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getCondoProjectsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbCondoUnits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getCondoUnitsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
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
  const result = await getParcelsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbOwners(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getOwnersCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbAppeals(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getAppealsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbDedications(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getDedicationsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbLandClassifications(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getLandClassificationsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbCurrentTaxBills(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getCurrentTaxBillsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbHistoricalTaxSummary(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getHistoricalTaxSummaryCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbHistoricalTaxDetails(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getHistoricalTaxDetailsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbHistoricalTaxPayments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getHistoricalTaxPaymentsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbHistoricalTaxCredits(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getHistoricalTaxCreditsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbAgriculturalAssessments(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getAgriculturalAssessmentsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbCommercialDetails(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getCommercialDetailsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbResidentialAdditions(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getResidentialAdditionsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbAccessoryStructures(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getAccessoryStructuresCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbYardImprovements(params: HhdbListParams) {
  await requirePermission("hhdb", "read");
  const result = await getYardImprovementsCtrl(params);
  return { rows: result.rows.map((r) => r.toJSON()), total: result.total };
}

export async function getHhdbFactors(table: string, column: string) {
  await requirePermission("hhdb", "read");
  const key = `${table}:${column}`;
  const cached = factorCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const result = await getFactorsCtrl(table, column);
  factorCache.set(key, { data: result, expiresAt: Date.now() + FACTOR_CACHE_TTL_MS });
  return result;
}
