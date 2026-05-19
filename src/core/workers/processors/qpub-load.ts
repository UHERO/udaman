import { existsSync, readFileSync } from "fs";
import path from "path";

import type { Job } from "bullmq";

import {
  getIslandCode,
  getJsonPath,
  PERIOD_WHERE,
} from "@/core/crawlers/qpub/config";
import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { parseDollarValue } from "@/core/crawlers/qpub/parse-utils";
import { insertAndGetId, rawQuery } from "@/lib/mysql/hhdb";

import type { QpubLoadJobData } from "../queues";

// ─── Helpers ─────────────────────────────────────────────────────

/** Parse a date string like "01/15/2024" or "2024-01-15" into a Date-compatible string, or null */
function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;

  // Try MM/DD/YYYY format
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  return null;
}

/** Get string or null, trimmed */
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

/** Get integer or null */
function int(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseDollarValue(v as string | number, true);
  return n;
}

/** Get decimal or null */
function dec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseDollarValue(v as string | number, false);
  return n;
}

type Row = Record<string, unknown>;

/** Extract property_class from the most recent assessment record. */
function getAssessmentPropertyClass(data: ParsedProperty): string | null {
  const assessInfo = data.assessment_information as Row | undefined;
  if (!assessInfo) return null;
  const current = (assessInfo.current_assessments as Row[] | undefined) ?? [];
  if (current.length > 0 && current[0].property_class) {
    return str(current[0].property_class);
  }
  const historical =
    (assessInfo.historical_assessments as Row[] | undefined) ?? [];
  if (historical.length > 0 && historical[0].property_class) {
    return str(historical[0].property_class);
  }
  return null;
}

/**
 * Compute the scrape period for a given date.
 * For use in SQL period-based dedup. Uses the same logic as PERIOD_WHERE:
 * months 1–7 → period 1, months 8–12 → period 2.
 */
function periodString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month <= 7 ? "1" : "2"}`;
}

/** Delete snapshot records matching tmk + scrape period */
async function deletePeriodSnapshot(
  tableName: string,
  tmk: string,
  scrapedAt: Date,
): Promise<void> {
  const period = periodString(scrapedAt);
  await rawQuery(
    `DELETE FROM ${tableName} WHERE tmk=? AND ${PERIOD_WHERE} = ?`,
    [tmk, period],
  );
}

/** Format a Date for SQL insertion (YYYY-MM-DD HH:MM:SS) */
function sqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// ─── Section loaders ─────────────────────────────────────────────

export async function loadProperties(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  const parcel = data.parcel_information as Row | undefined;
  if (!parcel) return;

  const islandCode = getIslandCode(tmk);
  const mapSection = data.map as Row | undefined;
  const sketchSection = data.sketch as Row | undefined;

  // For Maui condo units, project_name is in the Improvement Information
  // section as "Condo Name" rather than in Parcel Information
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
  const projectName =
    str(parcel.project_name) ?? str(firstBuilding?.condo_name);

  // Maui doesn't list property_class in Parcel Information — pull from assessments
  const propertyClass =
    str(parcel.property_class) ?? getAssessmentPropertyClass(data);

  await rawQuery(
    `INSERT INTO properties (tmk, island_code,
       parcel_number, location_address, address_other,
       project_name, legal_information, property_class,
       land_area_sqft, land_area_acres,
       neighborhood_code, zoning, parcel_note,
       damage, reentry_zone, zone_color,
       non_taxable_status, living_units,
       map_url, sketch_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       parcel_number=VALUES(parcel_number), location_address=VALUES(location_address),
       address_other=VALUES(address_other), project_name=VALUES(project_name),
       legal_information=VALUES(legal_information), property_class=VALUES(property_class),
       land_area_sqft=VALUES(land_area_sqft), land_area_acres=VALUES(land_area_acres),
       neighborhood_code=VALUES(neighborhood_code), zoning=VALUES(zoning),
       parcel_note=VALUES(parcel_note), damage=VALUES(damage),
       reentry_zone=VALUES(reentry_zone), zone_color=VALUES(zone_color),
       non_taxable_status=VALUES(non_taxable_status), living_units=VALUES(living_units),
       map_url=VALUES(map_url), sketch_url=VALUES(sketch_url),
       updated_at=NOW()`,
    [
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
    ],
  );
}

export async function loadParcels(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const parcel = data.parcel_information as Row | undefined;
  if (!parcel) return;

  // For Maui condo units, project_name is in Improvement Information as "Condo Name"
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
  const projectName =
    str(parcel.project_name) ?? str(firstBuilding?.condo_name);

  // Maui doesn't list property_class in Parcel Information — pull from assessments
  const propertyClass =
    str(parcel.property_class) ?? getAssessmentPropertyClass(data);

  // Delete same-period records for this TMK
  await deletePeriodSnapshot("parcels", tmk, scrapedAt);

  await rawQuery(
    `INSERT INTO parcels (tmk, scraped_at, parcel_number, location_address, address_other,
       project_name, legal_information, property_class, land_area_sqft, land_area_acres,
       neighborhood_code, zoning, parcel_note, damage, reentry_zone, zone_color,
       non_taxable_status, living_units)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tmk,
      sqlDate(scrapedAt),
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
    ],
  );
}

