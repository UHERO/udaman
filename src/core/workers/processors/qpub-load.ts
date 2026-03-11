import { existsSync, readFileSync } from "fs";
import path from "path";

import type { Job } from "bullmq";

import { getIslandCode, getJsonPath } from "@/core/crawlers/qpub/config";
import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { parseDollarValue } from "@/core/crawlers/qpub/parse-utils";
import { rawQuery } from "@/lib/mysql/hhdb";

import type { QpubLoadJobData } from "../queues";

// ─── Helpers ─────────────────────────────────────────────────────

/** Parse a date string like "01/15/2024" or "2024-01-15" into a Date-compatible string, or null */
function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = value.trim();
  if (!str) return null;

  // Try MM/DD/YYYY format
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
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

// ─── Section loaders ─────────────────────────────────────────────

async function loadProperties(
  tmk: string,
  data: ParsedProperty,
): Promise<void> {
  const parcel = data.parcel_information as Row | undefined;
  if (!parcel) return;

  const islandCode = getIslandCode(tmk);
  const mapSection = data.map as Row | undefined;
  const sketchSection = data.sketch as Row | undefined;

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
      str(parcel.project_name),
      str(parcel.legal_information),
      str(parcel.property_class),
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

async function loadParcels(tmk: string, data: ParsedProperty): Promise<void> {
  const parcel = data.parcel_information as Row | undefined;
  if (!parcel) return;

  // Delete same-day records for this TMK
  await rawQuery(
    `DELETE FROM parcels WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
    [tmk],
  );

  await rawQuery(
    `INSERT INTO parcels (tmk, scraped_at, parcel_number, location_address, address_other,
       project_name, legal_information, property_class, land_area_sqft, land_area_acres,
       neighborhood_code, zoning, parcel_note, damage, reentry_zone, zone_color,
       non_taxable_status, living_units)
     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tmk,
      str(parcel.parcel_number),
      str(parcel.location_address),
      str(parcel.address_other),
      str(parcel.project_name),
      str(parcel.legal_information),
      str(parcel.property_class),
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

async function loadOwners(tmk: string, data: ParsedProperty): Promise<void> {
  const ownerInfo = data.owner_information as Row | undefined;
  if (!ownerInfo?.all_owners) return;

  const owners = ownerInfo.all_owners as Row[];
  if (owners.length === 0) return;

  // Delete same-day records
  await rawQuery(
    `DELETE FROM owners WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
    [tmk],
  );

  for (let i = 0; i < owners.length; i++) {
    const o = owners[i];
    await rawQuery(
      `INSERT INTO owners (tmk, scraped_at, owner_name, owner_type, owner_address, sequence_order)
       VALUES (?, NOW(), ?, ?, ?, ?)`,
      [tmk, str(o.owner_name), str(o.owner_type), str(o.owner_address), i + 1],
    );
  }
}

async function loadAssessments(
  tmk: string,
  data: ParsedProperty,
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

async function loadLandClassifications(
  tmk: string,
  data: ParsedProperty,
): Promise<void> {
  const landInfo = data.land_information as Row | undefined;
  if (!landInfo?.land_classifications) return;

  const classifications = landInfo.land_classifications as Row[];
  if (classifications.length === 0) return;

  await rawQuery(
    `DELETE FROM land_classifications WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
    [tmk],
  );

  for (const c of classifications) {
    await rawQuery(
      `INSERT INTO land_classifications (tmk, scraped_at, land_classification, square_footage, acreage, agricultural_use_indicator)
       VALUES (?, NOW(), ?, ?, ?, ?)`,
      [
        tmk,
        str(c.land_classification),
        str(c.square_footage),
        str(c.acreage),
        str(c.agricultural_use_indicator),
      ],
    );
  }
}

async function loadResidentialImprovements(
  tmk: string,
  data: ParsedProperty,
): Promise<void> {
  // Check both section names (Honolulu/Hawaii vs Maui/Kauai)
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  if (!improvInfo) return;

  await rawQuery(
    `DELETE FROM residential_improvements WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
    [tmk],
  );

  await rawQuery(
    `INSERT INTO residential_improvements (tmk, scraped_at,
       building_number, year_built, eff_year_built, living_area,
       bedrooms, full_bath, half_bath,
       occupancy, framing, percent_complete, heating_cooling,
       exterior_wall, roof_material, fireplace, grade, building_value, total_room_count)
     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tmk,
      str(improvInfo.building_number),
      str(improvInfo.year_built),
      str(improvInfo.eff_year_built),
      str(improvInfo.living_area),
      str(improvInfo.bedrooms),
      str(improvInfo.full_bath),
      str(improvInfo.half_bath),
      str(improvInfo.occupancy),
      str(improvInfo.framing),
      str(improvInfo.percent_complete),
      str(improvInfo.heating_cooling),
      str(improvInfo.exterior_wall),
      str(improvInfo.roof_material),
      str(improvInfo.fireplace),
      str(improvInfo.grade),
      str(improvInfo.building_value),
      str(improvInfo.total_room_count),
    ],
  );
}

async function loadSales(tmk: string, data: ParsedProperty): Promise<void> {
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

async function loadHistoricalTax(
  tmk: string,
  data: ParsedProperty,
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

    const result = await rawQuery<{ insertId: number }>(
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

async function loadPermits(tmk: string, data: ParsedProperty): Promise<void> {
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

async function loadCurrentTaxBills(
  tmk: string,
  data: ParsedProperty,
): Promise<void> {
  const taxBillInfo = data.current_tax_bill_information as Row | undefined;
  if (!taxBillInfo) return;

  const bills = (taxBillInfo.table_data ?? []) as Row[];
  if (bills.length === 0) return;

  await rawQuery(
    `DELETE FROM current_tax_bills WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
    [tmk],
  );

  for (const b of bills) {
    await rawQuery(
      `INSERT INTO current_tax_bills (tmk, scraped_at,
         tax_period, description, original_due_date,
         taxes_assessment, tax_credits, net_tax,
         penalty, interest, other, amount_due)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tmk,
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

async function loadCondoProject(
  tmk: string,
  data: ParsedProperty,
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

  const projectName = str(parcel?.project_name);
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
): Promise<void> {
  if (rows.length === 0) return;

  // Get table columns
  const columns = await rawQuery<{ Field: string }>(
    `SHOW COLUMNS FROM ${tableName}`,
    [],
  );
  const columnNames = new Set(columns.map((c) => c.Field));

  // Delete same-day records
  if (columnNames.has("scraped_at")) {
    await rawQuery(
      `DELETE FROM ${tableName} WHERE tmk=? AND DATE(scraped_at) = CURDATE()`,
      [tmk],
    );
  }

  for (const row of rows) {
    // Match row fields to DB columns
    const matched: Record<string, unknown> = { tmk };
    if (columnNames.has("scraped_at")) {
      matched.scraped_at = new Date();
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
  commercial_improvement_information: "commercial_improvements",
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
): Promise<void> {
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    // Try table_data (multi-row) or treat the section itself as a single row
    const rows =
      (sectionData.table_data as Row[] | undefined) ??
      (Array.isArray(sectionData) ? sectionData : [sectionData]);

    try {
      await loadGenericSnapshot(tmk, tableName, rows);
    } catch {
      // Skip sections that fail to load generically — not all sections map cleanly
    }
  }
}

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

    // Load in order (respects FK constraints)
    await loadProperties(tmk, data);
    await loadParcels(tmk, data);
    await loadOwners(tmk, data);
    await loadCondoProject(tmk, data);
    await loadAssessments(tmk, data);
    await loadLandClassifications(tmk, data);
    await loadResidentialImprovements(tmk, data);
    await loadSales(tmk, data);
    await loadPermits(tmk, data);
    await loadHistoricalTax(tmk, data);
    await loadCurrentTaxBills(tmk, data);
    await loadGenericSections(tmk, data);

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
