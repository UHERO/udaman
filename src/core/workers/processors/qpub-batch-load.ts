/**
 * Batch Loading for QPub Rebuild
 *
 * Processes TMKs in batches of 500, loading all tables for the entire batch
 * using multi-row SQL. Reduces ~60M queries → ~50K queries for a full rebuild.
 *
 * All DB functions accept a `DbConnection` parameter so callers can target
 * either the remote production database or a local rebuild database.
 */

import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { getIslandCode } from "@/core/crawlers/qpub/config";
import type { Logger } from "@/core/observability/logger";
import { rawQuery, insertAndGetId } from "@/lib/mysql/hhdb";

import {
  str,
  int,
  dec,
  parseDateValue,
  sqlDate,
  getMaxTaxYear,
  getAssessmentPropertyClass,
  unitParcelToTmk,
  errorMessage,
  GENERIC_SECTION_MAP,
  type Row,
} from "./qpub-load";

// ─── Types ──────────────────────────────────────────────────────────

export type BatchItem = {
  tmk: string;
  data: ParsedProperty;
  scrapedAt: Date;
  observedYear: number;
};

export type BatchResult = {
  succeeded: number;
  failed: number;
  errors: Array<{ tmk: string; error: string }>;
};

/** Injectable database connection — allows targeting local or remote DB. */
export type DbConnection = {
  query: typeof rawQuery;
  insertAndGetId: typeof insertAndGetId;
};

type SqlValue = string | number | null;

/** Default connection pointing at the remote production database. */
const REMOTE_DB: DbConnection = { query: rawQuery, insertAndGetId };

// ─── Core Primitives ────────────────────────────────────────────────

const INSERT_CHUNK_SIZE = 2000;
const DELETE_CHUNK_SIZE = 1000;

/**
 * Multi-row INSERT with automatic chunking at INSERT_CHUNK_SIZE rows.
 * Optionally appends ON DUPLICATE KEY UPDATE clause.
 */
async function batchInsert(
  db: DbConnection,
  opts: {
    table: string;
    columns: string[];
    rows: SqlValue[][];
    onDuplicate?: string;
  },
): Promise<void> {
  const { table, columns, rows, onDuplicate } = opts;
  if (rows.length === 0) return;

  const colList = columns.join(", ");
  const rowPlaceholder = `(${columns.map(() => "?").join(", ")})`;
  const suffix = onDuplicate ? ` ON DUPLICATE KEY UPDATE ${onDuplicate}` : "";

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const placeholders = chunk.map(() => rowPlaceholder).join(", ");
    const values = chunk.flat();

    await db.query(
      `INSERT INTO ${table} (${colList}) VALUES ${placeholders}${suffix}`,
      values as (string | number | Date | null)[],
    );
  }
}

/**
 * DELETE WHERE tmk IN (...) with chunking at DELETE_CHUNK_SIZE.
 */
async function batchDeleteByTmk(db: DbConnection, table: string, tmks: string[]): Promise<void> {
  if (tmks.length === 0) return;

  for (let i = 0; i < tmks.length; i += DELETE_CHUNK_SIZE) {
    const chunk = tmks.slice(i, i + DELETE_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    await db.query(
      `DELETE FROM ${table} WHERE tmk IN (${placeholders})`,
      chunk,
    );
  }
}

/**
 * INSERT IGNORE with automatic chunking (for stub properties that may already exist).
 */
async function batchInsertIgnore(
  db: DbConnection,
  opts: {
    table: string;
    columns: string[];
    rows: SqlValue[][];
  },
): Promise<void> {
  const { table, columns, rows } = opts;
  if (rows.length === 0) return;

  const colList = columns.join(", ");
  const rowPlaceholder = `(${columns.map(() => "?").join(", ")})`;

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const placeholders = chunk.map(() => rowPlaceholder).join(", ");
    const values = chunk.flat();

    await db.query(
      `INSERT IGNORE INTO ${table} (${colList}) VALUES ${placeholders}`,
      values as (string | number | Date | null)[],
    );
  }
}