export async function loadOwners(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const ownerInfo = data.owner_information as Row | undefined;
  if (!ownerInfo?.all_owners) return;

  const owners = ownerInfo.all_owners as Row[];
  if (owners.length === 0) return;

  // Delete same-period records
  await deletePeriodSnapshot("owners", tmk, scrapedAt);

  for (let i = 0; i < owners.length; i++) {
    const o = owners[i];
    await rawQuery(
      `INSERT INTO owners (tmk, scraped_at, owner_name, owner_type, owner_address, sequence_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tmk,
        sqlDate(scrapedAt),
        str(o.owner_name),
        str(o.owner_type),
        str(o.owner_address),
        i + 1,
      ],
    );
  }
}

export async function loadAssessments(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  const assessInfo = data.assessment_information as Row | undefined;
  if (!assessInfo) return;

  const current = (assessInfo.current_assessments as Row[]) ?? [];
  const historical = (assessInfo.historical_assessments as Row[]) ?? [];
  const allAssessments = [...current, ...historical];

  if (allAssessments.length === 0) return;

  // Collect all tax years being scraped
  const taxYears = allAssessments
    .map((a) => int(a.tax_year))
    .filter((y): y is number => y !== null);

  if (taxYears.length === 0) return;

  // Delete only the years covered by this scrape
  const placeholders = taxYears.map(() => "?").join(",");
  await rawQuery(
    `DELETE FROM assessments WHERE tmk=? AND tax_year IN (${placeholders})`,
    [tmk, ...taxYears],
  );

  for (const a of allAssessments) {
    const taxYear = int(a.tax_year);
    if (!taxYear) continue;

    await rawQuery(
      `INSERT INTO assessments (tmk, tax_year, property_class,
         assessed_land_value, assessed_building_value, dedicated_use_value,
         land_exemption, building_exemption,
         net_taxable_land_value, net_taxable_building_value,
         total_property_assessed_value, total_property_exemption, total_net_taxable_value,
         agricultural_land_value, market_land_value, market_building_value, total_market_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
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
      ],
    );
  }
}

export async function loadLandClassifications(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const landInfo = data.land_information as Row | undefined;
  if (!landInfo?.land_classifications) return;

  const classifications = landInfo.land_classifications as Row[];
  if (classifications.length === 0) return;

  await deletePeriodSnapshot("land_classifications", tmk, scrapedAt);

  for (const c of classifications) {
    await rawQuery(
      `INSERT INTO land_classifications (tmk, scraped_at, land_classification, square_footage, acreage, agricultural_use_indicator)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tmk,
        sqlDate(scrapedAt),
        str(c.land_classification),
        str(c.square_footage),
        str(c.acreage),
        str(c.agricultural_use_indicator),
      ],
    );
  }
}

export async function loadResidentialImprovements(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  // Check both section names (Honolulu/Hawaii vs Maui/Kauai)
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  if (!improvInfo) return;

  const buildings = (improvInfo.buildings as Row[] | undefined) ?? [];
  if (buildings.length === 0) return;

  await deletePeriodSnapshot("residential_improvements", tmk, scrapedAt);

  for (const b of buildings) {
    await rawQuery(
      `INSERT INTO residential_improvements (tmk, scraped_at,
         building_number, year_built, eff_year_built, living_area,
         bedrooms, full_bath, half_bath,
         occupancy, framing, percent_complete, heating_cooling,
         exterior_wall, roof_material, fireplace, grade, building_value, total_room_count,
         condo_style, condo_view, floor_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
        sqlDate(scrapedAt),
        str(b.building_number),
        str(b.year_built),
        str(b.eff_year_built),
        str(b.living_area),
        str(b.bedrooms),
        str(b.full_bath),
        str(b.half_bath),
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
        str(b.condo_type),
        str(b.condo_view),
        str(b.condo_floor_number),
      ],
    );
  }
}

