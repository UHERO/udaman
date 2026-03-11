import type { FieldDef, SummaryViewType } from "./hhdb";

const ALL_VIEWS: SummaryViewType[] = ["summary", "rank", "range"];

export interface DictionaryField {
  key: string;
  label: string;
  description: string;
  summary?: SummaryViewType[];
  format?: "dollar" | "number" | "year" | "text";
  /** When true, the field is shown but not selectable in summaries. */
  disabled?: boolean;
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Single source of truth for every column in every HHDB table.
// Keys match the DB table names used by HHDB_TABLE_CONFIG.fieldsTable.
// ---------------------------------------------------------------------------

export const HHDB_DATA_DICTIONARY: Record<string, DictionaryField[]> = {
  // ── Properties ──────────────────────────────────────────────────────────
  properties: [
    {
      key: "tmk",
      label: "TMK",
      description:
        "Tax Map Key. Unique 9-digit parcel identifier assigned by the county.",
    },
    {
      key: "island_code",
      label: "Island Code",
      description:
        "Single-digit code identifying the island: 1=Oahu, 2=Maui, 3=Hawaii, 4=Kauai.",
      summary: ALL_VIEWS,
    },
    {
      key: "parcel_number",
      label: "Parcel Number",
      description:
        "County-assigned parcel number, often the same as TMK but may include formatting differences.",
    },
    {
      key: "location_address",
      label: "Address",
      description:
        "Street address of the property as recorded by the county assessor.",
    },
    {
      key: "address_other",
      label: "Address (Other)",
      description:
        "Additional address information such as unit numbers or secondary addresses.",
    },
    {
      key: "project_name",
      label: "Project Name",
      description:
        "Name of the development or subdivision the property belongs to.",
      summary: ALL_VIEWS,
    },
    {
      key: "legal_information",
      label: "Legal Information",
      description:
        "Legal description from deed records (lot, block, plat references).",
      disabled: true,
      disabledReason:
        "Too many variations to summarize — use the Data tab or query the database directly",
    },
    {
      key: "property_class",
      label: "Property Class",
      description:
        "County classification code indicating land use type (residential, commercial, agricultural, etc.).",
      summary: ALL_VIEWS,
    },
    {
      key: "land_area_sqft",
      label: "Land Area (sqft)",
      description: "Total land area of the parcel in square feet.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "land_area_acres",
      label: "Land Area (acres)",
      description: "Total land area of the parcel in acres.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "neighborhood_code",
      label: "Neighborhood Code",
      description:
        "Assessor-defined neighborhood grouping used for comparable-sales valuation.",
      summary: ALL_VIEWS,
    },
    {
      key: "zoning",
      label: "Zoning",
      description: "County zoning designation controlling permitted land uses.",
      summary: ALL_VIEWS,
    },
    {
      key: "parcel_note",
      label: "Parcel Note",
      description:
        "Free-text notes recorded by the assessor about this parcel.",
    },
    {
      key: "damage",
      label: "Damage",
      description:
        "Damage designation, typically from natural disasters (e.g. lava zone damage).",
      summary: ALL_VIEWS,
    },
    {
      key: "reentry_zone",
      label: "Reentry Zone",
      description: "Disaster reentry zone classification, if applicable.",
      summary: ALL_VIEWS,
    },
    {
      key: "zone_color",
      label: "Zone Color",
      description: "Color-coded zone classification used in hazard mapping.",
      summary: ALL_VIEWS,
    },
    {
      key: "non_taxable_status",
      label: "Non-Taxable Status",
      description:
        "Exemption status indicating the property is wholly or partially non-taxable.",
      summary: ALL_VIEWS,
    },
    {
      key: "living_units",
      label: "Living Units",
      description: "Number of residential living units on the parcel.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "map_url",
      label: "Map URL",
      description: "Link to the county GIS map viewer for this parcel.",
    },
    {
      key: "sketch_url",
      label: "Sketch URL",
      description: "Link to the assessor's building sketch or floor plan.",
    },
    {
      key: "zip",
      label: "ZIP",
      description: "Postal ZIP code for the property address.",
      summary: ALL_VIEWS,
    },
    {
      key: "latitude",
      label: "Latitude",
      description: "Geographic latitude coordinate of the parcel centroid.",
    },
    {
      key: "longitude",
      label: "Longitude",
      description: "Geographic longitude coordinate of the parcel centroid.",
    },
  ],

  // ── Assessments ─────────────────────────────────────────────────────────
  assessments: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_year",
      label: "Tax Year",
      description: "The fiscal year this assessment applies to.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "property_class",
      label: "Property Class",
      description: "County classification code for this assessment year.",
      summary: ALL_VIEWS,
    },
    {
      key: "assessed_land_value",
      label: "Assessed Land Value",
      description: "Assessor's valuation of the land component.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "assessed_building_value",
      label: "Assessed Building Value",
      description: "Assessor's valuation of buildings and improvements.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "dedicated_use_value",
      label: "Dedicated Use Value",
      description:
        "Value attributed to dedicated land use (e.g. agricultural dedication).",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "land_exemption",
      label: "Land Exemption",
      description:
        "Exemption amount applied to land value (homeowner, disabled veteran, etc.).",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "building_exemption",
      label: "Building Exemption",
      description: "Exemption amount applied to building value.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "net_taxable_land_value",
      label: "Net Taxable Land Value",
      description: "Land value remaining after exemptions are applied.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "net_taxable_building_value",
      label: "Net Taxable Building Value",
      description: "Building value remaining after exemptions are applied.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "total_property_assessed_value",
      label: "Total Assessed Value",
      description:
        "Sum of assessed land and building values before exemptions.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "total_property_exemption",
      label: "Total Property Exemption",
      description:
        "Total dollar amount of all exemptions applied to the property.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "total_net_taxable_value",
      label: "Net Taxable Value",
      description:
        "Total assessed value minus exemptions — the value taxes are computed on.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "agricultural_land_value",
      label: "Agricultural Land Value",
      description:
        "Land value computed under agricultural-use valuation rules.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "market_land_value",
      label: "Market Land Value",
      description:
        "Full market value of the land without agricultural or dedicated-use adjustments.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "market_building_value",
      label: "Market Building Value",
      description: "Full market value of buildings and improvements.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "total_market_value",
      label: "Total Market Value",
      description:
        "Combined market value of land and buildings at full market rates.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Sales ───────────────────────────────────────────────────────────────
  sales: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key",
      summary: ALL_VIEWS,
    },
    {
      key: "sale_date",
      label: "Sale Date",
      description: "Date the sale transaction occurred.",
      summary: ALL_VIEWS,
    },
    {
      key: "sale_amount",
      label: "Sale Amount",
      description: "Reported sale price of the property.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "instrument",
      label: "Instrument",
      description: "Recording instrument number for the transaction.",
      summary: ALL_VIEWS,
    },
    {
      key: "instrument_type",
      label: "Instrument Type",
      description: "Type code for the legal instrument (e.g. D=Deed, L=Lease).",
      summary: ALL_VIEWS,
    },
    {
      key: "instrument_description",
      label: "Instrument Description",
      description: "Descriptive text for the instrument type.",
      summary: ALL_VIEWS,
    },
    {
      key: "valid_sale",
      label: "Valid Sale",
      description:
        "Flag indicating whether the sale is considered arm's-length and usable for valuation.",
      summary: ALL_VIEWS,
    },
    {
      key: "date_of_recording",
      label: "Date of Recording",
      description:
        "Date the transaction was officially recorded at the Bureau of Conveyances.",
      summary: ALL_VIEWS,
    },
    {
      key: "land_court_document_number",
      label: "Land Court Doc #",
      description:
        "Land Court document number for registered land transactions.",
      summary: ALL_VIEWS,
    },
    {
      key: "cert",
      label: "Certificate",
      description: "Transfer certificate of title number.",
      summary: ALL_VIEWS,
    },
    {
      key: "book_page",
      label: "Book/Page",
      description: "Bureau of Conveyances book and page reference.",
      summary: ALL_VIEWS,
    },
    {
      key: "conveyance_tax",
      label: "Conveyance Tax",
      description: "State conveyance tax paid on the transaction.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "document_type",
      label: "Document Type",
      description: "Classification of the recorded document.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Residential Improvements ────────────────────────────────────────────
  residential_improvements: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key",
      summary: ALL_VIEWS,
    },
    {
      key: "building_number",
      label: "Building #",
      description: "Identifies which building on the parcel (1, 2, etc.).",
      summary: ALL_VIEWS,
    },
    {
      key: "year_built",
      label: "Year Built",
      description: "Original construction year of the building.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "eff_year_built",
      label: "Eff Year Built",
      description: "Effective year built, adjusted for major renovations.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "living_area",
      label: "Living Area",
      description: "Total interior living space in square feet.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "bedrooms",
      label: "Bedrooms",
      description: "Number of bedrooms in the dwelling.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "full_bath",
      label: "Full Bath",
      description: "Number of full bathrooms (toilet, sink, tub/shower).",
      summary: ALL_VIEWS,
    },
    {
      key: "half_bath",
      label: "Half Bath",
      description: "Number of half bathrooms (toilet and sink only).",
      summary: ALL_VIEWS,
    },
    {
      key: "occupancy",
      label: "Occupancy",
      description:
        "Occupancy type classification (e.g. single-family, duplex).",
      summary: ALL_VIEWS,
    },
    {
      key: "framing",
      label: "Framing",
      description:
        "Building frame construction type (e.g. wood, steel, concrete).",
      summary: ALL_VIEWS,
    },
    {
      key: "percent_complete",
      label: "% Complete",
      description:
        "Percentage of construction completed, for buildings under construction.",
      summary: ALL_VIEWS,
    },
    {
      key: "heating_cooling",
      label: "Heating/Cooling",
      description: "Type of HVAC system installed.",
      summary: ALL_VIEWS,
    },
    {
      key: "exterior_wall",
      label: "Exterior Wall",
      description: "Material of exterior walls (e.g. wood, stucco, masonry).",
      summary: ALL_VIEWS,
    },
    {
      key: "roof_material",
      label: "Roof Material",
      description: "Roofing material type (e.g. asphalt shingle, tile, metal).",
      summary: ALL_VIEWS,
    },
    {
      key: "fireplace",
      label: "Fireplace",
      description: "Fireplace presence and type.",
      summary: ALL_VIEWS,
    },
    {
      key: "grade",
      label: "Grade",
      description: "Construction quality grade assigned by the assessor.",
      summary: ALL_VIEWS,
    },
    {
      key: "building_value",
      label: "Building Value",
      description: "Assessed value of this residential building.",
      summary: ALL_VIEWS,
    },
    {
      key: "total_room_count",
      label: "Total Room Count",
      description: "Total number of rooms in the dwelling.",
      summary: ALL_VIEWS,
    },
    {
      key: "condo_style",
      label: "Condo Style",
      description:
        "Condominium architectural style classification, if applicable.",
      summary: ALL_VIEWS,
    },
    {
      key: "condo_view",
      label: "Condo View",
      description:
        "View classification for condominiums (e.g. ocean, mountain, city).",
      summary: ALL_VIEWS,
    },
    {
      key: "floor_level",
      label: "Floor Level",
      description: "Floor level of the unit within a multi-story building.",
      summary: ALL_VIEWS,
    },
    {
      key: "parking_spaces",
      label: "Parking Spaces",
      description: "Number of assigned parking spaces.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Commercial Improvements ─────────────────────────────────────────────
  commercial_improvements: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key",
      summary: ALL_VIEWS,
    },
    {
      key: "building_number",
      label: "Building #",
      description: "Identifies which building on the parcel.",
      summary: ALL_VIEWS,
    },
    {
      key: "building_card",
      label: "Building Card",
      description: "Card number for assessor records.",
      summary: ALL_VIEWS,
    },
    {
      key: "year_built",
      label: "Year Built",
      description: "Original construction year.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "effective_year_built",
      label: "Eff Year Built",
      description: "Effective year built, adjusted for renovations.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "improvement_name",
      label: "Improvement Name",
      description: "Descriptive name of the commercial improvement.",
      summary: ALL_VIEWS,
    },
    {
      key: "property_class",
      label: "Property Class",
      description: "Classification of commercial use.",
      summary: ALL_VIEWS,
    },
    {
      key: "structure_type",
      label: "Structure Type",
      description: "Structural classification of the building.",
      summary: ALL_VIEWS,
    },
    {
      key: "units",
      label: "Units",
      description: "Number of units in the building.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "identical_units",
      label: "Identical Units",
      description: "Number of identical units used for mass appraisal.",
      summary: ALL_VIEWS,
    },
    {
      key: "gross_building_description",
      label: "Gross Building Desc",
      description:
        "Free-text description of the building for assessment purposes.",
      summary: ALL_VIEWS,
    },
    {
      key: "building_square_footage",
      label: "Building Sq Ft",
      description: "Total gross building area in square feet.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "building_type",
      label: "Building Type",
      description: "Type classification for the building.",
      summary: ALL_VIEWS,
    },
    {
      key: "percent_complete",
      label: "% Complete",
      description: "Percentage of construction completed.",
      summary: ALL_VIEWS,
    },
    {
      key: "structure",
      label: "Structure",
      description: "Structural system description.",
      summary: ALL_VIEWS,
    },
    {
      key: "value",
      label: "Value",
      description: "Assessed value of this commercial improvement.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Permits ─────────────────────────────────────────────────────────────
  permits: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key",
      summary: ALL_VIEWS,
    },
    {
      key: "permit_date",
      label: "Permit Date",
      description: "Date the building permit was issued.",
      summary: ALL_VIEWS,
    },
    {
      key: "permit_number",
      label: "Permit Number",
      description: "County-assigned permit reference number.",
      summary: ALL_VIEWS,
    },
    {
      key: "reason",
      label: "Reason",
      description:
        "Purpose or reason for the permit (e.g. new construction, renovation, addition).",
      summary: ALL_VIEWS,
    },
    {
      key: "permit_amount",
      label: "Permit Amount",
      description: "Estimated construction cost declared on the permit.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Condominium Projects ────────────────────────────────────────────────
  condominium_projects: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the condominium project master record.",
      summary: ALL_VIEWS,
    },
    {
      key: "project_name",
      label: "Project Name",
      description: "Official name of the condominium project.",
      summary: ALL_VIEWS,
    },
    {
      key: "unit_count",
      label: "Unit Count",
      description: "Total number of units in the project.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "dcca_link",
      label: "DCCA Link",
      description: "Link to the DCCA condominium registration page.",
      summary: ALL_VIEWS,
    },
    {
      key: "zoning",
      label: "Zoning",
      description: "Zoning designation for the project site.",
      summary: ALL_VIEWS,
    },
    {
      key: "address",
      label: "Address",
      description: "Street address of the condominium project.",
      summary: ALL_VIEWS,
    },
    {
      key: "city",
      label: "City",
      description: "City where the project is located.",
      summary: ALL_VIEWS,
    },
    {
      key: "developer",
      label: "Developer",
      description: "Name of the project developer.",
      summary: ALL_VIEWS,
    },
    {
      key: "project_number",
      label: "Project Number",
      description: "DCCA-assigned project registration number.",
      summary: ALL_VIEWS,
    },
    {
      key: "commercial",
      label: "Commercial Units",
      description: "Number of commercial units in the project.",
      summary: ALL_VIEWS,
    },
    {
      key: "tool_sheds",
      label: "Tool Sheds",
      description: "Number of tool shed units.",
      summary: ALL_VIEWS,
    },
    {
      key: "ohana",
      label: "Ohana",
      description:
        "Whether the project includes ohana (accessory dwelling) units.",
      summary: ALL_VIEWS,
    },
    {
      key: "residential",
      label: "Residential Units",
      description: "Number of residential units in the project.",
      summary: ALL_VIEWS,
    },
    {
      key: "parking",
      label: "Parking Units",
      description: "Number of parking units.",
      summary: ALL_VIEWS,
    },
    {
      key: "converted",
      label: "Converted",
      description:
        "Whether the project was converted from another use (e.g. rental to condo).",
      summary: ALL_VIEWS,
    },
    {
      key: "agricultural",
      label: "Agricultural Units",
      description: "Number of agricultural-zoned units.",
      summary: ALL_VIEWS,
    },
    {
      key: "other",
      label: "Other Units",
      description: "Number of units not classified in other categories.",
      summary: ALL_VIEWS,
    },
    {
      key: "buildings",
      label: "Buildings",
      description: "Number of buildings in the project.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "floors",
      label: "Floors",
      description: "Number of floors in the building(s).",
      summary: ALL_VIEWS,
    },
    {
      key: "land_ownership",
      label: "Land Ownership",
      description: "Fee simple or leasehold ownership of the underlying land.",
      summary: ALL_VIEWS,
    },
    {
      key: "preliminary_date",
      label: "Preliminary Date",
      description: "Date of preliminary condo registration.",
      summary: ALL_VIEWS,
    },
    {
      key: "contingent_final_date",
      label: "Contingent Final Date",
      description: "Contingent final registration date.",
      summary: ALL_VIEWS,
    },
    {
      key: "final_date",
      label: "Final Date",
      description: "Final condo registration date.",
      summary: ALL_VIEWS,
    },
    {
      key: "biennial_registration_date",
      label: "Biennial Registration",
      description: "Most recent biennial registration date.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Condominium Units ───────────────────────────────────────────────────
  condominium_units: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "parent_tmk",
      label: "Parent TMK",
      description: "TMK of the parent condominium project.",
      summary: ALL_VIEWS,
    },
    {
      key: "unit_number",
      label: "Unit Number",
      description: "Unit designation within the condo project.",
      summary: ALL_VIEWS,
    },
    {
      key: "owner_name",
      label: "Owner Name",
      description: "Name of the unit owner on file.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Parcels ─────────────────────────────────────────────────────────────
  parcels: [
    {
      key: "parcel_number",
      label: "Parcel Number",
      description: "County-assigned parcel number.",
    },
    {
      key: "location_address",
      label: "Address",
      description: "Street address at the time this parcel record was scraped.",
    },
    {
      key: "address_other",
      label: "Address (Other)",
      description: "Additional address information.",
    },
    {
      key: "project_name",
      label: "Project Name",
      description: "Development or subdivision name.",
    },
    {
      key: "legal_information",
      label: "Legal Information",
      description: "Legal description from deed records.",
    },
    {
      key: "property_class",
      label: "Property Class",
      description: "County classification code.",
      summary: ALL_VIEWS,
    },
    {
      key: "land_area_sqft",
      label: "Land Area (sqft)",
      description: "Parcel land area in square feet.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "land_area_acres",
      label: "Land Area (acres)",
      description: "Parcel land area in acres.",
      summary: ALL_VIEWS,
      format: "number",
    },
    {
      key: "neighborhood_code",
      label: "Neighborhood Code",
      description: "Assessor-defined neighborhood grouping.",
      summary: ALL_VIEWS,
    },
    {
      key: "zoning",
      label: "Zoning",
      description: "County zoning designation.",
      summary: ALL_VIEWS,
    },
    {
      key: "parcel_note",
      label: "Parcel Note",
      description: "Free-text notes recorded by the assessor.",
    },
    {
      key: "damage",
      label: "Damage",
      description: "Damage designation from natural disasters.",
      summary: ALL_VIEWS,
    },
    {
      key: "reentry_zone",
      label: "Reentry Zone",
      description: "Disaster reentry zone classification.",
      summary: ALL_VIEWS,
    },
    {
      key: "zone_color",
      label: "Zone Color",
      description: "Color-coded zone classification.",
      summary: ALL_VIEWS,
    },
    {
      key: "non_taxable_status",
      label: "Non-Taxable Status",
      description: "Exemption status for the parcel.",
    },
    {
      key: "living_units",
      label: "Living Units",
      description: "Number of residential living units.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Owners ──────────────────────────────────────────────────────────────
  owners: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "owner_name",
      label: "Owner Name",
      description: "Full name of the property owner as recorded.",
      summary: ALL_VIEWS,
    },
    {
      key: "owner_type",
      label: "Owner Type",
      description:
        "Classification of ownership (e.g. individual, corporation, trust, government).",
      summary: ALL_VIEWS,
    },
    {
      key: "owner_address",
      label: "Owner Address",
      description: "Mailing address of the owner.",
      summary: ALL_VIEWS,
    },
    {
      key: "sequence_order",
      label: "Sequence Order",
      description: "Order of this owner when a property has multiple owners.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Appeals ─────────────────────────────────────────────────────────────
  appeals: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "year",
      label: "Year",
      description: "Tax year the appeal was filed for.",
      summary: ALL_VIEWS,
    },
    {
      key: "appeal_type_value",
      label: "Appeal Type/Value",
      description: "Type of appeal and the contested value.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "scheduled_hearing_date_subject_to_change",
      label: "Hearing Date",
      description: "Scheduled hearing date (subject to change).",
      summary: ALL_VIEWS,
    },
    {
      key: "status",
      label: "Status",
      description:
        "Current status of the appeal (e.g. pending, settled, withdrawn).",
      summary: ALL_VIEWS,
    },
    {
      key: "date_settled",
      label: "Date Settled",
      description: "Date the appeal was resolved.",
      summary: ALL_VIEWS,
    },
    {
      key: "final_value",
      label: "Final Value",
      description: "Property value determined after appeal resolution.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "tax_payer_opinion_of_value",
      label: "Taxpayer Opinion Value",
      description: "Property value claimed by the taxpayer in the appeal.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "tax_payer_opinion_of_property_class",
      label: "Taxpayer Opinion Class",
      description: "Property class the taxpayer believes is correct.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_payer_opinion_of_exemptions",
      label: "Taxpayer Opinion Exemptions",
      description:
        "Exemption amount the taxpayer believes they are entitled to.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Dedications ─────────────────────────────────────────────────────────
  dedications: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_year",
      label: "Tax Year",
      description: "Tax year the dedication applies to.",
      summary: ALL_VIEWS,
    },
    {
      key: "number_of_dedications",
      label: "# Dedications",
      description: "Number of dedication programs the property is enrolled in.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Land Classifications ────────────────────────────────────────────────
  land_classifications: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "land_classification",
      label: "Land Classification",
      description: "State Land Use Commission classification for the parcel.",
      summary: ALL_VIEWS,
    },
    {
      key: "square_footage",
      label: "Square Footage",
      description: "Area of this classification segment in square feet.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "acreage",
      label: "Acreage",
      description: "Area of this classification segment in acres.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "agricultural_use_indicator",
      label: "Agricultural Use",
      description:
        "Whether this land segment is actively used for agriculture.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Current Tax Bills ───────────────────────────────────────────────────
  current_tax_bills: [
    {
      key: "tmk",
      label: "TMK",
      description: "Tax Map Key for the individual condo unit (CPR number).",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_period",
      label: "Tax Period",
      description: "Billing period (e.g. 1st half, 2nd half).",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description: "Line-item description on the tax bill.",
      summary: ALL_VIEWS,
    },
    {
      key: "original_due_date",
      label: "Original Due Date",
      description: "Payment due date before any extensions.",
      summary: ALL_VIEWS,
    },
    {
      key: "taxes_assessment",
      label: "Taxes Assessment",
      description: "Tax amount based on the property assessment.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "tax_credits",
      label: "Tax Credits",
      description: "Credits applied to reduce the tax bill.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "net_tax",
      label: "Net Tax",
      description: "Tax amount after credits are applied.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "penalty",
      label: "Penalty",
      description: "Late payment penalty assessed.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "interest",
      label: "Interest",
      description: "Interest charged on overdue taxes.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "other",
      label: "Other",
      description: "Other charges or adjustments on the tax bill.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "amount_due",
      label: "Amount Due",
      description: "Total amount currently due.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Historical Tax Summary ──────────────────────────────────────────────
  historical_tax_summary: [
    {
      key: "year",
      label: "Year",
      description: "Tax year for this summary record.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax",
      label: "Tax",
      description: "Total tax assessed for the year.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "payments_and_credits",
      label: "Payments & Credits",
      description: "Total payments and credits applied during the year.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "penalty",
      label: "Penalty",
      description: "Total penalties assessed during the year.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "interest",
      label: "Interest",
      description: "Total interest charges for the year.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "other",
      label: "Other",
      description: "Other charges or adjustments.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "amount_due",
      label: "Amount Due",
      description: "Remaining amount due for the year.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "tax_details_total_tax",
      label: "Details: Total Tax",
      description: "Sum of all tax detail line items.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_details_total_payments_credits",
      label: "Details: Payments/Credits",
      description: "Sum of payments and credits from detail records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_details_total_penalty",
      label: "Details: Penalty",
      description: "Sum of penalties from detail records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_details_total_interest",
      label: "Details: Interest",
      description: "Sum of interest from detail records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_details_total_other",
      label: "Details: Other",
      description: "Sum of other charges from detail records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_payments_total_tax",
      label: "Payments: Tax",
      description: "Total tax amount from payment records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_payments_total_penalty",
      label: "Payments: Penalty",
      description: "Total penalty from payment records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_payments_total_interest",
      label: "Payments: Interest",
      description: "Total interest from payment records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_payments_total_other",
      label: "Payments: Other",
      description: "Total other amounts from payment records.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax_credits_total_amount",
      label: "Credits: Total",
      description: "Total amount of tax credits applied.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Historical Tax Details ──────────────────────────────────────────────
  historical_tax_details: [
    {
      key: "tax_period",
      label: "Tax Period",
      description: "Billing period for this detail line item.",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description: "Description of the tax detail line item.",
      summary: ALL_VIEWS,
    },
    {
      key: "tax",
      label: "Tax",
      description: "Tax amount for this line item.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "payments_credits",
      label: "Payments/Credits",
      description: "Payments and credits applied to this line item.",
      summary: ALL_VIEWS,
    },
    {
      key: "penalty",
      label: "Penalty",
      description: "Penalty for this line item.",
      summary: ALL_VIEWS,
    },
    {
      key: "interest",
      label: "Interest",
      description: "Interest charged on this line item.",
      summary: ALL_VIEWS,
    },
    {
      key: "other",
      label: "Other",
      description: "Other charges for this line item.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Historical Tax Payments ─────────────────────────────────────────────
  historical_tax_payments: [
    {
      key: "payment_sequence",
      label: "Payment Sequence",
      description: "Identifier for the payment sequence or batch.",
      summary: ALL_VIEWS,
    },
    {
      key: "effective_date",
      label: "Effective Date",
      description: "Date the payment was applied.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "tax",
      label: "Tax",
      description: "Tax portion of the payment.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "penalty",
      label: "Penalty",
      description: "Penalty portion of the payment.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "interest",
      label: "Interest",
      description: "Interest portion of the payment.",
      summary: ALL_VIEWS,
    },
    {
      key: "other",
      label: "Other",
      description: "Other amounts included in the payment.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Historical Tax Credits ──────────────────────────────────────────────
  historical_tax_credits: [
    {
      key: "period",
      label: "Period",
      description: "Tax period the credit applies to.",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description: "Description of the tax credit.",
      summary: ALL_VIEWS,
    },
    {
      key: "amount",
      label: "Amount",
      description: "Dollar amount of the tax credit.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Agricultural Assessments ────────────────────────────────────────────
  agricultural_assessments: [
    {
      key: "agricultural_type",
      label: "Agricultural Type",
      description:
        "Type of agricultural activity (e.g. crop, pasture, forestry).",
      summary: ALL_VIEWS,
    },
    {
      key: "use_description",
      label: "Use Description",
      description: "Specific description of the agricultural use.",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description: "Additional details about the agricultural assessment.",
      summary: ALL_VIEWS,
    },
    {
      key: "acres",
      label: "Acres",
      description: "Total acreage under agricultural assessment.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "acres_in_production",
      label: "Acres in Production",
      description: "Acres actively in agricultural production.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "agricultural_value",
      label: "Agricultural Value",
      description: "Value based on agricultural-use valuation.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "assessed_value",
      label: "Assessed Value",
      description: "Assessed value for this agricultural segment.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
  ],

  // ── Commercial Improvement Details ──────────────────────────────────────
  commercial_improvement_details: [
    {
      key: "card",
      label: "Card",
      description: "Assessor card number for this section.",
      summary: ALL_VIEWS,
    },
    {
      key: "section",
      label: "Section",
      description: "Section identifier within the building.",
      summary: ALL_VIEWS,
    },
    {
      key: "floor",
      label: "Floor",
      description: "Floor number within the building.",
      summary: ALL_VIEWS,
    },
    {
      key: "usage",
      label: "Usage",
      description: "How this section is used (e.g. office, retail, storage).",
      summary: ALL_VIEWS,
    },
    {
      key: "area",
      label: "Area",
      description: "Square footage of this section.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "perimeter",
      label: "Perimeter",
      description: "Perimeter measurement of this section.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "exterior_wall",
      label: "Exterior Wall",
      description: "Exterior wall material for this section.",
      summary: ALL_VIEWS,
    },
    {
      key: "wall_height",
      label: "Wall Height",
      description: "Wall height measurement.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "occupancy",
      label: "Occupancy",
      description: "Occupancy type classification.",
      summary: ALL_VIEWS,
    },
    {
      key: "construction",
      label: "Construction",
      description: "Construction type classification.",
      summary: ALL_VIEWS,
    },
    {
      key: "condo_style",
      label: "Condo Style",
      description: "Condo architectural style, if applicable.",
      summary: ALL_VIEWS,
    },
    {
      key: "condo_type",
      label: "Condo Type",
      description: "Condo type classification, if applicable.",
      summary: ALL_VIEWS,
    },
    {
      key: "condo_unit",
      label: "Condo Unit",
      description: "Condo unit designation.",
      summary: ALL_VIEWS,
    },
    {
      key: "floor_level",
      label: "Floor Level",
      description: "Floor level within a multi-story building.",
      summary: ALL_VIEWS,
    },
    {
      key: "view",
      label: "View",
      description: "View classification (e.g. ocean, mountain, garden).",
      summary: ALL_VIEWS,
    },
    {
      key: "project",
      label: "Project",
      description: "Project name this section belongs to.",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description: "Free-text description of the improvement section.",
      summary: ALL_VIEWS,
    },
  ],

  // ── Residential Additions ───────────────────────────────────────────────
  residential_additions: [
    {
      key: "card",
      label: "Card",
      description: "Assessor card number.",
      summary: ALL_VIEWS,
    },
    {
      key: "line",
      label: "Line",
      description: "Line item number on the assessor card.",
      summary: ALL_VIEWS,
    },
    {
      key: "lower",
      label: "Lower",
      description: "Lower level addition description.",
      summary: ALL_VIEWS,
    },
    {
      key: "first",
      label: "First",
      description: "First floor addition description.",
      summary: ALL_VIEWS,
    },
    {
      key: "second",
      label: "Second",
      description: "Second floor addition description.",
      summary: ALL_VIEWS,
    },
    {
      key: "third",
      label: "Third",
      description: "Third floor addition description.",
      summary: ALL_VIEWS,
    },
    {
      key: "area",
      label: "Area",
      description: "Area of the addition in square feet.",
      summary: ALL_VIEWS,
      format: "text",
    },
  ],

  // ── Accessory Structures ────────────────────────────────────────────────
  accessory_structures: [
    {
      key: "building_number",
      label: "Building #",
      description:
        "Building number this accessory structure is associated with.",
      summary: ALL_VIEWS,
    },
    {
      key: "description",
      label: "Description",
      description:
        "Description of the accessory structure (e.g. garage, carport, pool).",
      summary: ALL_VIEWS,
    },
    {
      key: "dimensions_units",
      label: "Dimensions/Units",
      description: "Size dimensions or unit count of the structure.",
      summary: ALL_VIEWS,
      format: "text",
    },
    {
      key: "percent_complete",
      label: "% Complete",
      description: "Percentage of construction completed.",
      summary: ALL_VIEWS,
    },
    {
      key: "value",
      label: "Value",
      description: "Assessed value of the accessory structure.",
      summary: ALL_VIEWS,
      format: "dollar",
    },
    {
      key: "year_built",
      label: "Year Built",
      description: "Year the structure was built.",
      summary: ALL_VIEWS,
      format: "year",
    },
  ],

  // ── Yard Improvements ───────────────────────────────────────────────────
  yard_improvements: [
    {
      key: "description",
      label: "Description",
      description:
        "Description of the yard improvement (e.g. fence, retaining wall, landscaping).",
      summary: ALL_VIEWS,
    },
    {
      key: "quantity",
      label: "Quantity",
      description: "Quantity or count of the improvement.",
      summary: ALL_VIEWS,
    },
    {
      key: "year_built",
      label: "Year Built",
      description: "Year the improvement was constructed.",
      summary: ALL_VIEWS,
      format: "year",
    },
    {
      key: "area",
      label: "Area",
      description: "Area or linear measurement of the improvement.",
      summary: ALL_VIEWS,
      format: "text",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all dictionary fields for a table. */
export function getDictionaryFields(
  tableName: string,
): DictionaryField[] | null {
  return HHDB_DATA_DICTIONARY[tableName] ?? null;
}

/**
 * Get summary-compatible FieldDef[] for a table, optionally filtered by view type.
 * Returns only fields that have a `summary` config.
 */
export function getSummaryFieldDefs(
  tableName: string,
  viewType?: SummaryViewType,
): FieldDef[] | null {
  const fields = HHDB_DATA_DICTIONARY[tableName];
  if (!fields) return null;
  const result: FieldDef[] = [];
  for (const f of fields) {
    if (!f.summary || f.summary.length === 0) continue;
    if (viewType && !f.summary.includes(viewType)) continue;
    // Use the first summary type as the primary type (or the requested viewType)
    const type = viewType ?? f.summary[0];
    result.push({
      column: f.key,
      label: f.label,
      type,
      format: f.format,
      disabled: f.disabled,
      disabledReason: f.disabledReason,
    });
  }
  return result.length > 0 ? result : null;
}

/** Get dictionary fields that support a specific view type. */
export function getFieldsForViewType(
  tableName: string,
  viewType: SummaryViewType,
): DictionaryField[] | null {
  const fields = HHDB_DATA_DICTIONARY[tableName];
  if (!fields) return null;
  const result = fields.filter((f) => f.summary?.includes(viewType));
  return result.length > 0 ? result : null;
}
