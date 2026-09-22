/**
 * Single source of truth for the data columns of `mls_listings`.
 *
 * Column names are the lower-case snake_case form of the HiCentral detail-page
 * keys ("Assd. Val. Land" → assd_val_land). HiCentral was the first site, so
 * its vocabulary IS the schema; every later site adapter maps its own keys
 * onto these names. The DDL (src/lib/hhdb/mls_listings.sql), the parsers, the
 * loader and the hhdb data dictionary are all checked against this list.
 *
 * Fill rates in the comments are from the 2026-09-18 key survey (265 detail
 * pages across all islands/statuses/property types).
 */

/**
 * How a raw site string becomes a column value (see normalize.ts):
 *  - text:  trimmed; "--" and "" → null
 *  - int:   "33,018" → 33018
 *  - money: "$18,500,000 (FS)", "$1,297/mo.", "--/mo." → whole dollars or null
 *  - date:  "December 31, 2024" → "2024-12-31"
 *  - year:  "1947" → 1947; "0" → null
 */
export type MlsColumnKind = "text" | "int" | "money" | "date" | "year";

export interface MlsColumnSpec {
  column: string;
  label: string;
  kind: MlsColumnKind;
  /** VARCHAR length for text columns; omitted → TEXT. */
  length?: number;
  /**
   * HiCentral `<dt>` key (colon/whitespace stripped) this column is read
   * from, or null when it comes from the page header / is derived.
   */
  hicentralKey: string | null;
  description: string;
}

const c = (
  column: string,
  label: string,
  kind: MlsColumnKind,
  hicentralKey: string | null,
  description: string,
  length?: number,
): MlsColumnSpec => ({
  column,
  label,
  kind,
  length,
  hicentralKey,
  description,
});

