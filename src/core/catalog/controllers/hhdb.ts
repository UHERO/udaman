import "server-only";

import { createLogger } from "@/core/observability/logger";

import HhdbAccessoryStructureCollection from "../collections/hhdb-accessory-structure-collection";
import HhdbAgriculturalAssessmentCollection from "../collections/hhdb-agricultural-assessment-collection";
import HhdbAppealCollection from "../collections/hhdb-appeal-collection";
import HhdbAssessmentCollection from "../collections/hhdb-assessment-collection";
import HhdbCommercialDetailCollection from "../collections/hhdb-commercial-detail-collection";
import HhdbCondoCollection from "../collections/hhdb-condo-collection";
import HhdbCurrentTaxBillCollection from "../collections/hhdb-current-tax-bill-collection";
import HhdbDashboardCollection from "../collections/hhdb-dashboard-collection";
import HhdbDedicationCollection from "../collections/hhdb-dedication-collection";
import HhdbHistoricalTaxCreditCollection from "../collections/hhdb-historical-tax-credit-collection";
import HhdbHistoricalTaxDetailCollection from "../collections/hhdb-historical-tax-detail-collection";
import HhdbHistoricalTaxPaymentCollection from "../collections/hhdb-historical-tax-payment-collection";
import HhdbHistoricalTaxSummaryCollection from "../collections/hhdb-historical-tax-summary-collection";
import HhdbImprovementCollection from "../collections/hhdb-improvement-collection";
import HhdbLandClassificationCollection from "../collections/hhdb-land-classification-collection";
import HhdbOwnerCollection from "../collections/hhdb-owner-collection";
import HhdbParcelCollection from "../collections/hhdb-parcel-collection";
import HhdbPermitCollection from "../collections/hhdb-permit-collection";
import HhdbProfileCollection from "../collections/hhdb-profile-collection";
import HhdbPropertyCollection from "../collections/hhdb-property-collection";
import HhdbResidentialAdditionCollection from "../collections/hhdb-residential-addition-collection";
import HhdbSaleCollection from "../collections/hhdb-sale-collection";
import HhdbSummaryCollection from "../collections/hhdb-summary-collection";
import HhdbYardImprovementCollection from "../collections/hhdb-yard-improvement-collection";
import type {
  CategoricalDrilldown,
  FreqSummaryParams,
  FreqSummaryResult,
  HhdbListParams,
  NumericDrilldown,
  OverviewData,
  TemporalDrilldown,
  TextDrilldown,
} from "../types/hhdb";

const log = createLogger("hhdb");

export async function getTableCount(table: string): Promise<number> {
  return HhdbSummaryCollection.getTableCount(table);
}

// --- Model instance variants (for business logic) ---

export async function getProperties(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb properties");
  const result = await HhdbPropertyCollection.list(params);
  log.info({ total: result.total }, "hhdb properties fetched");
  return result;
}

export async function getAssessments(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb assessments");
  const result = await HhdbAssessmentCollection.list(params);
  log.info({ total: result.total }, "hhdb assessments fetched");
  return result;
}

export async function getSales(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb sales");
  const result = await HhdbSaleCollection.list(params);
  log.info({ total: result.total }, "hhdb sales fetched");
  return result;
}

export async function getImprovements(
  params: HhdbListParams,
  type: "residential" | "commercial",
) {
  log.info({ params, type }, "fetching hhdb improvements");
  const result = await HhdbImprovementCollection.list(params, type);
  log.info({ total: result.total }, "hhdb improvements fetched");
  return result;
}

export async function getPermits(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb permits");
  const result = await HhdbPermitCollection.list(params);
  log.info({ total: result.total }, "hhdb permits fetched");
  return result;
}

export async function getCondoProjects(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb condo projects");
  const result = await HhdbCondoCollection.listProjects(params);
  log.info({ total: result.total }, "hhdb condo projects fetched");
  return result;
}

export async function getCondoUnits(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb condo units");
  const result = await HhdbCondoCollection.listUnits(params);
  log.info({ total: result.total }, "hhdb condo units fetched");
  return result;
}