export async function loadCommercialImprovements(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const ciInfo = data.commercial_improvement_information as Row | undefined;
  if (!ciInfo) return;

  const buildings = (ciInfo.buildings as Row[] | undefined) ?? [];
  if (buildings.length === 0) return;

  await deletePeriodSnapshot("commercial_improvement_details", tmk, scrapedAt);
  await deletePeriodSnapshot("commercial_improvements", tmk, scrapedAt);

  const scrapedAtStr = sqlDate(scrapedAt);

  for (const b of buildings) {
    const improvementId = await insertAndGetId(
      `INSERT INTO commercial_improvements (tmk, scraped_at,
         building_number, building_card, year_built, effective_year_built,
         improvement_name, property_class, structure_type, units, identical_units,
         gross_building_description, building_type, building_square_footage,
         percent_complete, value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
        scrapedAtStr,
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
      ],
    );

    const floorDetails = (b.floor_details as Row[] | undefined) ?? [];

    if (floorDetails.length > 0) {

      for (const d of floorDetails) {
        await rawQuery(
          `INSERT INTO commercial_improvement_details
             (commercial_improvement_id, tmk, scraped_at,
              card, section, floor, \`usage\`, area, perimeter,
              exterior_wall, wall_height, occupancy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            improvementId,
            tmk,
            scrapedAtStr,
            str(d.card),
            str(d.section),
            str(d.floor),
            str(d.usage),
            str(d.area),
            str(d.perimeter),
            str(d.exterior_wall),
            str(d.wall_height),
            str(d.usage),
          ],
        );
      }
    }
  }
}

export async function loadSales(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  const salesInfo =
    (data.sales_information as Row | undefined) ??
    (data.conveyance_information as Row | undefined);
  if (!salesInfo?.sales) return;

  const sales = salesInfo.sales as Row[];

  for (const s of sales) {
    const saleDate = parseDateValue(str(s.sale_date));
    const instrument = str(s.instrument);

    // Only insert if not already exists (by tmk + sale_date + instrument)
    const existing = await rawQuery(
      `SELECT id FROM sales WHERE tmk=? AND sale_date=? AND instrument=? LIMIT 1`,
      [tmk, saleDate, instrument],
    );

    if (existing.length === 0) {
      await rawQuery(
        `INSERT INTO sales (tmk, sale_date, sale_amount, instrument, instrument_type,
           instrument_description, valid_sale, date_of_recording,
           land_court_document_number, cert, book_page, conveyance_tax)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tmk,
          saleDate,
          int(s.sale_amount),
          instrument,
          str(s.instrument_type),
          str(s.instrument_description),
          str(s.valid_sale),
          parseDateValue(str(s.date_of_recording)),
          str(s.land_court_document_number),
          str(s.cert),
          str(s.book_page),
          dec(s.conveyance_tax),
        ],
      );
    }
  }
}