// ─── Table Extractors ───────────────────────────────────────────────

function extractProperties(items: BatchItem[]): SqlValue[][] {
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
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
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

function extractParcels(items: BatchItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];

  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const parcel = data.parcel_information as Row | undefined;
    if (!parcel) continue;

    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
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

function extractOwners(items: BatchItem[]): SqlValue[][] {
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

function extractAssessments(items: BatchItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];

  for (const { tmk, data, scrapedAt } of items) {
    const assessInfo = data.assessment_information as Row | undefined;
    if (!assessInfo) continue;

    const current = (assessInfo.current_assessments as Row[]) ?? [];
    const historical = (assessInfo.historical_assessments as Row[]) ?? [];
    const allAssessments = [...current, ...historical];
    const scrapedAtStr = sqlDate(scrapedAt);

    for (const a of allAssessments) {
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

function extractLandClassifications(items: BatchItem[]): SqlValue[][] {
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

function extractResidentialImprovements(items: BatchItem[]): SqlValue[][] {
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

function extractSales(items: BatchItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];

  for (const { tmk, data } of items) {
    const salesInfo =
      (data.sales_information as Row | undefined) ??
      (data.conveyance_information as Row | undefined);
    if (!salesInfo?.sales) continue;

    const sales = salesInfo.sales as Row[];
    for (const s of sales) {
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

function extractPermits(items: BatchItem[]): SqlValue[][] {
  const rows: SqlValue[][] = [];

  for (const { tmk, data } of items) {
    const permitInfo = data.permit_information as Row | undefined;
    if (!permitInfo) continue;

    const permits = (permitInfo.table_data ?? []) as Row[];
    for (const p of permits) {
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

function extractCurrentTaxBills(items: BatchItem[]): SqlValue[][] {
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

// ─── Historical Tax Extraction ──────────────────────────────────────

type HistoricalTaxSummaryRow = SqlValue[];
type HistoricalTaxDetailRow = { summaryKey: string; row: SqlValue[] };
type HistoricalTaxPaymentRow = { summaryKey: string; row: SqlValue[] };
type HistoricalTaxCreditRow = { summaryKey: string; row: SqlValue[] };

type HistoricalTaxExtracted = {
  summaries: { key: string; row: HistoricalTaxSummaryRow }[];
  details: HistoricalTaxDetailRow[];
  payments: HistoricalTaxPaymentRow[];
  credits: HistoricalTaxCreditRow[];
};

function extractHistoricalTax(items: BatchItem[]): HistoricalTaxExtracted {
  const result: HistoricalTaxExtracted = {
    summaries: [],
    details: [],
    payments: [],
    credits: [],
  };

  for (const { tmk, data, scrapedAt } of items) {
    const taxInfo = data.historical_tax_information as Row | undefined;
    if (!taxInfo?.tax_summary) continue;

    const summaries = taxInfo.tax_summary as Row[];
    const scrapedAtStr = sqlDate(scrapedAt);

    for (const summary of summaries) {
      const year = int(summary.year);
      if (!year) continue;

      const detailTotals = (summary.tax_details_totals ?? {}) as Row;
      const paymentTotals = (summary.tax_payments_totals ?? {}) as Row;
      const creditTotals = (summary.tax_credits_totals ?? {}) as Row;

      // Key for linking children to parent
      const summaryKey = `${tmk}|${year}`;

      result.summaries.push({
        key: summaryKey,
        row: [
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
      });

      // Extract children
      const taxDetails = (summary.tax_details ?? []) as Row[];
      for (const d of taxDetails) {
        result.details.push({
          summaryKey,
          row: [
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
        });
      }

      const taxPayments = (summary.tax_payments ?? []) as Row[];
      for (const p of taxPayments) {
        result.payments.push({
          summaryKey,
          row: [
            tmk,
            scrapedAtStr,
            str(p.payment_sequence),
            parseDateValue(str(p.effective_date)),
            dec(p.tax),
            dec(p.penalty),
            dec(p.interest),
            dec(p.other),
          ],
        });
      }

      const taxCredits = (summary.tax_credits ?? []) as Row[];
      for (const c of taxCredits) {
        result.credits.push({
          summaryKey,
          row: [tmk, scrapedAtStr, str(c.period), str(c.description), dec(c.amount)],
        });
      }
    }
  }

  return result;
}

// ─── Commercial Improvements Extraction ─────────────────────────────

type CommercialParentRow = {
  tmk: string;
  row: SqlValue[];
  details: SqlValue[][];
};

function extractCommercialImprovements(items: BatchItem[]): CommercialParentRow[] {
  const parents: CommercialParentRow[] = [];

  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const ciInfo = data.commercial_improvement_information as Row | undefined;
    if (!ciInfo) continue;

    const buildings = (ciInfo.buildings as Row[] | undefined) ?? [];
    const scrapedAtStr = sqlDate(scrapedAt);

    for (const b of buildings) {
      const floorDetails = (b.floor_details as Row[] | undefined) ?? [];
      const details: SqlValue[][] = [];

      for (const d of floorDetails) {
        details.push([
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

      parents.push({
        tmk,
        row: [
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
        ],
        details,
      });
    }
  }

  return parents;
}

// ─── Condominium Extraction ─────────────────────────────────────────

type CondoExtracted = {
  projects: { tmk: string; projectName: string | null; unitCount: number | null }[];
  unitProperties: SqlValue[][];
  units: SqlValue[][];
};

function extractCondominium(items: BatchItem[]): CondoExtracted {
  const result: CondoExtracted = {
    projects: [],
    unitProperties: [],
    units: [],
  };

  for (const { tmk, data } of items) {
    if (data.status !== "condo_project") continue;

    const parcel = data.parcel_information as Row | undefined;
    const unitInfo = data.condominium_apartment_unit_information as Row | undefined;
    const units = (unitInfo?.table_data ?? []) as Row[];

    const improvInfo =
      (data.residential_improvement_information as Row | undefined) ??
      (data.improvement_information as Row | undefined);
    const firstBuilding = ((improvInfo?.buildings as Row[] | undefined) ?? [])[0];
    const projectName =
      str(parcel?.project_name) ?? str(firstBuilding?.condo_name);
    const unitCount = units.length || null;

    result.projects.push({ tmk, projectName, unitCount });

    const islandCode = getIslandCode(tmk);
    for (const unit of units) {
      const unitParcel = str(unit.parcel_number);
      if (!unitParcel) continue;

      const unitTmk = unitParcelToTmk(tmk, unitParcel);
      const unitNumber = str(unit.unit_number);
      const ownerName = str(unit.owner_name);

      // Stub property for FK
      result.unitProperties.push([unitTmk, islandCode]);
      // Unit record
      result.units.push([unitTmk, tmk, unitNumber, ownerName]);
    }
  }

  return result;
}

// ─── Generic Section Extraction ─────────────────────────────────────

/** Column cache so we only query SHOW COLUMNS once per table per rebuild */
const columnCache = new Map<string, Set<string>>();

async function getTableColumns(db: DbConnection, table: string): Promise<Set<string>> {
  if (columnCache.has(table)) return columnCache.get(table)!;
  const columns = await db.query<{ Field: string }>(`SHOW COLUMNS FROM ${table}`, []);
  const set = new Set(columns.map((c) => c.Field));
  columnCache.set(table, set);
  return set;
}

/** Clear the column cache (call at start of rebuild) */
export function clearColumnCache(): void {
  columnCache.clear();
}

async function extractGenericSection(
  db: DbConnection,
  items: BatchItem[],
  sectionName: string,
  tableName: string,
): Promise<{ columns: string[]; rows: SqlValue[][] }> {
  const columnNames = await getTableColumns(db, tableName);
  const hasLastYearObserved = columnNames.has("last_year_observed");

  // Determine usable columns (exclude system cols)
  const excludedCols = new Set(["id", "created_at"]);

  // Collect all rows
  const allRows: SqlValue[][] = [];
  let detectedCols: string[] | null = null;

  for (const { tmk, data, scrapedAt, observedYear } of items) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    const rows =
      (sectionData.table_data as Row[] | undefined) ??
      (Array.isArray(sectionData) ? sectionData : [sectionData]);

    for (const row of rows) {
      const matched: Record<string, SqlValue> = { tmk };
      if (columnNames.has("scraped_at")) matched.scraped_at = sqlDate(scrapedAt);
      if (hasLastYearObserved) matched.last_year_observed = observedYear;

      for (const [key, value] of Object.entries(row)) {
        const snakeKey = key
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_");
        if (columnNames.has(snakeKey) && !excludedCols.has(snakeKey) &&
            snakeKey !== "tmk" && snakeKey !== "scraped_at" && snakeKey !== "last_year_observed") {
          matched[snakeKey] = value === null || value === undefined ? null : String(value);
        }
      }

      if (!detectedCols) {
        detectedCols = Object.keys(matched);
      }

      // Build row in column order
      const rowValues = (detectedCols ?? Object.keys(matched)).map((col) => matched[col] ?? null);
      allRows.push(rowValues);
    }
  }

  return { columns: detectedCols ?? [], rows: allRows };
}

// ─── Table Loading Strategies ───────────────────────────────────────

async function loadPropertiesBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const rows = extractProperties(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "island_code", "parcel_number", "location_address", "address_other",
    "project_name", "legal_information", "property_class",
    "land_area_sqft", "land_area_acres",
    "neighborhood_code", "zoning", "parcel_note",
    "damage", "reentry_zone", "zone_color",
    "non_taxable_status", "living_units",
    "map_url", "sketch_url",
  ];

  const onDuplicate = [
    "parcel_number=VALUES(parcel_number)", "location_address=VALUES(location_address)",
    "address_other=VALUES(address_other)", "project_name=VALUES(project_name)",
    "legal_information=VALUES(legal_information)", "property_class=VALUES(property_class)",
    "land_area_sqft=VALUES(land_area_sqft)", "land_area_acres=VALUES(land_area_acres)",
    "neighborhood_code=VALUES(neighborhood_code)", "zoning=VALUES(zoning)",
    "parcel_note=VALUES(parcel_note)", "damage=VALUES(damage)",
    "reentry_zone=VALUES(reentry_zone)", "zone_color=VALUES(zone_color)",
    "non_taxable_status=VALUES(non_taxable_status)", "living_units=VALUES(living_units)",
    "map_url=VALUES(map_url)", "sketch_url=VALUES(sketch_url)",
    "updated_at=NOW()",
  ].join(", ");

  await batchInsert(db, { table: "properties", columns, rows, onDuplicate });
}

async function loadParcelsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "parcels", tmks);

  const rows = extractParcels(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "last_year_observed",
    "parcel_number", "location_address", "address_other",
    "project_name", "legal_information", "property_class",
    "land_area_sqft", "land_area_acres",
    "neighborhood_code", "zoning", "parcel_note",
    "damage", "reentry_zone", "zone_color",
    "non_taxable_status", "living_units",
  ];

  await batchInsert(db, { table: "parcels", columns, rows });
}

async function loadOwnersBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "owners", tmks);

  const rows = extractOwners(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "last_year_observed",
    "owner_name", "owner_type", "owner_address", "sequence_order",
  ];

  await batchInsert(db, { table: "owners", columns, rows });
}

async function loadAssessmentsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const rows = extractAssessments(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "tax_year", "property_class",
    "assessed_land_value", "assessed_building_value", "dedicated_use_value",
    "land_exemption", "building_exemption",
    "net_taxable_land_value", "net_taxable_building_value",
    "total_property_assessed_value", "total_property_exemption", "total_net_taxable_value",
    "agricultural_land_value", "market_land_value", "market_building_value", "total_market_value",
  ];

  const onDuplicate = [
    "scraped_at=VALUES(scraped_at)", "property_class=VALUES(property_class)",
    "assessed_land_value=VALUES(assessed_land_value)",
    "assessed_building_value=VALUES(assessed_building_value)",
    "dedicated_use_value=VALUES(dedicated_use_value)",
    "land_exemption=VALUES(land_exemption)", "building_exemption=VALUES(building_exemption)",
    "net_taxable_land_value=VALUES(net_taxable_land_value)",
    "net_taxable_building_value=VALUES(net_taxable_building_value)",
    "total_property_assessed_value=VALUES(total_property_assessed_value)",
    "total_property_exemption=VALUES(total_property_exemption)",
    "total_net_taxable_value=VALUES(total_net_taxable_value)",
    "agricultural_land_value=VALUES(agricultural_land_value)",
    "market_land_value=VALUES(market_land_value)",
    "market_building_value=VALUES(market_building_value)",
    "total_market_value=VALUES(total_market_value)",
  ].join(", ");

  await batchInsert(db, { table: "assessments", columns, rows, onDuplicate });
}

async function loadLandClassificationsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "land_classifications", tmks);

  const rows = extractLandClassifications(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "last_year_observed",
    "land_classification", "square_footage", "acreage", "agricultural_use_indicator",
  ];

  await batchInsert(db, { table: "land_classifications", columns, rows });
}

async function loadResidentialImprovementsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "residential_improvements", tmks);

  const rows = extractResidentialImprovements(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "last_year_observed",
    "building_number", "year_built", "eff_year_built",
    "living_area", "bedrooms", "full_bath", "half_bath",
    "occupancy", "framing", "percent_complete",
    "heating_cooling", "exterior_wall", "roof_material",
    "fireplace", "grade", "building_value",
    "total_room_count", "condo_style", "condo_view",
    "floor_level", "parking_spaces",
  ];

  await batchInsert(db, { table: "residential_improvements", columns, rows });
}

async function loadCommercialImprovementsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);

  // Delete children first (FK constraint), then parents
  await batchDeleteByTmk(db, "commercial_improvement_details", tmks);
  await batchDeleteByTmk(db, "commercial_improvements", tmks);

  const parents = extractCommercialImprovements(items);
  if (parents.length === 0) return;

  const parentColumns = [
    "tmk", "scraped_at", "last_year_observed",
    "building_number", "building_card",
    "year_built", "effective_year_built",
    "improvement_name", "property_class", "structure_type",
    "units", "identical_units", "gross_building_description",
    "building_type", "building_square_footage",
    "percent_complete", "value",
  ];

  // Insert parents one by one to get IDs for children, but batch the children
  const detailColumns = [
    "commercial_improvement_id", "tmk", "scraped_at", "last_year_observed",
    "card", "section", "floor", "`usage`", "area", "perimeter",
    "exterior_wall", "wall_height", "occupancy",
  ];

  // Since we need parent IDs, insert parents individually and collect detail rows
  const allDetailRows: SqlValue[][] = [];

  for (const parent of parents) {
    if (parent.details.length === 0) {
      // No details — can batch insert parent (but still need INSERT for consistency)
      const parentId = await db.insertAndGetId(
        `INSERT INTO commercial_improvements (${parentColumns.join(", ")}) VALUES (${parentColumns.map(() => "?").join(", ")})`,
        parent.row as (string | number | Date | null)[],
      );
      // No children to insert
      void parentId;
    } else {
      const parentId = await db.insertAndGetId(
        `INSERT INTO commercial_improvements (${parentColumns.join(", ")}) VALUES (${parentColumns.map(() => "?").join(", ")})`,
        parent.row as (string | number | Date | null)[],
      );
      for (const detail of parent.details) {
        allDetailRows.push([parentId, ...detail]);
      }
    }
  }

  // Batch insert all detail rows
  if (allDetailRows.length > 0) {
    // Use raw column names (usage needs backtick)
    const detailColsRaw = [
      "commercial_improvement_id", "tmk", "scraped_at", "last_year_observed",
      "card", "section", "floor", "usage", "area", "perimeter",
      "exterior_wall", "wall_height", "occupancy",
    ];

    // Build INSERT manually to handle the backtick on `usage`
    const colList = detailColsRaw.map((c) => c === "usage" ? "`usage`" : c).join(", ");
    const rowPlaceholder = `(${detailColsRaw.map(() => "?").join(", ")})`;

    for (let i = 0; i < allDetailRows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = allDetailRows.slice(i, i + INSERT_CHUNK_SIZE);
      const placeholders = chunk.map(() => rowPlaceholder).join(", ");
      const values = chunk.flat();

      await db.query(
        `INSERT INTO commercial_improvement_details (${colList}) VALUES ${placeholders}`,
        values as (string | number | Date | null)[],
      );
    }
  }
}

async function loadSalesBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "sales", tmks);

  const rows = extractSales(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "sale_date", "sale_amount", "instrument", "instrument_type",
    "instrument_description", "valid_sale", "date_of_recording",
    "land_court_document_number", "cert", "book_page", "conveyance_tax",
  ];

  await batchInsert(db, { table: "sales", columns, rows });
}

async function loadPermitsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "permits", tmks);

  const rows = extractPermits(items);
  if (rows.length === 0) return;

  const columns = ["tmk", "permit_date", "permit_number", "reason", "permit_amount"];

  await batchInsert(db, { table: "permits", columns, rows });
}

async function loadCurrentTaxBillsBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, "current_tax_bills", tmks);

  const rows = extractCurrentTaxBills(items);
  if (rows.length === 0) return;

  const columns = [
    "tmk", "scraped_at", "last_year_observed",
    "tax_period", "description", "original_due_date",
    "taxes_assessment", "tax_credits", "net_tax",
    "penalty", "interest", "other", "amount_due",
  ];

  await batchInsert(db, { table: "current_tax_bills", columns, rows });
}

async function loadHistoricalTaxBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  const extracted = extractHistoricalTax(items);

  if (extracted.summaries.length === 0) return;

  // Delete children first (FK), then summaries
  // We need to get summary IDs to delete children, so delete by TMK
  await batchDeleteByTmk(db, "historical_tax_details", tmks);
  await batchDeleteByTmk(db, "historical_tax_payments", tmks);
  await batchDeleteByTmk(db, "historical_tax_credits", tmks);
  await batchDeleteByTmk(db, "historical_tax_summary", tmks);

  // Insert all summaries
  const summaryColumns = [
    "tmk", "scraped_at", "year", "tax", "payments_and_credits",
    "penalty", "interest", "other", "amount_due",
    "tax_details_total_tax", "tax_details_total_payments_credits",
    "tax_details_total_penalty", "tax_details_total_interest", "tax_details_total_other",
    "tax_payments_total_tax", "tax_payments_total_penalty",
    "tax_payments_total_interest", "tax_payments_total_other",
    "tax_credits_total_amount",
  ];

  await batchInsert(db, {
    table: "historical_tax_summary",
    columns: summaryColumns,
    rows: extracted.summaries.map((s) => s.row),
  });

  // Now SELECT back all summary IDs for the batch TMKs to link children
  if (extracted.details.length === 0 && extracted.payments.length === 0 && extracted.credits.length === 0) {
    return;
  }

  // Build a map of summaryKey → id
  const summaryIdMap = new Map<string, number>();
  for (let i = 0; i < tmks.length; i += DELETE_CHUNK_SIZE) {
    const chunk = tmks.slice(i, i + DELETE_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db.query<{ id: number; tmk: string; year: number }>(
      `SELECT id, tmk, year FROM historical_tax_summary WHERE tmk IN (${placeholders})`,
      chunk,
    );
    for (const r of rows) {
      summaryIdMap.set(`${r.tmk}|${r.year}`, r.id);
    }
  }

  // Insert details
  if (extracted.details.length > 0) {
    const detailRows: SqlValue[][] = [];
    for (const d of extracted.details) {
      const summaryId = summaryIdMap.get(d.summaryKey);
      if (!summaryId) continue;
      detailRows.push([summaryId, ...d.row]);
    }

    const detailColumns = [
      "historical_tax_summary_id", "tmk", "scraped_at",
      "tax_period", "description", "tax", "payments_credits",
      "penalty", "interest", "other",
    ];

    await batchInsert(db, { table: "historical_tax_details", columns: detailColumns, rows: detailRows });
  }

  // Insert payments
  if (extracted.payments.length > 0) {
    const paymentRows: SqlValue[][] = [];
    for (const p of extracted.payments) {
      const summaryId = summaryIdMap.get(p.summaryKey);
      if (!summaryId) continue;
      paymentRows.push([summaryId, ...p.row]);
    }

    const paymentColumns = [
      "historical_tax_summary_id", "tmk", "scraped_at",
      "payment_sequence", "effective_date", "tax",
      "penalty", "interest", "other",
    ];

    await batchInsert(db, { table: "historical_tax_payments", columns: paymentColumns, rows: paymentRows });
  }

  // Insert credits
  if (extracted.credits.length > 0) {
    const creditRows: SqlValue[][] = [];
    for (const c of extracted.credits) {
      const summaryId = summaryIdMap.get(c.summaryKey);
      if (!summaryId) continue;
      creditRows.push([summaryId, ...c.row]);
    }

    const creditColumns = [
      "historical_tax_summary_id", "tmk", "scraped_at",
      "period", "description", "amount",
    ];

    await batchInsert(db, { table: "historical_tax_credits", columns: creditColumns, rows: creditRows });
  }
}

