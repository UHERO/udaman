-- Frequency counts for the MLS Listings summary tab — same EAV shape and the
-- same INSERTs as every other freq_ table in ../hhdb-freq-tables.sql.
--
-- This file is the SAFE way to add it to a live server: it creates and fills
-- freq_mls_listings only. Do NOT source all of hhdb-freq-tables.sql for this —
-- that script DROPs every freq_ table and they stay empty until the (slow)
-- full regeneration finishes.
--
-- Applied by hand:
--   mariadb -h <host> -u <user> -p hawaii_housing_database < 2026-09-21-freq-mls-listings.sql
-- Safe to re-run any time to refresh the MLS counts on their own.
--
-- To have the weekly event (evt_weekly_freq_refresh → sp_regenerate_freq_tables)
-- keep it fresh from then on, re-create that procedure from hhdb-freq-tables.sql:
-- run ONLY the section from "DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables"
-- through "END //" + "DELIMITER ;" (it now ends with a freq_mls_listings block).

CREATE TABLE IF NOT EXISTS freq_mls_listings (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE freq_mls_listings;

-- mls_board
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mls_board', LEFT(COALESCE(CAST(`mls_board` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`mls_board` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'mls_board', LEFT(COALESCE(CAST(`mls_board` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`mls_board` AS CHAR), 500);

-- status
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'status', LEFT(COALESCE(CAST(`status` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`status` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'status', LEFT(COALESCE(CAST(`status` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`status` AS CHAR), 500);

-- source_site
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'source_site', LEFT(COALESCE(CAST(`source_site` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`source_site` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'source_site', LEFT(COALESCE(CAST(`source_site` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`source_site` AS CHAR), 500);

-- list_price
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'list_price', LEFT(COALESCE(CAST(`list_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`list_price` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'list_price', LEFT(COALESCE(CAST(`list_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`list_price` AS CHAR), 500);

-- sold_price
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'sold_price', LEFT(COALESCE(CAST(`sold_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`sold_price` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'sold_price', LEFT(COALESCE(CAST(`sold_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`sold_price` AS CHAR), 500);

-- tenure
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tenure', LEFT(COALESCE(CAST(`tenure` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tenure` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'tenure', LEFT(COALESCE(CAST(`tenure` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`tenure` AS CHAR), 500);

-- building_name
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'building_name', LEFT(COALESCE(CAST(`building_name` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`building_name` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'building_name', LEFT(COALESCE(CAST(`building_name` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`building_name` AS CHAR), 500);

-- city
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`city` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`city` AS CHAR), 500);

-- state
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'state', LEFT(COALESCE(CAST(`state` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`state` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'state', LEFT(COALESCE(CAST(`state` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`state` AS CHAR), 500);

-- zip
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`zip` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`zip` AS CHAR), 500);

-- sale_conditions
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'sale_conditions', LEFT(COALESCE(CAST(`sale_conditions` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`sale_conditions` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'sale_conditions', LEFT(COALESCE(CAST(`sale_conditions` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`sale_conditions` AS CHAR), 500);

-- listing_agent
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'listing_agent', LEFT(COALESCE(CAST(`listing_agent` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`listing_agent` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'listing_agent', LEFT(COALESCE(CAST(`listing_agent` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`listing_agent` AS CHAR), 500);

-- listing_office
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'listing_office', LEFT(COALESCE(CAST(`listing_office` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`listing_office` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'listing_office', LEFT(COALESCE(CAST(`listing_office` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`listing_office` AS CHAR), 500);

-- property_type
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'property_type', LEFT(COALESCE(CAST(`property_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`property_type` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'property_type', LEFT(COALESCE(CAST(`property_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`property_type` AS CHAR), 500);

-- bedrooms
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'bedrooms', LEFT(COALESCE(CAST(`bedrooms` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`bedrooms` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'bedrooms', LEFT(COALESCE(CAST(`bedrooms` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`bedrooms` AS CHAR), 500);

-- full_baths
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'full_baths', LEFT(COALESCE(CAST(`full_baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`full_baths` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'full_baths', LEFT(COALESCE(CAST(`full_baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`full_baths` AS CHAR), 500);

-- half_baths
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'half_baths', LEFT(COALESCE(CAST(`half_baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`half_baths` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'half_baths', LEFT(COALESCE(CAST(`half_baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`half_baths` AS CHAR), 500);

-- land_area_sf
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'land_area_sf', LEFT(COALESCE(CAST(`land_area_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`land_area_sf` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'land_area_sf', LEFT(COALESCE(CAST(`land_area_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`land_area_sf` AS CHAR), 500);

-- living_sf
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'living_sf', LEFT(COALESCE(CAST(`living_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`living_sf` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'living_sf', LEFT(COALESCE(CAST(`living_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`living_sf` AS CHAR), 500);

-- lanai_sf
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'lanai_sf', LEFT(COALESCE(CAST(`lanai_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`lanai_sf` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'lanai_sf', LEFT(COALESCE(CAST(`lanai_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`lanai_sf` AS CHAR), 500);

-- other_sf
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'other_sf', LEFT(COALESCE(CAST(`other_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`other_sf` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'other_sf', LEFT(COALESCE(CAST(`other_sf` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`other_sf` AS CHAR), 500);

-- parking_stalls
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'parking_stalls', LEFT(COALESCE(CAST(`parking_stalls` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`parking_stalls` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'parking_stalls', LEFT(COALESCE(CAST(`parking_stalls` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`parking_stalls` AS CHAR), 500);

-- island
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'island', LEFT(COALESCE(CAST(`island` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`island` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'island', LEFT(COALESCE(CAST(`island` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`island` AS CHAR), 500);

-- region
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'region', LEFT(COALESCE(CAST(`region` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`region` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'region', LEFT(COALESCE(CAST(`region` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`region` AS CHAR), 500);

-- neighborhood
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`neighborhood` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`neighborhood` AS CHAR), 500);

-- tmk
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(`tmk` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tmk` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'tmk', LEFT(COALESCE(CAST(`tmk` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`tmk` AS CHAR), 500);

-- list_date
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'list_date', LEFT(COALESCE(CAST(`list_date` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`list_date` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'list_date', LEFT(COALESCE(CAST(`list_date` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`list_date` AS CHAR), 500);

-- date_sold
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'date_sold', LEFT(COALESCE(CAST(`date_sold` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`date_sold` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'date_sold', LEFT(COALESCE(CAST(`date_sold` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`date_sold` AS CHAR), 500);

-- zoning
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'zoning', LEFT(COALESCE(CAST(`zoning` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`zoning` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'zoning', LEFT(COALESCE(CAST(`zoning` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`zoning` AS CHAR), 500);

-- furnished
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'furnished', LEFT(COALESCE(CAST(`furnished` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`furnished` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'furnished', LEFT(COALESCE(CAST(`furnished` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`furnished` AS CHAR), 500);

-- year_built
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`year_built` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`year_built` AS CHAR), 500);

-- year_remodeled
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'year_remodeled', LEFT(COALESCE(CAST(`year_remodeled` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`year_remodeled` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'year_remodeled', LEFT(COALESCE(CAST(`year_remodeled` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`year_remodeled` AS CHAR), 500);

-- assd_val_land
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'assd_val_land', LEFT(COALESCE(CAST(`assd_val_land` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`assd_val_land` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'assd_val_land', LEFT(COALESCE(CAST(`assd_val_land` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`assd_val_land` AS CHAR), 500);

-- assd_val_imprv
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'assd_val_imprv', LEFT(COALESCE(CAST(`assd_val_imprv` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`assd_val_imprv` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'assd_val_imprv', LEFT(COALESCE(CAST(`assd_val_imprv` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`assd_val_imprv` AS CHAR), 500);

-- assd_val_total
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'assd_val_total', LEFT(COALESCE(CAST(`assd_val_total` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`assd_val_total` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'assd_val_total', LEFT(COALESCE(CAST(`assd_val_total` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`assd_val_total` AS CHAR), 500);

-- tax_year
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tax_year', LEFT(COALESCE(CAST(`tax_year` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tax_year` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'tax_year', LEFT(COALESCE(CAST(`tax_year` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`tax_year` AS CHAR), 500);

-- monthly_taxes
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'monthly_taxes', LEFT(COALESCE(CAST(`monthly_taxes` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`monthly_taxes` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'monthly_taxes', LEFT(COALESCE(CAST(`monthly_taxes` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`monthly_taxes` AS CHAR), 500);

-- home_exempt
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'home_exempt', LEFT(COALESCE(CAST(`home_exempt` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`home_exempt` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'home_exempt', LEFT(COALESCE(CAST(`home_exempt` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`home_exempt` AS CHAR), 500);

-- maintenance_fees
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'maintenance_fees', LEFT(COALESCE(CAST(`maintenance_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`maintenance_fees` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'maintenance_fees', LEFT(COALESCE(CAST(`maintenance_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`maintenance_fees` AS CHAR), 500);

-- association_fees
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'association_fees', LEFT(COALESCE(CAST(`association_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`association_fees` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'association_fees', LEFT(COALESCE(CAST(`association_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`association_fees` AS CHAR), 500);

-- other_fees
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'other_fees', LEFT(COALESCE(CAST(`other_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`other_fees` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'other_fees', LEFT(COALESCE(CAST(`other_fees` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`other_fees` AS CHAR), 500);

-- land_tenure
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'land_tenure', LEFT(COALESCE(CAST(`land_tenure` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`land_tenure` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'land_tenure', LEFT(COALESCE(CAST(`land_tenure` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`land_tenure` AS CHAR), 500);

-- fee_options
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'fee_options', LEFT(COALESCE(CAST(`fee_options` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`fee_options` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'fee_options', LEFT(COALESCE(CAST(`fee_options` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`fee_options` AS CHAR), 500);

-- lessor
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'lessor', LEFT(COALESCE(CAST(`lessor` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`lessor` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'lessor', LEFT(COALESCE(CAST(`lessor` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`lessor` AS CHAR), 500);

-- elem_school
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'elem_school', LEFT(COALESCE(CAST(`elem_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`elem_school` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'elem_school', LEFT(COALESCE(CAST(`elem_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`elem_school` AS CHAR), 500);

-- middle_school
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'middle_school', LEFT(COALESCE(CAST(`middle_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`middle_school` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'middle_school', LEFT(COALESCE(CAST(`middle_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`middle_school` AS CHAR), 500);

-- high_school
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'high_school', LEFT(COALESCE(CAST(`high_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`high_school` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'high_school', LEFT(COALESCE(CAST(`high_school` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`high_school` AS CHAR), 500);

-- number_of_stories
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'number_of_stories', LEFT(COALESCE(CAST(`number_of_stories` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`number_of_stories` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'number_of_stories', LEFT(COALESCE(CAST(`number_of_stories` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`number_of_stories` AS CHAR), 500);

-- building_style
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'building_style', LEFT(COALESCE(CAST(`building_style` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`building_style` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'building_style', LEFT(COALESCE(CAST(`building_style` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`building_style` AS CHAR), 500);

-- property_condition
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'property_condition', LEFT(COALESCE(CAST(`property_condition` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`property_condition` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'property_condition', LEFT(COALESCE(CAST(`property_condition` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`property_condition` AS CHAR), 500);

-- land_recorded
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'land_recorded', LEFT(COALESCE(CAST(`land_recorded` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`land_recorded` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'land_recorded', LEFT(COALESCE(CAST(`land_recorded` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`land_recorded` AS CHAR), 500);

-- studio_units
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'studio_units', LEFT(COALESCE(CAST(`studio_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`studio_units` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'studio_units', LEFT(COALESCE(CAST(`studio_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`studio_units` AS CHAR), 500);

-- one_bed_units
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'one_bed_units', LEFT(COALESCE(CAST(`one_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`one_bed_units` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'one_bed_units', LEFT(COALESCE(CAST(`one_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`one_bed_units` AS CHAR), 500);

-- two_bed_units
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'two_bed_units', LEFT(COALESCE(CAST(`two_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`two_bed_units` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'two_bed_units', LEFT(COALESCE(CAST(`two_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`two_bed_units` AS CHAR), 500);

-- three_bed_units
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'three_bed_units', LEFT(COALESCE(CAST(`three_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`three_bed_units` AS CHAR), 500);
INSERT INTO freq_mls_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'three_bed_units', LEFT(COALESCE(CAST(`three_bed_units` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM mls_listings GROUP BY LEFT(CAST(`three_bed_units` AS CHAR), 500);
