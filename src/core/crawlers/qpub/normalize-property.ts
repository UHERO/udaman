/**
 * Post-processing normalization for ParsedProperty objects.
 *
 * Runs after all section parsers have produced their output and before
 * the JSON is written to disk.  This is the place for:
 *   - Deriving missing values from existing ones (sqft ↔ acres)
 *   - Pulling data across sections (land_classifications → parcel_information)
 *   - Any other cross-section consistency fixes
 */
import type { ParsedProperty } from "./parse";

const SQFT_PER_ACRE = 43_560;

type Row = Record<string, unknown>;

// ─── Area normalization ────────────────────────────────────────────

/**
 * Ensure parcel_information has both land_area_approximate_sq_ft and
 * land_area_acres whenever at least one is available.
 *
 * Sources (in priority order):
 *   1. Values already present in parcel_information
 *   2. Sum of land_classifications in land_information
 */
function normalizeArea(parsed: ParsedProperty): void {
  const parcel = parsed.parcel_information as Row | undefined;
  if (!parcel) return;

  let sqft = toNumber(parcel.land_area_approximate_sq_ft);
  let acres = toNumber(parcel.land_area_acres);

  // If parcel_information has neither, try summing land_classifications
  if (sqft === null && acres === null) {
    const landInfo = parsed.land_information as Row | undefined;
    const classifications = (landInfo?.land_classifications ??
      landInfo?.classifications) as Row[] | undefined;

    if (classifications && classifications.length > 0) {
      let totalSqft = 0;
      let totalAcres = 0;
      let hasSqft = false;
      let hasAcres = false;

      for (const c of classifications) {
        const cSqft = toNumber(c.square_footage);
        const cAcres = toNumber(c.acreage);
        if (cSqft !== null && cSqft > 0) {
          totalSqft += cSqft;
          hasSqft = true;
        }
        if (cAcres !== null && cAcres > 0) {
          totalAcres += cAcres;
          hasAcres = true;
        }
      }

      if (hasSqft) sqft = totalSqft;
      if (hasAcres) acres = totalAcres;
    }
  }

  // Derive the missing unit from the one we have
  if (sqft !== null && sqft > 0 && acres === null) {
    acres = parseFloat((sqft / SQFT_PER_ACRE).toFixed(4));
  } else if (acres !== null && acres > 0 && sqft === null) {
    sqft = Math.round(acres * SQFT_PER_ACRE);
  }

  // Write back
  if (sqft !== null) parcel.land_area_approximate_sq_ft = sqft;
  if (acres !== null) parcel.land_area_acres = acres;
}

// ─── Property class normalization ──────────────────────────────────

/**
 * Ensure parcel_information.property_class is populated.
 *
 * Most counties include "Property Class" or "Tax Classification" in the
 * parcel information section, but Maui only provides it as a column
 * ("Tax Class") in the assessment table.  When parcel_information is
 * missing property_class, copy it from the most recent assessment year.
 */
function normalizePropertyClass(parsed: ParsedProperty): void {
  const parcel = parsed.parcel_information as Row | undefined;
  if (!parcel) return;

  // Already have a value — nothing to do
  if (parcel.property_class) return;

  const ai = parsed.assessment_information as Row | undefined;
  if (!ai) return;

  const assessments = (ai.current_assessments ?? ai.assessments) as
    | Row[]
    | undefined;
  if (!assessments || assessments.length === 0) return;

  // Find the most recent assessment with a property_class value
  let best: Row | null = null;
  let bestYear = 0;
  for (const a of assessments) {
    const pc = a.property_class;
    if (!pc) continue;
    const year = parseInt(String(a.tax_year), 10) || 0;
    if (year > bestYear) {
      bestYear = year;
      best = a;
    }
  }

  if (best?.property_class) {
    parcel.property_class = best.property_class;
  }
}

// ─── Project name normalization ───────────────────────────────────

/**
 * Ensure parcel_information.project_name is populated for condo units.
 *
 * Maui doesn't include project_name in parcel information. Instead,
 * the condo project name appears as `condo_name` on the building record
 * inside improvement_information.  Copy it to project_name when missing.
 */
function normalizeProjectName(parsed: ParsedProperty): void {
  const parcel = parsed.parcel_information as Row | undefined;
  if (!parcel) return;

  if (parcel.project_name) return;

  // Check improvement_information (Maui) and residential_improvement_information
  const ii = (parsed.improvement_information ??
    parsed.residential_improvement_information) as Row | undefined;
  if (!ii) return;

  const buildings = ii.buildings as Row[] | undefined;
  if (!buildings || buildings.length === 0) return;

  // Take condo_name from the first building that has one
  for (const b of buildings) {
    if (b.condo_name && typeof b.condo_name === "string") {
      parcel.project_name = b.condo_name;
      return;
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Coerce a parsed value (number, string with commas, null) to a number. */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

// ─── Main entry point ──────────────────────────────────────────────

/**
 * Apply all cross-section normalizations to a parsed property.
 * Called from parsePropertyHTML after section parsing, before JSON write.
 */
export function normalizeProperty(parsed: ParsedProperty): void {
  normalizeArea(parsed);
  normalizePropertyClass(parsed);
  normalizeProjectName(parsed);
}
