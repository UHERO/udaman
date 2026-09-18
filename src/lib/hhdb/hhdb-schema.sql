-- ============================================================================
-- QPub Hawaii Property Database Schema
-- MariaDB/MySQL compatible schema for statewide property data
-- Current DB Version Mariadb 10.11.6
-- Primary table: properties (tmk as PK)
-- Related tables: Link back to properties via tmk foreign key
-- ============================================================================
-- Drop tables if they exist (for clean rebuild)
DROP TABLE IF EXISTS historical_tax_credits;

DROP TABLE IF EXISTS historical_tax_payments;

DROP TABLE IF EXISTS historical_tax_details;

DROP TABLE IF EXISTS historical_tax_summary;

DROP TABLE IF EXISTS current_tax_bills;

DROP TABLE IF EXISTS sales;

DROP TABLE IF EXISTS permits;

DROP TABLE IF EXISTS accessory_improvements;

DROP TABLE IF EXISTS commercial_improvement_details;

DROP TABLE IF EXISTS commercial_improvements;

DROP TABLE IF EXISTS residential_additions;

DROP TABLE IF EXISTS residential_improvements;

DROP TABLE IF EXISTS land_classifications;

DROP TABLE IF EXISTS assessments;

DROP TABLE IF EXISTS agricultural_assessments;

DROP TABLE IF EXISTS appeals;

DROP TABLE IF EXISTS dedications;

DROP TABLE IF EXISTS home_exemptions;

DROP TABLE IF EXISTS condominium_units;

DROP TABLE IF EXISTS condominium_projects;

DROP TABLE IF EXISTS parcels;

DROP TABLE IF EXISTS owners;

DROP TABLE IF EXISTS properties;