export const MLS_COLUMNS = [
  // ── Header (not in the dt/dd lists) ───────────────────────────────────
  c(
    "list_price",
    "List Price",
    "money",
    null,
    "Asking price in whole dollars.",
  ),
  c(
    "sold_price",
    "Sold Price",
    "money",
    null,
    "Closing price; only present once the listing has sold.",
  ),
  c(
    "tenure",
    "Tenure",
    "text",
    null,
    "FS (fee simple) or LH (leasehold), parsed from the price suffix.",
    2,
  ),
  c(
    "building_name",
    "Building Name",
    "text",
    null,
    "Condo / project name shown above the address (58% filled).",
    255,
  ),
  c(
    "address",
    "Address",
    "text",
    null,
    "Street address line, including unit.",
    255,
  ),
  c("city", "City", "text", null, "City from the address header.", 100),
  c(
    "state",
    "State",
    "text",
    null,
    "Two-letter state from the address header.",
    2,
  ),
  c("zip", "ZIP", "text", null, "ZIP code from the address header.", 10),
  c("remarks", "Remarks", "text", null, "Public marketing remarks."),
  c(
    "sale_conditions",
    "Sale Conditions",
    "text",
    null,
    "Foreclosure, Lender Sale, Probate, … (rare; blank for ordinary sales).",
    255,
  ),
  c("listing_agent", "Listing Agent", "text", null, "Listing agent name.", 255),
  c(
    "listing_office",
    "Listing Office",
    "text",
    null,
    "Listing brokerage.",
    255,
  ),

  // ── Property information ──────────────────────────────────────────────
  c(
    "property_type",
    "Property Type",
    "text",
    "Property Type",
    "Single Family, Condo/Townhouse, or Multi-Family.",
    50,
  ),
  c(
    "bedrooms",
    "Bedrooms",
    "int",
    "Bedrooms",
    "Bedroom count (absent for multi-family).",
  ),
  c("full_baths", "Full Baths", "int", "Full Baths", "Full bathroom count."),
  c("half_baths", "Half Baths", "int", "Half Baths", "Half bathroom count."),
  c(
    "land_area_sf",
    "Land Area (sf)",
    "int",
    "Land Area (sf)",
    "Lot size in square feet (68% filled; usually absent for condos).",
  ),
  c(
    "living_sf",
    "Living (sf)",
    "int",
    "Living (sf)",
    "Interior living area in square feet.",
  ),
  c(
    "lanai_sf",
    "Lanai (sf)",
    "int",
    "Lanai (sf)",
    "Lanai area in square feet.",
  ),
  c(
    "other_sf",
    "Other (sf)",
    "int",
    "Other (sf)",
    "Other covered area in square feet.",
  ),
  // "3 - Boat, Driveway, Garage" splits into the next two columns.
  c(
    "parking_stalls",
    "Parking Stalls",
    "int",
    "Parking Stalls",
    "Number of parking stalls (leading integer of the site value).",
  ),
  c(
    "parking_stalls_desc",
    "Parking Description",
    "text",
    null,
    "Parking types (remainder of the Parking Stalls value).",
    255,
  ),
  c(
    "island",
    "Island",
    "text",
    "Island",
    "Island name as the site spells it.",
    20,
  ),
  c(
    "region",
    "Region",
    "text",
    "Region",
    "MLS region, e.g. Diamond Head, Metro Oahu, Puna.",
    100,
  ),
  c(
    "neighborhood",
    "Neighborhood",
    "text",
    "Neighborhood",
    "MLS neighborhood, e.g. KAHALA AREA.",
    100,
  ),
  c(
    "tmk",
    "TMK",
    "text",
    "TMK",
    "Tax Map Key, I-Z-S-PPP-PPP-CCCC — same format as the qPublic tables.",
    18,
  ),
  c(
    "list_date",
    "List Date",
    "date",
    "List Date",
    "Date the listing went on the market.",
  ),
  c(
    "date_sold",
    "Date Sold",
    "date",
    "Date Sold",
    "Closing date; only present once sold.",
  ),
  c("zoning", "Zoning", "text", "Zoning", "Zoning code and description.", 100),
  c(
    "furnished",
    "Furnished",
    "text",
    "Furnished",
    "Full, Partial, None, or Negotiable.",
    30,
  ),
  c(
    "year_built",
    "Year Built",
    "year",
    "Year Built",
    "Year of original construction.",
  ),
  c(
    "year_remodeled",
    "Year Remodeled",
    "year",
    "Year Remodeled",
    "Year of last remodel (30% filled).",
  ),

  // ── Financial information ─────────────────────────────────────────────
  c(
    "assd_val_land",
    "Assd. Val. Land",
    "money",
    "Assd. Val. Land",
    "County assessed land value.",
  ),
  c(
    "assd_val_imprv",
    "Assd. Val. Imprv",
    "money",
    "Assd. Val. Imprv",
    "County assessed improvement value.",
  ),
  c(
    "assd_val_total",
    "Assd. Val. Total",
    "money",
    "Assd. Val. Total",
    "County assessed total value.",
  ),
  c(
    "tax_year",
    "Tax Year",
    "year",
    "Tax Year",
    "Tax year of the assessed values.",
  ),
  c(
    "monthly_taxes",
    "Monthly Taxes",
    "money",
    "Monthly Taxes",
    "Property tax per month.",
  ),
  // Free text on the site: "$160,000", "AVAILABLE", "No", "-0-" …
  c(
    "home_exempt",
    "Home Exempt.",
    "text",
    "Home Exempt.",
    "Home exemption as entered by the agent; not reliably numeric.",
    30,
  ),
  c(
    "maintenance_fees",
    "Maintenance Fees",
    "money",
    "Maintenance Fees",
    "Monthly maintenance fee (condos).",
  ),
  c(
    "association_fees",
    "Association Fees",
    "money",
    "Association Fees",
    "Monthly association fee.",
  ),
  c("other_fees", "Other Fees", "money", "Other Fees", "Other monthly fees."),

  // ── Leasehold block (only on LH listings, ~14%) ───────────────────────
  c(
    "land_tenure",
    "Land Tenure",
    "text",
    "Land Tenure",
    "Present only on leasehold listings.",
    30,
  ),
  c(
    "fee_options",
    "Fee Options",
    "text",
    "Fee Options",
    "Whether the fee interest can be purchased.",
    50,
  ),
  c(
    "lessor",
    "Lessor",
    "text",
    "Lessor",
    "Land owner, e.g. KSBE, Hawaiian Home Lands.",
    255,
  ),
  c(
    "lease_rent",
    "Lease Rent",
    "text",
    "Lease Rent",
    "Monthly lease rent / year it is fixed until, e.g. 491.02/2029.",
    50,
  ),
  c(
    "next_step_up",
    "Next Step-Up",
    "text",
    "Next Step-Up",
    "Next lease rent step, amount/year.",
    50,
  ),
  c(
    "second_step_up",
    "2nd Step-Up",
    "text",
    "2nd Step-Up",
    "Second lease rent step, amount/year.",
    50,
  ),
  c(
    "fee_purchase",
    "Fee Purchase",
    "text",
    "Fee Purchase",
    "Fee purchase price, when offered.",
    50,
  ),
  c(
    "reneg_date",
    "Reneg Date",
    "text",
    "Reneg Date",
    "Lease renegotiation date.",
    50,
  ),
  c("lease_exp", "Lease Exp", "text", "Lease Exp", "Lease expiration.", 50),

  // ── Schools (~26% filled) ─────────────────────────────────────────────
  c(
    "elem_school",
    "Elem. School",
    "text",
    "Elem. School",
    "Elementary school.",
    100,
  ),
  c(
    "middle_school",
    "Middle School",
    "text",
    "Middle School",
    "Middle school.",
    100,
  ),
  c("high_school", "High School", "text", "High School", "High school.", 100),

  // ── Other property features (comma-separated pick lists) ──────────────
  c(
    "frontage",
    "Frontage",
    "text",
    "Frontage",
    "Ocean, Golf Course, Stream/Canal, …",
  ),
  c("view", "View", "text", "View", "View types."),
  c("pool", "Pool", "text", "Pool", "Pool features."),
  c(
    "amenities",
    "Amenities",
    "text",
    "Amenities",
    "Property or building amenities.",
  ),
  c(
    "inclusions",
    "Inclusions",
    "text",
    "Inclusions",
    "Items included in the sale.",
  ),
  c("security", "Security", "text", "Security", "Security features."),
  c(
    "assn_fee_inclusions",
    "Assn. Fee Inclusions",
    "text",
    "Assn. Fee Inclusions",
    "What the association fee covers.",
  ),
  c(
    "other_fee_inclusions",
    "Other Fee Inclusions",
    "text",
    "Other Fee Inclusions",
    "What the other fees cover.",
  ),
  c(
    "lot_description",
    "Lot Description",
    "text",
    "Lot Description",
    "Lot characteristics.",
  ),
  c("topography", "Topography", "text", "Topography", "Lot topography."),
  c(
    "number_of_stories",
    "Number of Stories",
    "text",
    "Number of Stories",
    "Pick-list text: One, Two, 15-20, 21+ …",
    50,
  ),
  c(
    "building_style",
    "Building Style",
    "text",
    "Building Style",
    "Detach Single Family, High-Rise 7+ Stories, Condotel, …",
  ),
  c(
    "property_condition",
    "Property Condition",
    "text",
    "Property Condition",
    "Excellent, Above Average, Fair, …",
    100,
  ),
  c(
    "construction",
    "Construction",
    "text",
    "Construction",
    "Construction types.",
  ),
  c("roofing", "Roofing", "text", "Roofing", "Roof material."),
  c(
    "floor_covering",
    "Floor Covering",
    "text",
    "Floor Covering",
    "Floor materials.",
  ),
  c("disclosures", "Disclosures", "text", "Disclosures", "Seller disclosures."),
  c("possession", "Possession", "text", "Possession", "Possession terms."),
  c(
    "terms_accept",
    "Terms Accept.",
    "text",
    "Terms Accept.",
    "Acceptable financing terms.",
  ),
  c(
    "land_recorded",
    "Land Recorded",
    "text",
    "Land Recorded",
    "Land Court, Regular System, or Dual Systems.",
    50,
  ),
  c(
    "exclusions",
    "Exclusions",
    "text",
    "Exclusions",
    "Items excluded from the sale.",
  ),
  c("easements", "Easements", "text", "Easements", "Recorded easements."),
  c("set_backs", "Set-Backs", "text", "Set-Backs", "Set-back rules."),

  // ── Multi-family unit mix (~2%) ───────────────────────────────────────
  c(
    "studio_units",
    "Studio Units",
    "int",
    "Studio Units",
    "Multi-family: studio unit count.",
  ),
  c(
    "one_bed_units",
    "1-Bed Units",
    "int",
    "1-Bed Units",
    "Multi-family: 1-bedroom unit count.",
  ),
  c(
    "two_bed_units",
    "2-Bed Units",
    "int",
    "2-Bed Units",
    "Multi-family: 2-bedroom unit count.",
  ),
  c(
    "three_bed_units",
    "3-Bed Units",
    "int",
    "3-Bed Units",
    "Multi-family: 3-bedroom unit count.",
  ),

  // The site's key is literally "PUBLIC" and repeats once per open house;
  // occurrences are joined with "; ".
  c(
    "open_house",
    "Open House",
    "text",
    "PUBLIC",
    "Scheduled public open houses at fetch time.",
  ),
] as const satisfies readonly MlsColumnSpec[];

