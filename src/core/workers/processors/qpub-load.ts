import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import {
  getHtmlPath,
  getIslandCode,
  getJsonPath,
  tmkFromParcelNumber,
} from "@/core/crawlers/qpub/config";
import { toHstSql } from "@catalog/utils/time";

import type { ParsedProperty } from "@/core/crawlers/qpub/parse";
import { condoUnitRows, parsePropertyHTML } from "@/core/crawlers/qpub/parse";
import { parseDollarValue } from "@/core/crawlers/qpub/parse-utils";
import { insertAndGetId, rawQuery } from "@/lib/mysql/hhdb";

// ─── Error helper ────────────────────────────────────────────────

/** Extract a readable message from any thrown value (Error, Bun SQL object, string, etc.) */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    // Bun SQL errors are plain objects with a message property
    if (
      "message" in e &&
      typeof (e as Record<string, unknown>).message === "string"
    ) {
      return (e as Record<string, unknown>).message as string;
    }
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through */
    }
  }
  return String(e);
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Parse a date string like "01/15/2024" or "2024-01-15" into a Date-compatible string, or null */
export function parseDateValue(
  value: string | null | undefined,
): string | null {
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
export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

/** Get integer or null */
export function int(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseDollarValue(v as string | number, true);
  return n;
}

/** Get decimal or null */
export function dec(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseDollarValue(v as string | number, false);
  return n;
}

export type Row = Record<string, unknown>;

/** Extract property_class from the most recent assessment record. */
export function getAssessmentPropertyClass(
  data: ParsedProperty,
): string | null {
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

/** Format an instant for SQL insertion (YYYY-MM-DD HH:MM:SS) as HST
 *  wall-clock, consistent with NOW()-stamped DATETIME columns. */
export function sqlDate(d: Date): string {
  return toHstSql(d);
}

/**
 * Derive the observation year from the max tax_year in the assessment data.
 * Falls back to current calendar year if no assessments are present.
 */
export function getMaxTaxYear(data: ParsedProperty): number {
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
 *
 * Numeric-looking values are canonicalized through Number() so a freshly
 * coerced value compares equal to what the DB hands back for a numeric
 * column — DECIMAL columns return with trailing zeros ("5.0000") while
 * dec() yields 5, and without this every unchanged DECIMAL row would look
 * changed and insert a new snapshot version on every load.
 */
function normalizeForCompare(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(n);
  }
  return s;
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
    if (
      normalizeForCompare(existing[field]) !==
      normalizeForCompare(incoming[field])
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Group a parcel's rows by a derived key, preserving both group discovery
 * order and row order within each group. Keys are compared through
 * normalizeForCompare so "5.0000" and 5 land in the same group, exactly as
 * the data comparison would treat them.
 */
export function groupRowsByKey<T>(
  rows: T[],
  keyValues: (row: T) => unknown[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyValues(row).map(normalizeForCompare).join("\u0000");
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Pair one identity group's incoming rows against its existing rows.
 *
 * A batch (one parcel's rows in one load) can legitimately contain k rows with
 * the SAME identity — two "FRAME UTILITY SHED / 1927" structures on one Maui
 * parcel. The old 1-vs-latest comparison made such a pair ping-pong: each row
 * saw the other's version as "changed" and inserted a new version, doubling
 * the pair on every load.
 *
 * `existing` is the k most-recent rows for the identity (last_year_observed
 * DESC, id DESC). Each incoming row claims the most recent not-yet-claimed
 * existing row whose data matches → that row's span gets extended. No match →
 * a new version is inserted. Fewer existing rows than incoming → the shortfall
 * is inserted.
 *
 * Claiming by data match rather than strict Nth-to-Nth position matters when
 * the group's members differ in their data fields: existing rows come back in
 * id-DESC (reverse insertion) order, so positional pairing would compare row A
 * against row B's version and reintroduce the ping-pong for exactly the rows
 * this exists to fix. For a single-row group (k=1, the overwhelmingly common
 * case) this reduces to the old behavior precisely: match → update, differ →
 * insert.
 */
export function pairSnapshotGroup<E extends Record<string, unknown>>(
  incomingData: Array<Record<string, unknown>>,
  existing: E[],
): Array<{ kind: "update"; row: E } | { kind: "insert" }> {
  const claimed = new Array<boolean>(existing.length).fill(false);
  return incomingData.map((data) => {
    const fields = Object.keys(data);
    for (let i = 0; i < existing.length; i++) {
      if (claimed[i]) continue;
      if (dataFieldsMatch(existing[i], data, fields)) {
        claimed[i] = true;
        return { kind: "update" as const, row: existing[i] };
      }
    }
    return { kind: "insert" as const };
  });
}

/** One incoming snapshot row, split into its identity and data parts. */
export type SnapshotRow = {
  identityFields: Record<string, unknown>;
  dataFields: Record<string, unknown>;
};

/**
 * Upsert a parcel's snapshot rows using occurrence-aware change detection.
 *
 * Rows are grouped by identity first; each group of size k is compared against
 * the k most-recent existing rows for that identity (see pairSnapshotGroup):
 *
 * 1. SELECT the k most recent records matching tmk + identity
 * 2. Incoming row whose data matches an unclaimed existing row →
 *    UPDATE that row's last_year_observed + scraped_at
 * 3. Otherwise → INSERT a new version, old rows kept as history
 *
 * Identity fields are compared NULL-safe (<=>) — a NULL identity value must
 * match its stored NULL, not silently never match.
 */
async function batchUpsertSnapshot(opts: {
  table: string;
  tmk: string;
  observedYear: number;
  scrapedAt: Date;
  rows: SnapshotRow[];
}): Promise<void> {
  const { table, tmk, observedYear, scrapedAt, rows } = opts;
  if (rows.length === 0) return;
  const scrapedAtStr = sqlDate(scrapedAt);

  const groups = groupRowsByKey(rows, (r) => Object.values(r.identityFields));

  for (const group of groups.values()) {
    // Build WHERE clause from the group's identity fields (NULL-safe)
    const identityEntries = Object.entries(group[0].identityFields);
    const identityWhere =
      identityEntries.length > 0
        ? " AND " + identityEntries.map(([col]) => `${col}<=>?`).join(" AND ")
        : "";
    const identityValues = identityEntries.map(([, v]) =>
      v === undefined ? null : v,
    ) as (string | number | Date | null)[];

    // SELECT the k most recent records matching tmk + identity
    const existing = await rawQuery<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE tmk=?${identityWhere} ORDER BY last_year_observed DESC, id DESC LIMIT ${group.length}`,
      [tmk, ...identityValues],
    );

    const actions = pairSnapshotGroup(
      group.map((r) => r.dataFields),
      existing,
    );

    for (let i = 0; i < group.length; i++) {
      const action = actions[i];
      if (action.kind === "update") {
        // Data unchanged → bump last_year_observed + scraped_at
        await rawQuery(
          `UPDATE ${table} SET last_year_observed=?, scraped_at=? WHERE id=?`,
          [observedYear, scrapedAtStr, action.row.id as number],
        );
        continue;
      }

      // Data changed or no existing record → INSERT new row
      const allFields: Record<string, unknown> = {
        tmk,
        scraped_at: scrapedAtStr,
        last_year_observed: observedYear,
        ...group[i].identityFields,
        ...group[i].dataFields,
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
    }
  }
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
      int(parcel.living_units),
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

  await batchUpsertSnapshot({
    table: "parcels",
    tmk,
    observedYear: year,
    scrapedAt,
    rows: [
      {
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
          living_units: int(parcel.living_units),
        },
      },
    ],
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
    const ownerAddress = str(o.owner_address);

    // Look up existing by identity: tmk + owner_name + owner_type +
    // owner_address. The address is part of the identity, not data: qPublic
    // renders one estate several times with different representative addresses
    // (verified: TMK 2-1-1-003-053-0000 lists "TAU-A,MURPHY K EST / Fee Owner"
    // 3x with three C-O/ATTN addresses) and each must be its own row. A
    // changed address is therefore a new row, never an in-place update.
    // owner_type and owner_address are nullable → NULL-safe compare.
    const existing = await rawQuery<Record<string, unknown>>(
      `SELECT id FROM owners WHERE tmk=? AND owner_name<=>? AND owner_type<=>? AND owner_address<=>? LIMIT 1`,
      [tmk, ownerName, ownerType, ownerAddress],
    );

    if (existing.length > 0) {
      // Found → update last_year_observed, scraped_at, sequence_order
      await rawQuery(
        `UPDATE owners SET last_year_observed=?, scraped_at=?, sequence_order=? WHERE id=?`,
        [year, scrapedAtStr, i + 1, existing[0].id as number],
      );
    } else {
      // Not found → insert new owner
      await rawQuery(
        `INSERT INTO owners (tmk, scraped_at, last_year_observed, owner_name, owner_type, owner_address, sequence_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tmk, scrapedAtStr, year, ownerName, ownerType, ownerAddress, i + 1],
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

  // Identity is (land_classification, square_footage, acreage): a parcel
  // routinely carries several rows of the same classification that differ only
  // in size — 99.4% of within-parcel duplicate groups differ in sqft/acreage —
  // and on classification alone those rows collide and version against each
  // other. The residual fully-identical rows are handled by the
  // occurrence-aware pairing in batchUpsertSnapshot.
  await batchUpsertSnapshot({
    table: "land_classifications",
    tmk,
    observedYear: year,
    scrapedAt,
    rows: classifications.map((c) => ({
      identityFields: {
        land_classification: str(c.land_classification),
        square_footage: int(c.square_footage),
        acreage: dec(c.acreage),
      },
      dataFields: {
        agricultural_use_indicator: str(c.agricultural_use_indicator),
      },
    })),
  });
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

  await batchUpsertSnapshot({
    table: "residential_improvements",
    tmk,
    observedYear: year,
    scrapedAt,
    rows: buildings.map((b) => ({
      identityFields: {
        building_number: int(b.building_number),
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
        percent_complete: parsePercent(b.percent_complete),
        heating_cooling: str(b.heating_cooling),
        exterior_wall: str(b.exterior_wall),
        roof_material: str(b.roof_material),
        fireplace: str(b.fireplace),
        grade: str(b.grade),
        building_value: str(b.building_value),
        total_room_count: int(b.total_room_count),
        // condo_style (Oahu building form) and condo_type (Maui unit
        // position, "Corner") are distinct variables — never cross-assign.
        condo_style: str(b.condo_style),
        condo_type: str(b.condo_type),
        condo_view: str(b.condo_view),
        floor_level: int(b.floor_level ?? b.condo_floor_number),
        parking_spaces: dec(b.parking_spaces),
      },
    })),
  });
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
  const sectionOtherFeatures =
    (ciInfo.other_features as Row[] | undefined) ?? [];
  if (buildings.length === 0 && sectionOtherFeatures.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);
  const scrapedAtStr = sqlDate(scrapedAt);

  // Commercial "Condominium Information" rows (dgCondo) — parsed at the
  // section level; each becomes its own details row with only the six condo
  // columns filled (floor-detail columns null, and vice versa). Both row
  // kinds write through this one statement.
  const condoInfo = (ciInfo.condo_info as Row[] | undefined) ?? [];
  const detailInsertSql = `INSERT INTO commercial_improvement_details
             (commercial_improvement_id, tmk, scraped_at, last_year_observed,
              card, section, floor, \`usage\`, area, perimeter,
              exterior_wall, wall_height, construction, \`rank\`,
              condo_style, condo_type, condo_unit, floor_level, \`view\`, project)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const [bi, b] of buildings.entries()) {
    const buildingNumber = str(b.building_number);
    const buildingCard = int(b.building_card);

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
      // Maui/Kauai's "Building Type" holds the building's proper name — the
      // concept Oahu labels "Improvement Name". building_type stays as scraped.
      improvement_name: str(b.improvement_name ?? b.building_type),
      property_class: str(b.property_class),
      structure_type: str(b.structure_type),
      units: int(b.units),
      identical_units: int(b.identical_units),
      gross_building_description: str(b.gross_building_description),
      building_square_footage: int(b.building_square_footage),
      building_type: str(b.building_type),
      percent_complete: parsePercent(b.percent_complete),
      value: int(b.value),
    };

    const floorDetails = (b.floor_details as Row[] | undefined) ?? [];

    if (
      existing.length > 0 &&
      dataFieldsMatch(existing[0], incomingData, Object.keys(incomingData))
    ) {
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
          str(b.improvement_name ?? b.building_type),
          str(b.property_class),
          str(b.structure_type),
          int(b.units),
          int(b.identical_units),
          str(b.gross_building_description),
          str(b.building_type),
          int(b.building_square_footage),
          parsePercent(b.percent_complete),
          int(b.value),
        ],
      );

      for (const d of floorDetails) {
        await rawQuery(detailInsertSql, [
          improvementId,
          tmk,
          scrapedAtStr,
          year,
          int(d.card),
          str(d.section),
          str(d.floor),
          str(d.usage),
          int(d.area),
          int(d.perimeter),
          str(d.exterior_wall),
          int(d.wall_height),
          // Big Island/Kauai's Construction header and Maui's Building
          // Class header both parse to construction; rank is Maui only.
          str(d.construction),
          dec(d.rank),
          null,
          null,
          null,
          null,
          null,
          null,
        ]);
      }

      // Section-level condo-info rows ride with the first building — they
      // are re-inserted when it versions and bumped alongside its children
      // otherwise (same lifecycle as floor details).
      if (bi === 0) {
        for (const c of condoInfo) {
          await rawQuery(detailInsertSql, [
            improvementId,
            tmk,
            scrapedAtStr,
            year,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            str(c.condo_style),
            str(c.condo_type),
            str(c.condo_unit),
            // floor_level is VARCHAR(20) in the schema ("06") — never
            // int-coerce.
            str(c.floor_level),
            str(c.view),
            str(c.project),
          ]);
        }
      }
    }
  }

  // Maui commercial "Other Features" rows (dgOtherFeatures) — accessory
  // structures (canopies, loading docks, sprinklers), parsed at the section
  // level as {building_number, description, area, quantity}. They belong in
  // accessory_improvements, and loading them through loadGenericSnapshot gives
  // them the same change-detection identity as the other counties' rows
  // ((building_number, description, year_built, area)). year_built is set to
  // an explicit null so it participates in the identity WHERE and these rows
  // never cross-match residential accessory rows carrying a real year.
  if (sectionOtherFeatures.length > 0) {
    await loadGenericSnapshot(
      tmk,
      "accessory_improvements",
      sectionOtherFeatures.map((f) => ({ year_built: null, ...f })),
      scrapedAt,
      year,
      "commercial_improvement_information",
    );
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
    const landCourtDocNumber = str(s.land_court_document_number);
    const bookPage = str(s.book_page);
    const saleAmount = int(s.sale_amount);

    // Only insert if not already exists. The key carries the document
    // identifiers, not just (sale_date, instrument): genuinely distinct
    // documents record on the same date with consecutive doc numbers
    // (verified T12771112/T12771113), and the narrower key silently dropped
    // the second one. The widened key inserts new documents and still skips
    // re-scraped identical old sales. Every field but tmk is nullable →
    // NULL-safe compare.
    const existing = await rawQuery(
      `SELECT id FROM sales
       WHERE tmk=? AND sale_date<=>? AND instrument<=>?
         AND land_court_document_number<=>? AND book_page<=>? AND sale_amount<=>?
       LIMIT 1`,
      [tmk, saleDate, instrument, landCourtDocNumber, bookPage, saleAmount],
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
          saleAmount,
          instrument,
          str(s.instrument_type),
          str(s.instrument_description),
          str(s.valid_sale),
          parseDateValue(str(s.date_of_recording)),
          landCourtDocNumber,
          str(s.cert),
          bookPage,
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
          int(p.payment_sequence),
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
        [
          summaryId,
          tmk,
          scrapedAtStr,
          str(c.period),
          str(c.description),
          dec(c.amount),
        ],
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

/**
 * Drop the rollup row from a Current Tax Bill table.
 *
 * qPublic renders a trailing summary line under the real per-period rows —
 * blank Tax Period, description "Tax Bill with Interest computed through
 * <date>", and amounts that are the column totals. It isn't a bill.
 *
 * Keeping it was expensive twice over. It made up 44.5% of current_tax_bills
 * (452,518 of 1,016,290 rows), and because its description carries a date that
 * advances with every scrape, change detection could never match it — each
 * load stored yet another version of the same non-bill.
 *
 * Blank tax_period is the test: every real row names a period ("2025-2",
 * "PRIOR"), and every blank-period row on record is one of these rollups.
 */
export function isTaxBillRollupRow(row: Row): boolean {
  const period = row.tax_period;
  return period === null || period === undefined || String(period).trim() === "";
}

/** The real per-period bills, with the rollup line removed. */
export function realTaxBillRows(rows: Row[]): Row[] {
  return rows.filter((r) => !isTaxBillRollupRow(r));
}

export async function loadCurrentTaxBills(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  const taxBillInfo = data.current_tax_bill_information as Row | undefined;
  if (!taxBillInfo) return;

  const bills = realTaxBillRows((taxBillInfo.table_data ?? []) as Row[]);
  if (bills.length === 0) return;

  const year = observedYear ?? getMaxTaxYear(data);

  await batchUpsertSnapshot({
    table: "current_tax_bills",
    tmk,
    observedYear: year,
    scrapedAt,
    rows: bills.map((b) => ({
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
    })),
  });
}

// ─── Condominium Project ─────────────────────────────────────────

/**
 * The TMK a condo roster row names, or null when the row doesn't name one.
 *
 * The roster prints a full parcel number per row and links to it by KeyValue,
 * so the unit's identity is given, not inferred — the island code is the only
 * thing taken from the parent, because it is the only part a parcel number
 * omits. Nothing else is derived from the master.
 *
 * This used to keep the row's last four characters and graft them onto the
 * master's base. On an ordinary master that is indistinguishable — every
 * roster row shares the base — so it went unnoticed. On the handful of dropped
 * masters whose roster belongs to other parcels entirely it invented TMKs no
 * county record backs: 1-8-4-021-006-0000's 177 rows became 121 fabrications,
 * eleven distinct real parcels collapsing onto …0001 alone, each one then
 * scraped to a phantom page.
 */
export function unitParcelToTmk(
  parentTmk: string,
  unitParcel: string,
): string | null {
  return tmkFromParcelNumber(unitParcel, getIslandCode(parentTmk));
}

export async function loadCondoProject(
  tmk: string,
  data: ParsedProperty,
  _scrapedAt?: Date,
): Promise<void> {
  if (data.status !== "condo_project") return;

  const parcel = data.parcel_information as Row | undefined;
  const units = condoUnitRows(data) as Row[];

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
    // No TMK, no row: a roster line we can't read an identifier from is
    // dropped rather than filed under a guessed one.
    if (!unitTmk) continue;
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
export const GENERIC_IDENTITY_FIELDS: Record<string, string[]> = {
  // area and building_number are part of the identity, not the data. A parcel
  // routinely carries two structures of the same kind and vintage — two
  // "FRAME UTILITY SHED"s built in 1926, 60 sqft and 454 sqft — and on
  // (description, year_built) alone 32 of 144 sampled rows collided.
  //
  // That is worse than a mislabel. Change detection compares against the
  // latest rows per identity, so two colliding structures each see the other's
  // row as "changed" and insert a new version; the pair then doubles on every
  // load. With area and building_number included, collisions fall to 2 of 144
  // — and the residual fully-identical structures (two "FRAME UTILITY SHED /
  // 1927"s on one Maui parcel are real) are handled by the occurrence-aware
  // pairing in batchUpsertSnapshot, not by widening the identity further.
  accessory_improvements: [
    "building_number",
    "description",
    "year_built",
    "area",
  ],
  residential_additions: ["card", "line"],
  agricultural_assessments: [], // compare all data fields
};

/**
 * Fallback-path tables (no last_year_observed column) that are matched and
 * updated IN PLACE rather than blindly re-inserted.
 *
 * The plain-INSERT fallback re-inserts every row on every load — for appeals
 * that was the primary duplication bug. These tables keep one current row per
 * natural key, no history:
 *
 * - Incoming rows are grouped by the match key (NULL-safe — appeals'
 *   appeal_type_value is NULL on most Oahu rows). The Nth incoming row of a
 *   key updates the Nth existing row in place, overwriting every data column
 *   plus scraped_at: an appeal's fields legitimately change across scrapes
 *   (status Open→Closed, date_settled fills in). No Nth match → INSERT.
 *   In-page duplicates (two same-year appeals with different hearing dates,
 *   mostly Oahu) stay distinct via the occurrence index.
 *
 * - dedications carries UNIQUE(tmk, tax_year); matching on tax_year gives it
 *   the same one-row-per-year semantics without ever tripping the unique key
 *   on a re-load (the plain INSERT used to throw, swallowed by
 *   loadGenericSections' catch).
 */
export const GENERIC_MATCH_UPDATE: Record<string, string[]> = {
  appeals: ["year", "appeal_type_value"],
  dedications: ["tax_year"],
  // UNIQUE(tmk, tax_year, claimant_name) — matching on the full key keeps one
  // row per claimant per year (co-owners each file their own claim) and a
  // re-load only refreshes scraped_at instead of tripping the unique key.
  home_exemptions: ["tax_year", "claimant_name"],
};

/** SQL-parameter coercion shared by the generic fallback paths. */
function genericSqlValue(v: unknown): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return v;
  return String(v);
}

/**
 * Update-in-place apply for GENERIC_MATCH_UPDATE tables (see that map for the
 * semantics and rationale).
 *
 * Occurrence-aware: incoming rows are grouped by the match key (NULL-safe),
 * and the Nth incoming row of a key pairs with the Nth existing row (id ASC =
 * insertion = page order). Paired rows have every data column plus scraped_at
 * overwritten in place; unmatched incoming rows are inserted. One current row
 * per appeal/dedication, no history.
 */
async function matchUpdateGeneric(opts: {
  table: string;
  tmk: string;
  /** null when the table has no scraped_at column */
  scrapedAtStr: string | null;
  rows: Record<string, unknown>[];
  matchFields: string[];
}): Promise<void> {
  const { table, tmk, scrapedAtStr, rows, matchFields } = opts;

  const groups = groupRowsByKey(rows, (r) => matchFields.map((f) => r[f]));

  for (const group of groups.values()) {
    const where = matchFields.map((f) => `${f}<=>?`).join(" AND ");
    const whereValues = matchFields.map((f) => genericSqlValue(group[0][f]));

    const existing = await rawQuery<{ id: number }>(
      `SELECT id FROM ${table} WHERE tmk=? AND ${where} ORDER BY id ASC LIMIT ${group.length}`,
      [tmk, ...whereValues],
    );

    for (let i = 0; i < group.length; i++) {
      const matched = group[i];

      if (i < existing.length) {
        // Nth incoming updates Nth existing in place
        const dataCols = Object.keys(matched).filter(
          (c) => !matchFields.includes(c),
        );
        const sets = dataCols.map((c) => `${c}=?`);
        const values = dataCols.map((c) => genericSqlValue(matched[c]));
        if (scrapedAtStr !== null) {
          sets.push("scraped_at=?");
          values.push(scrapedAtStr);
        }
        if (sets.length === 0) continue;
        await rawQuery(`UPDATE ${table} SET ${sets.join(", ")} WHERE id=?`, [
          ...values,
          existing[i].id,
        ]);
      } else {
        // No Nth existing row → insert
        const allFields: Record<string, unknown> = { tmk, ...matched };
        if (scrapedAtStr !== null) allFields.scraped_at = scrapedAtStr;

        const fields = Object.keys(allFields);
        const placeholders = fields.map(() => "?").join(", ");
        await rawQuery(
          `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders})`,
          fields.map((f) => genericSqlValue(allFields[f])),
        );
      }
    }
  }
}

async function loadGenericSnapshot(
  tmk: string,
  tableName: string,
  rows: Row[],
  scrapedAt: Date = new Date(),
  observedYear?: number,
  sectionKey?: string,
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
  const matchUpdateFields = GENERIC_MATCH_UPDATE[tableName];

  // Match every row's fields to DB columns up front — the whole parcel is one
  // batch, and the upsert paths need to see the rows together to handle
  // legitimate within-parcel duplicates.
  const matchedRows: Record<string, unknown>[] = rows.map((row) => {
    const matched: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const snakeKey = key
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, "_");
      const column = resolveColumnName(snakeKey, columnNames, [
        sectionKey ?? "",
        tableName,
      ]);
      if (
        column &&
        column !== "id" &&
        column !== "tmk" &&
        column !== "created_at" &&
        column !== "scraped_at" &&
        column !== "last_year_observed"
      ) {
        const parse = COLUMN_VALUE_PARSERS[column];
        matched[column] = parse ? parse(value) : value;
      }
    }
    return matched;
  });

  if (hasLastYearObserved && observedYear) {
    // Change-detection pattern, occurrence-aware across the parcel's rows
    const snapshotRows: SnapshotRow[] = matchedRows.map((matched) => {
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

      return { identityFields, dataFields };
    });

    await batchUpsertSnapshot({
      table: tableName,
      tmk,
      observedYear,
      scrapedAt,
      rows: snapshotRows,
    });
    return;
  }

  if (matchUpdateFields) {
    // No last_year_observed, but a natural key worth matching on — update the
    // current row in place instead of re-inserting it on every load.
    await matchUpdateGeneric({
      table: tableName,
      tmk,
      scrapedAtStr: columnNames.has("scraped_at") ? scrapedAtStr : null,
      rows: matchedRows,
      matchFields: matchUpdateFields,
    });
    return;
  }

  // Fallback: simple insert (for tables without last_year_observed)
  for (const matched of matchedRows) {
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

// Section name → DB table mapping for generic loading
/**
 * Parsed section key -> destination table.
 *
 * The keys are derived from the section heading on the page, so they have to
 * be the headings qPublic actually renders — and those differ by county
 * ("Residential Additions" on Oahu, "Additions" on Maui). Four of the six
 * entries here never matched anything, which is why accessory_improvements
 * (then named yard_improvements),
 * residential_additions and dedications sat empty from the beginning:
 * loadGenericSections looks up data[sectionName], missed, and moved on
 * without a word. (accessory_structures never matched either and has since
 * been dropped from the schema entirely.)
 *
 * The verified keys come first; the original guesses are kept below them as
 * harmless aliases in case some county does use that wording.
 */
export const GENERIC_SECTION_MAP: Record<string, string> = {
  // Verified against parsed pages and fixtures. (Maui commercial pages feed a
  // third source into accessory_improvements — the "Other Features" rows
  // inside Commercial Improvement Information — but those arrive via
  // loadCommercialImprovements, not this map, because the section has a
  // dedicated loader.)
  other_building_and_yard_improvements: "accessory_improvements",
  residential_additions: "residential_additions",
  additions: "residential_additions", // Maui
  // Maui's equivalent of Other Building and Yard Improvements — same
  // structures, different heading and a packed size cell (see
  // SECTION_ROW_TRANSFORMS).
  accessory_information: "accessory_improvements",
  dedications: "dedications",
  // Maui only — packed "CLAIMANT NAME YYYY" rows, unpacked by
  // SECTION_ROW_TRANSFORMS before loading.
  home_exemption_information: "home_exemptions",
  agricultural_assessment_information: "agricultural_assessments",
  appeal_information: "appeals",

  // Unobserved spellings, retained as aliases.
  yard_improvement_information: "accessory_improvements",
  residential_addition_information: "residential_additions",
  dedication_information: "dedications",
};

/**
 * Map a parsed field name onto a real column.
 *
 * qPublic nests some column headers under a group header and the parser joins
 * the two, so the Dedications table yields "dedications_number_of_dedications"
 * for a column called "number_of_dedications". Both the loader and the
 * extractor matched on the exact name, so those values were silently dropped.
 *
 * Only a prefix naming the section or the table is stripped — a general
 * "any column that is a suffix" rule would map something like total_area onto
 * area and quietly corrupt it.
 */
export function resolveColumnName(
  snakeKey: string,
  columns: Set<string>,
  prefixes: string[],
): string | null {
  if (columns.has(snakeKey)) return snakeKey;

  const alias = FIELD_ALIASES[snakeKey];
  if (alias && columns.has(alias)) return alias;

  for (const prefix of prefixes) {
    if (!prefix || !snakeKey.startsWith(`${prefix}_`)) continue;
    const stripped = snakeKey.slice(prefix.length + 1);
    if (columns.has(stripped)) return stripped;
  }

  return null;
}

/**
 * County-specific spellings of the same field.
 *
 * Oahu and Hawaii head the value column of a yard improvement "Gross Building
 * Value"; Maui calls the same thing "Value". They are one column.
 */
const FIELD_ALIASES: Record<string, string> = {
  gross_building_value: "value",
  // Agricultural assessments: Maui heads its per-use-class acreage column
  // bare "Acres"; Oahu/Big Island call the same column "Acres in Production"
  // (both include non-producing classes like WASTE LAND, so the concepts
  // genuinely coincide).
  acres: "acres_in_production",
  // Maui's "Assessed Value" is the same discounted ag-use dollar figure
  // Oahu/Big Island head "Agricultural Value".
  assessed_value: "agricultural_value",
  // Maui's "Description" is the same use-class taxonomy Big Island heads
  // "Use Description" ("PASTUR B 10YR" ~ "GOOD PASTURE, 10 YR. DED.").
  // Safe globally: resolveColumnName matches a real `description` column
  // first, so tables that have one (accessory_improvements, tax tables) never
  // reach this alias.
  description: "use_description",
};

/**
 * Split Maui's "Dimensions/Units" cell into its three parts.
 *
 * The cell always reads "<dimensions> <area> / <quantity>" — e.g. "0x0 320 / 1"
 * is a 320 sqft structure, quantity 1. Verified against every distinct value in
 * a 251-file Maui sample (47 values, none deviating), with quantities above one
 * genuinely occurring ("0x0 1008 / 2").
 *
 * Returns null when the cell doesn't have that shape, so an unexpected format
 * is dropped rather than silently mis-split.
 */
export function parseDimensionsUnits(
  value: unknown,
): { dimensions: string; area: number; quantity: number } | null {
  if (value === null || value === undefined) return null;

  const match = String(value)
    .trim()
    .match(/^(\S+)\s+([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)$/);
  if (!match) return null;

  const area = Number(match[2].replace(/,/g, ""));
  const quantity = Number(match[3].replace(/,/g, ""));
  if (!Number.isFinite(area) || !Number.isFinite(quantity)) return null;

  return { dimensions: match[1], area, quantity };
}

/**
 * "100%" -> 100. Blank or unparseable -> null.
 *
 * qPublic writes this as a formatted string; int() can't help because
 * parseDollarValue strips $ , ( ) but not %. Surveyed values are only ever
 * "", "100%" and "0%", so a whole number is the right shape.
 */
export function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/%$/, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Split Maui's packed "Home Exemption Information" cell into claimant and year.
 *
 * Each row is a single "CLAIMANT NAME YYYY" string — the homestead
 * (owner-occupant) exemption claimant and the tax year of the claim, e.g.
 * "SODEN,TAMMY 2025" or "DAVIS,GREGORY S 2026". Names contain commas, spaces
 * and other punctuation, so only the trailing 4-digit year is structural.
 *
 * A value without a trailing year keeps the whole string as the claimant name
 * with a null year — preserved rather than dropped, since the name is still
 * data.
 */
export function splitHomesteadInformation(value: unknown): {
  claimant_name: string | null;
  tax_year: number | null;
} {
  if (value === null || value === undefined) {
    return { claimant_name: null, tax_year: null };
  }

  const s = String(value).trim();
  if (!s) return { claimant_name: null, tax_year: null };

  const match = s.match(/^(.*)\s+(\d{4})$/);
  if (!match) return { claimant_name: s, tax_year: null };

  return { claimant_name: match[1].trim(), tax_year: Number(match[2]) };
}

/**
 * Columns stored as numbers whose scraped form is a formatted string.
 *
 * Applied by the generic section path in both the loader and the extractor,
 * which otherwise pass cell text straight through. Oahu writes area with
 * thousands separators ("297,000") while the Maui split already yields a
 * number, so without this one column holds both shapes — and area is part of
 * the accessory_improvements identity, where a formatting difference would
 * read as a different structure.
 *
 * Keyed by bare column name across every generic table, so a name may only
 * appear here if numeric coercion is right everywhere it occurs:
 *   building_number → accessory_improvements only (SMALLINT)
 *   card, line      → residential_additions (card also in
 *                     commercial_improvement_details, which has a dedicated
 *                     loader — but it's numeric there too)
 *   quantity        → accessory_improvements (DECIMAL — Maui fractional
 *                     "400.5")
 *   acres, acres_in_production → agricultural_assessments (DECIMAL)
 *   tax_payer_opinion_of_property_class → appeals (Maui class code 0-12)
 *   tax_year        → dedications (scraped as a "2025"-style string) and
 *                     home_exemptions (already numeric from
 *                     splitHomesteadInformation — int() passes numbers through)
 * dedications' number_of_dedications is prose ("RESIDENTIAL USE(1)") and must
 * NOT be added; the same goes for home_exemptions' claimant_name.
 */
export const COLUMN_VALUE_PARSERS: Record<string, (v: unknown) => number | null> =
  {
    area: int,
    // accessory_improvements.value is BIGINT; strings arrive comma-formatted from
    // the repositioned GROSS BUILDING VALUE rows and dollar-formatted from
    // Big Island's own column.
    value: int,
    percent_complete: parsePercent,
    building_number: int,
    card: int,
    line: int,
    quantity: dec,
    // Maui's bare "Acres" resolves here via FIELD_ALIASES before parsing.
    acres_in_production: dec,
    tax_payer_opinion_of_property_class: int,
    tax_year: int,
  };

/**
 * Per-section row rewrites applied before columns are matched.
 *
 * The generic loader maps field names onto columns one-for-one, which can't
 * express "one cell becomes three". Anything needing that lands here.
 */
/**
 * qPublic's yard-improvement grids (Oahu/Big Island/Kauai) end in a summary
 * row with description "GROSS BUILDING VALUE" whose Area cell holds a DOLLAR
 * amount, not square feet. Move it to value so area stays honest — unless the
 * row already carries its own value (Big Island has a real Gross Building
 * Value column that can fill on these rows too).
 */
export function repositionGrossBuildingValue(row: Row): Row {
  const desc = String(row.description ?? "")
    .trim()
    .toUpperCase();
  if (desc !== "GROSS BUILDING VALUE") return row;

  const hasValue =
    (row.value != null && String(row.value).trim() !== "") ||
    (row.gross_building_value != null &&
      String(row.gross_building_value).trim() !== "");
  if (hasValue || row.area == null) return row;

  return { ...row, value: row.area, area: null };
}

export const SECTION_ROW_TRANSFORMS: Record<string, (row: Row) => Row> = {
  // Maui files its yard improvements under "Accessory Information" with the
  // size packed into a single cell. Unpacked, the row is the same shape the
  // other counties already produce.
  accessory_information: (row) => {
    const parts = parseDimensionsUnits(row.dimensions_units);
    if (!parts) return row;
    const { dimensions_units: _dropped, ...rest } = row;
    return { ...rest, ...parts };
  },
  other_building_and_yard_improvements: repositionGrossBuildingValue,
  yard_improvement_information: repositionGrossBuildingValue,
  // Maui's Home Exemption Information rows are one packed
  // "CLAIMANT NAME YYYY" cell — unpack it into the two real columns.
  home_exemption_information: (row) => {
    if (!("homestead_information" in row)) return row;
    const { homestead_information: packed, ...rest } = row;
    return { ...rest, ...splitHomesteadInformation(packed) };
  },
};

/**
 * The data rows inside a parsed section.
 *
 * Most sections put them under `table_data`, but the key is derived from the
 * table's id, so Maui's Accessory Information — rendered by a control named
 * grdSales — arrives under `sales`. Falling back to the first array-valued
 * property keeps that working without naming every variant.
 */
export function sectionRows(sectionData: Row): Row[] {
  const tableData = sectionData.table_data;
  if (Array.isArray(tableData)) return tableData as Row[];
  if (Array.isArray(sectionData)) return sectionData as Row[];

  const firstArray = Object.values(sectionData).find(Array.isArray);
  if (firstArray) return firstArray as Row[];

  return [sectionData];
}

async function loadGenericSections(
  tmk: string,
  data: ParsedProperty,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  for (const [sectionName, tableName] of Object.entries(GENERIC_SECTION_MAP)) {
    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    const transform = SECTION_ROW_TRANSFORMS[sectionName];
    const rows = sectionRows(sectionData).map((r) =>
      transform ? transform(r) : r,
    );

    try {
      await loadGenericSnapshot(
        tmk,
        tableName,
        rows,
        scrapedAt,
        observedYear,
        sectionName,
      );
    } catch {
      // Skip sections that fail to load generically — not all sections map cleanly
    }
  }
}

/**
 * Load one generic table from every section GENERIC_SECTION_MAP routes to it.
 * Used by TABLE_LOADERS for individual table reparse.
 *
 * Must mirror loadGenericSections: it previously took a single hardcoded
 * section name, and for accessory_improvements, residential_additions and
 * dedications that name was one of the unobserved alias spellings — so a
 * single-table rebuild loaded nothing while the full load worked. It also
 * skipped SECTION_ROW_TRANSFORMS and sectionRows, which Maui's
 * accessory_information section needs.
 */
export async function loadGenericForTable(
  tmk: string,
  data: ParsedProperty,
  tableName: string,
  scrapedAt: Date = new Date(),
  observedYear?: number,
): Promise<void> {
  for (const [sectionName, mappedTable] of Object.entries(GENERIC_SECTION_MAP)) {
    if (mappedTable !== tableName) continue;

    const sectionData = data[sectionName] as Row | undefined;
    if (!sectionData) continue;

    const transform = SECTION_ROW_TRANSFORMS[sectionName];
    const rows = sectionRows(sectionData).map((r) =>
      transform ? transform(r) : r,
    );

    await loadGenericSnapshot(
      tmk,
      tableName,
      rows,
      scrapedAt,
      observedYear,
      sectionName,
    );
  }
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
  // NOTE: a single-table reparse through this entry covers only the generic
  // sections; Maui commercial "Other Features" rows land in
  // accessory_improvements via the commercial_improvements loader.
  accessory_improvements: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "accessory_improvements", s, y),
  residential_additions: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "residential_additions", s, y),
  agricultural_assessments: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "agricultural_assessments", s, y),
  appeals: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "appeals", s, y),
  dedications: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "dedications", s, y),
  home_exemptions: (tmk, data, s, y) =>
    loadGenericForTable(tmk, data, "home_exemptions", s, y),
};

// ─── Main load processor ─────────────────────────────────────────

export async function processLoad(
  data: { tmk: string },
  log: (msg: string) => void,
  opts?: { skipStatusUpdate?: boolean },
): Promise<string> {
  const { tmk } = data;
  const skipStatus = opts?.skipStatusUpdate === true;

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
        if (!skipStatus) {
          await rawQuery(
            `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
            [`No JSON or HTML file found for ${tmk}`, tmk],
          );
        }
        throw new Error(`No JSON or HTML file found for ${tmk}`);
      }

      const html = readFileSync(htmlFile, "utf-8");
      parsed = parsePropertyHTML(html, tmk);

      if (parsed.status !== "success" && parsed.status !== "condo_project") {
        if (!skipStatus) {
          await rawQuery(
            `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
            [`Parse status: ${parsed.status}`, tmk],
          );
        }
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
    const scrapedAt = ssRow?.scraped_at
      ? new Date(ssRow.scraped_at)
      : new Date();

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
    if (!skipStatus) {
      await rawQuery(
        `UPDATE scrape_status SET load_status='success', loaded_at=NOW(), error=NULL WHERE tmk=?`,
        [tmk],
      );
    }

    log(`${tmk}: loaded`);
    return `${tmk}: loaded`;
  } catch (e) {
    if (!skipStatus) {
      const errorMsg = errorMessage(e);
      await rawQuery(
        `UPDATE scrape_status SET load_status='failed', error=? WHERE tmk=?`,
        [errorMsg.slice(0, 500), tmk],
      );
    }
    throw e;
  }
}
