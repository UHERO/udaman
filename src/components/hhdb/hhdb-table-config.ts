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
  "TMK is imputed, not supplied. RentHub gives a map point and a street address, not a parcel: tmk is our geocode — the parcel the point falls in, corrected by matching the listing address to qPublic site addresses. About 98% of rows have a TMK, but only ~83% are confirmed by address (tmk_match = within_addr or address); within (~14%) rests on the point alone (right ~90% of the time in spot checks), and fuzzy / address_far are inferred. TMKs are parcel-level only (CPR always 0000): a condo rental resolves to its building, never its unit. Filter on tmk_match to suit your analysis. County columns on the Summary tab count only rows with a TMK; the rest are in the State total.";

const FICOH_TMK_WARNING =
  "TMK is imputed, not supplied: FICOH gives a street address only (no parcel, no coordinates), and tmk is our match of that address to qPublic site addresses in the ZIP's county. tmk_match = unit is a condo unit matched to its own qPublic record — the only rows with a unit-level (CPR) TMK; address is the parcel (CPR 0000) carrying that exact address; fuzzy allows a misspelled street. Rows whose address is missing, not in qPublic, or shared by several parcels have no TMK. County columns on the Summary tab count only rows with a TMK; the rest are in the State total.";

const FICOH_RESTRICTED =
  "Restricted data: FICOH policies and claims are for approved researchers only, and results may be reported only in aggregate. ";

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
