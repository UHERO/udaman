-- ============================================================================
-- HHDB Frequency Tables
-- Pre-computed frequency counts of column values by county
-- Regenerated weekly via MariaDB scheduled EVENT
-- ============================================================================

-- ============================================================================
-- To update a a single existing frequency count field:
--
-- 1. Delete existing data for that field
-- DELETE FROM freq_properties WHERE column_name = 'zcta20';

-- 2. Re-insert (take from same query as original insert)
-- INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
-- SELECT LEFT(tmk, 1), 'zcta20', LEFT(COALESCE(CAST(zcta20 AS CHAR), '[NULL]'), 500), COUNT(*)
-- FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(zcta20 AS CHAR), 500);
-- INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
-- SELECT '0', 'zcta20', LEFT(COALESCE(CAST(zcta20 AS CHAR), '[NULL]'), 500), COUNT(*)
-- FROM properties GROUP BY LEFT(CAST(zcta20 AS CHAR), 500);
--
-- properties.latitude / longitude are deliberately NOT counted: they are
-- continuous parcel-centroid coordinates (~380k distinct values each), so
-- a frequency table of them is pure noise.

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
DROP TABLE IF EXISTS freq_accessory_improvements;
DROP TABLE IF EXISTS freq_permits;
DROP TABLE IF EXISTS freq_sales;
DROP TABLE IF EXISTS freq_current_tax_bills;
DROP TABLE IF EXISTS freq_historical_tax_summary;
DROP TABLE IF EXISTS freq_historical_tax_details;
DROP TABLE IF EXISTS freq_historical_tax_payments;
DROP TABLE IF EXISTS freq_historical_tax_credits;
DROP TABLE IF EXISTS freq_appeals;
DROP TABLE IF EXISTS freq_agricultural_assessments;
DROP TABLE IF EXISTS freq_dedications;

DROP TABLE IF EXISTS freq_home_exemptions;
DROP TABLE IF EXISTS freq_condominium_projects;
DROP TABLE IF EXISTS freq_condominium_units;

-- ============================================================================
-- CREATE FREQ TABLES (uniform EAV structure)
--
-- column_value is truncated to 500 chars on the way in (every insert wraps
-- its value in LEFT(..., 500), and GROUP BY groups on that same truncated
-- expression) rather than widened to fit: this table exists to survey how
-- common a value is, not to preserve it verbatim, and some source columns
-- (e.g. properties/parcels.address_other, a TEXT column with no cap) hold
-- multi-unit address lists past 500 chars that would otherwise overflow
-- column_value (ERROR 1406) or blow past the ~650-char ceiling on a
-- utf8mb4 PRIMARY KEY. Grouping on the truncated expression (rather than
-- the raw column) means two long values sharing the same first 500 chars
-- merge into one frequency count instead of colliding on insert
-- (ERROR 1062 Duplicate entry).
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

