/**
 * QPub Extract — Phase 2 of the rebuild pipeline.
 *
 * Reads parsed JSON for each TMK and writes flat JSONL files
 * (one per DB table) into a staging directory.
 *
 * Parent-child tables (commercial_improvements, historical_tax,
 * condominium) use sequential IDs assigned during extraction so
 * the load phase can INSERT them directly without roundtrips.
 *
 * Output files are newline-delimited JSON arrays:
 *   ["val1","val2",null,3]
 *   ["val1","val2","val3",4]
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

import { getIslandCode } from "@/core/crawlers/qpub/config";
import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import {
  dec,
  GENERIC_SECTION_MAP,
  getAssessmentPropertyClass,
  int,
  parseDateValue,
  sqlDate,
  str,
  unitParcelToTmk,
  type Row,
} from "./qpub-load";

// ─── Types ──────────────────────────────────────────────────────────

export type ExtractItem = {
  tmk: string;
  data: ParsedProperty;
  scrapedAt: Date;
  observedYear: number;
};

type SqlValue = string | number | null;

// ─── Column Definitions ─────────────────────────────────────────────

export const TABLE_COLUMNS: Record<string, string[]> = {
  properties: [
    "tmk",
    "island_code",
    "parcel_number",
    "location_address",
    "address_other",
    "project_name",
    "legal_information",
    "property_class",
    "land_area_sqft",
    "land_area_acres",
    "neighborhood_code",
    "zoning",
    "parcel_note",
    "damage",
    "reentry_zone",
    "zone_color",
    "non_taxable_status",
    "living_units",
    "map_url",
    "sketch_url",
  ],
  parcels: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "parcel_number",
    "location_address",
    "address_other",
    "project_name",
    "legal_information",
    "property_class",
    "land_area_sqft",
    "land_area_acres",
    "neighborhood_code",
    "zoning",
    "parcel_note",
    "damage",
    "reentry_zone",
    "zone_color",
    "non_taxable_status",
    "living_units",
  ],
  owners: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "owner_name",
    "owner_type",
    "owner_address",
    "sequence_order",
  ],
  assessments: [
    "tmk",
    "scraped_at",
    "tax_year",
    "property_class",
    "assessed_land_value",
    "assessed_building_value",
    "dedicated_use_value",
    "land_exemption",
    "building_exemption",
    "net_taxable_land_value",
    "net_taxable_building_value",
    "total_property_assessed_value",
    "total_property_exemption",
    "total_net_taxable_value",
    "agricultural_land_value",
    "market_land_value",
    "market_building_value",
    "total_market_value",
  ],
  land_classifications: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "land_classification",
    "square_footage",
    "acreage",
    "agricultural_use_indicator",
  ],
  residential_improvements: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "building_number",
    "year_built",
    "eff_year_built",
    "living_area",
    "bedrooms",
    "full_bath",
    "half_bath",
    "occupancy",
    "framing",
    "percent_complete",
    "heating_cooling",
    "exterior_wall",
    "roof_material",
    "fireplace",
    "grade",
    "building_value",
    "total_room_count",
    "condo_style",
    "condo_view",
    "floor_level",
    "parking_spaces",
  ],
  commercial_improvements: [
    "id",
    "tmk",
    "scraped_at",
    "last_year_observed",
    "building_number",
    "building_card",
    "year_built",
    "effective_year_built",
    "improvement_name",
    "property_class",
    "structure_type",
    "units",
    "identical_units",
    "gross_building_description",
    "building_type",
    "building_square_footage",
    "percent_complete",
    "value",
  ],
  commercial_improvement_details: [
    "commercial_improvement_id",
    "tmk",
    "scraped_at",
    "last_year_observed",
    "card",
    "section",
    "floor",
    "usage",
    "area",
    "perimeter",
    "exterior_wall",
    "wall_height",
    "occupancy",
  ],
  sales: [
    "tmk",
    "sale_date",
    "sale_amount",
    "instrument",
    "instrument_type",
    "instrument_description",
    "valid_sale",
    "date_of_recording",
    "land_court_document_number",
    "cert",
    "book_page",
    "conveyance_tax",
  ],
  permits: ["tmk", "permit_date", "permit_number", "reason", "permit_amount"],
  current_tax_bills: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "tax_period",
    "description",
    "original_due_date",
    "taxes_assessment",
    "tax_credits",
    "net_tax",
    "penalty",
    "interest",
    "other",
    "amount_due",
  ],
  historical_tax_summary: [
    "id",
    "tmk",
    "scraped_at",
    "year",
    "tax",
    "payments_and_credits",
    "penalty",
    "interest",
    "other",
    "amount_due",
    "tax_details_total_tax",
    "tax_details_total_payments_credits",
    "tax_details_total_penalty",
    "tax_details_total_interest",
    "tax_details_total_other",
    "tax_payments_total_tax",
    "tax_payments_total_penalty",
    "tax_payments_total_interest",
    "tax_payments_total_other",
    "tax_credits_total_amount",
  ],
  historical_tax_details: [
    "historical_tax_summary_id",
    "tmk",
    "scraped_at",
    "tax_period",
    "description",
    "tax",
    "payments_credits",
    "penalty",
    "interest",
    "other",
  ],
  historical_tax_payments: [
    "historical_tax_summary_id",
    "tmk",
    "scraped_at",
    "payment_sequence",
    "effective_date",
    "tax",
    "penalty",
    "interest",
    "other",
  ],
  historical_tax_credits: [
    "historical_tax_summary_id",
    "tmk",
    "scraped_at",
    "period",
    "description",
    "amount",
  ],
  condominium_projects: ["tmk", "project_name", "unit_count"],
  // Stub properties for condo units (INSERT IGNORE)
  condo_stub_properties: ["tmk", "island_code"],
  condominium_units: ["tmk", "parent_tmk", "unit_number", "owner_name"],
  // Generic section tables (fixed column definitions)
  yard_improvements: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "description",
    "quantity",
    "year_built",
    "area",
  ],
  residential_additions: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "card",
    "line",
    "lower",
    "first",
    "second",
    "third",
    "area",
  ],
  agricultural_assessments: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "acres",
    "acres_in_production",
    "agricultural_type",
    "agricultural_value",
    "assessed_value",
    "description",
    "use_description",
  ],
  accessory_structures: [
    "tmk",
    "scraped_at",
    "last_year_observed",
    "building_number",
    "description",
    "dimensions_units",
    "percent_complete",
    "value",
    "year_built",
  ],
  appeals: [
    "tmk",
    "scraped_at",
    "year",
    "appeal_type_value",
    "scheduled_hearing_date_subject_to_change",
    "status",
    "date_settled",
    "final_value",
    "tax_payer_opinion_of_value",
    "tax_payer_opinion_of_property_class",
    "tax_payer_opinion_of_exemptions",
  ],
  dedications: ["tmk", "scraped_at", "tax_year", "number_of_dedications"],
};

// ─── Counters for auto-increment IDs ───────────────────────────────

let nextCommercialId = 1;
let nextHistoricalTaxSummaryId = 1;

export function resetIdCounters(): void {
  nextCommercialId = 1;
  nextHistoricalTaxSummaryId = 1;
}

// ─── Extract Functions ──────────────────────────────────────────────

function extractProperties(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data } of items) {
    const parcel = data.parcel_information as Row | undefined;
    if (!parcel) continue;

    const islandCode = getIslandCode(tmk);
    const mapSection = data.map as Row | undefined;
    const sketchSection = data.sketch as Row | undefined;
    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ??
      [])[0];
    const projectName =
      str(parcel.project_name) ?? str(firstBuilding?.condo_name);
    const propertyClass =
      str(parcel.property_class) ?? getAssessmentPropertyClass(data);

    rows.push([
      tmk,
      islandCode,
      str(parcel.parcel_number),
      str(parcel.location_address),
      str(parcel.address_other),
      projectName,
      str(parcel.legal_information),
      propertyClass,
      int(parcel.land_area_approximate_sq_ft),
      dec(parcel.land_area_acres),
      str(parcel.neighborhood_code),
      str(parcel.zoning),
      str(parcel.parcel_note),
      str(parcel.damage),
      str(parcel.reentry_zone),
      str(parcel.zone_color),
      str(parcel.non_taxable_status),
      str(parcel.living_units),
      str(mapSection?.map_url),
      str(sketchSection?.sketch_url),
    ]);
  }
  return rows;
}

function extractParcels(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const parcel = data.parcel_information as Row | undefined;
    if (!parcel) continue;

    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ??
      [])[0];
    const projectName =
      str(parcel.project_name) ?? str(firstBuilding?.condo_name);
    const propertyClass =
      str(parcel.property_class) ?? getAssessmentPropertyClass(data);

    rows.push([
      tmk,
      sqlDate(scrapedAt),
      observedYear,
      str(parcel.parcel_number),
      str(parcel.location_address),
      str(parcel.address_other),
      projectName,
      str(parcel.legal_information),
      propertyClass,
      int(parcel.land_area_approximate_sq_ft),
      dec(parcel.land_area_acres),
      str(parcel.neighborhood_code),
      str(parcel.zoning),
      str(parcel.parcel_note),
      str(parcel.damage),
      str(parcel.reentry_zone),
      str(parcel.zone_color),
      str(parcel.non_taxable_status),
      str(parcel.living_units),
    ]);
  }
  return rows;
}

function extractOwners(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const ownerInfo = data.owner_information as Row | undefined;
    if (!ownerInfo?.all_owners) continue;
    const owners = ownerInfo.all_owners as Row[];
    for (let i = 0; i < owners.length; i++) {
      const o = owners[i];
      rows.push([
        tmk,
        sqlDate(scrapedAt),
        observedYear,
        str(o.owner_name),
        str(o.owner_type),
        str(o.owner_address),
        i + 1,
      ]);
    }
  }
  return rows;
}

function extractAssessments(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt } of items) {
    const assessInfo = data.assessment_information as Row | undefined;
    if (!assessInfo) continue;
    const current = (assessInfo.current_assessments as Row[]) ?? [];
    const historical = (assessInfo.historical_assessments as Row[]) ?? [];
    const scrapedAtStr = sqlDate(scrapedAt);
    for (const a of [...current, ...historical]) {
      const taxYear = int(a.tax_year);
      if (!taxYear) continue;
      rows.push([
        tmk,
        scrapedAtStr,
        taxYear,
        str(a.property_class),
        int(a.assessed_land_value),
        int(a.assessed_building_value),
        int(a.dedicated_use_value),
        int(a.land_exemption),
        int(a.building_exemption),
        int(a.net_taxable_land_value),
        int(a.net_taxable_building_value),
        int(a.total_property_assessed_value),
        int(a.total_property_exemption),
        int(a.total_net_taxable_value),
        int(a.agricultural_land_value),
        int(a.market_land_value),
        int(a.market_building_value),
        int(a.total_market_value),
      ]);
    }
  }
  return rows;
}

function extractLandClassifications(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const landInfo = data.land_information as Row | undefined;
    if (!landInfo?.land_classifications) continue;
    const classifications = landInfo.land_classifications as Row[];
    const scrapedAtStr = sqlDate(scrapedAt);
    for (const c of classifications) {
      rows.push([
        tmk,
        scrapedAtStr,
        observedYear,
        str(c.land_classification),
        str(c.square_footage),
        str(c.acreage),
        str(c.agricultural_use_indicator),
      ]);
    }
  }
  return rows;
}

function extractResidentialImprovements(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    if (!improvInfo) continue;
    const buildings = (improvInfo.buildings as Row[] | undefined) ?? [];
    const scrapedAtStr = sqlDate(scrapedAt);
    for (const b of buildings) {
      rows.push([
        tmk,
        scrapedAtStr,
        observedYear,
        str(b.building_number),
        str(b.year_built),
        str(b.eff_year_built),
        int(b.living_area),
        int(b.bedrooms),
        int(b.full_bath),
        int(b.half_bath),
        str(b.occupancy),
        str(b.framing),
        str(b.percent_complete),
        str(b.heating_cooling),
        str(b.exterior_wall),
        str(b.roof_material),
        str(b.fireplace),
        str(b.grade),
        str(b.building_value),
        str(b.total_room_count),
        str(b.condo_style ?? b.condo_type),
        str(b.condo_view),
        str(b.floor_level ?? b.condo_floor_number),
        str(b.parking_spaces),
      ]);
    }
  }
  return rows;
}

function extractSales(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data } of items) {
    const salesInfo =
      (data.sales_information as Row | undefined) ??
      (data.conveyance_information as Row | undefined);
    if (!salesInfo?.sales) continue;
    for (const s of salesInfo.sales as Row[]) {
      rows.push([
        tmk,
        parseDateValue(str(s.sale_date)),
        int(s.sale_amount),
        str(s.instrument),
        str(s.instrument_type),
        str(s.instrument_description),
        str(s.valid_sale),
        parseDateValue(str(s.date_of_recording)),
        str(s.land_court_document_number),
        str(s.cert),
        str(s.book_page),
        dec(s.conveyance_tax),
      ]);
    }
  }
  return rows;
}

function extractPermits(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data } of items) {
    const permitInfo = data.permit_information as Row | undefined;
    if (!permitInfo) continue;
    for (const p of (permitInfo.table_data ?? []) as Row[]) {
      const permitNumber = str(p.permit_number) ?? str(p.permit_);
      if (!permitNumber) continue;
      rows.push([
        tmk,
        parseDateValue(str(p.permit_date) ?? str(p.date)),
        permitNumber,
        str(p.reason) ?? str(p.description),
        int(p.permit_amount) ?? int(p.amount),
      ]);
    }
  }
  return rows;
}

function extractCurrentTaxBills(items: ExtractItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];
  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const taxBillInfo = data.current_tax_bill_information as Row | undefined;
    if (!taxBillInfo) continue;
    const bills = (taxBillInfo.table_data ?? []) as Row[];
    const scrapedAtStr = sqlDate(scrapedAt);
    for (const b of bills) {
      rows.push([
        tmk,
        scrapedAtStr,
        observedYear,
        str(b.tax_period),
        str(b.description),
        parseDateValue(str(b.original_due_date)),
        dec(b.taxes_assessment) ?? dec(b.taxes),
        dec(b.tax_credits) ?? dec(b.credits),
        dec(b.net_tax),
        dec(b.penalty),
        dec(b.interest),
        dec(b.other),
        dec(b.amount_due),
      ]);
    }
  }
  return rows;
}

/**
 * Extract commercial improvements with sequential parent IDs.
 * Returns rows for both commercial_improvements and commercial_improvement_details.
 */
