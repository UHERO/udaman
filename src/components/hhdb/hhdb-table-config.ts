import type { FieldDef } from "@catalog/types/hhdb";
import {
  getDictionaryFields,
  getSummaryFieldDefs,
  type DictionaryField,
} from "@catalog/types/hhdb-data-dictionary";

export interface HhdbTableConfig {
  title: string;
  /** Key into HHDB_FIELDS for summary fields. null = no summaries. */
  fieldsTable: string | null;
  defaultSort: string;
  /** Direction applied with defaultSort when the URL has no `order`. Default "asc". */
  defaultOrder?: "asc" | "desc";
  warning?: string;
  /** Enable the Exploration tab with analytical visualizations. */
  exploration?: boolean;
}

/**
 * TMK caveats for the tables whose tmk is imputed. Every other HHDB table
 * gets its TMK from a parcel number in the source, so its coverage is
 * effectively complete; these sources supply no parcel, and tmk is our
 * geocode. Figures are from the full loads (October 2026).
 */
const RENTHUB_TMK_WARNING =
  "TMK is imputed, not supplied. RentHub gives a map point and a street address, not a parcel. About 98% of rows have been matched to a TMK via a spatial join on Rent Hub's lat & lon coordinates and address matching. ~83% are confirmed by coords & address and ~14% by only coords. Where the listing address names a condo unit, tmk is that unit's CPR TMK (cpr_match is set, ~18% of rows) and joins to properties / owners; listings that give only a building's address stay at the parcel level (CPR 0000).";

const FICOH_TMK_WARNING =
  "TMK is imputed, not supplied: FICOH gives a street address only (no parcel, no coordinates). We assign TMK by matching on zip and then street address. Majority records find match this way, but be aware that this is the least reliable TMK field.";

const FICOH_RESTRICTED =
  "Restricted data: FICOH policies and claims data require explicit data agreement and approval prior to any public access. ";

export const HHDB_TABLE_CONFIG: Record<string, HhdbTableConfig> = {
  properties: {
    title: "Properties",
    fieldsTable: "properties",
    defaultSort: "id",
  },
  assessments: {
    title: "Assessments",
    fieldsTable: "assessments",
    defaultSort: "id",
  },
  sales: {
    title: "Sales",
    fieldsTable: "sales",
    defaultSort: "id",
  },
  "residential-improvements": {
    title: "Residential Improvements",
    fieldsTable: "residential_improvements",
    defaultSort: "id",
  },
  "commercial-improvements": {
    title: "Commercial Improvements",
    fieldsTable: "commercial_improvements",
    defaultSort: "id",
  },
  permits: {
    title: "Permits",
    fieldsTable: "permits",
    defaultSort: "id",
  },
  "condo-projects": {
    title: "Condo Projects",
    fieldsTable: "condominium_projects",
    defaultSort: "id",
  },
  "condo-units": {
    title: "Condo Units",
    fieldsTable: null,
    defaultSort: "id",
  },
  parcels: {
    title: "Parcels",
    fieldsTable: "parcels",
    defaultSort: "tmk",
  },
  owners: {
    title: "Owners",
    fieldsTable: "owners",
    defaultSort: "tmk",
    exploration: true,
  },
  appeals: {
    title: "Appeals",
    fieldsTable: "appeals",
    defaultSort: "tmk",
  },
  dedications: {
    title: "Dedications",
    fieldsTable: "dedications",
    defaultSort: "tmk",
  },
  "home-exemptions": {
    title: "Home Exemptions",
    fieldsTable: "home_exemptions",
    defaultSort: "tmk",
  },
  "land-classifications": {
    title: "Land Classifications",
    fieldsTable: "land_classifications",
    defaultSort: "tmk",
  },
  "tax-bills": {
    title: "Current Tax Bills",
    fieldsTable: "current_tax_bills",
    defaultSort: "tmk",
  },
  "tax-summary": {
    title: "Historical Tax Summary",
    fieldsTable: "historical_tax_summary",
    defaultSort: "id",
    warning:
      "This table contains millions of rows. Search and sorting are disabled. For complex queries, please use the database directly.",
  },
  "tax-details": {
    title: "Historical Tax Details",
    fieldsTable: "historical_tax_details",
    defaultSort: "id",
    warning:
      "This table contains millions of rows. Search and sorting are disabled. For complex queries, please use the database directly.",
  },
  "tax-payments": {
    title: "Historical Tax Payments",
    fieldsTable: "historical_tax_payments",
    defaultSort: "id",
    warning:
      "This table contains millions of rows. Search and sorting are disabled. For complex queries, please use the database directly.",
  },
  "tax-credits": {
    title: "Historical Tax Credits",
    fieldsTable: "historical_tax_credits",
    defaultSort: "tmk",
  },
  "ag-assessments": {
    title: "Agricultural Assessments",
    fieldsTable: "agricultural_assessments",
    defaultSort: "tmk",
  },
  "commercial-details": {
    title: "Commercial Improvement Details",
    fieldsTable: "commercial_improvement_details",
    defaultSort: "tmk",
  },
  "residential-additions": {
    title: "Residential Additions",
    fieldsTable: "residential_additions",
    defaultSort: "tmk",
  },
  "accessory-improvements": {
    title: "Accessory Improvements",
    fieldsTable: "accessory_improvements",
    defaultSort: "tmk",
  },
  transactions: {
    title: "Transactions (TG)",
    fieldsTable: "tg_transactions",
    // Most recently recorded documents first.
    defaultSort: "recDate",
    defaultOrder: "desc",
    warning:
      "This table contains millions of rows. Search matches the start of a dashed TMK, an undashed tax key, or a neighborhood name, and only indexed columns can be sorted. For other queries, please use the database directly.",
    exploration: true,
  },
  "mls-listings": {
    title: "MLS Listings",
    fieldsTable: "mls_listings",
    // Newest listings first.
    defaultSort: "list_date",
    defaultOrder: "desc",
    exploration: true,
  },
  "rent-listings": {
    title: "Rent Listings",
    fieldsTable: "renthub_listings",
    // Most recently scraped first.
    defaultSort: "scraped_at",
    defaultOrder: "desc",
    warning: RENTHUB_TMK_WARNING,
    exploration: true,
  },
  "insurance-policies": {
    title: "Insurance Policies",
    fieldsTable: "insurance_policies",
    defaultSort: "effective_date",
    defaultOrder: "desc",
    exploration: true,
    warning:
      FICOH_RESTRICTED +
      "About 93% of policies have a TMK (38% at the condo-unit level). " +
      FICOH_TMK_WARNING,
  },
  "insurance-claims": {
    title: "Insurance Claims",
    fieldsTable: "insurance_claims",
    defaultSort: "date_of_loss",
    defaultOrder: "desc",
    exploration: true,
    warning:
      FICOH_RESTRICTED +
      "About 91% of claims have a TMK (43% at the condo-unit level); policy_id links ~96% of claims to their policy row. " +
      FICOH_TMK_WARNING,
  },
};

export const HHDB_TABLE_SLUGS = Object.keys(HHDB_TABLE_CONFIG);

export function getFieldsForTable(slug: string): FieldDef[] | null {
  const config = HHDB_TABLE_CONFIG[slug];
  if (!config?.fieldsTable) return null;
  return getSummaryFieldDefs(config.fieldsTable);
}

export function getDictionaryForTable(slug: string): DictionaryField[] | null {
  const config = HHDB_TABLE_CONFIG[slug];
  if (!config?.fieldsTable) return null;
  return getDictionaryFields(config.fieldsTable);
}