-- ============================================================================
-- PRIMARY TABLE: Properties
-- ============================================================================
CREATE TABLE properties (
    tmk VARCHAR(30) PRIMARY KEY COMMENT 'Tax Map Key - format: I-ZZ-SSS-PPP-CCCC',
    island_code CHAR(1) NOT NULL COMMENT '1=Oahu, 2=Maui, 3=Big Island, 4=Kauai',
    -- Parcel Information (collapsed into properties - 1:1 relationship)
    parcel_number VARCHAR(30),
    location_address VARCHAR(255),
    address_other TEXT COMMENT 'Additional addresses for multi-unit properties',
    project_name VARCHAR(255),
    legal_information TEXT,
    property_class TEXT,
    land_area_sqft BIGINT UNSIGNED COMMENT 'Land area in square feet (whole number)',
    land_area_acres DECIMAL(12, 4) COMMENT 'Land area in acres (up to 99,999,999.9999 acres, 4 decimal precision)',
    neighborhood_code VARCHAR(20) COMMENT 'County-specific neighborhood/district code',
    zoning VARCHAR(50) COMMENT 'Zoning classification',
    parcel_note TEXT COMMENT 'Special notes about the parcel',
    damage VARCHAR(50) COMMENT 'Damage status (Maui)',
    reentry_zone VARCHAR(50) COMMENT 'Reentry zone (Maui)',
    zone_color VARCHAR(50) COMMENT 'Zone color classification (Maui)',
    non_taxable_status VARCHAR(255) COMMENT 'Non-taxable status prose (Kauai only), e.g. "Government owned parcel. ..."',
    living_units SMALLINT UNSIGNED COMMENT 'Number of living units (Kauai only). Max observed 268',
    -- Map and Sketch
    map_url TEXT,
    sketch_url TEXT,
    -- Geographic Information
    zip VARCHAR(10) COMMENT 'ZIP code from address list (never populated)',
    -- Census geography (see qpub crosswalk). Declared here for the same
    -- reason as the parcel-list columns below: the rebuild dumps this table
    -- over the remote one. Values are mirrored from parcel_crosswalk, the
    -- durable side; condo units inherit their parent land parcel's values.
    latitude DECIMAL(10, 8) COMMENT 'Parcel centroid latitude (WGS84, from parcel_crosswalk)',
    longitude DECIMAL(11, 8) COMMENT 'Parcel centroid longitude (WGS84, from parcel_crosswalk)',
    zcta20 CHAR(5) NULL COMMENT '2020 ZIP Code Tabulation Area of the parcel (from parcel_crosswalk)',
    countyfp CHAR(3) NULL COMMENT 'Census county FIPS: 001 Hawaii, 003 Honolulu, 005 Kalawao, 007 Kauai, 009 Maui',
    tractce CHAR(6) NULL COMMENT 'Census tract code within the county',
    tract_geoid CHAR(11) NULL COMMENT 'Full census tract GEOID (state + county + tract)',
    -- State parcel list reconciliation (see qpub parcel-list).
    -- Declared here, not only in the ALTER migration: the rebuild pipeline
    -- dumps this table over the remote one, so a column missing from this
    -- definition is dropped on every sync. Values are mirrored from
    -- scrape_status, which is the durable side.
    in_parcel_list TINYINT(1) NULL DEFAULT NULL COMMENT '1 = present in the state parcel list, 0 = absent, NULL = never checked',
    parcel_list_version VARCHAR(16) NULL COMMENT 'Vintage of the list that set in_parcel_list, e.g. 2026-8',
    parcel_list_checked_at DATETIME NULL COMMENT 'When in_parcel_list was last evaluated',
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_island (island_code),
    INDEX idx_property_class (property_class(100)),
    INDEX idx_location (location_address(100)),
    INDEX idx_zip (zip),
    INDEX idx_zcta20 (zcta20),
    INDEX idx_countyfp (countyfp),
    INDEX idx_tract_geoid (tract_geoid),
    INDEX idx_in_parcel_list (in_parcel_list)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Primary property table - one record per TMK';

-- ============================================================================
-- OWNERSHIP
-- ============================================================================
CREATE TABLE owners (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    owner_name VARCHAR(255) NOT NULL,
    owner_type VARCHAR(50) COMMENT 'Fee Owner, Lessee, etc.',
    owner_address TEXT COMMENT 'Owner mailing address',
    mailing_address TEXT COMMENT 'Structured mailing street address (e.g. county tax-bill extract), independent of owner_address',
    mailing_city VARCHAR(100) COMMENT 'Mailing city',
    mailing_state VARCHAR(50) COMMENT 'Mailing state/province',
    mailing_zip VARCHAR(10) COMMENT 'Mailing ZIP, or ZIP+4 as NNNNN-NNNN when available',
    mailing_country VARCHAR(100) COMMENT 'Mailing country, populated only when outside the US',
    sequence_order INT UNSIGNED COMMENT 'Order in all_owners array',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed),
    INDEX idx_owner_name (owner_name(100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Property owners - multiple owners per property';

-- ============================================================================
-- PARCELS (Annual observations of parcel information)
-- ============================================================================
CREATE TABLE parcels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    parcel_number VARCHAR(30),
    location_address VARCHAR(255),
    address_other TEXT,
    project_name VARCHAR(255),
    legal_information TEXT,
    property_class TEXT,
    land_area_sqft BIGINT UNSIGNED,
    land_area_acres DECIMAL(12, 4),
    neighborhood_code VARCHAR(20),
    zoning VARCHAR(50),
    parcel_note TEXT,
    damage VARCHAR(50),
    reentry_zone VARCHAR(50),
    zone_color VARCHAR(50),
    non_taxable_status VARCHAR(255),
    living_units SMALLINT UNSIGNED COMMENT 'Number of living units (Kauai only). Max observed 268',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_scraped_at (scraped_at),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Annual parcel information observations';

-- ============================================================================
-- ASSESSMENTS (Combined current + historical)
-- ============================================================================
CREATE TABLE assessments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    tax_year SMALLINT UNSIGNED NOT NULL,
    property_class TEXT,
    -- Oahu standard fields (BIGINT for assessed values - range 0 to billions)
    assessed_land_value BIGINT UNSIGNED,
    assessed_building_value BIGINT UNSIGNED,
    dedicated_use_value BIGINT UNSIGNED,
    land_exemption BIGINT,
    -- Can be negative for corrections/adjustments
    building_exemption BIGINT,
    -- Can be negative for corrections/adjustments
    net_taxable_land_value BIGINT,
    -- Can be negative when exemptions exceed assessed value
    net_taxable_building_value BIGINT,
    -- Can be negative when exemptions exceed assessed value
    total_property_assessed_value BIGINT UNSIGNED,
    total_property_exemption BIGINT,
    -- Can be negative for corrections/adjustments
    total_net_taxable_value BIGINT,
    -- Can be negative when exemptions exceed assessed value
    -- County-specific fields (nullable)
    agricultural_land_value BIGINT UNSIGNED COMMENT 'Maui/Big Island',
    market_land_value BIGINT UNSIGNED COMMENT 'Maui/Big Island',
    market_building_value BIGINT UNSIGNED COMMENT 'Big Island',
    total_market_value BIGINT UNSIGNED COMMENT 'Big Island/Kauai',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    UNIQUE KEY unique_assessment (tmk, tax_year),
    INDEX idx_scraped_at (scraped_at),
    INDEX idx_tax_year (tax_year),
    INDEX idx_property_class (property_class(100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Property assessments by year - combines current and historical';

-- ============================================================================
-- LAND CLASSIFICATIONS
-- ============================================================================
CREATE TABLE land_classifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    land_classification VARCHAR(100),
    square_footage BIGINT UNSIGNED COMMENT 'Square feet. Max observed 221,912,866; scraped with thousands separators ("5,000") - commas stripped at load',
    acreage DECIMAL(12, 4) COMMENT 'Acres, 4 decimal precision. Max observed 5,094.4184',
    agricultural_use_indicator VARCHAR(10),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed),
    INDEX idx_classification (land_classification)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Land classification details - multiple per property';

-- ============================================================================
-- RESIDENTIAL IMPROVEMENTS
-- ============================================================================
CREATE TABLE residential_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    -- Fields present on all or most islands
    building_number SMALLINT UNSIGNED,
    year_built SMALLINT UNSIGNED,
    eff_year_built SMALLINT UNSIGNED COMMENT 'Effective year built',
    living_area INT UNSIGNED COMMENT 'Square footage - all islands (Honolulu/Maui/Kauai: "Living Area", Hawaii: "Square Feet")',
    bedrooms SMALLINT UNSIGNED COMMENT 'Honolulu/Hawaii/Kauai (Maui uses combined field)',
    full_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: "Full Bath", Hawaii: "Full Baths" (Maui uses combined field)',
    half_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: "Half Bath", Hawaii: "Half Baths" (Maui uses combined field)',
    -- Island-specific fields
    occupancy VARCHAR(50) COMMENT 'Honolulu only',
    framing VARCHAR(100) COMMENT 'Honolulu/Hawaii: "Framing", Maui: "Construction Type"',
    percent_complete TINYINT UNSIGNED COMMENT 'Whole percent, 0-100 (scraped as "100%")',
    heating_cooling VARCHAR(100) COMMENT 'Maui only',
    exterior_wall VARCHAR(100) COMMENT 'Maui/Hawaii',
    roof_material VARCHAR(100) COMMENT 'Maui/Hawaii',
    fireplace VARCHAR(50) COMMENT 'Maui/Hawaii',
    grade VARCHAR(50) COMMENT 'Maui/Hawaii',
    building_value BIGINT UNSIGNED COMMENT 'Maui only - format: "$50,600"',
    total_room_count TINYINT UNSIGNED COMMENT 'Hawaii only. Max observed 18',
    -- Condo-specific fields (nullable - only for condo units)
    condo_style VARCHAR(50) COMMENT 'Oahu - building form, e.g. "Highrise", "Walk-Up"',
    condo_type VARCHAR(50) COMMENT 'Maui - unit position within the floor, e.g. "Corner". Distinct variable from condo_style',
    condo_view VARCHAR(50),
    floor_level SMALLINT UNSIGNED,
    parking_spaces DECIMAL(5, 2) COMMENT 'Scraped as "001" or fractional "1.75"',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed),
    INDEX idx_year_built (year_built),
    INDEX idx_occupancy (occupancy)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Residential improvements - handles "Residential Improvement Information" (Honolulu/Hawaii) and "Improvement Information" (Maui/Kauai)';

-- ============================================================================
-- RESIDENTIAL ADDITIONS
-- ============================================================================
CREATE TABLE residential_additions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    card SMALLINT UNSIGNED COMMENT 'Max observed 7,361',
    line TINYINT UNSIGNED COMMENT 'Max observed 26',
    lower TEXT,
    first TEXT,
    second TEXT,
    third TEXT,
    area INT UNSIGNED COMMENT 'Square feet',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Residential additions/features';

-- ============================================================================
-- COMMERCIAL IMPROVEMENTS
-- ============================================================================
CREATE TABLE commercial_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    building_number VARCHAR(10),
    building_card SMALLINT UNSIGNED COMMENT 'Max observed 7,035',
    year_built SMALLINT UNSIGNED,
    effective_year_built SMALLINT UNSIGNED,
    improvement_name VARCHAR(255),
    property_class TEXT,
    structure_type VARCHAR(100),
    units SMALLINT UNSIGNED COMMENT 'Max observed 4,444',
    identical_units TINYINT UNSIGNED COMMENT 'Max observed 14',
    gross_building_description TEXT,
    -- County-specific fields (nullable)
    building_square_footage INT UNSIGNED COMMENT 'Maui/Kauai. Max observed 268,707; scraped with thousands separators - commas stripped at load',
    building_type VARCHAR(100) COMMENT 'Maui/Kauai',
    percent_complete TINYINT UNSIGNED COMMENT 'Kauai. Whole percent, 0-100',
    structure VARCHAR(100) COMMENT 'Unused - written by nothing: Kauai''s bare "Structure" header maps to structure_type (same class-code vocabulary as Oahu''s "Structure Type"). Retained pending confirmation nothing external reads it',
    value BIGINT UNSIGNED COMMENT 'Maui - assessed value in whole dollars',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed),
    INDEX idx_year_built (year_built)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Commercial improvement summary';

-- ============================================================================
-- COMMERCIAL IMPROVEMENT DETAILS
-- ============================================================================
CREATE TABLE commercial_improvement_details (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    commercial_improvement_id BIGINT UNSIGNED NOT NULL,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    card SMALLINT UNSIGNED,
    section VARCHAR(50),
    floor VARCHAR(50),
    `usage` VARCHAR(100),
    area INT UNSIGNED COMMENT 'Square feet',
    perimeter SMALLINT UNSIGNED COMMENT 'Max observed 5,636',
    exterior_wall VARCHAR(100),
    wall_height TINYINT UNSIGNED COMMENT 'Max observed 87',
    -- County-specific fields
    -- (occupancy was dropped 2026-08-14: Kauai renders an Occupancy column but
    -- never fills it, and Maui/Hawaii's "Occupancy" header is their label for
    -- the usage column — no county ever supplies a distinct value.)
    construction VARCHAR(100) COMMENT 'Big Island/Kauai: Construction header (STEEL, WOOD FRAME, MASONRY); Maui: Building Class header (e.g. Wood/Steel Framing s1 p8); Oahu publishes none',
    `rank` DECIMAL(4,2) COMMENT 'Maui only - quality/depreciation rank factor, e.g. 0.7, 1.2, 4.5',
    condo_style VARCHAR(50),
    condo_type VARCHAR(50),
    condo_unit VARCHAR(20),
    floor_level VARCHAR(20),
    `view` VARCHAR(50),
    project VARCHAR(100),
    description TEXT,
    FOREIGN KEY (commercial_improvement_id) REFERENCES commercial_improvements(id) ON DELETE CASCADE,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_commercial_improvement (commercial_improvement_id),
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Detailed commercial improvement data (floors, sections, etc.)';

-- ============================================================================
-- ACCESSORY IMPROVEMENTS
-- ============================================================================
CREATE TABLE accessory_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    building_number SMALLINT UNSIGNED COMMENT 'Maui only - residential Accessory Information building number; commercial Other Features "Section" cell',
    description VARCHAR(255),
    dimensions VARCHAR(30) COMMENT 'Maui, from the "Dimensions/Units" cell, e.g. "0x0"',
    quantity DECIMAL(7, 2) COMMENT 'Maui: the "/ N" part of Dimensions/Units. Mostly whole numbers; fractional observed (400.5)',
    year_built SMALLINT UNSIGNED,
    area INT UNSIGNED COMMENT 'Square feet. qPublic emits summary rows (description = "GROSS BUILDING VALUE") with a dollar amount in this cell; the loader repositions those into value (repositionGrossBuildingValue), so area holds only real square footage',
    percent_complete TINYINT UNSIGNED COMMENT 'Maui/Kauai. Whole percent, 0-100',
    value BIGINT UNSIGNED COMMENT 'Assessed value. Hawaii County heads this column "Gross Building Value" (see FIELD_ALIASES), Maui "Value"; Oahu/Kauai publish no per-row value column - their GROSS BUILDING VALUE summary rows land here via the loader transform',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Accessory/yard structures from three page sections: Oahu/Big Island/Kauai "Other Building and Yard Improvements", Maui residential "Accessory Information", and Maui commercial "Commercial Improvement Information > Other Features" (dgOtherFeatures; its Stops column is dropped). qPublic emits summary rows (description = "GROSS BUILDING VALUE") whose Area cell is a dollar amount; the loader repositions those into value on the way in, so area holds only square footage.';

-- ============================================================================
-- PERMITS
-- ============================================================================
CREATE TABLE permits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    permit_date DATE,
    permit_number VARCHAR(50),
    reason VARCHAR(255),
    permit_amount BIGINT UNSIGNED COMMENT 'Permit value in whole dollars',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_permit_date (permit_date),
    INDEX idx_permit_number (permit_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Building permits';

-- ============================================================================
-- SALES INFORMATION
-- ============================================================================
CREATE TABLE sales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    sale_date DATE,
    sale_amount BIGINT UNSIGNED COMMENT 'Sale price in whole dollars',
    instrument VARCHAR(50),
    instrument_type VARCHAR(100),
    instrument_description VARCHAR(255) COMMENT 'Honolulu/Big Island head it "Instrument Description", Maui/Kauai "Document Type" - one column; on Big Island (both headers) the first non-empty cell wins',
    valid_sale VARCHAR(50) COMMENT 'Honolulu: bare flag. Maui: "Valid Sale or Other Reason" - conflates flag and rejection reason. Not published by Big Island/Kauai',
    date_of_recording DATE,
    land_court_document_number VARCHAR(50),
    cert VARCHAR(50),
    book_page VARCHAR(50),
    -- County-specific fields (nullable)
    conveyance_tax DECIMAL(12, 2) COMMENT 'Big Island/Kauai - tax amount with cents',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_sale_date (sale_date),
    INDEX idx_sale_amount (sale_amount)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Sales/conveyance information';

-- ============================================================================
-- CURRENT TAX BILLS
-- ============================================================================
CREATE TABLE current_tax_bills (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    tax_period VARCHAR(20),
    description VARCHAR(255),
    original_due_date DATE,
    taxes_assessment DECIMAL(12, 2),
    tax_credits DECIMAL(12, 2),
    net_tax DECIMAL(12, 2),
    penalty DECIMAL(12, 2),
    interest DECIMAL(12, 2),
    other DECIMAL(12, 2),
    amount_due DECIMAL(12, 2),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed),
    INDEX idx_tax_period (tax_period),
    -- A parcel can carry several concurrent bills for the same period — the
    -- base tax plus special-assessment district fees (e.g. "WAIKIKI SPECIAL
    -- IMPROVEMENT DI") — differing only by description, so that's part of
    -- the key too. Note MySQL allows repeated NULLs in a UNIQUE key, so this
    -- does NOT catch qPublic's blank-period rollup row — realTaxBillRows()
    -- filtering that out on the way in is the real defence, and this key is
    -- what makes the load an upsert rather than an append.
    UNIQUE KEY unique_tax_bill (tmk, tax_period, description)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Current tax bill information';

-- ============================================================================
-- HISTORICAL TAX INFORMATION
-- ============================================================================
-- Main summary table (one row per year per property)
CREATE TABLE historical_tax_summary (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    year SMALLINT UNSIGNED NOT NULL,
    tax DECIMAL(12, 2),
    payments_and_credits DECIMAL(12, 2),
    penalty DECIMAL(12, 2),
    interest DECIMAL(12, 2),
    other DECIMAL(12, 2),
    amount_due DECIMAL(12, 2),
    -- Totals from nested tables (DECIMAL for tax amounts with cents)
    tax_details_total_tax DECIMAL(12, 2) COMMENT 'Sum from tax_details table',
    tax_details_total_payments_credits DECIMAL(12, 2) COMMENT 'Sum from tax_details table',
    tax_details_total_penalty DECIMAL(12, 2) COMMENT 'Sum from tax_details table',
    tax_details_total_interest DECIMAL(12, 2) COMMENT 'Sum from tax_details table',
    tax_details_total_other DECIMAL(12, 2) COMMENT 'Sum from tax_details table',
    tax_payments_total_tax DECIMAL(12, 2) COMMENT 'Sum from tax_payments table',
    tax_payments_total_penalty DECIMAL(12, 2) COMMENT 'Sum from tax_payments table',
    tax_payments_total_interest DECIMAL(12, 2) COMMENT 'Sum from tax_payments table',
    tax_payments_total_other DECIMAL(12, 2) COMMENT 'Sum from tax_payments table',
    tax_credits_total_amount DECIMAL(12, 2) COMMENT 'Sum from tax_credits table',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    UNIQUE KEY unique_year (tmk, year),
    INDEX idx_tmk (tmk),
    INDEX idx_scraped_at (scraped_at),
    INDEX idx_year (year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Historical tax summary by year';

-- Tax details (nested table: YYYY_tax_details)
CREATE TABLE historical_tax_details (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    historical_tax_summary_id BIGINT UNSIGNED NOT NULL,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    tax_period VARCHAR(20),
    description VARCHAR(255),
    tax DECIMAL(12, 2),
    payments_credits DECIMAL(12, 2),
    penalty DECIMAL(12, 2),
    interest DECIMAL(12, 2),
    other DECIMAL(12, 2),
    FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_summary (historical_tax_summary_id),
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Historical tax details breakdown (nested YYYY_tax_details)';

-- Tax payments (nested table: YYYY_tax_payments)
CREATE TABLE historical_tax_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    historical_tax_summary_id BIGINT UNSIGNED NOT NULL,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    payment_sequence INT UNSIGNED COMMENT 'Max observed 14,210,072',
    effective_date DATE,
    tax DECIMAL(12, 2),
    penalty DECIMAL(12, 2),
    interest DECIMAL(12, 2),
    other DECIMAL(12, 2),
    FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_summary (historical_tax_summary_id),
    INDEX idx_tmk (tmk),
    INDEX idx_payment_sequence (payment_sequence)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Historical tax payments (nested YYYY_tax_payments)';

-- Tax credits (nested table: YYYY_tax_credits)
CREATE TABLE historical_tax_credits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    historical_tax_summary_id BIGINT UNSIGNED NOT NULL,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    period VARCHAR(20),
    description VARCHAR(255),
    amount DECIMAL(12, 2),
    FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_summary (historical_tax_summary_id),
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Historical tax credits (nested YYYY_tax_credits)';

-- ============================================================================
-- APPEALS
-- ============================================================================
CREATE TABLE appeals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    year SMALLINT UNSIGNED,
    appeal_type_value VARCHAR(100),
    scheduled_hearing_date_subject_to_change VARCHAR(50),
    status VARCHAR(50),
    -- Maui-specific fields (nullable)
    date_settled DATE,
    final_value BIGINT UNSIGNED COMMENT 'Final assessed value in whole dollars',
    tax_payer_opinion_of_value BIGINT UNSIGNED COMMENT 'Taxpayer opinion value in whole dollars',
    tax_payer_opinion_of_property_class TINYINT UNSIGNED COMMENT 'Maui only, numeric class code 0-12: 0=Time Share, 1=Non-Owner-Occupied, 2=Apartment, 3=Commercial, 4=Industrial, 5=Agricultural, 7=Hotel/Resort, 9=Owner-Occupied, 10=Commercialized Residential, 11=TVR-STRH, 12=Long-Term Rental (6, 8 unobserved)',
    tax_payer_opinion_of_exemptions BIGINT UNSIGNED COMMENT 'Taxpayer exemption amount in whole dollars',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_year (year),
    INDEX idx_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Assessment appeals (Oahu, Maui, Kauai only)';

-- ============================================================================
-- AGRICULTURAL ASSESSMENTS
-- ============================================================================
CREATE TABLE agricultural_assessments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    -- County-specific fields (all nullable)
    acres_in_production DECIMAL(12, 4) COMMENT 'Acreage in the use class. Oahu/Big Island head it "Acres in Production", Maui bare "Acres" (aliased in). Max observed 45,161',
    agricultural_type VARCHAR(100) COMMENT 'Oahu only - dedication/ratio code, e.g. "Z56-1%", "10Y-1%"',
    agricultural_value BIGINT UNSIGNED COMMENT 'Discounted ag-use value in whole dollars. Oahu/Big Island head it "Agricultural Value", Maui "Assessed Value" (aliased in)',
    use_description VARCHAR(255) COMMENT 'Use-class taxonomy. Big Island heads it "Use Description", Maui "Description" (aliased in); Oahu publishes no equivalent',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Agricultural assessment details (sparse - not all counties)';

-- ============================================================================
-- DEDICATIONS
-- ============================================================================
CREATE TABLE dedications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    tax_year SMALLINT UNSIGNED,
    number_of_dedications VARCHAR(100) COMMENT 'e.g., "RESIDENTIAL USE(1)" or "AG DEDI - 10 YEARS(2) · AG DEDI - 5 YEARS(1)"',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_tax_year (tax_year),
    -- One dedication row per parcel per tax year.
    UNIQUE KEY unique_dedication (tmk, tax_year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Dedications (Oahu only)';

-- ============================================================================
-- HOME EXEMPTIONS
-- ============================================================================
CREATE TABLE home_exemptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME,
    claimant_name VARCHAR(255) COMMENT 'Homestead exemption claimant as printed, e.g. "SODEN,TAMMY"',
    tax_year SMALLINT UNSIGNED COMMENT 'Tax year of the claim. Claim years run one year AHEAD of assessment years (2026 claims appear in the 2026-1 scrape)',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_tax_year (tax_year),
    INDEX idx_claimant_name (claimant_name),
    -- One row per claimant per parcel per tax year. Multiple claimants on one
    -- (tmk, tax_year) are co-owners each filing a claim.
    UNIQUE KEY unique_home_exemption (tmk, tax_year, claimant_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Homestead (owner-occupant) exemption claims (Maui only). Source rows are packed "CLAIMANT NAME YYYY" strings from the qPublic "Home Exemption Information" section.';

-- ============================================================================
-- CONDOMINIUM PROJECTS & UNITS
-- ============================================================================
-- Parent condo projects (the master TMK that lists all units)
CREATE TABLE condominium_projects (
    tmk VARCHAR(30) PRIMARY KEY COMMENT 'Parent project TMK',
    project_name VARCHAR(255),
    unit_count INT UNSIGNED COMMENT 'Number of units in project',
    -- DCCA registration data fields
    dcca_link TEXT COMMENT 'DCCA public project link',
    zoning VARCHAR(50) COMMENT 'Zoning classification',
    address TEXT COMMENT 'Full formatted address from DCCA',
    city VARCHAR(100) COMMENT 'City',
    developer VARCHAR(255) COMMENT 'Developer name',
    project_number VARCHAR(50) COMMENT 'DCCA project number',
    commercial INT UNSIGNED COMMENT 'Number of commercial units',
    tool_sheds INT UNSIGNED COMMENT 'Number of tool sheds',
    ohana VARCHAR(10) COMMENT 'Ohana units (Yes/No)',
    residential INT UNSIGNED COMMENT 'Number of residential units',
    parking INT UNSIGNED COMMENT 'Number of parking spaces',
    converted VARCHAR(10) COMMENT 'Converted status (Yes/No)',
    agricultural INT UNSIGNED COMMENT 'Number of agricultural units',
    other INT UNSIGNED COMMENT 'Number of other units',
    buildings INT UNSIGNED COMMENT 'Number of buildings',
    floors INT UNSIGNED COMMENT 'Number of floors',
    land_ownership VARCHAR(10) COMMENT 'Land ownership type (FC, FO, L, PC, etc.)',
    preliminary_date DATE COMMENT 'Preliminary date',
    contingent_final_date DATE COMMENT 'Contingent final date',
    final_date DATE COMMENT 'Final date',
    biennial_registration_date DATE COMMENT 'Biennial registration date',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_project_name (project_name(100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Condominium projects (parent/master records)';

-- Individual condo units
CREATE TABLE condominium_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL COMMENT 'Unit TMK (CPR)',
    parent_tmk VARCHAR(30) NOT NULL COMMENT 'Parent project TMK',
    unit_number VARCHAR(50),
    owner_name VARCHAR(255) COMMENT 'Denormalized for convenience',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    FOREIGN KEY (parent_tmk) REFERENCES condominium_projects(tmk) ON DELETE CASCADE,
    UNIQUE KEY unique_unit (tmk),
    INDEX idx_parent (parent_tmk),
    INDEX idx_unit_number (unit_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Condominium units - links units to parent project';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- Views are in hhdb-views.sql (run manually on remote)