function extractCommercialImprovements(items: ExtractItem[]): {
  parents: SqlValue[][];
  details: SqlValue[][];
} {
  const parents: SqlValue[][] = [];
  const details: SqlValue[][] = [];

  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const ciInfo = data.commercial_improvement_information as Row | undefined;
    if (!ciInfo) continue;
    const buildings = (ciInfo.buildings as Row[] | undefined) ?? [];
    const scrapedAtStr = sqlDate(scrapedAt);

    for (const b of buildings) {
      const parentId = nextCommercialId++;
      parents.push([
        parentId,
        tmk,
        scrapedAtStr,
        observedYear,
        str(b.building_number),
        str(b.building_card),
        int(b.year_built),
        int(b.effective_year_built),
        str(b.improvement_name),
        str(b.property_class),
        str(b.structure_type),
        str(b.units),
        str(b.identical_units),
        str(b.gross_building_description),
        str(b.building_type),
        str(b.building_square_footage),
        str(b.percent_complete),
        int(b.value),
      ]);

      for (const d of (b.floor_details as Row[] | undefined) ?? []) {
        details.push([
          parentId,
          tmk,
          scrapedAtStr,
          observedYear,
          str(d.card),
          str(d.section),
          str(d.floor),
          str(d.usage),
          str(d.area),
          str(d.perimeter),
          str(d.exterior_wall),
          str(d.wall_height),
          str(d.occupancy),
        ]);
      }
    }
  }

  return { parents, details };
}