export type MlsColumnName = (typeof MLS_COLUMNS)[number]["column"];

export const MLS_COLUMN_NAMES: MlsColumnName[] = MLS_COLUMNS.map(
  (s) => s.column,
);

/**
 * Columns of mls_listings that are NOT in MLS_COLUMNS — owned by the loader:
 *   id, mls_board, mls_number, source_site, source_priority, source_url,
 *   status, status_raw, extra (JSON), html_path,
 *   first_seen_at, last_seen_at, fetched_at, parsed_at
 * All DATETIMEs are HST wall-clock, stamped with NOW() (never a JS Date param).
 */
export const MLS_LOADER_COLUMNS = [
  "id",
  "mls_board",
  "mls_number",
  "source_site",
  "source_priority",
  "source_url",
  "status",
  "status_raw",
  "extra",
  "html_path",
  "first_seen_at",
  "last_seen_at",
  "fetched_at",
  "parsed_at",
] as const;

/**
 * Columns whose fill rate says the most about what the table can and can't
 * tell you — the "Field Completeness by Source" chart on the exploration
 * tab. Lives here (no imports) so the client component can use it without
 * pulling the DB collection into the browser bundle.
 */
export const MLS_COMPLETENESS_COLUMNS = [
  "list_date",
  "list_price",
  "sold_price",
  "date_sold",
  "tmk",
  "living_sf",
  "land_area_sf",
  "year_built",
  "bedrooms",
  "assd_val_total",
  "maintenance_fees",
  "remarks",
  "listing_agent",
  "elem_school",
] as const satisfies readonly MlsColumnName[];
