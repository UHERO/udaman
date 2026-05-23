import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import {
  getHtmlPath,
  getIslandCode,
  getJsonPath,
} from "@/core/crawlers/qpub/config";
import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { parseDollarValue } from "@/core/crawlers/qpub/parse-utils";
import { insertAndGetId, rawQuery } from "@/lib/mysql/hhdb";

// ─── Error helper ────────────────────────────────────────────────

/** Extract a readable message from any thrown value (Error, Bun SQL object, string, etc.) */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    // Bun SQL errors are plain objects with a message property
    if ("message" in e && typeof (e as Record<string, unknown>).message === "string") {
      return (e as Record<string, unknown>).message as string;
    }
    try { return JSON.stringify(e); } catch { /* fall through */ }
  }
  return String(e);
}

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

/** Format a Date for SQL insertion (YYYY-MM-DD HH:MM:SS) */
function sqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Derive the observation year from the max tax_year in the assessment data.
 * Falls back to current calendar year if no assessments are present.
 */
function getMaxTaxYear(data: ParsedProperty): number {
  const assessInfo = data.assessment_information as Row | undefined;
  if (!assessInfo) return new Date().getFullYear();

  const current = (assessInfo.current_assessments as Row[]) ?? [];
  const historical = (assessInfo.historical_assessments as Row[]) ?? [];
  const all = [...current, ...historical];

  let maxYear = 0;
  for (const a of all) {
    const y = int(a.tax_year);
    if (y && y > maxYear) maxYear = y;
  }

  return maxYear || new Date().getFullYear();
}

// ─── Change-detection helper ─────────────────────────────────────

/**
 * Normalize a value to a string for comparison purposes.
 * NULL/undefined → "", otherwise trimmed string.
 */