export async function loadHistoricalTax(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  const taxInfo = data.historical_tax_information as Row | undefined;
  if (!taxInfo?.tax_summary) return;

  const summaries = taxInfo.tax_summary as Row[];
  if (summaries.length === 0) return;

  // Collect years from this scrape
  const years = summaries
    .map((s) => int(s.year))
    .filter((y): y is number => y !== null);

  if (years.length === 0) return;

  // Delete scraped years (ON DELETE CASCADE handles nested details/payments/credits)
  const placeholders = years.map(() => "?").join(",");
  await rawQuery(
    `DELETE FROM historical_tax_summary WHERE tmk=? AND year IN (${placeholders})`,
    [tmk, ...years],
  );

  for (const summary of summaries) {
    const year = int(summary.year);
    if (!year) continue;

    // Extract totals from nested tables
    const detailTotals = (summary.tax_details_totals ?? {}) as Row;
    const paymentTotals = (summary.tax_payments_totals ?? {}) as Row;
    const creditTotals = (summary.tax_credits_totals ?? {}) as Row;

    await rawQuery(
      `INSERT INTO historical_tax_summary (tmk, year, tax, payments_and_credits,
         penalty, interest, other, amount_due,
         tax_details_total_tax, tax_details_total_payments_credits,
         tax_details_total_penalty, tax_details_total_interest, tax_details_total_other,
         tax_payments_total_tax, tax_payments_total_penalty,
         tax_payments_total_interest, tax_payments_total_other,
         tax_credits_total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
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
      ],
    );

    // Get inserted summary ID — Bun SQL returns the result set, use a separate query
    const [{ id: summaryId }] = await rawQuery<{ id: number }>(
      `SELECT id FROM historical_tax_summary WHERE tmk=? AND year=? LIMIT 1`,
      [tmk, year],
    );

    // Insert tax details
    const taxDetails = (summary.tax_details ?? []) as Row[];
    for (const d of taxDetails) {
      await rawQuery(
        `INSERT INTO historical_tax_details (historical_tax_summary_id, tmk,
           tax_period, description, tax, payments_credits, penalty, interest, other)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summaryId,
          tmk,
          str(d.tax_period),
          str(d.description),
          dec(d.tax),
          dec(d.payments_credits),
          dec(d.penalty),
          dec(d.interest),
          dec(d.other),
        ],
      );
    }

    // Insert tax payments
    const taxPayments = (summary.tax_payments ?? []) as Row[];
    for (const p of taxPayments) {
      await rawQuery(
        `INSERT INTO historical_tax_payments (historical_tax_summary_id, tmk,
           payment_sequence, effective_date, tax, penalty, interest, other)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summaryId,
          tmk,
          str(p.payment_sequence),
          parseDateValue(str(p.effective_date)),
          dec(p.tax),
          dec(p.penalty),
          dec(p.interest),
          dec(p.other),
        ],
      );
    }

    // Insert tax credits
    const taxCredits = (summary.tax_credits ?? []) as Row[];
    for (const c of taxCredits) {
      await rawQuery(
        `INSERT INTO historical_tax_credits (historical_tax_summary_id, tmk,
           period, description, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [summaryId, tmk, str(c.period), str(c.description), dec(c.amount)],
      );
    }
  }
}

