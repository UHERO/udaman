-- ============================================================================
-- HHDB Frequency Tables
-- Pre-computed frequency counts of column values by county
-- Regenerated weekly via MariaDB scheduled EVENT
-- ============================================================================

-- ============================================================================
-- To update a a single existing frequency count field:
--
-- 1. Delete existing data for that field
-- DELETE FROM freq_properties WHERE column_name = 'latitude';

-- 2. Re-insert (take from same query as original insert)
-- INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
-- SELECT LEFT(tmk, 1), 'latitude', COALESCE(CAST(latitude AS CHAR), '[NULL]'), COUNT(*)
-- FROM properties GROUP BY LEFT(tmk, 1), latitude;
-- INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
-- SELECT '0', 'latitude', COALESCE(CAST(latitude AS CHAR), '[NULL]'), COUNT(*)
-- FROM properties GROUP BY latitude;

-- Alternatively, rerun entire freq generation with (takes a while)
-- CALL sp_regenerate_freq_tables();
-- ============================================================================

-- SET this on server prior to first running
-- SET GLOBAL event_scheduler = ON;

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
DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables;
CREATE PROCEDURE sp_regenerate_freq_tables()
BEGIN
  -- freq_properties
  TRUNCATE TABLE freq_properties;

  -- island_code
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'island_code', COALESCE(CAST(island_code AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), island_code;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'island_code', COALESCE(CAST(island_code AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY island_code;

  -- parcel_number
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_number', COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), parcel_number;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_number', COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY parcel_number;

  -- location_address
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'location_address', COALESCE(CAST(location_address AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), location_address;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'location_address', COALESCE(CAST(location_address AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY location_address;

  -- address_other
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address_other', COALESCE(CAST(address_other AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), address_other;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'address_other', COALESCE(CAST(address_other AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY address_other;

  -- project_name
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), project_name;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY project_name;

  -- legal_information
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'legal_information', COALESCE(CAST(legal_information AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), legal_information;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'legal_information', COALESCE(CAST(legal_information AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY legal_information;

  -- property_class
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY property_class;

  -- land_area_sqft
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft', COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), land_area_sqft;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft', COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY land_area_sqft;

  -- land_area_acres
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_acres', COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), land_area_acres;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_acres', COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY land_area_acres;

  -- neighborhood_code
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), neighborhood_code;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY neighborhood_code;

  -- zoning
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY zoning;

  -- parcel_note
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_note', COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), parcel_note;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_note', COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY parcel_note;

  -- damage
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', COALESCE(CAST(damage AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), damage;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', COALESCE(CAST(damage AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY damage;

  -- reentry_zone
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), reentry_zone;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY reentry_zone;

  -- zone_color
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', COALESCE(CAST(zone_color AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zone_color;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', COALESCE(CAST(zone_color AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY zone_color;

  -- non_taxable_status
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), non_taxable_status;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY non_taxable_status;

  -- living_units
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', COALESCE(CAST(living_units AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), living_units;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', COALESCE(CAST(living_units AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY living_units;

  -- zip
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zip', COALESCE(CAST(zip AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), zip;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zip', COALESCE(CAST(zip AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY zip;

  -- latitude
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'latitude', COALESCE(CAST(latitude AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), latitude;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'latitude', COALESCE(CAST(latitude AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY latitude;

  -- longitude
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'longitude', COALESCE(CAST(longitude AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), longitude;
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'longitude', COALESCE(CAST(longitude AS CHAR), '[NULL]'), COUNT(*)
  FROM properties GROUP BY longitude;

  -- freq_owners
  TRUNCATE TABLE freq_owners;

  -- tmk
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY tmk;

  -- owner_name
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_name', COALESCE(CAST(owner_name AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), owner_name;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_name', COALESCE(CAST(owner_name AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY owner_name;

  -- owner_type
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_type', COALESCE(CAST(owner_type AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), owner_type;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_type', COALESCE(CAST(owner_type AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY owner_type;

  -- owner_address
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_address', COALESCE(CAST(owner_address AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), owner_address;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_address', COALESCE(CAST(owner_address AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY owner_address;

  -- sequence_order
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sequence_order', COALESCE(CAST(sequence_order AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), sequence_order;
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'sequence_order', COALESCE(CAST(sequence_order AS CHAR), '[NULL]'), COUNT(*)
  FROM owners GROUP BY sequence_order;

  -- freq_parcels
  TRUNCATE TABLE freq_parcels;

  -- parcel_number
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_number', COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), parcel_number;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_number', COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY parcel_number;

  -- location_address
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'location_address', COALESCE(CAST(location_address AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), location_address;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'location_address', COALESCE(CAST(location_address AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY location_address;

  -- address_other
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address_other', COALESCE(CAST(address_other AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), address_other;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'address_other', COALESCE(CAST(address_other AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY address_other;

  -- project_name
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), project_name;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY project_name;

  -- legal_information
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'legal_information', COALESCE(CAST(legal_information AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), legal_information;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'legal_information', COALESCE(CAST(legal_information AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY legal_information;

  -- property_class
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY property_class;

  -- land_area_sqft
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft', COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), land_area_sqft;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft', COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY land_area_sqft;

  -- land_area_acres
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_acres', COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), land_area_acres;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_acres', COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY land_area_acres;

  -- neighborhood_code
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), neighborhood_code;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY neighborhood_code;

  -- zoning
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY zoning;

  -- parcel_note
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_note', COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), parcel_note;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_note', COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY parcel_note;

  -- damage
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', COALESCE(CAST(damage AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), damage;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', COALESCE(CAST(damage AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY damage;

  -- reentry_zone
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), reentry_zone;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY reentry_zone;

  -- zone_color
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', COALESCE(CAST(zone_color AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), zone_color;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', COALESCE(CAST(zone_color AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY zone_color;

  -- non_taxable_status
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), non_taxable_status;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY non_taxable_status;

  -- living_units
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', COALESCE(CAST(living_units AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), living_units;
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', COALESCE(CAST(living_units AS CHAR), '[NULL]'), COUNT(*)
  FROM parcels GROUP BY living_units;

  -- freq_assessments
  TRUNCATE TABLE freq_assessments;

  -- tmk
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY tmk;

  -- tax_year
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), tax_year;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY tax_year;

  -- property_class
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY property_class;

  -- assessed_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_land_value', COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), assessed_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_land_value', COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY assessed_land_value;

  -- assessed_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_building_value', COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), assessed_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_building_value', COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY assessed_building_value;

  -- dedicated_use_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dedicated_use_value', COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), dedicated_use_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'dedicated_use_value', COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY dedicated_use_value;

  -- land_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_exemption', COALESCE(CAST(land_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), land_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_exemption', COALESCE(CAST(land_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY land_exemption;

  -- building_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_exemption', COALESCE(CAST(building_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), building_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_exemption', COALESCE(CAST(building_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY building_exemption;

  -- net_taxable_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_land_value', COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), net_taxable_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_land_value', COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY net_taxable_land_value;

  -- net_taxable_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_building_value', COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), net_taxable_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_building_value', COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY net_taxable_building_value;

  -- total_property_assessed_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_assessed_value', COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_property_assessed_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_assessed_value', COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY total_property_assessed_value;

  -- total_property_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_exemption', COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_property_exemption;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_exemption', COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY total_property_exemption;

  -- total_net_taxable_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_net_taxable_value', COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_net_taxable_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_net_taxable_value', COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY total_net_taxable_value;

  -- agricultural_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_land_value', COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), agricultural_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_land_value', COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY agricultural_land_value;

  -- market_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_land_value', COALESCE(CAST(market_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), market_land_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_land_value', COALESCE(CAST(market_land_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY market_land_value;

  -- market_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_building_value', COALESCE(CAST(market_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), market_building_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_building_value', COALESCE(CAST(market_building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY market_building_value;

  -- total_market_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_market_value', COALESCE(CAST(total_market_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), total_market_value;
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_market_value', COALESCE(CAST(total_market_value AS CHAR), '[NULL]'), COUNT(*)
  FROM assessments GROUP BY total_market_value;

  -- freq_land_classifications
  TRUNCATE TABLE freq_land_classifications;

  -- tmk
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY tmk;

  -- land_classification
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_classification', COALESCE(CAST(land_classification AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), land_classification;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_classification', COALESCE(CAST(land_classification AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY land_classification;

  -- square_footage
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'square_footage', COALESCE(CAST(square_footage AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), square_footage;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'square_footage', COALESCE(CAST(square_footage AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY square_footage;

  -- acreage
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acreage', COALESCE(CAST(acreage AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), acreage;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'acreage', COALESCE(CAST(acreage AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY acreage;

  -- agricultural_use_indicator
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_use_indicator', COALESCE(CAST(agricultural_use_indicator AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), agricultural_use_indicator;
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_use_indicator', COALESCE(CAST(agricultural_use_indicator AS CHAR), '[NULL]'), COUNT(*)
  FROM land_classifications GROUP BY agricultural_use_indicator;

  -- freq_residential_improvements
  TRUNCATE TABLE freq_residential_improvements;

  -- tmk
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY tmk;

  -- building_number
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY building_number;

  -- year_built
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY year_built;

  -- eff_year_built
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'eff_year_built', COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), eff_year_built;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'eff_year_built', COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY eff_year_built;

  -- living_area
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_area', COALESCE(CAST(living_area AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), living_area;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_area', COALESCE(CAST(living_area AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY living_area;

  -- bedrooms
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'bedrooms', COALESCE(CAST(bedrooms AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), bedrooms;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'bedrooms', COALESCE(CAST(bedrooms AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY bedrooms;

  -- full_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'full_bath', COALESCE(CAST(full_bath AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), full_bath;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'full_bath', COALESCE(CAST(full_bath AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY full_bath;

  -- half_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'half_bath', COALESCE(CAST(half_bath AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), half_bath;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'half_bath', COALESCE(CAST(half_bath AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY half_bath;

  -- occupancy
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'occupancy', COALESCE(CAST(occupancy AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), occupancy;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'occupancy', COALESCE(CAST(occupancy AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY occupancy;

  -- framing
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'framing', COALESCE(CAST(framing AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), framing;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'framing', COALESCE(CAST(framing AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY framing;

  -- percent_complete
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY percent_complete;

  -- heating_cooling
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'heating_cooling', COALESCE(CAST(heating_cooling AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), heating_cooling;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'heating_cooling', COALESCE(CAST(heating_cooling AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY heating_cooling;

  -- exterior_wall
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), exterior_wall;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY exterior_wall;

  -- roof_material
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'roof_material', COALESCE(CAST(roof_material AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), roof_material;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'roof_material', COALESCE(CAST(roof_material AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY roof_material;

  -- fireplace
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'fireplace', COALESCE(CAST(fireplace AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), fireplace;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'fireplace', COALESCE(CAST(fireplace AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY fireplace;

  -- grade
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'grade', COALESCE(CAST(grade AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), grade;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'grade', COALESCE(CAST(grade AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY grade;

  -- building_value
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_value', COALESCE(CAST(building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), building_value;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_value', COALESCE(CAST(building_value AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY building_value;

  -- total_room_count
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_room_count', COALESCE(CAST(total_room_count AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), total_room_count;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_room_count', COALESCE(CAST(total_room_count AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY total_room_count;

  -- condo_style
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', COALESCE(CAST(condo_style AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), condo_style;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', COALESCE(CAST(condo_style AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY condo_style;

  -- condo_view
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_view', COALESCE(CAST(condo_view AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), condo_view;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_view', COALESCE(CAST(condo_view AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY condo_view;

  -- floor_level
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', COALESCE(CAST(floor_level AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), floor_level;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', COALESCE(CAST(floor_level AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY floor_level;

  -- parking_spaces
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking_spaces', COALESCE(CAST(parking_spaces AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), parking_spaces;
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking_spaces', COALESCE(CAST(parking_spaces AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_improvements GROUP BY parking_spaces;

  -- freq_residential_additions
  TRUNCATE TABLE freq_residential_additions;

  -- tmk
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY tmk;

  -- card
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', COALESCE(CAST(card AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), card;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', COALESCE(CAST(card AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY card;

  -- line
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'line', COALESCE(CAST(line AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), line;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'line', COALESCE(CAST(line AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY line;

  -- lower
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'lower', COALESCE(CAST(lower AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), lower;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'lower', COALESCE(CAST(lower AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY lower;

  -- first
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'first', COALESCE(CAST(first AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), first;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'first', COALESCE(CAST(first AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY first;

  -- second
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'second', COALESCE(CAST(second AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), second;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'second', COALESCE(CAST(second AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY second;

  -- third
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'third', COALESCE(CAST(third AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), third;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'third', COALESCE(CAST(third AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY third;

  -- area
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM residential_additions GROUP BY area;

  -- freq_commercial_improvements
  TRUNCATE TABLE freq_commercial_improvements;

  -- tmk
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY tmk;

  -- building_number
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_number;

  -- building_card
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_card', COALESCE(CAST(building_card AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_card;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_card', COALESCE(CAST(building_card AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_card;

  -- year_built
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY year_built;

  -- effective_year_built
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_year_built', COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), effective_year_built;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_year_built', COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY effective_year_built;

  -- improvement_name
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'improvement_name', COALESCE(CAST(improvement_name AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), improvement_name;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'improvement_name', COALESCE(CAST(improvement_name AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY improvement_name;

  -- property_class
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), property_class;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', COALESCE(CAST(property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY property_class;

  -- structure_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure_type', COALESCE(CAST(structure_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), structure_type;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure_type', COALESCE(CAST(structure_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY structure_type;

  -- units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'units', COALESCE(CAST(units AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), units;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'units', COALESCE(CAST(units AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY units;

  -- identical_units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'identical_units', COALESCE(CAST(identical_units AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), identical_units;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'identical_units', COALESCE(CAST(identical_units AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY identical_units;

  -- gross_building_description
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'gross_building_description', COALESCE(CAST(gross_building_description AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), gross_building_description;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'gross_building_description', COALESCE(CAST(gross_building_description AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY gross_building_description;

  -- building_square_footage
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_square_footage', COALESCE(CAST(building_square_footage AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_square_footage;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_square_footage', COALESCE(CAST(building_square_footage AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_square_footage;

  -- building_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_type', COALESCE(CAST(building_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), building_type;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_type', COALESCE(CAST(building_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY building_type;

  -- percent_complete
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY percent_complete;

  -- structure
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure', COALESCE(CAST(structure AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), structure;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure', COALESCE(CAST(structure AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY structure;

  -- value
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value', COALESCE(CAST(`value` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), `value`;
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'value', COALESCE(CAST(`value` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvements GROUP BY `value`;

  -- freq_commercial_improvement_details
  TRUNCATE TABLE freq_commercial_improvement_details;

  -- tmk
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY tmk;

  -- card
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', COALESCE(CAST(card AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), card;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', COALESCE(CAST(card AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY card;

  -- section
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'section', COALESCE(CAST(section AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), section;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'section', COALESCE(CAST(section AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY section;

  -- floor
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor', COALESCE(CAST(floor AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), floor;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor', COALESCE(CAST(floor AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY floor;

  -- usage
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'usage', COALESCE(CAST(`usage` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), `usage`;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'usage', COALESCE(CAST(`usage` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY `usage`;

  -- area
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY area;

  -- perimeter
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'perimeter', COALESCE(CAST(perimeter AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), perimeter;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'perimeter', COALESCE(CAST(perimeter AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY perimeter;

  -- exterior_wall
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), exterior_wall;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY exterior_wall;

  -- wall_height
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'wall_height', COALESCE(CAST(wall_height AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), wall_height;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'wall_height', COALESCE(CAST(wall_height AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY wall_height;

  -- occupancy
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'occupancy', COALESCE(CAST(occupancy AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), occupancy;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'occupancy', COALESCE(CAST(occupancy AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY occupancy;

  -- construction
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'construction', COALESCE(CAST(construction AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), construction;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'construction', COALESCE(CAST(construction AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY construction;

  -- condo_style
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', COALESCE(CAST(condo_style AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_style;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', COALESCE(CAST(condo_style AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_style;

  -- condo_type
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_type', COALESCE(CAST(condo_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_type;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_type', COALESCE(CAST(condo_type AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_type;

  -- condo_unit
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_unit', COALESCE(CAST(condo_unit AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), condo_unit;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_unit', COALESCE(CAST(condo_unit AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY condo_unit;

  -- floor_level
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', COALESCE(CAST(floor_level AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), floor_level;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', COALESCE(CAST(floor_level AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY floor_level;

  -- view
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'view', COALESCE(CAST(`view` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), `view`;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'view', COALESCE(CAST(`view` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY `view`;

  -- project
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project', COALESCE(CAST(project AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), project;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'project', COALESCE(CAST(project AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY project;

  -- description
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM commercial_improvement_details GROUP BY `description`;

  -- freq_yard_improvements
  TRUNCATE TABLE freq_yard_improvements;

  -- tmk
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY tmk;

  -- description
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY `description`;

  -- quantity
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'quantity', COALESCE(CAST(quantity AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), quantity;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'quantity', COALESCE(CAST(quantity AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY quantity;

  -- year_built
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY year_built;

  -- area
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY LEFT(tmk, 1), area;
  INSERT INTO freq_yard_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', COALESCE(CAST(area AS CHAR), '[NULL]'), COUNT(*)
  FROM yard_improvements GROUP BY area;

  -- freq_permits
  TRUNCATE TABLE freq_permits;

  -- tmk
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY tmk;

  -- permit_date
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_date', COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), YEAR(permit_date);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_date', COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY YEAR(permit_date);

  -- permit_number
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_number', COALESCE(CAST(permit_number AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), permit_number;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_number', COALESCE(CAST(permit_number AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY permit_number;

  -- reason
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reason', COALESCE(CAST(reason AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), reason;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'reason', COALESCE(CAST(reason AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY reason;

  -- permit_amount
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_amount', COALESCE(CAST(permit_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), permit_amount;
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_amount', COALESCE(CAST(permit_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM permits GROUP BY permit_amount;

  -- freq_sales
  TRUNCATE TABLE freq_sales;

  -- tmk
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY tmk;

  -- sale_date
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_date', COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), YEAR(sale_date);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_date', COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY YEAR(sale_date);

  -- sale_amount
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_amount', COALESCE(CAST(sale_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), sale_amount;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_amount', COALESCE(CAST(sale_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY sale_amount;

  -- instrument
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument', COALESCE(CAST(instrument AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument', COALESCE(CAST(instrument AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument;

  -- instrument_type
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_type', COALESCE(CAST(instrument_type AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument_type;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_type', COALESCE(CAST(instrument_type AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument_type;

  -- instrument_description
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_description', COALESCE(CAST(instrument_description AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), instrument_description;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_description', COALESCE(CAST(instrument_description AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY instrument_description;

  -- valid_sale
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'valid_sale', COALESCE(CAST(valid_sale AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), valid_sale;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'valid_sale', COALESCE(CAST(valid_sale AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY valid_sale;

  -- date_of_recording
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_of_recording', COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), YEAR(date_of_recording);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_of_recording', COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY YEAR(date_of_recording);

  -- land_court_document_number
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_court_document_number', COALESCE(CAST(land_court_document_number AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), land_court_document_number;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_court_document_number', COALESCE(CAST(land_court_document_number AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY land_court_document_number;

  -- cert
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'cert', COALESCE(CAST(cert AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), cert;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'cert', COALESCE(CAST(cert AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY cert;

  -- book_page
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'book_page', COALESCE(CAST(book_page AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), book_page;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'book_page', COALESCE(CAST(book_page AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY book_page;

  -- conveyance_tax
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'conveyance_tax', COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), conveyance_tax;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'conveyance_tax', COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY conveyance_tax;

  -- document_type
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'document_type', COALESCE(CAST(document_type AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), document_type;
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'document_type', COALESCE(CAST(document_type AS CHAR), '[NULL]'), COUNT(*)
  FROM sales GROUP BY document_type;

  -- freq_current_tax_bills
  TRUNCATE TABLE freq_current_tax_bills;

  -- tmk
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY tmk;

  -- tax_period
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', COALESCE(CAST(tax_period AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tax_period;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', COALESCE(CAST(tax_period AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY tax_period;

  -- description
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY `description`;

  -- original_due_date
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'original_due_date', COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), YEAR(original_due_date);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'original_due_date', COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY YEAR(original_due_date);

  -- taxes_assessment
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'taxes_assessment', COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), taxes_assessment;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'taxes_assessment', COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY taxes_assessment;

  -- tax_credits
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_credits', COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), tax_credits;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_credits', COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY tax_credits;

  -- net_tax
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_tax', COALESCE(CAST(net_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), net_tax;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_tax', COALESCE(CAST(net_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY net_tax;

  -- penalty
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY penalty;

  -- interest
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY interest;

  -- other
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), `other`;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY `other`;

  -- amount_due
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due', COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), amount_due;
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due', COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM current_tax_bills GROUP BY amount_due;

  -- freq_historical_tax_summary
  TRUNCATE TABLE freq_historical_tax_summary;

  -- tmk
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tmk;

  -- year
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', COALESCE(CAST(`year` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), `year`;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', COALESCE(CAST(`year` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY `year`;

  -- tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax;

  -- payments_and_credits
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_and_credits', COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), payments_and_credits;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_and_credits', COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY payments_and_credits;

  -- penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), `other`;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY `other`;

  -- amount_due
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due', COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), amount_due;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due', COALESCE(CAST(amount_due AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY amount_due;

  -- tax_details_total_tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_tax', COALESCE(CAST(tax_details_total_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_details_total_tax;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_tax', COALESCE(CAST(tax_details_total_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_details_total_tax;

  -- tax_details_total_payments_credits
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_payments_credits', COALESCE(CAST(tax_details_total_payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_details_total_payments_credits;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_payments_credits', COALESCE(CAST(tax_details_total_payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_details_total_payments_credits;

  -- tax_details_total_penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_penalty', COALESCE(CAST(tax_details_total_penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_details_total_penalty;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_penalty', COALESCE(CAST(tax_details_total_penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_details_total_penalty;

  -- tax_details_total_interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_interest', COALESCE(CAST(tax_details_total_interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_details_total_interest;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_interest', COALESCE(CAST(tax_details_total_interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_details_total_interest;

  -- tax_details_total_other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_other', COALESCE(CAST(tax_details_total_other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_details_total_other;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_other', COALESCE(CAST(tax_details_total_other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_details_total_other;

  -- tax_payments_total_tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_tax', COALESCE(CAST(tax_payments_total_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_payments_total_tax;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_tax', COALESCE(CAST(tax_payments_total_tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_payments_total_tax;

  -- tax_payments_total_penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_penalty', COALESCE(CAST(tax_payments_total_penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_payments_total_penalty;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_penalty', COALESCE(CAST(tax_payments_total_penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_payments_total_penalty;

  -- tax_payments_total_interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_interest', COALESCE(CAST(tax_payments_total_interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_payments_total_interest;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_interest', COALESCE(CAST(tax_payments_total_interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_payments_total_interest;

  -- tax_payments_total_other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_other', COALESCE(CAST(tax_payments_total_other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_payments_total_other;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_other', COALESCE(CAST(tax_payments_total_other AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_payments_total_other;

  -- tax_credits_total_amount
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_credits_total_amount', COALESCE(CAST(tax_credits_total_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), tax_credits_total_amount;
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_credits_total_amount', COALESCE(CAST(tax_credits_total_amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_summary GROUP BY tax_credits_total_amount;

  -- freq_historical_tax_details
  TRUNCATE TABLE freq_historical_tax_details;

  -- tmk
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY tmk;

  -- tax_period
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', COALESCE(CAST(tax_period AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tax_period;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', COALESCE(CAST(tax_period AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY tax_period;

  -- description
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY `description`;

  -- tax
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY tax;

  -- payments_credits
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_credits', COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), payments_credits;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_credits', COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY payments_credits;

  -- penalty
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), `other`;
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_details GROUP BY `other`;

  -- freq_historical_tax_payments
  TRUNCATE TABLE freq_historical_tax_payments;

  -- tmk
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY tmk;

  -- payment_sequence
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payment_sequence', COALESCE(CAST(payment_sequence AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), payment_sequence;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'payment_sequence', COALESCE(CAST(payment_sequence AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY payment_sequence;

  -- effective_date
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_date', COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), YEAR(effective_date);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_date', COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY YEAR(effective_date);

  -- tax
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), tax;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', COALESCE(CAST(tax AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY tax;

  -- penalty
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), penalty;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', COALESCE(CAST(penalty AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY penalty;

  -- interest
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), interest;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', COALESCE(CAST(interest AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY interest;

  -- other
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), `other`;
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_payments GROUP BY `other`;

  -- freq_historical_tax_credits
  TRUNCATE TABLE freq_historical_tax_credits;

  -- tmk
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY tmk;

  -- period
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'period', COALESCE(CAST(period AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), period;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'period', COALESCE(CAST(period AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY period;

  -- description
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY `description`;

  -- amount
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount', COALESCE(CAST(amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), amount;
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount', COALESCE(CAST(amount AS CHAR), '[NULL]'), COUNT(*)
  FROM historical_tax_credits GROUP BY amount;

  -- freq_appeals
  TRUNCATE TABLE freq_appeals;

  -- tmk
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY tmk;

  -- year
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', COALESCE(CAST(`year` AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), `year`;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', COALESCE(CAST(`year` AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY `year`;

  -- appeal_type_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'appeal_type_value', COALESCE(CAST(appeal_type_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), appeal_type_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'appeal_type_value', COALESCE(CAST(appeal_type_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY appeal_type_value;

  -- scheduled_hearing_date_subject_to_change
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'scheduled_hearing_date_subject_to_change', COALESCE(CAST(scheduled_hearing_date_subject_to_change AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), scheduled_hearing_date_subject_to_change;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'scheduled_hearing_date_subject_to_change', COALESCE(CAST(scheduled_hearing_date_subject_to_change AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY scheduled_hearing_date_subject_to_change;

  -- status
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'status', COALESCE(CAST(status AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), status;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'status', COALESCE(CAST(status AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY status;

  -- date_settled
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_settled', COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), YEAR(date_settled);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_settled', COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY YEAR(date_settled);

  -- final_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_value', COALESCE(CAST(final_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), final_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_value', COALESCE(CAST(final_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY final_value;

  -- tax_payer_opinion_of_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_value', COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_value;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_value', COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_value;

  -- tax_payer_opinion_of_property_class
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_property_class', COALESCE(CAST(tax_payer_opinion_of_property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_property_class;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_property_class', COALESCE(CAST(tax_payer_opinion_of_property_class AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_property_class;

  -- tax_payer_opinion_of_exemptions
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_exemptions', COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), tax_payer_opinion_of_exemptions;
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_exemptions', COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'), COUNT(*)
  FROM appeals GROUP BY tax_payer_opinion_of_exemptions;

  -- freq_agricultural_assessments
  TRUNCATE TABLE freq_agricultural_assessments;

  -- tmk
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY tmk;

  -- acres
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acres', COALESCE(CAST(acres AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), acres;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'acres', COALESCE(CAST(acres AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY acres;

  -- acres_in_production
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acres_in_production', COALESCE(CAST(acres_in_production AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), acres_in_production;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'acres_in_production', COALESCE(CAST(acres_in_production AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY acres_in_production;

  -- agricultural_type
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_type', COALESCE(CAST(agricultural_type AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), agricultural_type;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_type', COALESCE(CAST(agricultural_type AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY agricultural_type;

  -- agricultural_value
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_value', COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), agricultural_value;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_value', COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY agricultural_value;

  -- assessed_value
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_value', COALESCE(CAST(assessed_value AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), assessed_value;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_value', COALESCE(CAST(assessed_value AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY assessed_value;

  -- description
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY `description`;

  -- use_description
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'use_description', COALESCE(CAST(use_description AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), use_description;
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'use_description', COALESCE(CAST(use_description AS CHAR), '[NULL]'), COUNT(*)
  FROM agricultural_assessments GROUP BY use_description;

  -- freq_accessory_structures
  TRUNCATE TABLE freq_accessory_structures;

  -- tmk
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY tmk;

  -- building_number
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), building_number;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', COALESCE(CAST(building_number AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY building_number;

  -- description
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), `description`;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', COALESCE(CAST(`description` AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY `description`;

  -- dimensions_units
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dimensions_units', COALESCE(CAST(dimensions_units AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), dimensions_units;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'dimensions_units', COALESCE(CAST(dimensions_units AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY dimensions_units;

  -- percent_complete
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), percent_complete;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY percent_complete;

  -- value
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value', COALESCE(CAST(`value` AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), `value`;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'value', COALESCE(CAST(`value` AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY `value`;

  -- year_built
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY LEFT(tmk, 1), year_built;
  INSERT INTO freq_accessory_structures (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', COALESCE(CAST(year_built AS CHAR), '[NULL]'), COUNT(*)
  FROM accessory_structures GROUP BY year_built;

  -- freq_dedications
  TRUNCATE TABLE freq_dedications;

  -- tmk
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY tmk;

  -- tax_year
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), tax_year;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', COALESCE(CAST(tax_year AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY tax_year;

  -- number_of_dedications
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'number_of_dedications', COALESCE(CAST(number_of_dedications AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), number_of_dedications;
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'number_of_dedications', COALESCE(CAST(number_of_dedications AS CHAR), '[NULL]'), COUNT(*)
  FROM dedications GROUP BY number_of_dedications;

  -- freq_condominium_projects
  TRUNCATE TABLE freq_condominium_projects;

  -- tmk
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY tmk;

  -- project_name
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), project_name;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', COALESCE(CAST(project_name AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY project_name;

  -- unit_count
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_count', COALESCE(CAST(unit_count AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), unit_count;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_count', COALESCE(CAST(unit_count AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY unit_count;

  -- zoning
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), zoning;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', COALESCE(CAST(zoning AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY zoning;

  -- address
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address', COALESCE(CAST(address AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), address;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'address', COALESCE(CAST(address AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY address;

  -- city
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'city', COALESCE(CAST(city AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), city;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'city', COALESCE(CAST(city AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY city;

  -- developer
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'developer', COALESCE(CAST(developer AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), developer;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'developer', COALESCE(CAST(developer AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY developer;

  -- project_number
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_number', COALESCE(CAST(project_number AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), project_number;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_number', COALESCE(CAST(project_number AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY project_number;

  -- commercial
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'commercial', COALESCE(CAST(commercial AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), commercial;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'commercial', COALESCE(CAST(commercial AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY commercial;

  -- tool_sheds
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tool_sheds', COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), tool_sheds;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tool_sheds', COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY tool_sheds;

  -- ohana
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'ohana', COALESCE(CAST(ohana AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), ohana;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'ohana', COALESCE(CAST(ohana AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY ohana;

  -- residential
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'residential', COALESCE(CAST(residential AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), residential;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'residential', COALESCE(CAST(residential AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY residential;

  -- parking
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking', COALESCE(CAST(parking AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), parking;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking', COALESCE(CAST(parking AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY parking;

  -- converted
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'converted', COALESCE(CAST(converted AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), converted;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'converted', COALESCE(CAST(converted AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY converted;

  -- agricultural
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural', COALESCE(CAST(agricultural AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), agricultural;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural', COALESCE(CAST(agricultural AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY agricultural;

  -- other
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), `other`;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', COALESCE(CAST(`other` AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY `other`;

  -- buildings
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'buildings', COALESCE(CAST(buildings AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), buildings;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'buildings', COALESCE(CAST(buildings AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY buildings;

  -- floors
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floors', COALESCE(CAST(floors AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), floors;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'floors', COALESCE(CAST(floors AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY floors;

  -- land_ownership
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_ownership', COALESCE(CAST(land_ownership AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), land_ownership;
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_ownership', COALESCE(CAST(land_ownership AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY land_ownership;

  -- preliminary_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'preliminary_date', COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(preliminary_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'preliminary_date', COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(preliminary_date);

  -- contingent_final_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'contingent_final_date', COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(contingent_final_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'contingent_final_date', COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(contingent_final_date);

  -- final_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_date', COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(final_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_date', COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(final_date);

  -- biennial_registration_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'biennial_registration_date', COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), YEAR(biennial_registration_date);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'biennial_registration_date', COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_projects GROUP BY YEAR(biennial_registration_date);

  -- freq_condominium_units
  TRUNCATE TABLE freq_condominium_units;

  -- tmk
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), tmk;
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', COALESCE(CAST(tmk AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY tmk;

  -- unit_number
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_number', COALESCE(CAST(unit_number AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), unit_number;
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_number', COALESCE(CAST(unit_number AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY unit_number;

  -- owner_name
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_name', COALESCE(CAST(owner_name AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), owner_name;
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_name', COALESCE(CAST(owner_name AS CHAR), '[NULL]'), COUNT(*)
  FROM condominium_units GROUP BY owner_name;

END //
DELIMITER ;

-- ============================================================================
-- EVENT: Weekly regeneration of freq tables
-- Runs every Sunday at 2:00 AM
-- ============================================================================
-- NOTE: event_scheduler=ON must be set in my.cnf (requires SUPER privilege)

DROP EVENT IF EXISTS evt_weekly_freq_refresh;

CREATE EVENT evt_weekly_freq_refresh
ON SCHEDULE EVERY 1 WEEK STARTS '2026-03-15 02:00:00'
COMMENT 'Regenerate all freq_ tables weekly on Sunday at 2 AM'
DO CALL sp_regenerate_freq_tables();

-- ============================================================================
-- END OF FREQ TABLES
-- ============================================================================