function normalizeForCompare(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Compare two sets of data fields to check if they represent the same data.
 * Returns true if all fields match.
 */
function dataFieldsMatch(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  fieldNames: string[],
): boolean {
  for (const field of fieldNames) {
    if (normalizeForCompare(existing[field]) !== normalizeForCompare(incoming[field])) {
      return false;
    }
  }
  return true;
}

/**
 * Upsert a snapshot record using change detection.
 *
 * 1. SELECT most recent record matching tmk + identity fields (highest last_year_observed)
 * 2. If found and data matches → UPDATE last_year_observed + scraped_at → "updated"
 * 3. If found but data differs → INSERT new row → "inserted"
 * 4. If not found → INSERT new row → "inserted"
 */
async function upsertSnapshot(opts: {
  table: string;
  tmk: string;
  observedYear: number;
  scrapedAt: Date;
  identityFields: Record<string, unknown>;
  dataFields: Record<string, unknown>;
}): Promise<"updated" | "inserted"> {
  const { table, tmk, observedYear, scrapedAt, identityFields, dataFields } = opts;
  const scrapedAtStr = sqlDate(scrapedAt);

  // Build WHERE clause for identity fields
  const identityEntries = Object.entries(identityFields);
  const identityWhere = identityEntries.length > 0
    ? " AND " + identityEntries.map(([col]) => `${col}=?`).join(" AND ")
    : "";
  const identityValues = Object.values(identityFields) as (string | number | Date | null)[];

  // SELECT most recent record matching tmk + identity
  const existing = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE tmk=?${identityWhere} ORDER BY last_year_observed DESC, id DESC LIMIT 1`,
    [tmk, ...identityValues],
  );

  if (existing.length > 0) {
    const row = existing[0];
    const dataFieldNames = Object.keys(dataFields);

    if (dataFieldsMatch(row, dataFields, dataFieldNames)) {
      // Data unchanged → bump last_year_observed + scraped_at
      await rawQuery(
        `UPDATE ${table} SET last_year_observed=?, scraped_at=? WHERE id=?`,
        [observedYear, scrapedAtStr, row.id as number],
      );
      return "updated";
    }
  }

  // Data changed or no existing record → INSERT new row
  const allFields: Record<string, unknown> = {
    tmk,
    scraped_at: scrapedAtStr,
    last_year_observed: observedYear,
    ...identityFields,
    ...dataFields,
  };
  const cols = Object.keys(allFields);
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((c) => {
    const v = allFields[c];
    if (v === null || v === undefined) return null;
    return v;
  });

  await rawQuery(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    values as (string | number | Date | null)[],
  );
  return "inserted";
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
  observedYear?: number,
): Promise<void> {
  const parcel = data.parcel_information as Row | undefined;
  if (!parcel) return;

  const year = observedYear ?? getMaxTaxYear(data);

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

  await upsertSnapshot({
    table: "parcels",
    tmk,
    observedYear: year,
    scrapedAt,
    identityFields: {},
    dataFields: {
      parcel_number: str(parcel.parcel_number),
      location_address: str(parcel.location_address),
      address_other: str(parcel.address_other),
      project_name: projectName,
      legal_information: str(parcel.legal_information),
      property_class: propertyClass,
      land_area_sqft: int(parcel.land_area_approximate_sq_ft),
      land_area_acres: dec(parcel.land_area_acres),
      neighborhood_code: str(parcel.neighborhood_code),
      zoning: str(parcel.zoning),
      parcel_note: str(parcel.parcel_note),
      damage: str(parcel.damage),
      reentry_zone: str(parcel.reentry_zone),
      zone_color: str(parcel.zone_color),
      non_taxable_status: str(parcel.non_taxable_status),
      living_units: str(parcel.living_units),
    },
  });
}

export async function loadOwners(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  const ownerInfo = data.owner_information as Row | undefined;
  if (!ownerInfo?.all_owners) return;

  const owners = ownerInfo.all_owners as Row[];
  if (owners.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);
  const scrapedAtStr = sqlDate(scrapedAt);

  for (let i = 0; i < owners.length; i++) {
    const o = owners[i];
    const ownerName = str(o.owner_name);
    const ownerType = str(o.owner_type);

    // Look up existing by identity: tmk + owner_name + owner_type
    const existing = await rawQuery<Record<string, unknown>>(
      `SELECT id, owner_address FROM owners WHERE tmk=? AND owner_name=? AND owner_type=? LIMIT 1`,
      [tmk, ownerName, ownerType],
    );

    if (existing.length > 0) {
      // Found → update last_year_observed, scraped_at, sequence_order
      // Do NOT touch owner_address — preserved from external join
      await rawQuery(
        `UPDATE owners SET last_year_observed=?, scraped_at=?, sequence_order=? WHERE id=?`,
        [year, scrapedAtStr, i + 1, existing[0].id as number],
      );
    } else {
      // Not found → insert new owner
      await rawQuery(
        `INSERT INTO owners (tmk, scraped_at, last_year_observed, owner_name, owner_type, owner_address, sequence_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tmk,
          scrapedAtStr,
          year,
          ownerName,
          ownerType,
          str(o.owner_address),
          i + 1,
        ],
      );
    }
  }
  // Owners NOT in this scrape keep their old last_year_observed — signals no longer on title
}