export async function loadPermits(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  const permitInfo = data.permit_information as Row | undefined;
  if (!permitInfo) return;

  const permits = (permitInfo.table_data ?? []) as Row[];

  for (const p of permits) {
    const permitNumber = str(p.permit_number) ?? str(p.permit_);
    if (!permitNumber) continue;

    // Only insert if not already exists
    const existing = await rawQuery(
      `SELECT id FROM permits WHERE tmk=? AND permit_number=? LIMIT 1`,
      [tmk, permitNumber],
    );

    if (existing.length === 0) {
      await rawQuery(
        `INSERT INTO permits (tmk, permit_date, permit_number, reason, permit_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [
          tmk,
          parseDateValue(str(p.permit_date) ?? str(p.date)),
          permitNumber,
          str(p.reason) ?? str(p.description),
          int(p.permit_amount) ?? int(p.amount),
        ],
      );
    }
  }
}

export async function loadCurrentTaxBills(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const taxBillInfo = data.current_tax_bill_information as Row | undefined;
  if (!taxBillInfo) return;

  const bills = (taxBillInfo.table_data ?? []) as Row[];
  if (bills.length === 0) return;

  await deletePeriodSnapshot("current_tax_bills", tmk, scrapedAt);

  const scrapedAtStr = sqlDate(scrapedAt);

  for (const b of bills) {
    await rawQuery(
      `INSERT INTO current_tax_bills (tmk, scraped_at,
         tax_period, description, original_due_date,
         taxes_assessment, tax_credits, net_tax,
         penalty, interest, other, amount_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
        scrapedAtStr,
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
      ],
    );
  }
}

// ─── Condominium Project ─────────────────────────────────────────

/** Derive a unit TMK from parent TMK + unit parcel number (last 4 chars = CPR) */
function unitParcelToTmk(parentTmk: string, unitParcel: string): string {
  const parts = parentTmk.split("-");
  // Replace the last segment (CPR) with the unit's last 4 characters
  parts[parts.length - 1] = unitParcel.slice(-4);
  return parts.join("-");
}

export async function loadCondoProject(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  if (data.status !== "condo_project") return;

  const parcel = data.parcel_information as Row | undefined;
  const unitInfo = data.condominium_apartment_unit_information as
    | Row
    | undefined;
  const units = (unitInfo?.table_data ?? []) as Row[];

  // Upsert condominium_projects — only set fields from QPub, don't overwrite DCCA fields
  const existing = await rawQuery<{ tmk: string }>(
    `SELECT tmk FROM condominium_projects WHERE tmk=? LIMIT 1`,
    [tmk],
  );

  // For Maui, project_name may be in Improvement Information as "Condo Name"
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
  const projectName =
    str(parcel?.project_name) ?? str(firstBuilding?.condo_name);
  const unitCount = units.length || null;

  if (existing.length === 0) {
    await rawQuery(
      `INSERT INTO condominium_projects (tmk, project_name, unit_count)
       VALUES (?, ?, ?)`,
      [tmk, projectName, unitCount],
    );
  } else {
    // Update only project_name and unit_count — preserve DCCA-sourced fields
    await rawQuery(
      `UPDATE condominium_projects SET project_name=?, unit_count=? WHERE tmk=?`,
      [projectName, unitCount, tmk],
    );
  }

  // Ensure each unit is linked in condominium_units
  const islandCode = getIslandCode(tmk);

  for (const unit of units) {
    const unitParcel = str(unit.parcel_number);
    if (!unitParcel) continue;

    const unitTmk = unitParcelToTmk(tmk, unitParcel);
    const unitNumber = str(unit.unit_number);
    const ownerName = str(unit.owner_name);

    // Ensure the unit property exists in properties table (needed for FK)
    const propExists = await rawQuery<{ tmk: string }>(
      `SELECT tmk FROM properties WHERE tmk=? LIMIT 1`,
      [unitTmk],
    );

    if (propExists.length === 0) {
      await rawQuery(
        `INSERT INTO properties (tmk, island_code) VALUES (?, ?)`,
        [unitTmk, islandCode],
      );
    }

    // Upsert condominium_units — INSERT if not exists, UPDATE owner_name if exists
    const unitExists = await rawQuery<{ id: number }>(
      `SELECT id FROM condominium_units WHERE tmk=? LIMIT 1`,
      [unitTmk],
    );

    if (unitExists.length === 0) {
      await rawQuery(
        `INSERT INTO condominium_units (tmk, parent_tmk, unit_number, owner_name)
         VALUES (?, ?, ?, ?)`,
        [unitTmk, tmk, unitNumber, ownerName],
      );
    } else {
      await rawQuery(
        `UPDATE condominium_units SET unit_number=?, owner_name=? WHERE tmk=?`,
        [unitNumber, ownerName, unitTmk],
      );
    }
  }
}

// ─── Generic snapshot loaders ────────────────────────────────────

async function loadGenericSnapshot(
  tmk: string,
  tableName: string,
  rows: Row[],
  scrapedAt: Date = new Date(),
): Promise<void> {
  if (rows.length === 0) return;

  // Get table columns
  const columns = await rawQuery<{ Field: string }>(
    `SHOW COLUMNS FROM ${tableName}`,
    [],
  );
  const columnNames = new Set(columns.map((c) => c.Field));

  // Delete same-period records
  if (columnNames.has("scraped_at")) {
    await deletePeriodSnapshot(tableName, tmk, scrapedAt);
  }

  const scrapedAtStr = sqlDate(scrapedAt);

  for (const row of rows) {
    // Match row fields to DB columns
    const matched: Record<string, unknown> = { tmk };
    if (columnNames.has("scraped_at")) {
      matched.scraped_at = scrapedAtStr;
    }

    for (const [key, value] of Object.entries(row)) {
      const snakeKey = key
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, "_");
      if (
        columnNames.has(snakeKey) &&
        snakeKey !== "id" &&
        snakeKey !== "tmk" &&
        snakeKey !== "created_at" &&
        snakeKey !== "scraped_at"
      ) {
        matched[snakeKey] = value;
      }
    }

    const fields = Object.keys(matched);
    const placeholders = fields.map(() => "?").join(", ");
    const values = fields.map((f) => {
      const v = matched[f];
      if (v instanceof Date) return v;
      if (v === null || v === undefined) return null;
      return String(v);
    });

    await rawQuery(
      `INSERT INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders})`,
      values,
    );
  }
}

// Section name → DB table mapping for generic loading
const GENERIC_SECTION_MAP: Record<string, string> = {
  yard_improvement_information: "yard_improvements",
  residential_addition_information: "residential_additions",
  agricultural_assessment_information: "agricultural_assessments",
  accessory_structure_information: "accessory_structures",
  appeal_information: "appeals",
  dedication_information: "dedications",
};