async function loadCondominiumBatch(db: DbConnection, items: BatchItem[], _log: Logger): Promise<void> {
  const extracted = extractCondominium(items);
  if (extracted.projects.length === 0) return;

  // Upsert projects
  const projectColumns = ["tmk", "project_name", "unit_count"];
  const projectRows: SqlValue[][] = extracted.projects.map((p) => [
    p.tmk, p.projectName, p.unitCount,
  ]);

  await batchInsert(db, {
    table: "condominium_projects",
    columns: projectColumns,
    rows: projectRows,
    onDuplicate: "project_name=VALUES(project_name), unit_count=VALUES(unit_count)",
  });

  // Insert stub properties for units (INSERT IGNORE — may already exist)
  if (extracted.unitProperties.length > 0) {
    await batchInsertIgnore(db, {
      table: "properties",
      columns: ["tmk", "island_code"],
      rows: extracted.unitProperties,
    });
  }

  // Upsert units
  if (extracted.units.length > 0) {
    const unitColumns = ["tmk", "parent_tmk", "unit_number", "owner_name"];
    await batchInsert(db, {
      table: "condominium_units",
      columns: unitColumns,
      rows: extracted.units,
      onDuplicate: "unit_number=VALUES(unit_number), owner_name=VALUES(owner_name)",
    });
  }
}

