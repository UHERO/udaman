import "server-only";

import { createLogger } from "@/core/observability/logger";
import type { HhdbListParams } from "../types/hhdb";
import HhdbPropertyCollection from "../collections/hhdb-property-collection";
import HhdbAssessmentCollection from "../collections/hhdb-assessment-collection";
import HhdbSaleCollection from "../collections/hhdb-sale-collection";
import HhdbImprovementCollection from "../collections/hhdb-improvement-collection";
import HhdbPermitCollection from "../collections/hhdb-permit-collection";
import HhdbCondoCollection from "../collections/hhdb-condo-collection";
import HhdbDashboardCollection from "../collections/hhdb-dashboard-collection";
import HhdbFactorCollection from "../collections/hhdb-factor-collection";
import HhdbParcelCollection from "../collections/hhdb-parcel-collection";
import HhdbOwnerCollection from "../collections/hhdb-owner-collection";
import HhdbAppealCollection from "../collections/hhdb-appeal-collection";
import HhdbDedicationCollection from "../collections/hhdb-dedication-collection";
import HhdbLandClassificationCollection from "../collections/hhdb-land-classification-collection";
import HhdbCurrentTaxBillCollection from "../collections/hhdb-current-tax-bill-collection";
import HhdbHistoricalTaxSummaryCollection from "../collections/hhdb-historical-tax-summary-collection";
import HhdbHistoricalTaxDetailCollection from "../collections/hhdb-historical-tax-detail-collection";
import HhdbHistoricalTaxPaymentCollection from "../collections/hhdb-historical-tax-payment-collection";
import HhdbHistoricalTaxCreditCollection from "../collections/hhdb-historical-tax-credit-collection";
import HhdbAgriculturalAssessmentCollection from "../collections/hhdb-agricultural-assessment-collection";
import HhdbCommercialDetailCollection from "../collections/hhdb-commercial-detail-collection";
import HhdbResidentialAdditionCollection from "../collections/hhdb-residential-addition-collection";
import HhdbAccessoryStructureCollection from "../collections/hhdb-accessory-structure-collection";
import HhdbYardImprovementCollection from "../collections/hhdb-yard-improvement-collection";

const log = createLogger("hhdb");

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

export async function getFactors(table: string, column: string) {
  log.info({ table, column }, "fetching hhdb factors");
  const result = await HhdbFactorCollection.getFactors(table, column);
  log.info({ table, column, type: result.type }, "hhdb factors fetched");
  return result;
}