async function loadGenericSections(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    // Try table_data (multi-row) or treat the section itself as a single row
    const rows =
      (sectionData.table_data as Row[] | undefined) ??
      (Array.isArray(sectionData) ? sectionData : [sectionData]);

    try {
      await loadGenericSnapshot(tmk, tableName, rows, scrapedAt);
    } catch {
      // Skip sections that fail to load generically — not all sections map cleanly
    }
  }
}

/**
 * Load a single generic section by section name and table name.
 * Used by TABLE_LOADERS for individual table reparse.
 */
export async function loadGenericForTable(
  tmk: string,
  data: ParsedProperty,
  sectionName: string,
  tableName: string,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const sectionData = data[sectionName] as Row | undefined;
  if (!sectionData) return;

  const rows =
    (sectionData.table_data as Row[] | undefined) ??
    (Array.isArray(sectionData) ? sectionData : [sectionData]);

  await loadGenericSnapshot(tmk, tableName, rows, scrapedAt);
}

// ─── TABLE_LOADERS map ──────────────────────────────────────────

export type TableLoaderFn = (
  tmk: string,
  data: ParsedProperty,
  scrapedAt?: Date,
) => Promise<void>;

/** Map of table name → load function, used by reparse processor */
export const TABLE_LOADERS: Record<string, TableLoaderFn> = {
  properties: loadProperties,
  parcels: loadParcels,
  owners: loadOwners,
  assessments: loadAssessments,
  land_classifications: loadLandClassifications,
  residential_improvements: loadResidentialImprovements,
  commercial_improvements: loadCommercialImprovements,
  sales: loadSales,
  permits: loadPermits,
  historical_tax: loadHistoricalTax,
  current_tax_bills: loadCurrentTaxBills,
  condominium: loadCondoProject,
  yard_improvements: (tmk, data, s) =>
    loadGenericForTable(
      tmk,
      data,
      "yard_improvement_information",
      "yard_improvements",
      s,
    ),
  residential_additions: (tmk, data, s) =>
    loadGenericForTable(
      tmk,
      data,
      "residential_addition_information",
      "residential_additions",
      s,
    ),
  agricultural_assessments: (tmk, data, s) =>
    loadGenericForTable(
      tmk,
      data,
      "agricultural_assessment_information",
      "agricultural_assessments",
      s,
    ),
  accessory_structures: (tmk, data, s) =>
    loadGenericForTable(
      tmk,
      data,
      "accessory_structure_information",
      "accessory_structures",
      s,
    ),
  appeals: (tmk, data, s) =>
    loadGenericForTable(tmk, data, "appeal_information", "appeals", s),
  dedications: (tmk, data, s) =>
    loadGenericForTable(tmk, data, "dedication_information", "dedications", s),
};

// ─── Main load processor ─────────────────────────────────────────

export async function processQpubLoad(
  job: Job<QpubLoadJobData>,
): Promise<string> {
  const { tmk } = job.data;

  try {
    // Read JSON from NAS
    const jsonDir = getJsonPath(tmk);
    const jsonFile = path.join(jsonDir, `${tmk}.json`);

    if (!existsSync(jsonFile)) {
      await rawQuery(
        `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
        [`JSON file not found: ${jsonFile}`, tmk],
      );
      throw new Error(`JSON file not found: ${jsonFile}`);
    }

    const data = JSON.parse(readFileSync(jsonFile, "utf-8")) as ParsedProperty;
    const scrapedAt = new Date();

    // Load in order (respects FK constraints)
    await loadProperties(tmk, data, scrapedAt);
    await loadParcels(tmk, data, scrapedAt);
    await loadOwners(tmk, data, scrapedAt);
    await loadCondoProject(tmk, data, scrapedAt);
    await loadAssessments(tmk, data, scrapedAt);
    await loadLandClassifications(tmk, data, scrapedAt);
    await loadResidentialImprovements(tmk, data, scrapedAt);
    await loadCommercialImprovements(tmk, data, scrapedAt);
    await loadSales(tmk, data, scrapedAt);
    await loadPermits(tmk, data, scrapedAt);
    await loadHistoricalTax(tmk, data, scrapedAt);
    await loadCurrentTaxBills(tmk, data, scrapedAt);
    await loadGenericSections(tmk, data, scrapedAt);

    // Update status
    await rawQuery(
      `UPDATE scrape_status SET load_status='success', loaded_at=NOW(), error=NULL WHERE tmk=?`,
      [tmk],
    );

    job.log(`${tmk}: loaded`);
    return `${tmk}: loaded`;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await rawQuery(
      `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
      [errorMsg.slice(0, 500), tmk],
    );
    throw e;
  }
}
