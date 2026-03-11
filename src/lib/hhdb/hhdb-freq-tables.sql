-- ============================================================================
-- HHDB Frequency Tables
-- Pre-computed frequency counts of column values by county
-- Regenerated weekly via MariaDB scheduled EVENT
-- ============================================================================

-- Drop freq tables if they exist
DROP TABLE IF EXISTS freq_properties;
DROP TABLE IF EXISTS freq_owners;
DROP TABLE IF EXISTS freq_parcels;
DROP TABLE IF EXISTS freq_assessments;
DROP TABLE IF EXISTS freq_land_classifications;
DROP TABLE IF EXISTS freq_residential_improvements;
DROP TABLE IF EXISTS freq_residential_additions;
DROP TABLE IF EXISTS freq_commercial_improvements;
DROP TABLE IF EXISTS freq_commercial_improvement_details;
DROP TABLE IF EXISTS freq_yard_improvements;
DROP TABLE IF EXISTS freq_permits;
DROP TABLE IF EXISTS freq_sales;
DROP TABLE IF EXISTS freq_current_tax_bills;
DROP TABLE IF EXISTS freq_historical_tax_summary;
DROP TABLE IF EXISTS freq_historical_tax_details;
DROP TABLE IF EXISTS freq_historical_tax_payments;
DROP TABLE IF EXISTS freq_historical_tax_credits;
DROP TABLE IF EXISTS freq_appeals;
DROP TABLE IF EXISTS freq_agricultural_assessments;
DROP TABLE IF EXISTS freq_accessory_structures;
DROP TABLE IF EXISTS freq_dedications;
DROP TABLE IF EXISTS freq_condominium_projects;
DROP TABLE IF EXISTS freq_condominium_units;

-- ============================================================================
-- CREATE FREQ TABLES (uniform EAV structure)
-- ============================================================================