export async function loadAssessments(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
): Promise<void> {
  const assessInfo = data.assessment_information as Row | undefined;
  if (!assessInfo) return;

  const current = (assessInfo.current_assessments as Row[]) ?? [];
  const historical = (assessInfo.historical_assessments as Row[]) ?? [];
  const allAssessments = [...current, ...historical];

  if (allAssessments.length === 0) return;

  const scrapedAtStr = sqlDate(scrapedAt);

  for (const a of allAssessments) {
    const taxYear = int(a.tax_year);
    if (!taxYear) continue;

    // INSERT ... ON DUPLICATE KEY UPDATE — handles new year (insert)
    // and corrections to historical years (update) in one pass
    await rawQuery(
      `INSERT INTO assessments (tmk, scraped_at, tax_year, property_class,
         assessed_land_value, assessed_building_value, dedicated_use_value,
         land_exemption, building_exemption,
         net_taxable_land_value, net_taxable_building_value,
         total_property_assessed_value, total_property_exemption, total_net_taxable_value,
         agricultural_land_value, market_land_value, market_building_value, total_market_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         scraped_at=VALUES(scraped_at),
         property_class=VALUES(property_class),
         assessed_land_value=VALUES(assessed_land_value),
         assessed_building_value=VALUES(assessed_building_value),
         dedicated_use_value=VALUES(dedicated_use_value),
         land_exemption=VALUES(land_exemption),
         building_exemption=VALUES(building_exemption),
         net_taxable_land_value=VALUES(net_taxable_land_value),
         net_taxable_building_value=VALUES(net_taxable_building_value),
         total_property_assessed_value=VALUES(total_property_assessed_value),
         total_property_exemption=VALUES(total_property_exemption),
         total_net_taxable_value=VALUES(total_net_taxable_value),
         agricultural_land_value=VALUES(agricultural_land_value),
         market_land_value=VALUES(market_land_value),
         market_building_value=VALUES(market_building_value),
         total_market_value=VALUES(total_market_value)`,
      [
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
      ],
    );
  }
}

export async function loadLandClassifications(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  const landInfo = data.land_information as Row | undefined;
  if (!landInfo?.land_classifications) return;

  const classifications = landInfo.land_classifications as Row[];
  if (classifications.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);

  for (const c of classifications) {
    await upsertSnapshot({
      table: "land_classifications",
      tmk,
      observedYear: year,
      scrapedAt,
      identityFields: {
        land_classification: str(c.land_classification),
      },
      dataFields: {
        square_footage: str(c.square_footage),
        acreage: str(c.acreage),
        agricultural_use_indicator: str(c.agricultural_use_indicator),
      },
    });
  }
}

export async function loadResidentialImprovements(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  // Check both section names (Honolulu/Hawaii vs Maui/Kauai)
  const improvInfo =
    (data.residential_improvement_information as Row | undefined) ??
    (data.improvement_information as Row | undefined);
  if (!improvInfo) return;

  const buildings = (improvInfo.buildings as Row[] | undefined) ?? [];
  if (buildings.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);

  for (const b of buildings) {
    await upsertSnapshot({
      table: "residential_improvements",
      tmk,
      observedYear: year,
      scrapedAt,
      identityFields: {
        building_number: str(b.building_number),
      },
      dataFields: {
        year_built: str(b.year_built),
        eff_year_built: str(b.eff_year_built),
        living_area: int(b.living_area),
        bedrooms: int(b.bedrooms),
        full_bath: int(b.full_bath),
        half_bath: int(b.half_bath),
        occupancy: str(b.occupancy),
        framing: str(b.framing),
        percent_complete: str(b.percent_complete),
        heating_cooling: str(b.heating_cooling),
        exterior_wall: str(b.exterior_wall),
        roof_material: str(b.roof_material),
        fireplace: str(b.fireplace),
        grade: str(b.grade),
        building_value: str(b.building_value),
        total_room_count: str(b.total_room_count),
        condo_style: str(b.condo_style ?? b.condo_type),
        condo_view: str(b.condo_view),
        floor_level: str(b.floor_level ?? b.condo_floor_number),
        parking_spaces: str(b.parking_spaces),
      },
    });
  }
}

