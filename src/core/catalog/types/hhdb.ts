export interface HhdbListParams {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface HhdbListResult<T> {
  rows: T[];
  total: number;
}

export const ISLAND_NAMES: Record<string, string> = {
  "1": "Hawaii",
  "2": "Maui",
  "3": "Oahu",
  "4": "Kauai",
  "5": "Molokai",
  "6": "Lanai",
};

export interface FieldDef {
  column: string;
  label: string;
  type: "factor" | "range";
  format?: "dollar" | "number" | "year" | "text";
  /** When true, the field is shown but not selectable (e.g. too many unique values). */
  disabled?: boolean;
  disabledReason?: string;
}

/** Per-island counts keyed by first digit of TMK: 1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai */
export type IslandCounts = Record<string, number>;

export type FactorResult =
  | {
      type: "factor";
      values: { value: string; counts: IslandCounts; total: number }[];
      nullCounts: IslandCounts;
      nullTotal: number;
    }
  | {
      type: "range";
      format: "dollar" | "number" | "year" | "text";
      islands: {
        island: string;
        min: number;
        max: number;
        median: number;
        count: number;
      }[];
      overall: { min: number; max: number; median: number; count: number };
    };

export const HHDB_FIELDS: Record<string, FieldDef[]> = {
  properties: [
    { column: "island_code", label: "Island Code", type: "factor" },
    { column: "property_class", label: "Property Class", type: "factor" },
    { column: "zoning", label: "Zoning", type: "factor" },
    { column: "damage", label: "Damage", type: "factor" },
    { column: "reentry_zone", label: "Reentry Zone", type: "factor" },
    { column: "zone_color", label: "Zone Color", type: "factor" },
    { column: "living_units", label: "Living Units", type: "factor" },
    {
      column: "land_area_sqft",
      label: "Land Area (sqft)",
      type: "range",
      format: "number",
    },
    { column: "neighborhood_code", label: "Neighborhood Code", type: "factor" },
    { column: "zip", label: "ZIP", type: "factor" },
    { column: "project_name", label: "Project Name", type: "factor" },
    { column: "non_taxable_status", label: "Non-Taxable Status", type: "factor" },
    {
      column: "land_area_acres",
      label: "Land Area (acres)",
      type: "range",
      format: "number",
    },
    {
      column: "legal_information",
      label: "Legal Information",
      type: "factor",
      disabled: true,
      disabledReason: "Too many variations to load — use database directly",
    },
  ],
  assessments: [
    { column: "tax_year", label: "Tax Year", type: "factor" },
    { column: "property_class", label: "Property Class", type: "factor" },
    {
      column: "assessed_land_value",
      label: "Assessed Land Value",
      type: "range",
      format: "dollar",
    },
    {
      column: "assessed_building_value",
      label: "Assessed Building Value",
      type: "range",
      format: "dollar",
    },
    {
      column: "total_property_assessed_value",
      label: "Total Assessed Value",
      type: "range",
      format: "dollar",
    },
    {
      column: "total_net_taxable_value",
      label: "Net Taxable Value",
      type: "range",
      format: "dollar",
    },
    {
      column: "total_market_value",
      label: "Total Market Value",
      type: "range",
      format: "dollar",
    },
  ],
  sales: [
    {
      column: "sale_amount",
      label: "Sale Amount",
      type: "range",
      format: "dollar",
    },
    { column: "instrument_type", label: "Instrument Type", type: "factor" },
    {
      column: "instrument_description",
      label: "Instrument Description",
      type: "factor",
    },
    { column: "valid_sale", label: "Valid Sale", type: "factor" },
    {
      column: "conveyance_tax",
      label: "Conveyance Tax",
      type: "range",
      format: "dollar",
    },
  ],
  residential_improvements: [
    { column: "building_number", label: "Building #", type: "factor" },
    {
      column: "year_built",
      label: "Year Built",
      type: "range",
      format: "year",
    },
    {
      column: "eff_year_built",
      label: "Eff Year Built",
      type: "range",
      format: "year",
    },
    {
      column: "living_area",
      label: "Living Area",
      type: "range",
      format: "number",
    },
    { column: "full_bath", label: "Full Bath", type: "factor" },
    { column: "half_bath", label: "Half Bath", type: "factor" },
    { column: "occupancy", label: "Occupancy", type: "factor" },
    { column: "framing", label: "Framing", type: "factor" },
  ],
  commercial_improvements: [
    { column: "building_number", label: "Building #", type: "factor" },
    { column: "building_card", label: "Building Card", type: "factor" },
    {
      column: "year_built",
      label: "Year Built",
      type: "range",
      format: "year",
    },
    {
      column: "effective_year_built",
      label: "Eff Year Built",
      type: "range",
      format: "year",
    },
    { column: "property_class", label: "Property Class", type: "factor" },
    { column: "structure_type", label: "Structure Type", type: "factor" },
    { column: "identical_units", label: "Identical Units", type: "factor" },
    { column: "percent_complete", label: "% Complete", type: "factor" },
    { column: "structure", label: "Structure", type: "factor" },
    {
      column: "improvement_name",
      label: "Improvement Name",
      type: "range",
      format: "text",
    },
    { column: "units", label: "Units", type: "range", format: "number" },
    {
      column: "building_square_footage",
      label: "Building Sq Ft",
      type: "range",
      format: "number",
    },
    {
      column: "building_type",
      label: "Building Type",
      type: "range",
      format: "text",
    },
    { column: "value", label: "Value", type: "range", format: "dollar" },
  ],
  permits: [
    { column: "reason", label: "Reason", type: "factor" },
    {
      column: "permit_amount",
      label: "Permit Amount",
      type: "range",
      format: "dollar",
    },
  ],
  condominium_projects: [
    { column: "city", label: "City", type: "factor" },
    { column: "floors", label: "Floors", type: "factor" },
    { column: "land_ownership", label: "Land Ownership", type: "factor" },
    { column: "converted", label: "Converted", type: "factor" },
    { column: "ohana", label: "Ohana", type: "factor" },
    {
      column: "unit_count",
      label: "Unit Count",
      type: "range",
      format: "number",
    },
    {
      column: "buildings",
      label: "Buildings",
      type: "range",
      format: "number",
    },
    { column: "zoning", label: "Zoning", type: "range", format: "text" },
  ],
  parcels: [
    { column: "property_class", label: "Property Class", type: "factor" },
    { column: "zoning", label: "Zoning", type: "factor" },
    { column: "damage", label: "Damage", type: "factor" },
    { column: "reentry_zone", label: "Reentry Zone", type: "factor" },
    { column: "zone_color", label: "Zone Color", type: "factor" },
    { column: "living_units", label: "Living Units", type: "factor" },
    { column: "neighborhood_code", label: "Neighborhood Code", type: "range", format: "text" },
    { column: "land_area_sqft", label: "Land Area (sqft)", type: "range", format: "number" },
    { column: "land_area_acres", label: "Land Area (acres)", type: "range", format: "number" },
  ],
  owners: [
    { column: "owner_type", label: "Owner Type", type: "factor" },
    { column: "owner_name", label: "Owner Name", type: "range", format: "text" },
  ],
  appeals: [
    { column: "status", label: "Status", type: "factor" },
    { column: "tax_payer_opinion_of_property_class", label: "Taxpayer Opinion Class", type: "factor" },
    { column: "year", label: "Year", type: "factor" },
    { column: "final_value", label: "Final Value", type: "range", format: "dollar" },
    { column: "tax_payer_opinion_of_value", label: "Taxpayer Opinion Value", type: "range", format: "dollar" },
    { column: "tax_payer_opinion_of_exemptions", label: "Taxpayer Opinion Exemptions", type: "range", format: "dollar" },
  ],
  dedications: [
    { column: "tax_year", label: "Tax Year", type: "factor" },
    { column: "number_of_dedications", label: "# Dedications", type: "factor" },
  ],
  land_classifications: [
    { column: "land_classification", label: "Land Classification", type: "factor" },
    { column: "agricultural_use_indicator", label: "Agricultural Use", type: "factor" },
    { column: "square_footage", label: "Square Footage", type: "range", format: "text" },
    { column: "acreage", label: "Acreage", type: "range", format: "text" },
  ],
  current_tax_bills: [
    { column: "tax_period", label: "Tax Period", type: "factor" },
    { column: "description", label: "Description", type: "factor" },
    { column: "taxes_assessment", label: "Taxes Assessment", type: "range", format: "dollar" },
    { column: "net_tax", label: "Net Tax", type: "range", format: "dollar" },
    { column: "amount_due", label: "Amount Due", type: "range", format: "dollar" },
    { column: "penalty", label: "Penalty", type: "range", format: "dollar" },
  ],
  historical_tax_summary: [
    { column: "year", label: "Year", type: "factor" },
    { column: "tax", label: "Tax", type: "range", format: "dollar" },
    { column: "amount_due", label: "Amount Due", type: "range", format: "dollar" },
    { column: "payments_and_credits", label: "Payments & Credits", type: "range", format: "dollar" },
  ],
  historical_tax_details: [
    { column: "tax_period", label: "Tax Period", type: "factor" },
    { column: "description", label: "Description", type: "factor" },
    { column: "tax", label: "Tax", type: "range", format: "dollar" },
  ],
  historical_tax_payments: [
    { column: "effective_date", label: "Effective Date", type: "range", format: "text" },
    { column: "tax", label: "Tax", type: "range", format: "dollar" },
    { column: "penalty", label: "Penalty", type: "range", format: "dollar" },
  ],
  historical_tax_credits: [
    { column: "period", label: "Period", type: "factor" },
    { column: "description", label: "Description", type: "factor" },
    { column: "amount", label: "Amount", type: "range", format: "dollar" },
  ],
  agricultural_assessments: [
    { column: "agricultural_type", label: "Agricultural Type", type: "factor" },
    { column: "use_description", label: "Use Description", type: "factor" },
    { column: "description", label: "Description", type: "factor" },
    { column: "acres", label: "Acres", type: "range", format: "text" },
    { column: "acres_in_production", label: "Acres in Production", type: "range", format: "text" },
    { column: "agricultural_value", label: "Agricultural Value", type: "range", format: "dollar" },
    { column: "assessed_value", label: "Assessed Value", type: "range", format: "dollar" },
  ],
  commercial_improvement_details: [
    { column: "usage", label: "Usage", type: "factor" },
    { column: "construction", label: "Construction", type: "factor" },
    { column: "section", label: "Section", type: "factor" },
    { column: "exterior_wall", label: "Exterior Wall", type: "factor" },
    { column: "condo_style", label: "Condo Style", type: "factor" },
    { column: "condo_type", label: "Condo Type", type: "factor" },
    { column: "view", label: "View", type: "factor" },
    { column: "occupancy", label: "Occupancy", type: "factor" },
    { column: "floor", label: "Floor", type: "factor" },
    { column: "floor_level", label: "Floor Level", type: "factor" },
    { column: "area", label: "Area", type: "range", format: "text" },
    { column: "perimeter", label: "Perimeter", type: "range", format: "text" },
    { column: "wall_height", label: "Wall Height", type: "range", format: "text" },
  ],
  residential_additions: [
    { column: "card", label: "Card", type: "factor" },
    { column: "line", label: "Line", type: "factor" },
    { column: "lower", label: "Lower", type: "factor" },
    { column: "first", label: "First", type: "factor" },
    { column: "area", label: "Area", type: "range", format: "text" },
  ],
  accessory_structures: [
    { column: "building_number", label: "Building #", type: "factor" },
    { column: "description", label: "Description", type: "factor" },
    { column: "percent_complete", label: "% Complete", type: "factor" },
    { column: "dimensions_units", label: "Dimensions/Units", type: "range", format: "text" },
    { column: "value", label: "Value", type: "range", format: "dollar" },
    { column: "year_built", label: "Year Built", type: "range", format: "year" },
  ],
  yard_improvements: [
    { column: "description", label: "Description", type: "factor" },
    { column: "quantity", label: "Quantity", type: "factor" },
    { column: "year_built", label: "Year Built", type: "range", format: "year" },
    { column: "area", label: "Area", type: "range", format: "text" },
  ],
};