/**
 * Extract historical tax data with sequential summary IDs.
 * Returns rows for summary, details, payments, and credits.
 */
function extractHistoricalTax(items: ExtractItem[]): {
  summaries: SqlValue[][];
  details: SqlValue[][];
  payments: SqlValue[][];
  credits: SqlValue[][];
} {
  const summaries: SqlValue[][] = [];
  const details: SqlValue[][] = [];
  const payments: SqlValue[][] = [];
  const credits: SqlValue[][] = [];

  for (const { tmk, data, scrapedAt } of items) {
    const taxInfo = data.historical_tax_information as Row | undefined;
    if (!taxInfo?.tax_summary) continue;
    const scrapedAtStr = sqlDate(scrapedAt);

    for (const summary of taxInfo.tax_summary as Row[]) {
      const year = int(summary.year);
      if (!year) continue;

      const summaryId = nextHistoricalTaxSummaryId++;
      const detailTotals = (summary.tax_details_totals ?? {}) as Row;
      const paymentTotals = (summary.tax_payments_totals ?? {}) as Row;
      const creditTotals = (summary.tax_credits_totals ?? {}) as Row;

      summaries.push([
        summaryId,
        tmk,
        scrapedAtStr,
        year,
        dec(summary.tax),
        dec(summary.payments_and_credits),
        dec(summary.penalty),
        dec(summary.interest),
        dec(summary.other),
        dec(summary.amount_due),
        dec(detailTotals.total_tax),
        dec(detailTotals.total_payments_credits),
        dec(detailTotals.total_penalty),
        dec(detailTotals.total_interest),
        dec(detailTotals.total_other),
        dec(paymentTotals.total_tax),
        dec(paymentTotals.total_penalty),
        dec(paymentTotals.total_interest),
        dec(paymentTotals.total_other),
        dec(creditTotals.total_amount),
      ]);

      for (const d of (summary.tax_details ?? []) as Row[]) {
        details.push([
          summaryId,
          tmk,
          scrapedAtStr,
          str(d.tax_period),
          str(d.description),
          dec(d.tax),
          dec(d.payments_credits),
          dec(d.penalty),
          dec(d.interest),
          dec(d.other),
        ]);
      }

      for (const p of (summary.tax_payments ?? []) as Row[]) {
        payments.push([
          summaryId,
          tmk,
          scrapedAtStr,
          str(p.payment_sequence),
          parseDateValue(str(p.effective_date)),
          dec(p.tax),
          dec(p.penalty),
          dec(p.interest),
          dec(p.other),
        ]);
      }

      for (const c of (summary.tax_credits ?? []) as Row[]) {
        credits.push([
          summaryId,
          tmk,
          scrapedAtStr,
          str(c.period),
          str(c.description),
          dec(c.amount),
        ]);
      }
    }
  }

  return { summaries, details, payments, credits };
}