export async function getParcels(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb parcels");
  const result = await HhdbParcelCollection.list(params);
  log.info({ total: result.total }, "hhdb parcels fetched");
  return result;
}

export async function getOwners(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb owners");
  const result = await HhdbOwnerCollection.list(params);
  log.info({ total: result.total }, "hhdb owners fetched");
  return result;
}

export async function getAppeals(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb appeals");
  const result = await HhdbAppealCollection.list(params);
  log.info({ total: result.total }, "hhdb appeals fetched");
  return result;
}

export async function getDedications(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb dedications");
  const result = await HhdbDedicationCollection.list(params);
  log.info({ total: result.total }, "hhdb dedications fetched");
  return result;
}

export async function getLandClassifications(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb land classifications");
  const result = await HhdbLandClassificationCollection.list(params);
  log.info({ total: result.total }, "hhdb land classifications fetched");
  return result;
}

export async function getCurrentTaxBills(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb current tax bills");
  const result = await HhdbCurrentTaxBillCollection.list(params);
  log.info({ total: result.total }, "hhdb current tax bills fetched");
  return result;
}

export async function getHistoricalTaxSummary(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax summary");
  const result = await HhdbHistoricalTaxSummaryCollection.list(params);
  log.info({ total: result.total }, "hhdb historical tax summary fetched");
  return result;
}

export async function getHistoricalTaxDetails(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax details");
  const result = await HhdbHistoricalTaxDetailCollection.list(params);
  log.info({ total: result.total }, "hhdb historical tax details fetched");
  return result;
}

export async function getHistoricalTaxPayments(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax payments");
  const result = await HhdbHistoricalTaxPaymentCollection.list(params);
  log.info({ total: result.total }, "hhdb historical tax payments fetched");
  return result;
}

export async function getHistoricalTaxCredits(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax credits");
  const result = await HhdbHistoricalTaxCreditCollection.list(params);
  log.info({ total: result.total }, "hhdb historical tax credits fetched");
  return result;
}

export async function getAgriculturalAssessments(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb agricultural assessments");
  const result = await HhdbAgriculturalAssessmentCollection.list(params);
  log.info({ total: result.total }, "hhdb agricultural assessments fetched");
  return result;
}

export async function getCommercialDetails(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb commercial details");
  const result = await HhdbCommercialDetailCollection.list(params);
  log.info({ total: result.total }, "hhdb commercial details fetched");
  return result;
}

export async function getResidentialAdditions(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb residential additions");
  const result = await HhdbResidentialAdditionCollection.list(params);
  log.info({ total: result.total }, "hhdb residential additions fetched");
  return result;
}

export async function getAccessoryStructures(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb accessory structures");
  const result = await HhdbAccessoryStructureCollection.list(params);
  log.info({ total: result.total }, "hhdb accessory structures fetched");
  return result;
}

export async function getYardImprovements(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb yard improvements");
  const result = await HhdbYardImprovementCollection.list(params);
  log.info({ total: result.total }, "hhdb yard improvements fetched");
  return result;
}

// --- JSON variants (for read-only list display) ---

export async function getPropertiesJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb properties");
  const result = await HhdbPropertyCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb properties fetched");
  return result;
}

export async function getAssessmentsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb assessments");
  const result = await HhdbAssessmentCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb assessments fetched");
  return result;
}

export async function getSalesJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb sales");
  const result = await HhdbSaleCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb sales fetched");
  return result;
}

export async function getImprovementsJSON(
  params: HhdbListParams,
  type: "residential" | "commercial",
) {
  log.info({ params, type }, "fetching hhdb improvements");
  const result = await HhdbImprovementCollection.listJSON(params, type);
  log.info({ total: result.total }, "hhdb improvements fetched");
  return result;
}

export async function getPermitsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb permits");
  const result = await HhdbPermitCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb permits fetched");
  return result;
}

export async function getCondoProjectsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb condo projects");
  const result = await HhdbCondoCollection.listProjectsJSON(params);
  log.info({ total: result.total }, "hhdb condo projects fetched");
  return result;
}

