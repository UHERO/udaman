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

DROP TABLE IF EXISTS yard_improvements;

DROP TABLE IF EXISTS commercial_improvement_details;

DROP TABLE IF EXISTS commercial_improvements;

DROP TABLE IF EXISTS residential_additions;

DROP TABLE IF EXISTS residential_improvements;

DROP TABLE IF EXISTS land_classifications;

DROP TABLE IF EXISTS assessments;

DROP TABLE IF EXISTS agricultural_assessments;

DROP TABLE IF EXISTS accessory_structures;

DROP TABLE IF EXISTS appeals;

DROP TABLE IF EXISTS dedications;

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
    property_class VARCHAR(50),
    land_area_sqft BIGINT UNSIGNED COMMENT 'Land area in square feet (whole number)',
    land_area_acres DECIMAL(12, 4) COMMENT 'Land area in acres (up to 99,999,999.9999 acres, 4 decimal precision)',
    neighborhood_code VARCHAR(20) COMMENT 'County-specific neighborhood/district code',
    zoning VARCHAR(50) COMMENT 'Zoning classification',
    parcel_note TEXT COMMENT 'Special notes about the parcel',
    damage VARCHAR(50) COMMENT 'Damage status (Maui)',
    reentry_zone VARCHAR(50) COMMENT 'Reentry zone (Maui)',
    zone_color VARCHAR(50) COMMENT 'Zone color classification (Maui)',
    non_taxable_status VARCHAR(50) COMMENT 'Non-taxable status (Big Island)',
    living_units VARCHAR(20) COMMENT 'Number of living units (Big Island)',
    -- Map and Sketch
    map_url TEXT,
    sketch_url TEXT,
    -- Geographic Information (from state_address_list.csv)
    zip VARCHAR(10) COMMENT 'ZIP code from address list',
    latitude DECIMAL(10, 8) COMMENT 'Geographic latitude coordinate',
    longitude DECIMAL(11, 8) COMMENT 'Geographic longitude coordinate',
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_island (island_code),
    INDEX idx_property_class (property_class),
    INDEX idx_location (location_address(100)),
    INDEX idx_zip (zip)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Primary property table - one record per TMK';