CREATE TABLE freq_properties (
  county_code CHAR(1) NOT NULL COMMENT '0=Statewide, 1=Honolulu, 2=Maui, 3=Hawaii, 4=Kauai',
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_owners (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_parcels (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_assessments (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_land_classifications (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_residential_improvements (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_residential_additions (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_commercial_improvements (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_commercial_improvement_details (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_yard_improvements (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_permits (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_sales (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_current_tax_bills (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_historical_tax_summary (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_historical_tax_details (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_historical_tax_payments (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_historical_tax_credits (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_appeals (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_agricultural_assessments (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_accessory_structures (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_dedications (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_condominium_projects (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_condominium_units (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

-- ============================================================================
-- STORED PROCEDURE: sp_regenerate_freq_tables
-- Truncates and repopulates all freq_ tables
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables;

DELIMITER //

CREATE PROCEDURE sp_regenerate_freq_tables()
BEGIN

  -- ========================================================================
  -- freq_properties
  -- Categorical: island_code, property_class, neighborhood_code, zoning,
  --   damage, reentry_zone, zone_color, non_taxable_status, living_units, zip
  -- Numeric: land_area_sqft
  -- ========================================================================
  TRUNCATE TABLE freq_properties;

  -- island_code (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'island_code', COALESCE(island_code, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), island_code;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'island_code', COALESCE(island_code, '[NULL]'), COUNT(*)
  FROM properties GROUP BY island_code;

  -- property_class (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM properties GROUP BY property_class;

  -- neighborhood_code (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', COALESCE(neighborhood_code, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), neighborhood_code;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', COALESCE(neighborhood_code, '[NULL]'), COUNT(*)
  FROM properties GROUP BY neighborhood_code;

  -- zoning (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM properties GROUP BY zoning;

  -- damage (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', COALESCE(damage, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), damage;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', COALESCE(damage, '[NULL]'), COUNT(*)
  FROM properties GROUP BY damage;

  -- reentry_zone (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', COALESCE(reentry_zone, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), reentry_zone;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', COALESCE(reentry_zone, '[NULL]'), COUNT(*)
  FROM properties GROUP BY reentry_zone;

  -- zone_color (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', COALESCE(zone_color, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zone_color;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', COALESCE(zone_color, '[NULL]'), COUNT(*)
  FROM properties GROUP BY zone_color;

  -- non_taxable_status (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', COALESCE(non_taxable_status, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), non_taxable_status;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', COALESCE(non_taxable_status, '[NULL]'), COUNT(*)
  FROM properties GROUP BY non_taxable_status;

  -- living_units (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', COALESCE(living_units, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), living_units;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', COALESCE(living_units, '[NULL]'), COUNT(*)
  FROM properties GROUP BY living_units;

  -- zip (categorical)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zip', COALESCE(zip, '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zip;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zip', COALESCE(zip, '[NULL]'), COUNT(*)
  FROM properties GROUP BY zip;

  -- land_area_sqft (as-is)
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft',
    COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'),
    COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), land_area_sqft;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft',
    COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'),
    COUNT(*)
  FROM properties GROUP BY land_area_sqft;

  -- ========================================================================
  -- freq_owners
  -- Categorical: owner_type
  -- ========================================================================
  TRUNCATE TABLE freq_owners;

  -- tmk
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM owners GROUP BY tmk;

  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_type', COALESCE(owner_type, '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), owner_type;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_type', COALESCE(owner_type, '[NULL]'), COUNT(*)
  FROM owners GROUP BY owner_type;

  -- ========================================================================
  -- freq_parcels
  -- Categorical: property_class, neighborhood_code, zoning, damage,
  --   reentry_zone, zone_color, non_taxable_status, living_units
  -- Numeric: land_area_sqft
  -- ========================================================================
  TRUNCATE TABLE freq_parcels;

  -- property_class
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY property_class;

  -- neighborhood_code
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', COALESCE(neighborhood_code, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), neighborhood_code;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', COALESCE(neighborhood_code, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY neighborhood_code;

  -- zoning
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY zoning;

  -- damage
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', COALESCE(damage, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), damage;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', COALESCE(damage, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY damage;

  -- reentry_zone
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', COALESCE(reentry_zone, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), reentry_zone;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', COALESCE(reentry_zone, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY reentry_zone;

  -- zone_color
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', COALESCE(zone_color, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), zone_color;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', COALESCE(zone_color, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY zone_color;

  -- non_taxable_status
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', COALESCE(non_taxable_status, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), non_taxable_status;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', COALESCE(non_taxable_status, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY non_taxable_status;

  -- living_units
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', COALESCE(living_units, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), living_units;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', COALESCE(living_units, '[NULL]'), COUNT(*)
  FROM parcels GROUP BY living_units;

  -- land_area_sqft (as-is)
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft',
    COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'),
    COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), land_area_sqft;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft',
    COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'),
    COUNT(*)
  FROM parcels GROUP BY land_area_sqft;

  -- ========================================================================
  -- freq_assessments
  -- Categorical: property_class
  -- Year: tax_year
  -- Log-scale (signed): assessed_land_value, assessed_building_value,
  --   dedicated_use_value, land_exemption, building_exemption,
  --   net_taxable_land_value, net_taxable_building_value,
  --   total_property_assessed_value, total_property_exemption,
  --   total_net_taxable_value, agricultural_land_value, market_land_value,
  --   market_building_value, total_market_value
  -- ========================================================================
  TRUNCATE TABLE freq_assessments;

  -- tmk
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM assessments GROUP BY tmk;

  -- property_class
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM assessments GROUP BY property_class;

  -- tax_year (year column, store as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), tax_year;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY tax_year;

  -- assessed_land_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_land_value',
    COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), assessed_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_land_value',
    COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY assessed_land_value;

  -- assessed_building_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_building_value',
    COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), assessed_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_building_value',
    COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY assessed_building_value;

  -- dedicated_use_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dedicated_use_value',
    COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), dedicated_use_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'dedicated_use_value',
    COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY dedicated_use_value;

  -- land_exemption (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_exemption',
    COALESCE(CAST(land_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), land_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_exemption',
    COALESCE(CAST(land_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY land_exemption;

  -- building_exemption (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_exemption',
    COALESCE(CAST(building_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), building_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_exemption',
    COALESCE(CAST(building_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY building_exemption;

  -- net_taxable_land_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_land_value',
    COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), net_taxable_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_land_value',
    COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY net_taxable_land_value;

  -- net_taxable_building_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_building_value',
    COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), net_taxable_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_building_value',
    COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY net_taxable_building_value;

  -- total_property_assessed_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_assessed_value',
    COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_property_assessed_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_assessed_value',
    COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY total_property_assessed_value;

  -- total_property_exemption (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_exemption',
    COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_property_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_exemption',
    COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY total_property_exemption;

  -- total_net_taxable_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_net_taxable_value',
    COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_net_taxable_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_net_taxable_value',
    COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY total_net_taxable_value;

  -- agricultural_land_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_land_value',
    COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), agricultural_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_land_value',
    COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY agricultural_land_value;

  -- market_land_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_land_value',
    COALESCE(CAST(market_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), market_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_land_value',
    COALESCE(CAST(market_land_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY market_land_value;

  -- market_building_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_building_value',
    COALESCE(CAST(market_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), market_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_building_value',
    COALESCE(CAST(market_building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY market_building_value;

  -- total_market_value (as-is)
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_market_value',
    COALESCE(CAST(total_market_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_market_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_market_value',
    COALESCE(CAST(total_market_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM assessments GROUP BY total_market_value;

  -- ========================================================================
  -- freq_land_classifications
  -- Categorical: land_classification, agricultural_use_indicator
  -- ========================================================================
  TRUNCATE TABLE freq_land_classifications;

  -- tmk
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM land_classifications GROUP BY tmk;

  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_classification', COALESCE(land_classification, '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), land_classification;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_classification', COALESCE(land_classification, '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY land_classification;

  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_use_indicator', COALESCE(agricultural_use_indicator, '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), agricultural_use_indicator;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_use_indicator', COALESCE(agricultural_use_indicator, '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY agricultural_use_indicator;

  -- ========================================================================
  -- freq_residential_improvements
  -- Categorical: building_number, occupancy, framing, percent_complete,
  --   heating_cooling, exterior_wall, roof_material, fireplace, grade,
  --   bedrooms, full_bath, half_bath, living_area, total_room_count,
  --   condo_style, condo_view, floor_level, parking_spaces
  -- Year: year_built, eff_year_built
  -- Numeric: building_value
  -- ========================================================================
  TRUNCATE TABLE freq_residential_improvements;

  -- tmk
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM residential_improvements GROUP BY tmk;

  -- building_number
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY building_number;

  -- occupancy
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'occupancy', COALESCE(occupancy, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), occupancy;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'occupancy', COALESCE(occupancy, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY occupancy;

  -- framing
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'framing', COALESCE(framing, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), framing;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'framing', COALESCE(framing, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY framing;

  -- percent_complete
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY percent_complete;

  -- heating_cooling
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'heating_cooling', COALESCE(heating_cooling, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), heating_cooling;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'heating_cooling', COALESCE(heating_cooling, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY heating_cooling;

  -- exterior_wall
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', COALESCE(exterior_wall, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), exterior_wall;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', COALESCE(exterior_wall, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY exterior_wall;

  -- roof_material
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'roof_material', COALESCE(roof_material, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), roof_material;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'roof_material', COALESCE(roof_material, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY roof_material;

  -- fireplace
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'fireplace', COALESCE(fireplace, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), fireplace;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'fireplace', COALESCE(fireplace, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY fireplace;

  -- grade
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'grade', COALESCE(grade, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), grade;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'grade', COALESCE(grade, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY grade;

  -- bedrooms
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'bedrooms', COALESCE(bedrooms, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), bedrooms;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'bedrooms', COALESCE(bedrooms, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY bedrooms;

  -- full_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'full_bath', COALESCE(full_bath, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), full_bath;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'full_bath', COALESCE(full_bath, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY full_bath;

  -- half_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'half_bath', COALESCE(half_bath, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), half_bath;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'half_bath', COALESCE(half_bath, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY half_bath;

  -- living_area
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_area', COALESCE(living_area, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), living_area;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_area', COALESCE(living_area, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY living_area;

  -- total_room_count
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_room_count', COALESCE(total_room_count, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), total_room_count;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_room_count', COALESCE(total_room_count, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY total_room_count;

  -- condo_style
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', COALESCE(condo_style, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), condo_style;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', COALESCE(condo_style, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY condo_style;

  -- condo_view
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_view', COALESCE(condo_view, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), condo_view;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_view', COALESCE(condo_view, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY condo_view;

  -- floor_level
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', COALESCE(floor_level, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), floor_level;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', COALESCE(floor_level, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY floor_level;

  -- parking_spaces
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking_spaces', COALESCE(parking_spaces, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), parking_spaces;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking_spaces', COALESCE(parking_spaces, '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY parking_spaces;

  -- year_built (year)
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY year_built;

  -- eff_year_built (year)
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'eff_year_built', COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), eff_year_built;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'eff_year_built', COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY eff_year_built;

  -- building_value (as-is)
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_value',
    COALESCE(CAST(building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), building_value;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_value',
    COALESCE(CAST(building_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM residential_improvements GROUP BY building_value;

  -- ========================================================================
  -- freq_residential_additions
  -- Categorical: card, line, area
  -- ========================================================================
  TRUNCATE TABLE freq_residential_additions;

  -- tmk
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM residential_additions GROUP BY tmk;

  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', COALESCE(card, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), card;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', COALESCE(card, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY card;

  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'line', COALESCE(`line`, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), `line`;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'line', COALESCE(`line`, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY `line`;

  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY area;

  -- ========================================================================
  -- freq_commercial_improvements
  -- Categorical: building_number, building_card, property_class,
  --   structure_type, units, identical_units, building_square_footage,
  --   building_type, percent_complete, structure
  -- Year: year_built, effective_year_built
  -- Numeric: value
  -- ========================================================================
  TRUNCATE TABLE freq_commercial_improvements;

  -- tmk
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM commercial_improvements GROUP BY tmk;

  -- building_number
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_number;

  -- building_card
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_card', COALESCE(building_card, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_card;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_card', COALESCE(building_card, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_card;

  -- property_class
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(property_class, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY property_class;

  -- structure_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure_type', COALESCE(structure_type, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), structure_type;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure_type', COALESCE(structure_type, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY structure_type;

  -- units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'units', COALESCE(units, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), units;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'units', COALESCE(units, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY units;

  -- identical_units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'identical_units', COALESCE(identical_units, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), identical_units;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'identical_units', COALESCE(identical_units, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY identical_units;

  -- building_square_footage
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_square_footage', COALESCE(building_square_footage, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_square_footage;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_square_footage', COALESCE(building_square_footage, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_square_footage;

  -- building_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_type', COALESCE(building_type, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_type;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_type', COALESCE(building_type, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_type;

  -- percent_complete
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY percent_complete;

  -- structure
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure', COALESCE(structure, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), structure;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure', COALESCE(structure, '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY structure;

  -- year_built (year)
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY year_built;

  -- effective_year_built (year)
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_year_built', COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), effective_year_built;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_year_built', COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY effective_year_built;

  -- value (as-is)
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value',
    COALESCE(CAST(value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), value;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'value',
    COALESCE(CAST(value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM commercial_improvements GROUP BY value;

  -- ========================================================================
  -- freq_commercial_improvement_details
  -- Categorical: card, section, floor, usage, area, perimeter,
  --   exterior_wall, wall_height, occupancy, construction, condo_style,
  --   condo_type, condo_unit, floor_level, view, project
  -- ========================================================================
  TRUNCATE TABLE freq_commercial_improvement_details;

  -- tmk
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM commercial_improvement_details GROUP BY tmk;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', COALESCE(card, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), card;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', COALESCE(card, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY card;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'section', COALESCE(section, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), section;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'section', COALESCE(section, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY section;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor', COALESCE(floor, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), floor;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor', COALESCE(floor, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY floor;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'usage', COALESCE(`usage`, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), `usage`;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'usage', COALESCE(`usage`, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY `usage`;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY area;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'perimeter', COALESCE(perimeter, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), perimeter;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'perimeter', COALESCE(perimeter, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY perimeter;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', COALESCE(exterior_wall, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), exterior_wall;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', COALESCE(exterior_wall, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY exterior_wall;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'wall_height', COALESCE(wall_height, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), wall_height;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'wall_height', COALESCE(wall_height, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY wall_height;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'occupancy', COALESCE(occupancy, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), occupancy;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'occupancy', COALESCE(occupancy, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY occupancy;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'construction', COALESCE(construction, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), construction;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'construction', COALESCE(construction, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY construction;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', COALESCE(condo_style, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_style;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', COALESCE(condo_style, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_style;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_type', COALESCE(condo_type, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_type;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_type', COALESCE(condo_type, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_type;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_unit', COALESCE(condo_unit, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_unit;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_unit', COALESCE(condo_unit, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_unit;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', COALESCE(floor_level, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), floor_level;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', COALESCE(floor_level, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY floor_level;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'view', COALESCE(`view`, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), `view`;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'view', COALESCE(`view`, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY `view`;

  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project', COALESCE(project, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), project;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'project', COALESCE(project, '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY project;

  -- ========================================================================
  -- freq_yard_improvements
  -- Categorical: description, quantity, area
  -- Year: year_built
  -- ========================================================================
  TRUNCATE TABLE freq_yard_improvements;

  -- tmk
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM yard_improvements GROUP BY tmk;

  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), description;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY description;

  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'quantity', COALESCE(quantity, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), quantity;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'quantity', COALESCE(quantity, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY quantity;

  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(area, '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY area;

  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY year_built;

  -- ========================================================================
  -- freq_permits
  -- Categorical: reason
  -- Date→year: permit_date
  -- Numeric: permit_amount
  -- ========================================================================
  TRUNCATE TABLE freq_permits;

  -- tmk
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM permits GROUP BY tmk;

  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reason', COALESCE(reason, '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), reason;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'reason', COALESCE(reason, '[NULL]'), COUNT(*)
  FROM permits GROUP BY reason;

  -- permit_date (date → year)
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_date', COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), YEAR(permit_date);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_date', COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY YEAR(permit_date);

  -- permit_amount (as-is)
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_amount',
    COALESCE(CAST(permit_amount AS CHAR), '[NULL]'),
    COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), permit_amount;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_amount',
    COALESCE(CAST(permit_amount AS CHAR), '[NULL]'),
    COUNT(*)
  FROM permits GROUP BY permit_amount;

  -- ========================================================================
  -- freq_sales
  -- Categorical: instrument, instrument_type, instrument_description,
  --   valid_sale, document_type
  -- Date→year: sale_date, date_of_recording
  -- Numeric: sale_amount, conveyance_tax
  -- ========================================================================
  TRUNCATE TABLE freq_sales;

  -- tmk
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM sales GROUP BY tmk;

  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument', COALESCE(instrument, '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument', COALESCE(instrument, '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument;

  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_type', COALESCE(instrument_type, '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument_type;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_type', COALESCE(instrument_type, '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument_type;

  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_description', COALESCE(instrument_description, '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument_description;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_description', COALESCE(instrument_description, '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument_description;

  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'valid_sale', COALESCE(valid_sale, '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), valid_sale;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'valid_sale', COALESCE(valid_sale, '[NULL]'), COUNT(*)
  FROM sales GROUP BY valid_sale;

  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'document_type', COALESCE(document_type, '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), document_type;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'document_type', COALESCE(document_type, '[NULL]'), COUNT(*)
  FROM sales GROUP BY document_type;

  -- sale_date (date → year)
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_date', COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), YEAR(sale_date);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_date', COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY YEAR(sale_date);

  -- date_of_recording (date → year)
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_of_recording', COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), YEAR(date_of_recording);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_of_recording', COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY YEAR(date_of_recording);

  -- sale_amount (as-is)
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_amount',
    COALESCE(CAST(sale_amount AS CHAR), '[NULL]'),
    COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), sale_amount;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_amount',
    COALESCE(CAST(sale_amount AS CHAR), '[NULL]'),
    COUNT(*)
  FROM sales GROUP BY sale_amount;

  -- conveyance_tax (as-is)
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'conveyance_tax',
    COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'),
    COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), conveyance_tax;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'conveyance_tax',
    COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'),
    COUNT(*)
  FROM sales GROUP BY conveyance_tax;

  -- ========================================================================
  -- freq_current_tax_bills
  -- Categorical: tax_period, description
  -- Date→year: original_due_date
  -- Log-scale (DECIMAL, signed): taxes_assessment, tax_credits, net_tax,
  --   penalty, interest, other, amount_due
  -- ========================================================================
  TRUNCATE TABLE freq_current_tax_bills;

  -- tmk
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM current_tax_bills GROUP BY tmk;

  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', COALESCE(tax_period, '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tax_period;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', COALESCE(tax_period, '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY tax_period;

  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), description;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY description;

  -- original_due_date (date → year)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'original_due_date', COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), YEAR(original_due_date);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'original_due_date', COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY YEAR(original_due_date);

  -- taxes_assessment (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'taxes_assessment',
    COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), taxes_assessment;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'taxes_assessment',
    COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY taxes_assessment;

  -- tax_credits (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_credits',
    COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tax_credits;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_credits',
    COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY tax_credits;

  -- net_tax (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_tax',
    COALESCE(CAST(net_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), net_tax;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_tax',
    COALESCE(CAST(net_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY net_tax;

  -- penalty (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY penalty;

  -- interest (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY interest;

  -- other (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), other;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY other;

  -- amount_due (as-is)
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due',
    COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), amount_due;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due',
    COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY amount_due;

  -- ========================================================================
  -- freq_historical_tax_summary
  -- Year: year
  -- Log-scale (DECIMAL signed): tax, payments_and_credits, penalty,
  --   interest, other, amount_due
  -- ========================================================================
  TRUNCATE TABLE freq_historical_tax_summary;

  -- tmk
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM historical_tax_summary GROUP BY tmk;

  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', COALESCE(CAST(year AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), year;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', COALESCE(CAST(year AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY year;

  -- tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax;

  -- payments_and_credits
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_and_credits',
    COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), payments_and_credits;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_and_credits',
    COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY payments_and_credits;

  -- penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), other;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY other;

  -- amount_due
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due',
    COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), amount_due;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due',
    COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY amount_due;

  -- ========================================================================
  -- freq_historical_tax_details
  -- Categorical: tax_period
  -- Log-scale (DECIMAL signed): tax, payments_credits, penalty, interest, other
  -- ========================================================================
  TRUNCATE TABLE freq_historical_tax_details;

  -- tmk
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM historical_tax_details GROUP BY tmk;

  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', COALESCE(tax_period, '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tax_period;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', COALESCE(tax_period, '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY tax_period;

  -- tax
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY tax;

  -- payments_credits
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_credits',
    COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), payments_credits;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_credits',
    COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY payments_credits;

  -- penalty
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), other;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY other;

  -- ========================================================================
  -- freq_historical_tax_payments
  -- Categorical: payment_sequence
  -- Date→year: effective_date
  -- Log-scale (DECIMAL signed): tax, penalty, interest, other
  -- ========================================================================
  TRUNCATE TABLE freq_historical_tax_payments;

  -- tmk
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM historical_tax_payments GROUP BY tmk;

  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payment_sequence', COALESCE(payment_sequence, '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), payment_sequence;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'payment_sequence', COALESCE(payment_sequence, '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY payment_sequence;

  -- effective_date (date → year)
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_date', COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), YEAR(effective_date);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_date', COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY YEAR(effective_date);

  -- tax
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax',
    COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY tax;

  -- penalty
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty',
    COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest',
    COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), other;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY other;

  -- ========================================================================
  -- freq_historical_tax_credits
  -- Categorical: period
  -- Log-scale (DECIMAL signed): amount
  -- ========================================================================
  TRUNCATE TABLE freq_historical_tax_credits;

  -- tmk
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM historical_tax_credits GROUP BY tmk;

  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'period', COALESCE(period, '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), period;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'period', COALESCE(period, '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY period;

  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount',
    COALESCE(CAST(amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), amount;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount',
    COALESCE(CAST(amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY amount;

  -- ========================================================================
  -- freq_appeals
  -- Categorical: appeal_type_value, status, tax_payer_opinion_of_property_class
  -- Year: year
  -- Date→year: date_settled
  -- Log-scale (BIGINT UNSIGNED): final_value, tax_payer_opinion_of_value,
  --   tax_payer_opinion_of_exemptions
  -- ========================================================================
  TRUNCATE TABLE freq_appeals;

  -- tmk
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM appeals GROUP BY tmk;

  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'appeal_type_value', COALESCE(appeal_type_value, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), appeal_type_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'appeal_type_value', COALESCE(appeal_type_value, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY appeal_type_value;

  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'status', COALESCE(status, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), status;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'status', COALESCE(status, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY status;

  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_property_class', COALESCE(tax_payer_opinion_of_property_class, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_property_class;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_property_class', COALESCE(tax_payer_opinion_of_property_class, '[NULL]'), COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_property_class;

  -- year
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', COALESCE(CAST(year AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), year;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', COALESCE(CAST(year AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY year;

  -- date_settled (date → year)
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_settled', COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), YEAR(date_settled);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_settled', COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY YEAR(date_settled);

  -- final_value (as-is)
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_value',
    COALESCE(CAST(final_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), final_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_value',
    COALESCE(CAST(final_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY final_value;

  -- tax_payer_opinion_of_value (as-is)
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_value',
    COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_value',
    COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_value;

  -- tax_payer_opinion_of_exemptions (as-is)
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_exemptions',
    COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_exemptions;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_exemptions',
    COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'),
    COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_exemptions;

  -- ========================================================================
  -- freq_agricultural_assessments
  -- Categorical: acres, acres_in_production, agricultural_type, use_description
  -- Log-scale (BIGINT UNSIGNED): agricultural_value, assessed_value
  -- ========================================================================
  TRUNCATE TABLE freq_agricultural_assessments;

  -- tmk
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM agricultural_assessments GROUP BY tmk;

  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acres', COALESCE(acres, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), acres;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'acres', COALESCE(acres, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY acres;

  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acres_in_production', COALESCE(acres_in_production, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), acres_in_production;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'acres_in_production', COALESCE(acres_in_production, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY acres_in_production;

  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_type', COALESCE(agricultural_type, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), agricultural_type;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_type', COALESCE(agricultural_type, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY agricultural_type;

  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'use_description', COALESCE(use_description, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), use_description;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'use_description', COALESCE(use_description, '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY use_description;

  -- agricultural_value (as-is)
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_value',
    COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), agricultural_value;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_value',
    COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM agricultural_assessments GROUP BY agricultural_value;

  -- assessed_value (as-is)
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_value',
    COALESCE(CAST(assessed_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), assessed_value;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_value',
    COALESCE(CAST(assessed_value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM agricultural_assessments GROUP BY assessed_value;

  -- ========================================================================
  -- freq_accessory_structures
  -- Categorical: building_number, description, dimensions_units, percent_complete
  -- Year: year_built
  -- Log-scale (BIGINT UNSIGNED): value
  -- ========================================================================
  TRUNCATE TABLE freq_accessory_structures;

  -- tmk
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM accessory_structures GROUP BY tmk;

  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(building_number, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY building_number;

  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), description;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(description, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY description;

  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dimensions_units', COALESCE(dimensions_units, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), dimensions_units;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'dimensions_units', COALESCE(dimensions_units, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY dimensions_units;

  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(percent_complete, '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY percent_complete;

  -- year_built
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY year_built;

  -- value (as-is)
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value',
    COALESCE(CAST(value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), value;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'value',
    COALESCE(CAST(value AS CHAR), '[NULL]'),
    COUNT(*)
  FROM accessory_structures GROUP BY value;

  -- ========================================================================
  -- freq_dedications
  -- Categorical: number_of_dedications
  -- Year: tax_year
  -- ========================================================================
  TRUNCATE TABLE freq_dedications;

  -- tmk
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM dedications GROUP BY tmk;

  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'number_of_dedications', COALESCE(number_of_dedications, '[NULL]'), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), number_of_dedications;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'number_of_dedications', COALESCE(number_of_dedications, '[NULL]'), COUNT(*)
  FROM dedications GROUP BY number_of_dedications;

  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), tax_year;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY tax_year;

  -- ========================================================================
  -- freq_condominium_projects
  -- Categorical: project_name, zoning, city, developer, ohana, converted,
  --   land_ownership
  -- Date→year: preliminary_date, contingent_final_date, final_date,
  --   biennial_registration_date
  -- Log-scale (INT UNSIGNED): unit_count, commercial, tool_sheds,
  --   residential, parking, agricultural, other, buildings, floors
  -- ========================================================================
  TRUNCATE TABLE freq_condominium_projects;

  -- tmk
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM condominium_projects GROUP BY tmk;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', COALESCE(project_name, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), project_name;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', COALESCE(project_name, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY project_name;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(zoning, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY zoning;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'city', COALESCE(city, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), city;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'city', COALESCE(city, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY city;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'developer', COALESCE(developer, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), developer;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'developer', COALESCE(developer, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY developer;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'ohana', COALESCE(ohana, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), ohana;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'ohana', COALESCE(ohana, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY ohana;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'converted', COALESCE(converted, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), converted;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'converted', COALESCE(converted, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY converted;

  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_ownership', COALESCE(land_ownership, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), land_ownership;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_ownership', COALESCE(land_ownership, '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY land_ownership;

  -- preliminary_date (date → year)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'preliminary_date', COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(preliminary_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'preliminary_date', COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(preliminary_date);

  -- contingent_final_date (date → year)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'contingent_final_date', COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(contingent_final_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'contingent_final_date', COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(contingent_final_date);

  -- final_date (date → year)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_date', COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(final_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_date', COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(final_date);

  -- biennial_registration_date (date → year)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'biennial_registration_date', COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(biennial_registration_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'biennial_registration_date', COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(biennial_registration_date);

  -- unit_count (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_count',
    COALESCE(CAST(unit_count AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), unit_count;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_count',
    COALESCE(CAST(unit_count AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY unit_count;

  -- commercial (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'commercial',
    COALESCE(CAST(commercial AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), commercial;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'commercial',
    COALESCE(CAST(commercial AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY commercial;

  -- tool_sheds (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tool_sheds',
    COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), tool_sheds;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tool_sheds',
    COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY tool_sheds;

  -- residential (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'residential',
    COALESCE(CAST(residential AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), residential;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'residential',
    COALESCE(CAST(residential AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY residential;

  -- parking (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking',
    COALESCE(CAST(parking AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), parking;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking',
    COALESCE(CAST(parking AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY parking;

  -- agricultural (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural',
    COALESCE(CAST(agricultural AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), agricultural;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural',
    COALESCE(CAST(agricultural AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY agricultural;

  -- other (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), other;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'other',
    COALESCE(CAST(other AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY other;

  -- buildings (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'buildings',
    COALESCE(CAST(buildings AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), buildings;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'buildings',
    COALESCE(CAST(buildings AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY buildings;

  -- floors (as-is)
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floors',
    COALESCE(CAST(floors AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), floors;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'floors',
    COALESCE(CAST(floors AS CHAR), '[NULL]'),
    COUNT(*)
  FROM condominium_projects GROUP BY floors;

  -- ========================================================================
  -- freq_condominium_units
  -- Categorical: unit_number
  -- ========================================================================
  TRUNCATE TABLE freq_condominium_units;

  -- tmk
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', tmk, COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', tmk, COUNT(*)
  FROM condominium_units GROUP BY tmk;

  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_number', COALESCE(unit_number, '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), unit_number;
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_number', COALESCE(unit_number, '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY unit_number;

END //

DELIMITER ;

-- ============================================================================
-- EVENT: Weekly regeneration of freq tables
-- Runs every Sunday at 2:00 AM
-- ============================================================================
-- Ensure event scheduler is enabled (also set event_scheduler=ON in my.cnf)
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS evt_weekly_freq_refresh;

CREATE EVENT evt_weekly_freq_refresh
ON SCHEDULE EVERY 1 WEEK STARTS '2026-03-15 02:00:00'
COMMENT 'Regenerate all freq_ tables weekly on Sunday at 2 AM'
DO CALL sp_regenerate_freq_tables();

-- ============================================================================
-- END OF FREQ TABLES
-- ============================================================================