/**
 * Extract condominium data.
 * Returns rows for projects, stub properties, and units.
 */
function extractCondominium(items: ExtractItem[]): {
  projects: SqlValue[][];
  stubProperties: SqlValue[][];
  units: SqlValue[][];
} {
  const projects: SqlValue[][] = [];
  const stubProperties: SqlValue[][] = [];
  const units: SqlValue[][] = [];

  for (const { tmk, data } of items) {
    if (data.status !== "condo_project") continue;

    const parcel = data.parcel_information as Row | undefined;
    const unitInfo = data.condominium_apartment_unit_information as
      | Row
      | undefined;
    const unitRows = (unitInfo?.table_data ?? []) as Row[];
    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ??
      [])[0];
    const projectName =
      str(parcel?.project_name) ?? str(firstBuilding?.condo_name);

    projects.push([tmk, projectName, unitRows.length || null]);

    const islandCode = getIslandCode(tmk);
    for (const unit of unitRows) {
      const unitParcel = str(unit.parcel_number);
      if (!unitParcel) continue;
      const unitTmk = unitParcelToTmk(tmk, unitParcel);
      stubProperties.push([unitTmk, islandCode]);
      units.push([unitTmk, tmk, str(unit.unit_number), str(unit.owner_name)]);
    }
  }

  return { projects, stubProperties, units };
}