-- ============================================================================
-- OWNERSHIP
-- ============================================================================
CREATE TABLE owners (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_type VARCHAR(50) COMMENT 'Fee Owner, Lessee, etc.',
    owner_address TEXT COMMENT 'Owner mailing address',
    sequence_order INT UNSIGNED COMMENT 'Order in all_owners array',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_owner_name (owner_name(100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Property owners - multiple owners per property';

-- ============================================================================
-- PARCELS (Annual observations of parcel information)
-- ============================================================================
CREATE TABLE parcels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    parcel_number VARCHAR(30),
    location_address VARCHAR(255),
    address_other TEXT,
    project_name VARCHAR(255),
    legal_information TEXT,
    property_class VARCHAR(50),
    land_area_sqft BIGINT UNSIGNED,
    land_area_acres DECIMAL(12, 4),
    neighborhood_code VARCHAR(20),
    zoning VARCHAR(50),
    parcel_note TEXT,
    damage VARCHAR(50),
    reentry_zone VARCHAR(50),
    zone_color VARCHAR(50),
    non_taxable_status VARCHAR(50),
    living_units VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_scraped_at (scraped_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Annual parcel information observations';

-- ============================================================================
-- ASSESSMENTS (Combined current + historical)
-- ============================================================================
CREATE TABLE assessments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    tax_year SMALLINT UNSIGNED NOT NULL,
    property_class VARCHAR(50),
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
    INDEX idx_tax_year (tax_year),
    INDEX idx_property_class (property_class)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Property assessments by year - combines current and historical';

-- ============================================================================
-- LAND CLASSIFICATIONS
-- ============================================================================
CREATE TABLE land_classifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    land_classification VARCHAR(100),
    square_footage VARCHAR(20),
    acreage VARCHAR(20),
    agricultural_use_indicator VARCHAR(10),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_classification (land_classification)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Land classification details - multiple per property';

-- ============================================================================
-- RESIDENTIAL IMPROVEMENTS
-- ============================================================================
CREATE TABLE residential_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    -- Fields present on all or most islands
    building_number VARCHAR(10),
    year_built SMALLINT UNSIGNED,
    eff_year_built SMALLINT UNSIGNED COMMENT 'Effective year built',
    living_area VARCHAR(20) COMMENT 'Square footage - all islands (Honolulu/Maui/Kauai: "Living Area", Hawaii: "Square Feet")',
    bedrooms VARCHAR(10) COMMENT 'Honolulu/Hawaii/Kauai (Maui uses combined field)',
    full_bath VARCHAR(10) COMMENT 'Honolulu/Kauai: "Full Bath", Hawaii: "Full Baths" (Maui uses combined field)',
    half_bath VARCHAR(10) COMMENT 'Honolulu/Kauai: "Half Bath", Hawaii: "Half Baths" (Maui uses combined field)',
    -- Island-specific fields
    occupancy VARCHAR(50) COMMENT 'Honolulu only',
    framing VARCHAR(100) COMMENT 'Honolulu/Hawaii: "Framing", Maui: "Construction Type"',
    percent_complete VARCHAR(10) COMMENT 'Maui/Kauai - format: "100%"',
    heating_cooling VARCHAR(100) COMMENT 'Maui only',
    exterior_wall VARCHAR(100) COMMENT 'Maui/Hawaii',
    roof_material VARCHAR(100) COMMENT 'Maui/Hawaii',
    fireplace VARCHAR(50) COMMENT 'Maui/Hawaii',
    grade VARCHAR(50) COMMENT 'Maui/Hawaii',
    building_value BIGINT UNSIGNED COMMENT 'Maui only - format: "$50,600"',
    total_room_count VARCHAR(10) COMMENT 'Hawaii only',
    -- Condo-specific fields (nullable - only for condo units)
    condo_style VARCHAR(50),
    condo_view VARCHAR(50),
    floor_level VARCHAR(20),
    parking_spaces VARCHAR(10),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
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
    card VARCHAR(10),
    line VARCHAR(10),
    lower TEXT,
    first TEXT,
    second TEXT,
    third TEXT,
    area VARCHAR(20),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Residential additions/features';

-- ============================================================================
-- COMMERCIAL IMPROVEMENTS
-- ============================================================================
CREATE TABLE commercial_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    building_number VARCHAR(10),
    building_card VARCHAR(10),
    year_built SMALLINT UNSIGNED,
    effective_year_built SMALLINT UNSIGNED,
    improvement_name VARCHAR(255),
    property_class VARCHAR(50),
    structure_type VARCHAR(100),
    units VARCHAR(20),
    identical_units VARCHAR(20),
    gross_building_description TEXT,
    -- County-specific fields (nullable)
    building_square_footage VARCHAR(20) COMMENT 'Maui/Kauai',
    building_type VARCHAR(100) COMMENT 'Maui/Kauai',
    percent_complete VARCHAR(10) COMMENT 'Kauai',
    structure VARCHAR(100) COMMENT 'Kauai',
    value BIGINT UNSIGNED COMMENT 'Maui - assessed value in whole dollars',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
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
    card VARCHAR(10),
    section VARCHAR(50),
    floor VARCHAR(50),
    `usage` VARCHAR(100),
    area VARCHAR(20),
    perimeter VARCHAR(20),
    exterior_wall VARCHAR(100),
    wall_height VARCHAR(20),
    -- County-specific fields
    occupancy VARCHAR(50),
    construction VARCHAR(100),
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
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Detailed commercial improvement data (floors, sections, etc.)';

-- ============================================================================
-- YARD IMPROVEMENTS
-- ============================================================================
CREATE TABLE yard_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    description VARCHAR(255),
    quantity VARCHAR(20),
    year_built SMALLINT UNSIGNED,
    area VARCHAR(20),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Other building and yard improvements (pools, etc.)';

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
    instrument_description VARCHAR(255),
    valid_sale VARCHAR(50),
    date_of_recording DATE,
    land_court_document_number VARCHAR(50),
    cert VARCHAR(50),
    book_page VARCHAR(50),
    -- County-specific fields (nullable)
    conveyance_tax DECIMAL(12, 2) COMMENT 'Kauai - tax amount with cents',
    document_type VARCHAR(100) COMMENT 'Kauai',
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
    INDEX idx_tax_period (tax_period)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Current tax bill information';

-- ============================================================================
-- HISTORICAL TAX INFORMATION
-- ============================================================================
-- Main summary table (one row per year per property)
CREATE TABLE historical_tax_summary (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
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
    INDEX idx_year (year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Historical tax summary by year';

-- Tax details (nested table: YYYY_tax_details)
CREATE TABLE historical_tax_details (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    historical_tax_summary_id BIGINT UNSIGNED NOT NULL,
    tmk VARCHAR(30) NOT NULL,
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
    payment_sequence VARCHAR(50),
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
    year SMALLINT UNSIGNED,
    appeal_type_value VARCHAR(100),
    scheduled_hearing_date_subject_to_change VARCHAR(50),
    status VARCHAR(50),
    -- Maui-specific fields (nullable)
    date_settled DATE,
    final_value BIGINT UNSIGNED COMMENT 'Final assessed value in whole dollars',
    tax_payer_opinion_of_value BIGINT UNSIGNED COMMENT 'Taxpayer opinion value in whole dollars',
    tax_payer_opinion_of_property_class VARCHAR(50),
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
    -- County-specific fields (all nullable)
    acres VARCHAR(20) COMMENT 'Maui',
    acres_in_production VARCHAR(20) COMMENT 'Oahu/Big Island',
    agricultural_type VARCHAR(100) COMMENT 'Oahu',
    agricultural_value BIGINT UNSIGNED COMMENT 'Oahu/Big Island - value in whole dollars',
    assessed_value BIGINT UNSIGNED COMMENT 'Maui - value in whole dollars',
    description TEXT COMMENT 'Maui',
    use_description VARCHAR(255) COMMENT 'Big Island',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Agricultural assessment details (sparse - not all counties)';

-- ============================================================================
-- ACCESSORY STRUCTURES
-- ============================================================================
CREATE TABLE accessory_structures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    building_number VARCHAR(10),
    description VARCHAR(255),
    dimensions_units VARCHAR(50),
    percent_complete VARCHAR(10),
    value BIGINT UNSIGNED COMMENT 'Structure value in whole dollars',
    year_built SMALLINT UNSIGNED,
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Accessory structures (Maui only)';

-- ============================================================================
-- DEDICATIONS
-- ============================================================================
CREATE TABLE dedications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    tax_year SMALLINT UNSIGNED,
    number_of_dedications VARCHAR(100) COMMENT 'e.g., "RESIDENTIAL USE(1)" or "AG DEDI - 10 YEARS(2) · AG DEDI - 5 YEARS(1)"',
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_tax_year (tax_year)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Dedications (Oahu only)';

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
-- VIEWS FOR CONVENIENCE
-- ============================================================================
-- View: Properties with current assessment
CREATE
OR REPLACE VIEW v_properties_current AS
SELECT
    p.*,
    a.tax_year,
    a.property_class AS current_property_class,
    a.total_net_taxable_value,
    a.total_property_assessed_value,
    a.assessed_land_value,
    a.assessed_building_value
FROM
    properties p
    LEFT JOIN assessments a ON p.tmk = a.tmk
WHERE
    a.tax_year = (
        SELECT
            MAX(tax_year)
        FROM
            assessments
        WHERE
            tmk = p.tmk
    );

-- View: Condo projects with unit counts
CREATE
OR REPLACE VIEW v_condo_projects AS
SELECT
    cp.tmk,
    cp.project_name,
    cp.unit_count,
    p.location_address,
    p.island_code,
    COUNT(cu.id) AS actual_unit_count
FROM
    condominium_projects cp
    JOIN properties p ON cp.tmk = p.tmk
    LEFT JOIN condominium_units cu ON cp.tmk = cu.parent_tmk
GROUP BY
    cp.tmk,
    cp.project_name,
    cp.unit_count,
    p.location_address,
    p.island_code;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================