export async function getCondoUnitsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb condo units");
  const result = await HhdbCondoCollection.listUnitsJSON(params);
  log.info({ total: result.total }, "hhdb condo units fetched");
  return result;
}

export async function getParcelsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb parcels");
  const result = await HhdbParcelCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb parcels fetched");
  return result;
}

export async function getOwnersJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb owners");
  const result = await HhdbOwnerCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb owners fetched");
  return result;
}

export async function getAppealsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb appeals");
  const result = await HhdbAppealCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb appeals fetched");
  return result;
}

export async function getDedicationsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb dedications");
  const result = await HhdbDedicationCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb dedications fetched");
  return result;
}

export async function getLandClassificationsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb land classifications");
  const result = await HhdbLandClassificationCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb land classifications fetched");
  return result;
}

export async function getCurrentTaxBillsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb current tax bills");
  const result = await HhdbCurrentTaxBillCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb current tax bills fetched");
  return result;
}

export async function getHistoricalTaxSummaryJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax summary");
  const result = await HhdbHistoricalTaxSummaryCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb historical tax summary fetched");
  return result;
}

export async function getHistoricalTaxDetailsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax details");
  const result = await HhdbHistoricalTaxDetailCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb historical tax details fetched");
  return result;
}

export async function getHistoricalTaxPaymentsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax payments");
  const result = await HhdbHistoricalTaxPaymentCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb historical tax payments fetched");
  return result;
}

export async function getHistoricalTaxCreditsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb historical tax credits");
  const result = await HhdbHistoricalTaxCreditCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb historical tax credits fetched");
  return result;
}

export async function getAgriculturalAssessmentsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb agricultural assessments");
  const result = await HhdbAgriculturalAssessmentCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb agricultural assessments fetched");
  return result;
}

export async function getCommercialDetailsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb commercial details");
  const result = await HhdbCommercialDetailCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb commercial details fetched");
  return result;
}

export async function getResidentialAdditionsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb residential additions");
  const result = await HhdbResidentialAdditionCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb residential additions fetched");
  return result;
}

export async function getAccessoryStructuresJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb accessory structures");
  const result = await HhdbAccessoryStructureCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb accessory structures fetched");
  return result;
}

export async function getYardImprovementsJSON(params: HhdbListParams) {
  log.info({ params }, "fetching hhdb yard improvements");
  const result = await HhdbYardImprovementCollection.listJSON(params);
  log.info({ total: result.total }, "hhdb yard improvements fetched");
  return result;
}

// --- Dashboard & Factor (no model instantiation, unchanged) ---

export async function getMedianAssessedByClass() {
  log.info("fetching median assessed by class");
  const data = await HhdbDashboardCollection.getMedianAssessedByClass();
  log.info({ count: data.length }, "median assessed by class fetched");
  return data;
}

export async function getMedianSalePriceByIsland() {
  log.info("fetching median sale price by island");
  const data = await HhdbDashboardCollection.getMedianSalePriceByIsland();
  log.info({ count: data.length }, "median sale price by island fetched");
  return data;
}

export async function getPropertyCountByClass() {
  log.info("fetching property count by class");
  const data = await HhdbDashboardCollection.getPropertyCountByClass();
  log.info({ count: data.length }, "property count by class fetched");
  return data;
}

export async function getTotalAssessedByIsland() {
  log.info("fetching total assessed by island");
  const data = await HhdbDashboardCollection.getTotalAssessedByIsland();
  log.info({ count: data.length }, "total assessed by island fetched");
  return data;
}

export async function getPermitActivityByYear() {
  log.info("fetching permit activity by year");
  const data = await HhdbDashboardCollection.getPermitActivityByYear();
  log.info({ count: data.length }, "permit activity by year fetched");
  return data;
}

export async function getCondoAreaByYearBuilt() {
  log.info("fetching condo area by year built");
  const data = await HhdbDashboardCollection.getCondoAreaByYearBuilt();
  log.info({ count: data.length }, "condo area by year built fetched");
  return data;
}

