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
  warning?: string;
}

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
  "accessory-structures": {
    title: "Accessory Structures",
    fieldsTable: "accessory_structures",
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
  "yard-improvements": {
    title: "Yard Improvements",
    fieldsTable: "yard_improvements",
    defaultSort: "tmk",
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