export async function loadCommercialImprovements(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  const ciInfo = data.commercial_improvement_information as Row | undefined;
  if (!ciInfo) return;

  const buildings = (ciInfo.buildings as Row[] | undefined) ?? [];
  if (buildings.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);
  const scrapedAtStr = sqlDate(scrapedAt);

  for (const b of buildings) {
    const buildingNumber = str(b.building_number);
    const buildingCard = str(b.building_card);

    // Check for existing parent by identity: tmk + building_number + building_card
    const existing = await rawQuery<Record<string, unknown>>(
      `SELECT id, year_built, effective_year_built, improvement_name, property_class,
              structure_type, units, identical_units, gross_building_description,
              building_square_footage, building_type, percent_complete, value
       FROM commercial_improvements
       WHERE tmk=? AND building_number=? AND building_card=?
       ORDER BY last_year_observed DESC, id DESC LIMIT 1`,
      [tmk, buildingNumber, buildingCard],
    );

    const incomingData: Record<string, unknown> = {
      year_built: int(b.year_built),
      effective_year_built: int(b.effective_year_built),
      improvement_name: str(b.improvement_name),
      property_class: str(b.property_class),
      structure_type: str(b.structure_type),
      units: str(b.units),
      identical_units: str(b.identical_units),
      gross_building_description: str(b.gross_building_description),
      building_square_footage: str(b.building_square_footage),
      building_type: str(b.building_type),
      percent_complete: str(b.percent_complete),
      value: int(b.value),
    };

    const floorDetails = (b.floor_details as Row[] | undefined) ?? [];

    if (existing.length > 0 && dataFieldsMatch(existing[0], incomingData, Object.keys(incomingData))) {
      // Data unchanged → bump parent last_year_observed + scraped_at
      const parentId = existing[0].id as number;
      await rawQuery(
        `UPDATE commercial_improvements SET last_year_observed=?, scraped_at=? WHERE id=?`,
        [year, scrapedAtStr, parentId],
      );
      // Also bump children
      await rawQuery(
        `UPDATE commercial_improvement_details SET last_year_observed=?, scraped_at=? WHERE commercial_improvement_id=?`,
        [year, scrapedAtStr, parentId],
      );
    } else {
      // Data changed or not found → INSERT new parent + children
      const improvementId = await insertAndGetId(
        `INSERT INTO commercial_improvements (tmk, scraped_at, last_year_observed,
           building_number, building_card, year_built, effective_year_built,
           improvement_name, property_class, structure_type, units, identical_units,
           gross_building_description, building_type, building_square_footage,
           percent_complete, value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tmk,
          scrapedAtStr,
          year,
          buildingNumber,
          buildingCard,
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

      for (const d of floorDetails) {
        await rawQuery(
          `INSERT INTO commercial_improvement_details
             (commercial_improvement_id, tmk, scraped_at, last_year_observed,
              card, section, floor, \`usage\`, area, perimeter,
              exterior_wall, wall_height, occupancy)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            improvementId,
            tmk,
            scrapedAtStr,
            year,
            str(d.card),
            str(d.section),
            str(d.floor),
            str(d.usage),
            str(d.area),
            str(d.perimeter),
            str(d.exterior_wall),
            str(d.wall_height),
            str(d.occupancy),
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
  scrapedAt: Date = new Date(),
): Promise<void> {
  const taxInfo = data.historical_tax_information as Row | undefined;
  if (!taxInfo?.tax_summary) return;

  const summaries = taxInfo.tax_summary as Row[];
  if (summaries.length === 0) return;

  const scrapedAtStr = sqlDate(scrapedAt);

  for (const summary of summaries) {
    const year = int(summary.year);
    if (!year) continue;

    // Extract totals from nested tables
    const detailTotals = (summary.tax_details_totals ?? {}) as Row;
    const paymentTotals = (summary.tax_payments_totals ?? {}) as Row;
    const creditTotals = (summary.tax_credits_totals ?? {}) as Row;

    // INSERT ... ON DUPLICATE KEY UPDATE for summary (keyed by tmk + year)
    await rawQuery(
      `INSERT INTO historical_tax_summary (tmk, scraped_at, year, tax, payments_and_credits,
         penalty, interest, other, amount_due,
         tax_details_total_tax, tax_details_total_payments_credits,
         tax_details_total_penalty, tax_details_total_interest, tax_details_total_other,
         tax_payments_total_tax, tax_payments_total_penalty,
         tax_payments_total_interest, tax_payments_total_other,
         tax_credits_total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         scraped_at=VALUES(scraped_at),
         tax=VALUES(tax),
         payments_and_credits=VALUES(payments_and_credits),
         penalty=VALUES(penalty),
         interest=VALUES(interest),
         other=VALUES(other),
         amount_due=VALUES(amount_due),
         tax_details_total_tax=VALUES(tax_details_total_tax),
         tax_details_total_payments_credits=VALUES(tax_details_total_payments_credits),
         tax_details_total_penalty=VALUES(tax_details_total_penalty),
         tax_details_total_interest=VALUES(tax_details_total_interest),
         tax_details_total_other=VALUES(tax_details_total_other),
         tax_payments_total_tax=VALUES(tax_payments_total_tax),
         tax_payments_total_penalty=VALUES(tax_payments_total_penalty),
         tax_payments_total_interest=VALUES(tax_payments_total_interest),
         tax_payments_total_other=VALUES(tax_payments_total_other),
         tax_credits_total_amount=VALUES(tax_credits_total_amount)`,
      [
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
      ],
    );

    // Get summary ID (may be existing or newly inserted)
    const [{ id: summaryId }] = await rawQuery<{ id: number }>(
      `SELECT id FROM historical_tax_summary WHERE tmk=? AND year=? LIMIT 1`,
      [tmk, year],
    );

    // Delete children and re-insert (always loaded as complete set per year)
    await rawQuery(
      `DELETE FROM historical_tax_details WHERE historical_tax_summary_id=?`,
      [summaryId],
    );
    await rawQuery(
      `DELETE FROM historical_tax_payments WHERE historical_tax_summary_id=?`,
      [summaryId],
    );
    await rawQuery(
      `DELETE FROM historical_tax_credits WHERE historical_tax_summary_id=?`,
      [summaryId],
    );

    // Insert tax details
    const taxDetails = (summary.tax_details ?? []) as Row[];
    for (const d of taxDetails) {
      await rawQuery(
        `INSERT INTO historical_tax_details (historical_tax_summary_id, tmk, scraped_at,
           tax_period, description, tax, payments_credits, penalty, interest, other)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
    }

    // Insert tax payments
    const taxPayments = (summary.tax_payments ?? []) as Row[];
    for (const p of taxPayments) {
      await rawQuery(
        `INSERT INTO historical_tax_payments (historical_tax_summary_id, tmk, scraped_at,
           payment_sequence, effective_date, tax, penalty, interest, other)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          summaryId,
          tmk,
          scrapedAtStr,
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
        `INSERT INTO historical_tax_credits (historical_tax_summary_id, tmk, scraped_at,
           period, description, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [summaryId, tmk, scrapedAtStr, str(c.period), str(c.description), dec(c.amount)],
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
  observedYear?: number,
): Promise<void> {
  const taxBillInfo = data.current_tax_bill_information as Row | undefined;
  if (!taxBillInfo) return;

  const bills = (taxBillInfo.table_data ?? []) as Row[];
  if (bills.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);

  for (const b of bills) {
    await upsertSnapshot({
      table: "current_tax_bills",
      tmk,
      observedYear: year,
      scrapedAt,
      identityFields: {
        tax_period: str(b.tax_period),
      },
      dataFields: {
        description: str(b.description),
        original_due_date: parseDateValue(str(b.original_due_date)),
        taxes_assessment: dec(b.taxes_assessment) ?? dec(b.taxes),
        tax_credits: dec(b.tax_credits) ?? dec(b.credits),
        net_tax: dec(b.net_tax),
        penalty: dec(b.penalty),
        interest: dec(b.interest),
        other: dec(b.other),
        amount_due: dec(b.amount_due),
      },
    });
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

/** Identity field definitions for generic snapshot tables */
const GENERIC_IDENTITY_FIELDS: Record<string, string[]> = {
  yard_improvements: ["description", "year_built"],
  residential_additions: ["card", "line"],
  agricultural_assessments: [], // compare all data fields
  accessory_structures: ["building_number", "description"],
  appeals: ["year", "appeal_type_value"],
  dedications: ["tax_year"],
};

async function loadGenericSnapshot(
  tmk: string,
  tableName: string,
  rows: Row[],
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  if (rows.length === 0) return;

  // Get table columns
  const columns = await rawQuery<{ Field: string }>(
    `SHOW COLUMNS FROM ${tableName}`,
    [],
  );
  const columnNames = new Set(columns.map((c) => c.Field));

  const hasLastYearObserved = columnNames.has("last_year_observed");
  const scrapedAtStr = sqlDate(scrapedAt);
  const identityFieldDefs = GENERIC_IDENTITY_FIELDS[tableName] ?? [];

  for (const row of rows) {
    // Match row fields to DB columns
    const matched: Record<string, unknown> = {};

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
        snakeKey !== "scraped_at" &&
        snakeKey !== "last_year_observed"
      ) {
        matched[snakeKey] = value;
      }
    }

    if (hasLastYearObserved && observedYear) {
      // Use change-detection pattern
      const identityFields: Record<string, unknown> = {};
      const dataFields: Record<string, unknown> = {};

      if (identityFieldDefs.length === 0) {
        // No explicit identity fields — all matched fields are both identity and data
        // (e.g. agricultural_assessments: compare everything)
        for (const [k, v] of Object.entries(matched)) {
          dataFields[k] = v === null || v === undefined ? null : String(v);
        }
      } else {
        for (const [k, v] of Object.entries(matched)) {
          const val = v === null || v === undefined ? null : String(v);
          if (identityFieldDefs.includes(k)) {
            identityFields[k] = val;
          } else {
            dataFields[k] = val;
          }
        }
      }

      await upsertSnapshot({
        table: tableName,
        tmk,
        observedYear,
        scrapedAt,
        identityFields,
        dataFields,
      });
    } else {
      // Fallback: simple insert (for tables without last_year_observed)
      const allFields: Record<string, unknown> = { tmk, ...matched };
      if (columnNames.has("scraped_at")) {
        allFields.scraped_at = scrapedAtStr;
      }

      const fields = Object.keys(allFields);
      const placeholders = fields.map(() => "?").join(", ");
      const values = fields.map((f) => {
        const v = allFields[f];
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
  observedYear?: number,
): Promise<void> {
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    // Try table_data (multi-row) or treat the section itself as a single row
    const rows =
      (sectionData.table_data as Row[] | undefined) ??
      (Array.isArray(sectionData) ? sectionData : [sectionData]);

    try {
      await loadGenericSnapshot(tmk, tableName, rows, scrapedAt, observedYear);
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
  observedYear?: number,
): Promise<void> {
  const sectionData = data[sectionName] as Row | undefined;
  if (!sectionData) return;

  const rows =
    (sectionData.table_data as Row[] | undefined) ??
    (Array.isArray(sectionData) ? sectionData : [sectionData]);

  await loadGenericSnapshot(tmk, tableName, rows, scrapedAt, observedYear);
}

// ─── TABLE_LOADERS map ──────────────────────────────────────────

export type TableLoaderFn = (
  tmk: string,
  data: ParsedProperty,
  scrapedAt?: Date,
  observedYear?: number,
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
  yard_improvements: (tmk, data, s, y) =>
    loadGenericForTable(
      tmk,
      data,
      "yard_improvement_information",
      "yard_improvements",
      s,
      y,
    ),
  residential_additions: (tmk, data, s, y) =>
    loadGenericForTable(
      tmk,
      data,
      "residential_addition_information",
      "residential_additions",
      s,
      y,
    ),
  agricultural_assessments: (tmk, data, s, y) =>
    loadGenericForTable(
      tmk,
      data,
      "agricultural_assessment_information",
      "agricultural_assessments",
      s,
      y,
    ),
  accessory_structures: (tmk, data, s, y) =>
    loadGenericForTable(
      tmk,
      data,
      "accessory_structure_information",
      "accessory_structures",
      s,
      y,
    ),
  appeals: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "appeal_information", "appeals", s, y),
  dedications: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "dedication_information", "dedications", s, y),
};

// ─── Main load processor ─────────────────────────────────────────

export async function processLoad(
  data: { tmk: string },
  log: (msg: string) => void,
): Promise<string> {
  const { tmk } = data;

  try {
    // Read JSON from NAS — if missing, re-parse from HTML
    const jsonDir = getJsonPath(tmk);
    const jsonFile = path.join(jsonDir, `${tmk}.json`);

    let parsed: ParsedProperty;

    if (existsSync(jsonFile)) {
      parsed = JSON.parse(readFileSync(jsonFile, "utf-8")) as ParsedProperty;
    } else {
      // JSON missing — try to parse from HTML
      const htmlDir = getHtmlPath(tmk);
      const htmlFile = path.join(htmlDir, `${tmk}.html`);

      if (!existsSync(htmlFile)) {
        await rawQuery(
          `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
          [`No JSON or HTML file found for ${tmk}`, tmk],
        );
        throw new Error(`No JSON or HTML file found for ${tmk}`);
      }

      const html = readFileSync(htmlFile, "utf-8");
      parsed = parsePropertyHTML(html, tmk);

      if (parsed.status !== "success" && parsed.status !== "condo_project") {
        await rawQuery(
          `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
          [`Parse status: ${parsed.status}`, tmk],
        );
        throw new Error(`Parse status: ${parsed.status}`);
      }

      // Write JSON so future loads don't need to re-parse
      if (!existsSync(jsonDir)) {
        mkdirSync(jsonDir, { recursive: true });
      }
      writeFileSync(jsonFile, JSON.stringify(parsed, null, 2));
    }

    // Read scraped_at from scrape_status (when HTML was actually fetched)
    const [ssRow] = await rawQuery<{ scraped_at: string }>(
      `SELECT scraped_at FROM scrape_status WHERE tmk=?`,
      [tmk],
    );
    const scrapedAt = ssRow?.scraped_at ? new Date(ssRow.scraped_at) : new Date();

    // Derive observation year from the most recent assessment on the page
    const observedYear = getMaxTaxYear(parsed);

    // Load in order (respects FK constraints)
    await loadProperties(tmk, parsed, scrapedAt);
    await loadParcels(tmk, parsed, scrapedAt, observedYear);
    await loadOwners(tmk, parsed, scrapedAt, observedYear);
    await loadCondoProject(tmk, parsed, scrapedAt);
    await loadAssessments(tmk, parsed, scrapedAt);
    await loadLandClassifications(tmk, parsed, scrapedAt, observedYear);
    await loadResidentialImprovements(tmk, parsed, scrapedAt, observedYear);
    await loadCommercialImprovements(tmk, parsed, scrapedAt, observedYear);
    await loadSales(tmk, parsed, scrapedAt);
    await loadPermits(tmk, parsed, scrapedAt);
    await loadHistoricalTax(tmk, parsed, scrapedAt);
    await loadCurrentTaxBills(tmk, parsed, scrapedAt, observedYear);
    await loadGenericSections(tmk, parsed, scrapedAt, observedYear);

    // Update status
    await rawQuery(
      `UPDATE scrape_status SET load_status='success', loaded_at=NOW(), error=NULL WHERE tmk=?`,
      [tmk],
    );

    log(`${tmk}: loaded`);
    return `${tmk}: loaded`;
  } catch (e) {
    const errorMsg = errorMessage(e);
    await rawQuery(
      `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
      [errorMsg.slice(0, 500), tmk],
    );
    throw e;
  }
}