export async function getFreqSummary(
  table: string,
  column: string,
  params: FreqSummaryParams,
): Promise<FreqSummaryResult> {
  log.info({ table, column, page: params.page }, "fetching hhdb freq summary");
  const result = await HhdbSummaryCollection.getFreqSummary(
    table,
    column,
    params,
  );
  log.info(
    { table, column, rows: result.rows.length, total: result.total },
    "hhdb freq summary fetched",
  );
  return result;
}

// --- Profile ---

export async function getProfileOverview(table: string): Promise<OverviewData> {
  log.info({ table }, "fetching hhdb profile overview");
  const result = await HhdbProfileCollection.getOverview(table);
  log.info(
    { table, rows: result.rows.length },
    "hhdb profile overview fetched",
  );
  return result;
}

export async function getProfileCategoricalDrilldown(
  table: string,
  column: string,
): Promise<CategoricalDrilldown> {
  log.info({ table, column }, "fetching hhdb categorical drilldown");
  return HhdbProfileCollection.getCategoricalDrilldown(table, column);
}

export async function getProfileNumericDrilldown(
  table: string,
  column: string,
): Promise<NumericDrilldown> {
  log.info({ table, column }, "fetching hhdb numeric drilldown");
  return HhdbProfileCollection.getNumericDrilldown(table, column);
}

export async function getProfileTemporalDrilldown(
  table: string,
  column: string,
): Promise<TemporalDrilldown> {
  log.info({ table, column }, "fetching hhdb temporal drilldown");
  return HhdbProfileCollection.getTemporalDrilldown(table, column);
}

export async function getProfileTextDrilldown(
  table: string,
  column: string,
): Promise<TextDrilldown> {
  log.info({ table, column }, "fetching hhdb text drilldown");
  return HhdbProfileCollection.getTextDrilldown(table, column);
}

// --- Exploration: Out-of-State Ownership ---

export async function getOutOfStateRatioByQuarter(islandCode?: string) {
  log.info({ islandCode }, "fetching out-of-state ratio by quarter");
  const data = await HhdbDashboardCollection.getOutOfStateRatioByQuarter(islandCode);
  log.info({ count: data.length }, "out-of-state ratio fetched");
  return data;
}

export async function getOutOfStateTopStates(startYear?: number, endYear?: number) {
  log.info({ startYear, endYear }, "fetching out-of-state top states");
  const data = await HhdbDashboardCollection.getOutOfStateTopStates(startYear, endYear);
  log.info({ count: data.length }, "out-of-state top states fetched");
  return data;
}

export async function getOutOfStateTopZips(state?: string, startYear?: number, endYear?: number) {
  log.info({ state, startYear, endYear }, "fetching out-of-state top zips");
  const data = await HhdbDashboardCollection.getOutOfStateTopZips(state, startYear, endYear);
  log.info({ count: data.length }, "out-of-state top zips fetched");
  return data;
}

// --- Exploration: Ownership Concentration ---

export async function getOwnershipDistribution(islandCode?: string) {
  log.info({ islandCode }, "fetching ownership distribution");
  const data = await HhdbDashboardCollection.getOwnershipDistribution(islandCode);
  log.info({ count: data.length }, "ownership distribution fetched");
  return data;
}

export async function getOwnershipLorenzCurve(islandCode?: string) {
  log.info({ islandCode }, "fetching ownership Lorenz curve");
  const data = await HhdbDashboardCollection.getOwnershipLorenzCurve(islandCode);
  log.info({ points: data.points.length, gini: data.gini }, "ownership Lorenz curve fetched");
  return data;
}

export async function getTopOwners(limit?: number, islandCode?: string) {
  log.info({ limit, islandCode }, "fetching top owners");
  const data = await HhdbDashboardCollection.getTopOwners(limit, islandCode);
  log.info({ count: data.length }, "top owners fetched");
  return data;
}

export async function getConcentrationByIsland() {
  log.info("fetching concentration by island");
  const data = await HhdbDashboardCollection.getConcentrationByIsland();
  log.info({ count: data.length }, "concentration by island fetched");
  return data;
}