/**
 * Extract a generic section using the fixed column list from TABLE_COLUMNS.
 * Every row is mapped to the same column order — missing fields get null.
 */
function extractGenericSection(
  items: ExtractItem[],
  sectionName: string,
  tableName: string,
): SqlValue[][] {
  const columns = TABLE_COLUMNS[tableName];
  if (!columns) return [];

  const columnSet = new Set(columns);
  const hasScrapedAt = columnSet.has("scraped_at");
  const hasLastYearObserved = columnSet.has("last_year_observed");
  const allRows: SqlValue[][] = [];

  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    const rows =
      (sectionData.table_data as Row[] | undefined) ??
      (Array.isArray(sectionData) ? sectionData : [sectionData]);

    for (const row of rows) {
      const matched: Record<string, SqlValue> = { tmk };
      if (hasScrapedAt) matched.scraped_at = sqlDate(scrapedAt);
      if (hasLastYearObserved) matched.last_year_observed = observedYear;

      for (const [key, value] of Object.entries(row)) {
        const snakeKey = key
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_");
        if (
          columnSet.has(snakeKey) &&
          snakeKey !== "tmk" &&
          snakeKey !== "scraped_at" &&
          snakeKey !== "last_year_observed"
        ) {
          matched[snakeKey] =
            value === null || value === undefined ? null : String(value);
        }
      }

      // Map to fixed column order — missing columns get null
      allRows.push(columns.map((col) => matched[col] ?? null));
    }
  }

  return allRows;
}