async function loadGenericSectionBatch(
  db: DbConnection,
  items: BatchItem[],
  sectionName: string,
  tableName: string,
  _log: Logger,
): Promise<void> {
  const tmks = items.map((i) => i.tmk);
  await batchDeleteByTmk(db, tableName, tmks);

  const { columns, rows } = await extractGenericSection(db, items, sectionName, tableName);
  if (rows.length === 0) return;

  await batchInsert(db, { table: tableName, columns, rows });
}

// ─── Safe Batch Load with Fallback ─────────────────────────────────

async function safeBatchLoad(
  db: DbConnection,
  items: BatchItem[],
  loadFn: (db: DbConnection, items: BatchItem[], log: Logger) => Promise<void>,
  tableName: string,
  log: Logger,
): Promise<BatchResult> {
  const result: BatchResult = { succeeded: 0, failed: 0, errors: [] };

  try {
    await loadFn(db, items, log);
    result.succeeded = items.length;
  } catch (e) {
    // Batch failed — fall back to per-item loading
    log.warn(
      { table: tableName, error: errorMessage(e) },
      `Batch INSERT failed for ${tableName}, falling back to per-item`,
    );

    for (const item of items) {
      try {
        await loadFn(db, [item], log);
        result.succeeded++;
      } catch (itemErr) {
        result.failed++;
        result.errors.push({ tmk: item.tmk, error: errorMessage(itemErr) });
      }
    }
  }

  return result;
}

