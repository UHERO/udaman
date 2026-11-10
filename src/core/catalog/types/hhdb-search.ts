import type { HhdbListParams } from "./hhdb";

/**
 * The columns the search box can match on each table, keyed by table slug.
 * This is the allowlist for user-picked fields: only these names ever reach
 * the SQL. Pure, so the picker can import it too.
 *
 * Absent on purpose: transactions and the spec tables (rent, insurance) route
 * each term to one indexed column, because OR-ing columns there takes 30s+;
 * the historical tax summary/details/payments have search disabled.
 */
export const HHDB_SEARCH_FIELDS = {
  properties: [
    "tmk",
    "location_address",
    "property_class",
    "zoning",
    "zip",
    "project_name",
    "zcta20",
    "tract_geoid",
  ],
  parcels: ["tmk", "location_address", "property_class", "zoning"],
  owners: ["tmk", "owner_name", "owner_type"],
  assessments: ["tmk", "property_class", "tax_year"],
  sales: ["tmk", "instrument", "instrument_type", "instrument_description"],
  "residential-improvements": ["tmk", "occupancy", "framing", "grade"],
  "commercial-improvements": [
    "tmk",
    "improvement_name",
    "property_class",
    "structure_type",
  ],
  "condo-projects": ["tmk", "project_name", "developer"],
  "condo-units": ["tmk", "parent_tmk", "unit_number", "owner_name"],
  permits: ["tmk", "permit_number", "reason"],
  appeals: ["tmk", "status", "appeal_type_value"],
  dedications: ["tmk", "number_of_dedications"],
  "home-exemptions": ["tmk", "claimant_name"],
  "land-classifications": [
    "tmk",
    "land_classification",
    "agricultural_use_indicator",
  ],
  "tax-bills": ["tmk", "tax_period", "description"],
  "tax-credits": ["tmk", "period", "description"],
  "ag-assessments": ["tmk", "agricultural_type", "use_description"],
  "commercial-details": ["tmk", "usage", "construction", "description"],
  "residential-additions": ["tmk", "card"],
  "accessory-improvements": ["tmk", "description"],
  "mls-listings": [
    "mls_number",
    "tmk",
    "island",
    "status",
    "property_type",
    "region",
    "neighborhood",
    "address",
  ],
} as const satisfies Record<string, readonly string[]>;

export type HhdbSearchTable = keyof typeof HHDB_SEARCH_FIELDS;

/** The fields a table's search can be narrowed to; null if it has no picker. */
export function getSearchFields(slug: string): readonly string[] | null {
  return Object.hasOwn(HHDB_SEARCH_FIELDS, slug)
    ? HHDB_SEARCH_FIELDS[slug as HhdbSearchTable]
    : null;
}

/**
 * The WHERE clause for a table's search box: a contains-match on the picked
 * fields, or on all of them when none are picked. Names not in the allowlist
 * are dropped, since they come from the URL.
 */
export function buildSearchWhere(
  slug: HhdbSearchTable,
  { search, searchFields }: Pick<HhdbListParams, "search" | "searchFields">,
): { where: string; params: string[] } {
  if (!search) return { where: "", params: [] };
  const all: readonly string[] = HHDB_SEARCH_FIELDS[slug];
  const picked = all.filter((f) => searchFields?.includes(f));
  const columns = picked.length ? picked : all;
  const clause = columns.map((c) => `\`${c}\` LIKE ?`).join(" OR ");
  return {
    where: `WHERE (${clause})`,
    params: columns.map(() => `%${search}%`),
  };
}