// ─── File Writers ───────────────────────────────────────────────────

function appendRows(filePath: string, rows: SqlValue[][]): void {
  if (rows.length === 0) return;
  const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  appendFileSync(filePath, lines);
}

function tablePath(stagingDir: string, table: string): string {
  return path.join(stagingDir, `${table}.jsonl`);
}

// ─── Main Extract ───────────────────────────────────────────────────

/**
 * Extract a batch of items and append rows to table JSONL files.
 *
 * Call this repeatedly for each batch of parsed TMKs.
 * The staging directory must exist and files should be initialized
 * (truncated) before the first call.
 */
export function extractBatch(items: ExtractItem[], stagingDir: string): void {
  // Simple tables
  appendRows(tablePath(stagingDir, "properties"), extractProperties(items));
  appendRows(tablePath(stagingDir, "parcels"), extractParcels(items));
  appendRows(tablePath(stagingDir, "owners"), extractOwners(items));
  appendRows(tablePath(stagingDir, "assessments"), extractAssessments(items));
  appendRows(
    tablePath(stagingDir, "land_classifications"),
    extractLandClassifications(items),
  );
  appendRows(
    tablePath(stagingDir, "residential_improvements"),
    extractResidentialImprovements(items),
  );
  appendRows(tablePath(stagingDir, "sales"), extractSales(items));
  appendRows(tablePath(stagingDir, "permits"), extractPermits(items));
  appendRows(
    tablePath(stagingDir, "current_tax_bills"),
    extractCurrentTaxBills(items),
  );

  // Commercial improvements (parent-child with sequential IDs)
  const ci = extractCommercialImprovements(items);
  appendRows(tablePath(stagingDir, "commercial_improvements"), ci.parents);
  appendRows(
    tablePath(stagingDir, "commercial_improvement_details"),
    ci.details,
  );

  // Historical tax (parent-child with sequential IDs)
  const ht = extractHistoricalTax(items);
  appendRows(tablePath(stagingDir, "historical_tax_summary"), ht.summaries);
  appendRows(tablePath(stagingDir, "historical_tax_details"), ht.details);
  appendRows(tablePath(stagingDir, "historical_tax_payments"), ht.payments);
  appendRows(tablePath(stagingDir, "historical_tax_credits"), ht.credits);

  // Condominium
  const condo = extractCondominium(items);
  appendRows(tablePath(stagingDir, "condominium_projects"), condo.projects);
  appendRows(
    tablePath(stagingDir, "condo_stub_properties"),
    condo.stubProperties,
  );
  appendRows(tablePath(stagingDir, "condominium_units"), condo.units);

  // Generic sections (use fixed columns from TABLE_COLUMNS)
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    if (!TABLE_COLUMNS[tableName]) continue;
    const rows = extractGenericSection(items, sectionName, tableName);
    appendRows(tablePath(stagingDir, tableName), rows);
  }
}

/**
 * Initialize the staging directory — creates it and truncates all table files.
 */
export function initStagingDir(stagingDir: string): void {
  if (!existsSync(stagingDir)) {
    mkdirSync(stagingDir, { recursive: true });
  }

  // Truncate all known table files
  const allTables = [
    "properties",
    "parcels",
    "owners",
    "assessments",
    "land_classifications",
    "residential_improvements",
    "commercial_improvements",
    "commercial_improvement_details",
    "sales",
    "permits",
    "current_tax_bills",
    "historical_tax_summary",
    "historical_tax_details",
    "historical_tax_payments",
    "historical_tax_credits",
    "condominium_projects",
    "condo_stub_properties",
    "condominium_units",
    "yard_improvements",
    "residential_additions",
    "agricultural_assessments",
    "accessory_structures",
    "appeals",
    "dedications",
  ];

  for (const table of allTables) {
    writeFileSync(tablePath(stagingDir, table), "");
  }
  // Generic section files are created on first write
}

/** Default staging directory */
export const DEFAULT_STAGING_DIR = "/tmp/hhdb-extract";