CREATE TABLE freq_accessory_improvements (
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

CREATE TABLE freq_dedications (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB;

CREATE TABLE freq_home_exemptions (
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
  SELECT LEFT(tmk, 1), 'island_code', LEFT(COALESCE(CAST(island_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(island_code AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'island_code', LEFT(COALESCE(CAST(island_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(island_code AS CHAR), 500);

  -- parcel_number
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_number', LEFT(COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(parcel_number AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_number', LEFT(COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(parcel_number AS CHAR), 500);

  -- location_address
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'location_address', LEFT(COALESCE(CAST(location_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(location_address AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'location_address', LEFT(COALESCE(CAST(location_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(location_address AS CHAR), 500);

  -- address_other
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address_other', LEFT(COALESCE(CAST(address_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(address_other AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'address_other', LEFT(COALESCE(CAST(address_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(address_other AS CHAR), 500);

  -- project_name
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(project_name AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(project_name AS CHAR), 500);

  -- legal_information
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'legal_information', LEFT(COALESCE(CAST(legal_information AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(legal_information AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'legal_information', LEFT(COALESCE(CAST(legal_information AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(legal_information AS CHAR), 500);

  -- property_class
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(property_class AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(property_class AS CHAR), 500);

  -- land_area_sqft
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft', LEFT(COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(land_area_sqft AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft', LEFT(COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(land_area_sqft AS CHAR), 500);

  -- land_area_acres
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_acres', LEFT(COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(land_area_acres AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_acres', LEFT(COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(land_area_acres AS CHAR), 500);

  -- neighborhood_code
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', LEFT(COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(neighborhood_code AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', LEFT(COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(neighborhood_code AS CHAR), 500);

  -- zoning
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(zoning AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(zoning AS CHAR), 500);

  -- parcel_note
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_note', LEFT(COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(parcel_note AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_note', LEFT(COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(parcel_note AS CHAR), 500);

  -- damage
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', LEFT(COALESCE(CAST(damage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(damage AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', LEFT(COALESCE(CAST(damage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(damage AS CHAR), 500);

  -- reentry_zone
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', LEFT(COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(reentry_zone AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', LEFT(COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(reentry_zone AS CHAR), 500);

  -- zone_color
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', LEFT(COALESCE(CAST(zone_color AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(zone_color AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', LEFT(COALESCE(CAST(zone_color AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(zone_color AS CHAR), 500);

  -- non_taxable_status
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', LEFT(COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(non_taxable_status AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', LEFT(COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(non_taxable_status AS CHAR), 500);

  -- living_units
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', LEFT(COALESCE(CAST(living_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(living_units AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', LEFT(COALESCE(CAST(living_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(living_units AS CHAR), 500);

  -- map_url
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'map_url', LEFT(COALESCE(CAST(map_url AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(map_url AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'map_url', LEFT(COALESCE(CAST(map_url AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(map_url AS CHAR), 500);

  -- sketch_url
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sketch_url', LEFT(COALESCE(CAST(sketch_url AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(sketch_url AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'sketch_url', LEFT(COALESCE(CAST(sketch_url AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(sketch_url AS CHAR), 500);

  -- zip
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zip', LEFT(COALESCE(CAST(zip AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(zip AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zip', LEFT(COALESCE(CAST(zip AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(zip AS CHAR), 500);

  -- zcta20
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zcta20', LEFT(COALESCE(CAST(zcta20 AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(zcta20 AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'zcta20', LEFT(COALESCE(CAST(zcta20 AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(zcta20 AS CHAR), 500);

  -- countyfp
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'countyfp', LEFT(COALESCE(CAST(countyfp AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(countyfp AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'countyfp', LEFT(COALESCE(CAST(countyfp AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(countyfp AS CHAR), 500);

  -- tractce
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tractce', LEFT(COALESCE(CAST(tractce AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(tractce AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'tractce', LEFT(COALESCE(CAST(tractce AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(tractce AS CHAR), 500);

  -- tract_geoid
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tract_geoid', LEFT(COALESCE(CAST(tract_geoid AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(tract_geoid AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'tract_geoid', LEFT(COALESCE(CAST(tract_geoid AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(tract_geoid AS CHAR), 500);

  -- in_parcel_list
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'in_parcel_list', LEFT(COALESCE(CAST(in_parcel_list AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(in_parcel_list AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'in_parcel_list', LEFT(COALESCE(CAST(in_parcel_list AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(in_parcel_list AS CHAR), 500);

  -- parcel_list_version
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_list_version', LEFT(COALESCE(CAST(parcel_list_version AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(tmk, 1), LEFT(CAST(parcel_list_version AS CHAR), 500);
  INSERT INTO freq_properties (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_list_version', LEFT(COALESCE(CAST(parcel_list_version AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM properties GROUP BY LEFT(CAST(parcel_list_version AS CHAR), 500);

  -- freq_owners
  TRUNCATE TABLE freq_owners;

  -- tmk
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- owner_name
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_name', LEFT(COALESCE(CAST(owner_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(owner_name AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_name', LEFT(COALESCE(CAST(owner_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(owner_name AS CHAR), 500);

  -- owner_type
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_type', LEFT(COALESCE(CAST(owner_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(owner_type AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_type', LEFT(COALESCE(CAST(owner_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(owner_type AS CHAR), 500);

  -- owner_address
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_address', LEFT(COALESCE(CAST(owner_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(owner_address AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_address', LEFT(COALESCE(CAST(owner_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(owner_address AS CHAR), 500);

  -- mailing_address
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'mailing_address', LEFT(COALESCE(CAST(mailing_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(mailing_address AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'mailing_address', LEFT(COALESCE(CAST(mailing_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(mailing_address AS CHAR), 500);

  -- mailing_city
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'mailing_city', LEFT(COALESCE(CAST(mailing_city AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(mailing_city AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'mailing_city', LEFT(COALESCE(CAST(mailing_city AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(mailing_city AS CHAR), 500);

  -- mailing_state
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'mailing_state', LEFT(COALESCE(CAST(mailing_state AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(mailing_state AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'mailing_state', LEFT(COALESCE(CAST(mailing_state AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(mailing_state AS CHAR), 500);

  -- mailing_zip
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'mailing_zip', LEFT(COALESCE(CAST(mailing_zip AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(mailing_zip AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'mailing_zip', LEFT(COALESCE(CAST(mailing_zip AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(mailing_zip AS CHAR), 500);

  -- mailing_country
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'mailing_country', LEFT(COALESCE(CAST(mailing_country AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(mailing_country AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'mailing_country', LEFT(COALESCE(CAST(mailing_country AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(mailing_country AS CHAR), 500);

  -- sequence_order
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sequence_order', LEFT(COALESCE(CAST(sequence_order AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(tmk, 1), LEFT(CAST(sequence_order AS CHAR), 500);
  INSERT INTO freq_owners (county_code, column_name, column_value, frequency)
  SELECT '0', 'sequence_order', LEFT(COALESCE(CAST(sequence_order AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM owners GROUP BY LEFT(CAST(sequence_order AS CHAR), 500);

  -- freq_parcels
  TRUNCATE TABLE freq_parcels;

  -- parcel_number
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_number', LEFT(COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(parcel_number AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_number', LEFT(COALESCE(CAST(parcel_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(parcel_number AS CHAR), 500);

  -- location_address
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'location_address', LEFT(COALESCE(CAST(location_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(location_address AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'location_address', LEFT(COALESCE(CAST(location_address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(location_address AS CHAR), 500);

  -- address_other
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address_other', LEFT(COALESCE(CAST(address_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(address_other AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'address_other', LEFT(COALESCE(CAST(address_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(address_other AS CHAR), 500);

  -- project_name
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(project_name AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(project_name AS CHAR), 500);

  -- legal_information
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'legal_information', LEFT(COALESCE(CAST(legal_information AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(legal_information AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'legal_information', LEFT(COALESCE(CAST(legal_information AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(legal_information AS CHAR), 500);

  -- property_class
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(property_class AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(property_class AS CHAR), 500);

  -- land_area_sqft
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_sqft', LEFT(COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(land_area_sqft AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_sqft', LEFT(COALESCE(CAST(land_area_sqft AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(land_area_sqft AS CHAR), 500);

  -- land_area_acres
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_area_acres', LEFT(COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(land_area_acres AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_area_acres', LEFT(COALESCE(CAST(land_area_acres AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(land_area_acres AS CHAR), 500);

  -- neighborhood_code
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'neighborhood_code', LEFT(COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(neighborhood_code AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'neighborhood_code', LEFT(COALESCE(CAST(neighborhood_code AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(neighborhood_code AS CHAR), 500);

  -- zoning
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(zoning AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(zoning AS CHAR), 500);

  -- parcel_note
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parcel_note', LEFT(COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(parcel_note AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'parcel_note', LEFT(COALESCE(CAST(parcel_note AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(parcel_note AS CHAR), 500);

  -- damage
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'damage', LEFT(COALESCE(CAST(damage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(damage AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'damage', LEFT(COALESCE(CAST(damage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(damage AS CHAR), 500);

  -- reentry_zone
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reentry_zone', LEFT(COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(reentry_zone AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'reentry_zone', LEFT(COALESCE(CAST(reentry_zone AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(reentry_zone AS CHAR), 500);

  -- zone_color
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zone_color', LEFT(COALESCE(CAST(zone_color AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(zone_color AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'zone_color', LEFT(COALESCE(CAST(zone_color AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(zone_color AS CHAR), 500);

  -- non_taxable_status
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'non_taxable_status', LEFT(COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(non_taxable_status AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'non_taxable_status', LEFT(COALESCE(CAST(non_taxable_status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(non_taxable_status AS CHAR), 500);

  -- living_units
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_units', LEFT(COALESCE(CAST(living_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(tmk, 1), LEFT(CAST(living_units AS CHAR), 500);
  INSERT INTO freq_parcels (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_units', LEFT(COALESCE(CAST(living_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM parcels GROUP BY LEFT(CAST(living_units AS CHAR), 500);

  -- freq_assessments
  TRUNCATE TABLE freq_assessments;

  -- tmk
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- tax_year
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_year AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(tax_year AS CHAR), 500);

  -- property_class
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(property_class AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(property_class AS CHAR), 500);

  -- assessed_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_land_value', LEFT(COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(assessed_land_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_land_value', LEFT(COALESCE(CAST(assessed_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(assessed_land_value AS CHAR), 500);

  -- assessed_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'assessed_building_value', LEFT(COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(assessed_building_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'assessed_building_value', LEFT(COALESCE(CAST(assessed_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(assessed_building_value AS CHAR), 500);

  -- dedicated_use_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dedicated_use_value', LEFT(COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(dedicated_use_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'dedicated_use_value', LEFT(COALESCE(CAST(dedicated_use_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(dedicated_use_value AS CHAR), 500);

  -- land_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_exemption', LEFT(COALESCE(CAST(land_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(land_exemption AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_exemption', LEFT(COALESCE(CAST(land_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(land_exemption AS CHAR), 500);

  -- building_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_exemption', LEFT(COALESCE(CAST(building_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(building_exemption AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_exemption', LEFT(COALESCE(CAST(building_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(building_exemption AS CHAR), 500);

  -- net_taxable_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_land_value', LEFT(COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(net_taxable_land_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_land_value', LEFT(COALESCE(CAST(net_taxable_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(net_taxable_land_value AS CHAR), 500);

  -- net_taxable_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_taxable_building_value', LEFT(COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(net_taxable_building_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_taxable_building_value', LEFT(COALESCE(CAST(net_taxable_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(net_taxable_building_value AS CHAR), 500);

  -- total_property_assessed_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_assessed_value', LEFT(COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(total_property_assessed_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_assessed_value', LEFT(COALESCE(CAST(total_property_assessed_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(total_property_assessed_value AS CHAR), 500);

  -- total_property_exemption
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_property_exemption', LEFT(COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(total_property_exemption AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_property_exemption', LEFT(COALESCE(CAST(total_property_exemption AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(total_property_exemption AS CHAR), 500);

  -- total_net_taxable_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_net_taxable_value', LEFT(COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(total_net_taxable_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_net_taxable_value', LEFT(COALESCE(CAST(total_net_taxable_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(total_net_taxable_value AS CHAR), 500);

  -- agricultural_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_land_value', LEFT(COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(agricultural_land_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_land_value', LEFT(COALESCE(CAST(agricultural_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(agricultural_land_value AS CHAR), 500);

  -- market_land_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_land_value', LEFT(COALESCE(CAST(market_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(market_land_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_land_value', LEFT(COALESCE(CAST(market_land_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(market_land_value AS CHAR), 500);

  -- market_building_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'market_building_value', LEFT(COALESCE(CAST(market_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(market_building_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'market_building_value', LEFT(COALESCE(CAST(market_building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(market_building_value AS CHAR), 500);

  -- total_market_value
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_market_value', LEFT(COALESCE(CAST(total_market_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(total_market_value AS CHAR), 500);
  INSERT INTO freq_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_market_value', LEFT(COALESCE(CAST(total_market_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM assessments GROUP BY LEFT(CAST(total_market_value AS CHAR), 500);

  -- freq_land_classifications
  TRUNCATE TABLE freq_land_classifications;

  -- tmk
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- land_classification
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_classification', LEFT(COALESCE(CAST(land_classification AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), LEFT(CAST(land_classification AS CHAR), 500);
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_classification', LEFT(COALESCE(CAST(land_classification AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(CAST(land_classification AS CHAR), 500);

  -- square_footage
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'square_footage', LEFT(COALESCE(CAST(square_footage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), LEFT(CAST(square_footage AS CHAR), 500);
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'square_footage', LEFT(COALESCE(CAST(square_footage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(CAST(square_footage AS CHAR), 500);

  -- acreage
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acreage', LEFT(COALESCE(CAST(acreage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), LEFT(CAST(acreage AS CHAR), 500);
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'acreage', LEFT(COALESCE(CAST(acreage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(CAST(acreage AS CHAR), 500);

  -- agricultural_use_indicator
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_use_indicator', LEFT(COALESCE(CAST(agricultural_use_indicator AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(tmk, 1), LEFT(CAST(agricultural_use_indicator AS CHAR), 500);
  INSERT INTO freq_land_classifications (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_use_indicator', LEFT(COALESCE(CAST(agricultural_use_indicator AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM land_classifications GROUP BY LEFT(CAST(agricultural_use_indicator AS CHAR), 500);

  -- freq_residential_improvements
  TRUNCATE TABLE freq_residential_improvements;

  -- tmk
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- building_number
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_number AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(building_number AS CHAR), 500);

  -- year_built
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(year_built AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(year_built AS CHAR), 500);

  -- eff_year_built
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'eff_year_built', LEFT(COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(eff_year_built AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'eff_year_built', LEFT(COALESCE(CAST(eff_year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(eff_year_built AS CHAR), 500);

  -- living_area
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'living_area', LEFT(COALESCE(CAST(living_area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(living_area AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'living_area', LEFT(COALESCE(CAST(living_area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(living_area AS CHAR), 500);

  -- bedrooms
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'bedrooms', LEFT(COALESCE(CAST(bedrooms AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(bedrooms AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'bedrooms', LEFT(COALESCE(CAST(bedrooms AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(bedrooms AS CHAR), 500);

  -- full_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'full_bath', LEFT(COALESCE(CAST(full_bath AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(full_bath AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'full_bath', LEFT(COALESCE(CAST(full_bath AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(full_bath AS CHAR), 500);

  -- half_bath
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'half_bath', LEFT(COALESCE(CAST(half_bath AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(half_bath AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'half_bath', LEFT(COALESCE(CAST(half_bath AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(half_bath AS CHAR), 500);

  -- occupancy
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'occupancy', LEFT(COALESCE(CAST(occupancy AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(occupancy AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'occupancy', LEFT(COALESCE(CAST(occupancy AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(occupancy AS CHAR), 500);

  -- framing
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'framing', LEFT(COALESCE(CAST(framing AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(framing AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'framing', LEFT(COALESCE(CAST(framing AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(framing AS CHAR), 500);

  -- percent_complete
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(percent_complete AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(percent_complete AS CHAR), 500);

  -- heating_cooling
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'heating_cooling', LEFT(COALESCE(CAST(heating_cooling AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(heating_cooling AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'heating_cooling', LEFT(COALESCE(CAST(heating_cooling AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(heating_cooling AS CHAR), 500);

  -- exterior_wall
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', LEFT(COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(exterior_wall AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', LEFT(COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(exterior_wall AS CHAR), 500);

  -- roof_material
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'roof_material', LEFT(COALESCE(CAST(roof_material AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(roof_material AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'roof_material', LEFT(COALESCE(CAST(roof_material AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(roof_material AS CHAR), 500);

  -- fireplace
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'fireplace', LEFT(COALESCE(CAST(fireplace AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(fireplace AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'fireplace', LEFT(COALESCE(CAST(fireplace AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(fireplace AS CHAR), 500);

  -- grade
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'grade', LEFT(COALESCE(CAST(grade AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(grade AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'grade', LEFT(COALESCE(CAST(grade AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(grade AS CHAR), 500);

  -- building_value
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_value', LEFT(COALESCE(CAST(building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_value AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_value', LEFT(COALESCE(CAST(building_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(building_value AS CHAR), 500);

  -- total_room_count
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'total_room_count', LEFT(COALESCE(CAST(total_room_count AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(total_room_count AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'total_room_count', LEFT(COALESCE(CAST(total_room_count AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(total_room_count AS CHAR), 500);

  -- condo_style
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', LEFT(COALESCE(CAST(condo_style AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_style AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', LEFT(COALESCE(CAST(condo_style AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(condo_style AS CHAR), 500);

  -- condo_type
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_type', LEFT(COALESCE(CAST(condo_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_type AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_type', LEFT(COALESCE(CAST(condo_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(condo_type AS CHAR), 500);

  -- condo_view
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_view', LEFT(COALESCE(CAST(condo_view AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_view AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_view', LEFT(COALESCE(CAST(condo_view AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(condo_view AS CHAR), 500);

  -- floor_level
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', LEFT(COALESCE(CAST(floor_level AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(floor_level AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', LEFT(COALESCE(CAST(floor_level AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(floor_level AS CHAR), 500);

  -- parking_spaces
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking_spaces', LEFT(COALESCE(CAST(parking_spaces AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(parking_spaces AS CHAR), 500);
  INSERT INTO freq_residential_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking_spaces', LEFT(COALESCE(CAST(parking_spaces AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_improvements GROUP BY LEFT(CAST(parking_spaces AS CHAR), 500);

  -- freq_residential_additions
  TRUNCATE TABLE freq_residential_additions;

  -- tmk
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- card
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', LEFT(COALESCE(CAST(card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(card AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', LEFT(COALESCE(CAST(card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(card AS CHAR), 500);

  -- line
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'line', LEFT(COALESCE(CAST(line AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(line AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'line', LEFT(COALESCE(CAST(line AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(line AS CHAR), 500);

  -- lower
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'lower', LEFT(COALESCE(CAST(lower AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(lower AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'lower', LEFT(COALESCE(CAST(lower AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(lower AS CHAR), 500);

  -- first
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'first', LEFT(COALESCE(CAST(first AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(first AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'first', LEFT(COALESCE(CAST(first AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(first AS CHAR), 500);

  -- second
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'second', LEFT(COALESCE(CAST(second AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(second AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'second', LEFT(COALESCE(CAST(second AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(second AS CHAR), 500);

  -- third
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'third', LEFT(COALESCE(CAST(third AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(third AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'third', LEFT(COALESCE(CAST(third AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(third AS CHAR), 500);

  -- area
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(tmk, 1), LEFT(CAST(area AS CHAR), 500);
  INSERT INTO freq_residential_additions (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM residential_additions GROUP BY LEFT(CAST(area AS CHAR), 500);

  -- freq_commercial_improvements
  TRUNCATE TABLE freq_commercial_improvements;

  -- tmk
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- building_number
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_number AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(building_number AS CHAR), 500);

  -- building_card
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_card', LEFT(COALESCE(CAST(building_card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_card AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_card', LEFT(COALESCE(CAST(building_card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(building_card AS CHAR), 500);

  -- year_built
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(year_built AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(year_built AS CHAR), 500);

  -- effective_year_built
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_year_built', LEFT(COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(effective_year_built AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_year_built', LEFT(COALESCE(CAST(effective_year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(effective_year_built AS CHAR), 500);

  -- improvement_name
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'improvement_name', LEFT(COALESCE(CAST(improvement_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(improvement_name AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'improvement_name', LEFT(COALESCE(CAST(improvement_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(improvement_name AS CHAR), 500);

  -- property_class
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(property_class AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'property_class', LEFT(COALESCE(CAST(property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(property_class AS CHAR), 500);

  -- structure_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure_type', LEFT(COALESCE(CAST(structure_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(structure_type AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure_type', LEFT(COALESCE(CAST(structure_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(structure_type AS CHAR), 500);

  -- units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'units', LEFT(COALESCE(CAST(units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(units AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'units', LEFT(COALESCE(CAST(units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(units AS CHAR), 500);

  -- identical_units
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'identical_units', LEFT(COALESCE(CAST(identical_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(identical_units AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'identical_units', LEFT(COALESCE(CAST(identical_units AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(identical_units AS CHAR), 500);

  -- gross_building_description
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'gross_building_description', LEFT(COALESCE(CAST(gross_building_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(gross_building_description AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'gross_building_description', LEFT(COALESCE(CAST(gross_building_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(gross_building_description AS CHAR), 500);

  -- building_square_footage
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_square_footage', LEFT(COALESCE(CAST(building_square_footage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_square_footage AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_square_footage', LEFT(COALESCE(CAST(building_square_footage AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(building_square_footage AS CHAR), 500);

  -- building_type
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_type', LEFT(COALESCE(CAST(building_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_type AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_type', LEFT(COALESCE(CAST(building_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(building_type AS CHAR), 500);

  -- percent_complete
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(percent_complete AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(percent_complete AS CHAR), 500);

  -- structure
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'structure', LEFT(COALESCE(CAST(structure AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(structure AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'structure', LEFT(COALESCE(CAST(structure AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(structure AS CHAR), 500);

  -- value
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value', LEFT(COALESCE(CAST(`value` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(`value` AS CHAR), 500);
  INSERT INTO freq_commercial_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'value', LEFT(COALESCE(CAST(`value` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvements GROUP BY LEFT(CAST(`value` AS CHAR), 500);

  -- freq_commercial_improvement_details
  TRUNCATE TABLE freq_commercial_improvement_details;

  -- tmk
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- card
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'card', LEFT(COALESCE(CAST(card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(card AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'card', LEFT(COALESCE(CAST(card AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(card AS CHAR), 500);

  -- section
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'section', LEFT(COALESCE(CAST(section AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(section AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'section', LEFT(COALESCE(CAST(section AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(section AS CHAR), 500);

  -- floor
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor', LEFT(COALESCE(CAST(floor AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(floor AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor', LEFT(COALESCE(CAST(floor AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(floor AS CHAR), 500);

  -- usage
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'usage', LEFT(COALESCE(CAST(`usage` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`usage` AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'usage', LEFT(COALESCE(CAST(`usage` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(`usage` AS CHAR), 500);

  -- area
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(area AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(area AS CHAR), 500);

  -- perimeter
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'perimeter', LEFT(COALESCE(CAST(perimeter AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(perimeter AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'perimeter', LEFT(COALESCE(CAST(perimeter AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(perimeter AS CHAR), 500);

  -- exterior_wall
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'exterior_wall', LEFT(COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(exterior_wall AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'exterior_wall', LEFT(COALESCE(CAST(exterior_wall AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(exterior_wall AS CHAR), 500);

  -- wall_height
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'wall_height', LEFT(COALESCE(CAST(wall_height AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(wall_height AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'wall_height', LEFT(COALESCE(CAST(wall_height AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(wall_height AS CHAR), 500);

  -- construction
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'construction', LEFT(COALESCE(CAST(construction AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(construction AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'construction', LEFT(COALESCE(CAST(construction AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(construction AS CHAR), 500);

  -- rank
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'rank', LEFT(COALESCE(CAST(`rank` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`rank` AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'rank', LEFT(COALESCE(CAST(`rank` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(`rank` AS CHAR), 500);

  -- condo_style
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_style', LEFT(COALESCE(CAST(condo_style AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_style AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_style', LEFT(COALESCE(CAST(condo_style AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(condo_style AS CHAR), 500);

  -- condo_type
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_type', LEFT(COALESCE(CAST(condo_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_type AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_type', LEFT(COALESCE(CAST(condo_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(condo_type AS CHAR), 500);

  -- condo_unit
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'condo_unit', LEFT(COALESCE(CAST(condo_unit AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(condo_unit AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'condo_unit', LEFT(COALESCE(CAST(condo_unit AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(condo_unit AS CHAR), 500);

  -- floor_level
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floor_level', LEFT(COALESCE(CAST(floor_level AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(floor_level AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'floor_level', LEFT(COALESCE(CAST(floor_level AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(floor_level AS CHAR), 500);

  -- view
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'view', LEFT(COALESCE(CAST(`view` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`view` AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'view', LEFT(COALESCE(CAST(`view` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(`view` AS CHAR), 500);

  -- project
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project', LEFT(COALESCE(CAST(project AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(project AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'project', LEFT(COALESCE(CAST(project AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(project AS CHAR), 500);

  -- description
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`description` AS CHAR), 500);
  INSERT INTO freq_commercial_improvement_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM commercial_improvement_details GROUP BY LEFT(CAST(`description` AS CHAR), 500);

  -- freq_accessory_improvements
  TRUNCATE TABLE freq_accessory_improvements;

  -- tmk
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- building_number
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(building_number AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'building_number', LEFT(COALESCE(CAST(building_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(building_number AS CHAR), 500);

  -- description
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(`description` AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(`description` AS CHAR), 500);

  -- dimensions
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dimensions', LEFT(COALESCE(CAST(dimensions AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(dimensions AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'dimensions', LEFT(COALESCE(CAST(dimensions AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(dimensions AS CHAR), 500);

  -- quantity
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'quantity', LEFT(COALESCE(CAST(quantity AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(quantity AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'quantity', LEFT(COALESCE(CAST(quantity AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(quantity AS CHAR), 500);

  -- year_built
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(year_built AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'year_built', LEFT(COALESCE(CAST(year_built AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(year_built AS CHAR), 500);

  -- area
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(area AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'area', LEFT(COALESCE(CAST(area AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(area AS CHAR), 500);

  -- percent_complete
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(percent_complete AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'percent_complete', LEFT(COALESCE(CAST(percent_complete AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(percent_complete AS CHAR), 500);

  -- value
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'value', LEFT(COALESCE(CAST(`value` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(tmk, 1), LEFT(CAST(`value` AS CHAR), 500);
  INSERT INTO freq_accessory_improvements (county_code, column_name, column_value, frequency)
  SELECT '0', 'value', LEFT(COALESCE(CAST(`value` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM accessory_improvements GROUP BY LEFT(CAST(`value` AS CHAR), 500);

  -- freq_permits
  TRUNCATE TABLE freq_permits;

  -- tmk
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- permit_date
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_date', LEFT(COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(permit_date) AS CHAR), 500);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_date', LEFT(COALESCE(CAST(YEAR(permit_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(CAST(YEAR(permit_date) AS CHAR), 500);

  -- permit_number
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_number', LEFT(COALESCE(CAST(permit_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), LEFT(CAST(permit_number AS CHAR), 500);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_number', LEFT(COALESCE(CAST(permit_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(CAST(permit_number AS CHAR), 500);

  -- reason
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'reason', LEFT(COALESCE(CAST(reason AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), LEFT(CAST(reason AS CHAR), 500);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'reason', LEFT(COALESCE(CAST(reason AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(CAST(reason AS CHAR), 500);

  -- permit_amount
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'permit_amount', LEFT(COALESCE(CAST(permit_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(tmk, 1), LEFT(CAST(permit_amount AS CHAR), 500);
  INSERT INTO freq_permits (county_code, column_name, column_value, frequency)
  SELECT '0', 'permit_amount', LEFT(COALESCE(CAST(permit_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM permits GROUP BY LEFT(CAST(permit_amount AS CHAR), 500);

  -- freq_sales
  TRUNCATE TABLE freq_sales;

  -- tmk
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- sale_date
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_date', LEFT(COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(sale_date) AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_date', LEFT(COALESCE(CAST(YEAR(sale_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(YEAR(sale_date) AS CHAR), 500);

  -- sale_amount
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'sale_amount', LEFT(COALESCE(CAST(sale_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(sale_amount AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'sale_amount', LEFT(COALESCE(CAST(sale_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(sale_amount AS CHAR), 500);

  -- instrument
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument', LEFT(COALESCE(CAST(instrument AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(instrument AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument', LEFT(COALESCE(CAST(instrument AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(instrument AS CHAR), 500);

  -- instrument_type
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_type', LEFT(COALESCE(CAST(instrument_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(instrument_type AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_type', LEFT(COALESCE(CAST(instrument_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(instrument_type AS CHAR), 500);

  -- instrument_description
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'instrument_description', LEFT(COALESCE(CAST(instrument_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(instrument_description AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'instrument_description', LEFT(COALESCE(CAST(instrument_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(instrument_description AS CHAR), 500);

  -- valid_sale
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'valid_sale', LEFT(COALESCE(CAST(valid_sale AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(valid_sale AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'valid_sale', LEFT(COALESCE(CAST(valid_sale AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(valid_sale AS CHAR), 500);

  -- date_of_recording
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_of_recording', LEFT(COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(date_of_recording) AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_of_recording', LEFT(COALESCE(CAST(YEAR(date_of_recording) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(YEAR(date_of_recording) AS CHAR), 500);

  -- land_court_document_number
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_court_document_number', LEFT(COALESCE(CAST(land_court_document_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(land_court_document_number AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_court_document_number', LEFT(COALESCE(CAST(land_court_document_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(land_court_document_number AS CHAR), 500);

  -- cert
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'cert', LEFT(COALESCE(CAST(cert AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(cert AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'cert', LEFT(COALESCE(CAST(cert AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(cert AS CHAR), 500);

  -- book_page
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'book_page', LEFT(COALESCE(CAST(book_page AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(book_page AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'book_page', LEFT(COALESCE(CAST(book_page AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(book_page AS CHAR), 500);

  -- conveyance_tax
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'conveyance_tax', LEFT(COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(tmk, 1), LEFT(CAST(conveyance_tax AS CHAR), 500);
  INSERT INTO freq_sales (county_code, column_name, column_value, frequency)
  SELECT '0', 'conveyance_tax', LEFT(COALESCE(CAST(conveyance_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM sales GROUP BY LEFT(CAST(conveyance_tax AS CHAR), 500);

  -- freq_current_tax_bills
  TRUNCATE TABLE freq_current_tax_bills;

  -- tmk
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- tax_period
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', LEFT(COALESCE(CAST(tax_period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_period AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', LEFT(COALESCE(CAST(tax_period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(tax_period AS CHAR), 500);

  -- description
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(`description` AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(`description` AS CHAR), 500);

  -- original_due_date
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'original_due_date', LEFT(COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(original_due_date) AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'original_due_date', LEFT(COALESCE(CAST(YEAR(original_due_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(YEAR(original_due_date) AS CHAR), 500);

  -- taxes_assessment
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'taxes_assessment', LEFT(COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(taxes_assessment AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'taxes_assessment', LEFT(COALESCE(CAST(taxes_assessment AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(taxes_assessment AS CHAR), 500);

  -- tax_credits
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_credits', LEFT(COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_credits AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_credits', LEFT(COALESCE(CAST(tax_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(tax_credits AS CHAR), 500);

  -- net_tax
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'net_tax', LEFT(COALESCE(CAST(net_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(net_tax AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'net_tax', LEFT(COALESCE(CAST(net_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(net_tax AS CHAR), 500);

  -- penalty
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(penalty AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(penalty AS CHAR), 500);

  -- interest
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(interest AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(interest AS CHAR), 500);

  -- other
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(`other` AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(`other` AS CHAR), 500);

  -- amount_due
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due', LEFT(COALESCE(CAST(amount_due AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(tmk, 1), LEFT(CAST(amount_due AS CHAR), 500);
  INSERT INTO freq_current_tax_bills (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due', LEFT(COALESCE(CAST(amount_due AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM current_tax_bills GROUP BY LEFT(CAST(amount_due AS CHAR), 500);

  -- freq_historical_tax_summary
  TRUNCATE TABLE freq_historical_tax_summary;

  -- tmk
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- year
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', LEFT(COALESCE(CAST(`year` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(`year` AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', LEFT(COALESCE(CAST(`year` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(`year` AS CHAR), 500);

  -- tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax AS CHAR), 500);

  -- payments_and_credits
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_and_credits', LEFT(COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(payments_and_credits AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_and_credits', LEFT(COALESCE(CAST(payments_and_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(payments_and_credits AS CHAR), 500);

  -- penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(penalty AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(penalty AS CHAR), 500);

  -- interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(interest AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(interest AS CHAR), 500);

  -- other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(`other` AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(`other` AS CHAR), 500);

  -- amount_due
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount_due', LEFT(COALESCE(CAST(amount_due AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(amount_due AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount_due', LEFT(COALESCE(CAST(amount_due AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(amount_due AS CHAR), 500);

  -- tax_details_total_tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_tax', LEFT(COALESCE(CAST(tax_details_total_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_details_total_tax AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_tax', LEFT(COALESCE(CAST(tax_details_total_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_details_total_tax AS CHAR), 500);

  -- tax_details_total_payments_credits
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_payments_credits', LEFT(COALESCE(CAST(tax_details_total_payments_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_details_total_payments_credits AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_payments_credits', LEFT(COALESCE(CAST(tax_details_total_payments_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_details_total_payments_credits AS CHAR), 500);

  -- tax_details_total_penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_penalty', LEFT(COALESCE(CAST(tax_details_total_penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_details_total_penalty AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_penalty', LEFT(COALESCE(CAST(tax_details_total_penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_details_total_penalty AS CHAR), 500);

  -- tax_details_total_interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_interest', LEFT(COALESCE(CAST(tax_details_total_interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_details_total_interest AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_interest', LEFT(COALESCE(CAST(tax_details_total_interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_details_total_interest AS CHAR), 500);

  -- tax_details_total_other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_details_total_other', LEFT(COALESCE(CAST(tax_details_total_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_details_total_other AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_details_total_other', LEFT(COALESCE(CAST(tax_details_total_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_details_total_other AS CHAR), 500);

  -- tax_payments_total_tax
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_tax', LEFT(COALESCE(CAST(tax_payments_total_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payments_total_tax AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_tax', LEFT(COALESCE(CAST(tax_payments_total_tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_payments_total_tax AS CHAR), 500);

  -- tax_payments_total_penalty
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_penalty', LEFT(COALESCE(CAST(tax_payments_total_penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payments_total_penalty AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_penalty', LEFT(COALESCE(CAST(tax_payments_total_penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_payments_total_penalty AS CHAR), 500);

  -- tax_payments_total_interest
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_interest', LEFT(COALESCE(CAST(tax_payments_total_interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payments_total_interest AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_interest', LEFT(COALESCE(CAST(tax_payments_total_interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_payments_total_interest AS CHAR), 500);

  -- tax_payments_total_other
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payments_total_other', LEFT(COALESCE(CAST(tax_payments_total_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payments_total_other AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payments_total_other', LEFT(COALESCE(CAST(tax_payments_total_other AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_payments_total_other AS CHAR), 500);

  -- tax_credits_total_amount
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_credits_total_amount', LEFT(COALESCE(CAST(tax_credits_total_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_credits_total_amount AS CHAR), 500);
  INSERT INTO freq_historical_tax_summary (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_credits_total_amount', LEFT(COALESCE(CAST(tax_credits_total_amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_summary GROUP BY LEFT(CAST(tax_credits_total_amount AS CHAR), 500);

  -- freq_historical_tax_details
  TRUNCATE TABLE freq_historical_tax_details;

  -- tmk
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- tax_period
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_period', LEFT(COALESCE(CAST(tax_period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_period AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_period', LEFT(COALESCE(CAST(tax_period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(tax_period AS CHAR), 500);

  -- description
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`description` AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(`description` AS CHAR), 500);

  -- tax
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(tax AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(tax AS CHAR), 500);

  -- payments_credits
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payments_credits', LEFT(COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(payments_credits AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'payments_credits', LEFT(COALESCE(CAST(payments_credits AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(payments_credits AS CHAR), 500);

  -- penalty
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(penalty AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(penalty AS CHAR), 500);

  -- interest
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(interest AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(interest AS CHAR), 500);

  -- other
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(tmk, 1), LEFT(CAST(`other` AS CHAR), 500);
  INSERT INTO freq_historical_tax_details (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_details GROUP BY LEFT(CAST(`other` AS CHAR), 500);

  -- freq_historical_tax_payments
  TRUNCATE TABLE freq_historical_tax_payments;

  -- tmk
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- payment_sequence
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'payment_sequence', LEFT(COALESCE(CAST(payment_sequence AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(payment_sequence AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'payment_sequence', LEFT(COALESCE(CAST(payment_sequence AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(payment_sequence AS CHAR), 500);

  -- effective_date
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'effective_date', LEFT(COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(effective_date) AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'effective_date', LEFT(COALESCE(CAST(YEAR(effective_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(YEAR(effective_date) AS CHAR), 500);

  -- tax
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(tax AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax', LEFT(COALESCE(CAST(tax AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(tax AS CHAR), 500);

  -- penalty
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(penalty AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'penalty', LEFT(COALESCE(CAST(penalty AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(penalty AS CHAR), 500);

  -- interest
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(interest AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'interest', LEFT(COALESCE(CAST(interest AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(interest AS CHAR), 500);

  -- other
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(tmk, 1), LEFT(CAST(`other` AS CHAR), 500);
  INSERT INTO freq_historical_tax_payments (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_payments GROUP BY LEFT(CAST(`other` AS CHAR), 500);

  -- freq_historical_tax_credits
  TRUNCATE TABLE freq_historical_tax_credits;

  -- tmk
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- period
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'period', LEFT(COALESCE(CAST(period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), LEFT(CAST(period AS CHAR), 500);
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'period', LEFT(COALESCE(CAST(period AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(CAST(period AS CHAR), 500);

  -- description
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), LEFT(CAST(`description` AS CHAR), 500);
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'description', LEFT(COALESCE(CAST(`description` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(CAST(`description` AS CHAR), 500);

  -- amount
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'amount', LEFT(COALESCE(CAST(amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(tmk, 1), LEFT(CAST(amount AS CHAR), 500);
  INSERT INTO freq_historical_tax_credits (county_code, column_name, column_value, frequency)
  SELECT '0', 'amount', LEFT(COALESCE(CAST(amount AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM historical_tax_credits GROUP BY LEFT(CAST(amount AS CHAR), 500);

  -- freq_appeals
  TRUNCATE TABLE freq_appeals;

  -- tmk
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- year
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'year', LEFT(COALESCE(CAST(`year` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(`year` AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'year', LEFT(COALESCE(CAST(`year` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(`year` AS CHAR), 500);

  -- appeal_type_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'appeal_type_value', LEFT(COALESCE(CAST(appeal_type_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(appeal_type_value AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'appeal_type_value', LEFT(COALESCE(CAST(appeal_type_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(appeal_type_value AS CHAR), 500);

  -- scheduled_hearing_date_subject_to_change
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'scheduled_hearing_date_subject_to_change', LEFT(COALESCE(CAST(scheduled_hearing_date_subject_to_change AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(scheduled_hearing_date_subject_to_change AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'scheduled_hearing_date_subject_to_change', LEFT(COALESCE(CAST(scheduled_hearing_date_subject_to_change AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(scheduled_hearing_date_subject_to_change AS CHAR), 500);

  -- status
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'status', LEFT(COALESCE(CAST(status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(status AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'status', LEFT(COALESCE(CAST(status AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(status AS CHAR), 500);

  -- date_settled
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'date_settled', LEFT(COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(date_settled) AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'date_settled', LEFT(COALESCE(CAST(YEAR(date_settled) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(YEAR(date_settled) AS CHAR), 500);

  -- final_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_value', LEFT(COALESCE(CAST(final_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(final_value AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_value', LEFT(COALESCE(CAST(final_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(final_value AS CHAR), 500);

  -- tax_payer_opinion_of_value
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_value', LEFT(COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payer_opinion_of_value AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_value', LEFT(COALESCE(CAST(tax_payer_opinion_of_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(tax_payer_opinion_of_value AS CHAR), 500);

  -- tax_payer_opinion_of_property_class
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_property_class', LEFT(COALESCE(CAST(tax_payer_opinion_of_property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payer_opinion_of_property_class AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_property_class', LEFT(COALESCE(CAST(tax_payer_opinion_of_property_class AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(tax_payer_opinion_of_property_class AS CHAR), 500);

  -- tax_payer_opinion_of_exemptions
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_payer_opinion_of_exemptions', LEFT(COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_payer_opinion_of_exemptions AS CHAR), 500);
  INSERT INTO freq_appeals (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_payer_opinion_of_exemptions', LEFT(COALESCE(CAST(tax_payer_opinion_of_exemptions AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM appeals GROUP BY LEFT(CAST(tax_payer_opinion_of_exemptions AS CHAR), 500);

  -- freq_agricultural_assessments
  TRUNCATE TABLE freq_agricultural_assessments;

  -- tmk
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- acres_in_production
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'acres_in_production', LEFT(COALESCE(CAST(acres_in_production AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(acres_in_production AS CHAR), 500);
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'acres_in_production', LEFT(COALESCE(CAST(acres_in_production AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(CAST(acres_in_production AS CHAR), 500);

  -- agricultural_type
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_type', LEFT(COALESCE(CAST(agricultural_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(agricultural_type AS CHAR), 500);
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_type', LEFT(COALESCE(CAST(agricultural_type AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(CAST(agricultural_type AS CHAR), 500);

  -- agricultural_value
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural_value', LEFT(COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(agricultural_value AS CHAR), 500);
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural_value', LEFT(COALESCE(CAST(agricultural_value AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(CAST(agricultural_value AS CHAR), 500);

  -- use_description
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'use_description', LEFT(COALESCE(CAST(use_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(tmk, 1), LEFT(CAST(use_description AS CHAR), 500);
  INSERT INTO freq_agricultural_assessments (county_code, column_name, column_value, frequency)
  SELECT '0', 'use_description', LEFT(COALESCE(CAST(use_description AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM agricultural_assessments GROUP BY LEFT(CAST(use_description AS CHAR), 500);

  -- freq_dedications
  TRUNCATE TABLE freq_dedications;

  -- tmk
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- tax_year
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_year AS CHAR), 500);
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(CAST(tax_year AS CHAR), 500);

  -- number_of_dedications
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'number_of_dedications', LEFT(COALESCE(CAST(number_of_dedications AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(tmk, 1), LEFT(CAST(number_of_dedications AS CHAR), 500);
  INSERT INTO freq_dedications (county_code, column_name, column_value, frequency)
  SELECT '0', 'number_of_dedications', LEFT(COALESCE(CAST(number_of_dedications AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM dedications GROUP BY LEFT(CAST(number_of_dedications AS CHAR), 500);

  -- freq_home_exemptions
  TRUNCATE TABLE freq_home_exemptions;

  -- tmk
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- claimant_name
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'claimant_name', LEFT(COALESCE(CAST(claimant_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(tmk, 1), LEFT(CAST(claimant_name AS CHAR), 500);
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT '0', 'claimant_name', LEFT(COALESCE(CAST(claimant_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(CAST(claimant_name AS CHAR), 500);

  -- tax_year
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(tmk, 1), LEFT(CAST(tax_year AS CHAR), 500);
  INSERT INTO freq_home_exemptions (county_code, column_name, column_value, frequency)
  SELECT '0', 'tax_year', LEFT(COALESCE(CAST(tax_year AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM home_exemptions GROUP BY LEFT(CAST(tax_year AS CHAR), 500);

  -- freq_condominium_projects
  TRUNCATE TABLE freq_condominium_projects;

  -- tmk
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- project_name
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(project_name AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_name', LEFT(COALESCE(CAST(project_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(project_name AS CHAR), 500);

  -- unit_count
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_count', LEFT(COALESCE(CAST(unit_count AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(unit_count AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_count', LEFT(COALESCE(CAST(unit_count AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(unit_count AS CHAR), 500);

  -- dcca_link
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'dcca_link', LEFT(COALESCE(CAST(dcca_link AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(dcca_link AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'dcca_link', LEFT(COALESCE(CAST(dcca_link AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(dcca_link AS CHAR), 500);

  -- zoning
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(zoning AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'zoning', LEFT(COALESCE(CAST(zoning AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(zoning AS CHAR), 500);

  -- address
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'address', LEFT(COALESCE(CAST(address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(address AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'address', LEFT(COALESCE(CAST(address AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(address AS CHAR), 500);

  -- city
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'city', LEFT(COALESCE(CAST(city AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(city AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'city', LEFT(COALESCE(CAST(city AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(city AS CHAR), 500);

  -- developer
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'developer', LEFT(COALESCE(CAST(developer AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(developer AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'developer', LEFT(COALESCE(CAST(developer AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(developer AS CHAR), 500);

  -- project_number
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'project_number', LEFT(COALESCE(CAST(project_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(project_number AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'project_number', LEFT(COALESCE(CAST(project_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(project_number AS CHAR), 500);

  -- commercial
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'commercial', LEFT(COALESCE(CAST(commercial AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(commercial AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'commercial', LEFT(COALESCE(CAST(commercial AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(commercial AS CHAR), 500);

  -- tool_sheds
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tool_sheds', LEFT(COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(tool_sheds AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'tool_sheds', LEFT(COALESCE(CAST(tool_sheds AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(tool_sheds AS CHAR), 500);

  -- ohana
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'ohana', LEFT(COALESCE(CAST(ohana AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(ohana AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'ohana', LEFT(COALESCE(CAST(ohana AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(ohana AS CHAR), 500);

  -- residential
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'residential', LEFT(COALESCE(CAST(residential AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(residential AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'residential', LEFT(COALESCE(CAST(residential AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(residential AS CHAR), 500);

  -- parking
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parking', LEFT(COALESCE(CAST(parking AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(parking AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'parking', LEFT(COALESCE(CAST(parking AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(parking AS CHAR), 500);

  -- converted
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'converted', LEFT(COALESCE(CAST(converted AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(converted AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'converted', LEFT(COALESCE(CAST(converted AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(converted AS CHAR), 500);

  -- agricultural
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'agricultural', LEFT(COALESCE(CAST(agricultural AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(agricultural AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'agricultural', LEFT(COALESCE(CAST(agricultural AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(agricultural AS CHAR), 500);

  -- other
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(`other` AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'other', LEFT(COALESCE(CAST(`other` AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(`other` AS CHAR), 500);

  -- buildings
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'buildings', LEFT(COALESCE(CAST(buildings AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(buildings AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'buildings', LEFT(COALESCE(CAST(buildings AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(buildings AS CHAR), 500);

  -- floors
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'floors', LEFT(COALESCE(CAST(floors AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(floors AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'floors', LEFT(COALESCE(CAST(floors AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(floors AS CHAR), 500);

  -- land_ownership
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'land_ownership', LEFT(COALESCE(CAST(land_ownership AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(land_ownership AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'land_ownership', LEFT(COALESCE(CAST(land_ownership AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(land_ownership AS CHAR), 500);

  -- preliminary_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'preliminary_date', LEFT(COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(preliminary_date) AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'preliminary_date', LEFT(COALESCE(CAST(YEAR(preliminary_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(YEAR(preliminary_date) AS CHAR), 500);

  -- contingent_final_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'contingent_final_date', LEFT(COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(contingent_final_date) AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'contingent_final_date', LEFT(COALESCE(CAST(YEAR(contingent_final_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(YEAR(contingent_final_date) AS CHAR), 500);

  -- final_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'final_date', LEFT(COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(final_date) AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'final_date', LEFT(COALESCE(CAST(YEAR(final_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(YEAR(final_date) AS CHAR), 500);

  -- biennial_registration_date
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'biennial_registration_date', LEFT(COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(biennial_registration_date) AS CHAR), 500);
  INSERT INTO freq_condominium_projects (county_code, column_name, column_value, frequency)
  SELECT '0', 'biennial_registration_date', LEFT(COALESCE(CAST(YEAR(biennial_registration_date) AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_projects GROUP BY LEFT(CAST(YEAR(biennial_registration_date) AS CHAR), 500);

  -- freq_condominium_units
  TRUNCATE TABLE freq_condominium_units;

  -- tmk
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), LEFT(CAST(tmk AS CHAR), 500);
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'tmk', LEFT(COALESCE(CAST(tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(CAST(tmk AS CHAR), 500);

  -- parent_tmk
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'parent_tmk', LEFT(COALESCE(CAST(parent_tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), LEFT(CAST(parent_tmk AS CHAR), 500);
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'parent_tmk', LEFT(COALESCE(CAST(parent_tmk AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(CAST(parent_tmk AS CHAR), 500);

  -- unit_number
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'unit_number', LEFT(COALESCE(CAST(unit_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), LEFT(CAST(unit_number AS CHAR), 500);
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'unit_number', LEFT(COALESCE(CAST(unit_number AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(CAST(unit_number AS CHAR), 500);

  -- owner_name
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT LEFT(tmk, 1), 'owner_name', LEFT(COALESCE(CAST(owner_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(tmk, 1), LEFT(CAST(owner_name AS CHAR), 500);
  INSERT INTO freq_condominium_units (county_code, column_name, column_value, frequency)
  SELECT '0', 'owner_name', LEFT(COALESCE(CAST(owner_name AS CHAR), '[NULL]'), 500), COUNT(*)
  FROM condominium_units GROUP BY LEFT(CAST(owner_name AS CHAR), 500);

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