// ─── Table Registry ─────────────────────────────────────────────────

type BatchTableLoader = (db: DbConnection, items: BatchItem[], log: Logger) => Promise<void>;

const BATCH_TABLE_LOADERS: Record<string, BatchTableLoader> = {
  properties: loadPropertiesBatch,
  parcels: loadParcelsBatch,
  owners: loadOwnersBatch,
  assessments: loadAssessmentsBatch,
  land_classifications: loadLandClassificationsBatch,
  residential_improvements: loadResidentialImprovementsBatch,
  commercial_improvements: loadCommercialImprovementsBatch,
  sales: loadSalesBatch,
  permits: loadPermitsBatch,
  historical_tax: loadHistoricalTaxBatch,
  current_tax_bills: loadCurrentTaxBillsBatch,
  condominium: loadCondominiumBatch,
};

// ─── Main Entry Points ──────────────────────────────────────────────

/**
 * Load all tables for a batch of items.
 * Processes tables in FK-safe order.
 */
export async function batchLoadAll(
  items: BatchItem[],
  log: Logger,
  db: DbConnection = REMOTE_DB,
): Promise<BatchResult> {
  const combined: BatchResult = { succeeded: items.length, failed: 0, errors: [] };

  // Phase 1: properties (all FKs point here)
  const propResult = await safeBatchLoad(db, items, loadPropertiesBatch, "properties", log);
  if (propResult.failed > 0) {
    combined.errors.push(...propResult.errors);
  }

  // Phase 2: condominium (creates unit properties)
  const condoResult = await safeBatchLoad(db, items, loadCondominiumBatch, "condominium", log);
  if (condoResult.failed > 0) {
    combined.errors.push(...condoResult.errors);
  }

  // Phase 3: All other tables
  const phase3Tables: [string, BatchTableLoader][] = [
    ["parcels", loadParcelsBatch],
    ["owners", loadOwnersBatch],
    ["assessments", loadAssessmentsBatch],
    ["land_classifications", loadLandClassificationsBatch],
    ["residential_improvements", loadResidentialImprovementsBatch],
    ["commercial_improvements", loadCommercialImprovementsBatch],
    ["sales", loadSalesBatch],
    ["permits", loadPermitsBatch],
    ["historical_tax", loadHistoricalTaxBatch],
    ["current_tax_bills", loadCurrentTaxBillsBatch],
  ];

  for (const [tableName, loader] of phase3Tables) {
    const tableResult = await safeBatchLoad(db, items, loader, tableName, log);
    if (tableResult.failed > 0) {
      combined.errors.push(...tableResult.errors);
    }
  }

  // Phase 4: Generic sections
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    try {
      await loadGenericSectionBatch(db, items, sectionName, tableName, log);
    } catch (e) {
      // Generic sections are best-effort — log and continue
      log.warn({ table: tableName, error: errorMessage(e) }, "Generic section batch failed");
    }
  }

  // Determine which TMKs failed across any table
  const failedTmks = new Set(combined.errors.map((e) => e.tmk));
  combined.failed = failedTmks.size;
  combined.succeeded = items.length - failedTmks.size;

  return combined;
}

/**
 * Load a single table for a batch of items.
 */
export async function batchLoadTable(
  table: string,
  items: BatchItem[],
  log: Logger,
  db: DbConnection = REMOTE_DB,
): Promise<BatchResult> {
  // Check if it's a known batch loader
  const loader = BATCH_TABLE_LOADERS[table];
  if (loader) {
    return safeBatchLoad(db, items, loader, table, log);
  }

  // Check if it's a generic section
  const sectionEntry = Object.entries(GENERIC_SECTION_MAP).find(([, t]) => t === table);
  if (sectionEntry) {
    const [sectionName, tableName] = sectionEntry;
    return safeBatchLoad(
      db,
      items,
      (conn, batchItems, batchLog) => loadGenericSectionBatch(conn, batchItems, sectionName, tableName, batchLog),
      tableName,
      log,
    );
  }

  throw new Error(`Unknown table for batch loading: "${table}"`);
}
