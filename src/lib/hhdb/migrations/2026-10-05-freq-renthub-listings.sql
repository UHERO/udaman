-- Frequency counts for the RentHub Listings summary tab — same EAV shape and
-- the same INSERTs as every other freq_ table in ../hhdb-freq-tables.sql.
-- Generated from the Summary-tab fields of renthub_listings in
-- src/core/catalog/types/hhdb-data-dictionary.ts (the `summary` flag on
-- RENTHUB_COLUMNS); freq-renthub-listings.test.ts keeps both files in step.
--
-- This file is the SAFE way to add it to a live server: it creates and fills
-- freq_renthub_listings only. Do NOT source all of hhdb-freq-tables.sql for
-- this — that script DROPs every freq_ table and they stay empty until the
-- (slow) full regeneration finishes. Apply after the first `bun run renthub
-- load`, or the counts are empty:
--
--   mariadb -h <host> -u <user> -p hawaii_housing_database < 2026-10-05-freq-renthub-listings.sql
--
-- Safe to re-run any time to refresh the RentHub counts on their own.
--
-- To have the weekly event (evt_weekly_freq_refresh → sp_regenerate_freq_tables)
-- keep it fresh from then on, re-create that procedure from hhdb-freq-tables.sql:
-- run ONLY the section from "DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables"
-- through "END //" + "DELIMITER ;" (it now ends with a freq_renthub_listings block).
--
-- Per-county INSERTs skip listings with no TMK (county_code is NOT NULL);
-- those count toward '0' (State) only. Dates are counted by year.

CREATE TABLE IF NOT EXISTS freq_renthub_listings (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE freq_renthub_listings;

-- batch
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'batch', LEFT(COALESCE(CAST(`batch` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`batch` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'batch', LEFT(COALESCE(CAST(`batch` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`batch` AS CHAR), 500);

-- tmk_match
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tmk_match` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`tmk_match` AS CHAR), 500);

-- cpr_match
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cpr_match', LEFT(COALESCE(CAST(`cpr_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cpr_match` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'cpr_match', LEFT(COALESCE(CAST(`cpr_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`cpr_match` AS CHAR), 500);

-- coord_decimals
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'coord_decimals', LEFT(COALESCE(CAST(`coord_decimals` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`coord_decimals` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'coord_decimals', LEFT(COALESCE(CAST(`coord_decimals` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`coord_decimals` AS CHAR), 500);

-- scraped_at
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'scraped_at', LEFT(COALESCE(CAST(YEAR(`scraped_at`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`scraped_at`) AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'scraped_at', LEFT(COALESCE(CAST(YEAR(`scraped_at`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(YEAR(`scraped_at`) AS CHAR), 500);

-- city
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`city` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`city` AS CHAR), 500);

-- neighborhood
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`neighborhood` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`neighborhood` AS CHAR), 500);

-- zip
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`zip` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`zip` AS CHAR), 500);

-- company
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'company', LEFT(COALESCE(CAST(`company` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`company` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'company', LEFT(COALESCE(CAST(`company` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`company` AS CHAR), 500);

-- building_type
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'building_type', LEFT(COALESCE(CAST(`building_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`building_type` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'building_type', LEFT(COALESCE(CAST(`building_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`building_type` AS CHAR), 500);

-- beds
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'beds', LEFT(COALESCE(CAST(`beds` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`beds` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'beds', LEFT(COALESCE(CAST(`beds` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`beds` AS CHAR), 500);

-- baths
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'baths', LEFT(COALESCE(CAST(`baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`baths` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'baths', LEFT(COALESCE(CAST(`baths` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`baths` AS CHAR), 500);

-- sqft
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'sqft', LEFT(COALESCE(CAST(`sqft` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`sqft` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'sqft', LEFT(COALESCE(CAST(`sqft` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`sqft` AS CHAR), 500);

-- rent_price
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'rent_price', LEFT(COALESCE(CAST(`rent_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`rent_price` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'rent_price', LEFT(COALESCE(CAST(`rent_price` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`rent_price` AS CHAR), 500);

-- granite
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'granite', LEFT(COALESCE(CAST(`granite` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`granite` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'granite', LEFT(COALESCE(CAST(`granite` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`granite` AS CHAR), 500);

-- stainless
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'stainless', LEFT(COALESCE(CAST(`stainless` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`stainless` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'stainless', LEFT(COALESCE(CAST(`stainless` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`stainless` AS CHAR), 500);

-- pool
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'pool', LEFT(COALESCE(CAST(`pool` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`pool` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'pool', LEFT(COALESCE(CAST(`pool` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`pool` AS CHAR), 500);

-- gym
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'gym', LEFT(COALESCE(CAST(`gym` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`gym` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'gym', LEFT(COALESCE(CAST(`gym` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`gym` AS CHAR), 500);

-- doorman
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'doorman', LEFT(COALESCE(CAST(`doorman` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`doorman` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'doorman', LEFT(COALESCE(CAST(`doorman` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`doorman` AS CHAR), 500);

-- furnished
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'furnished', LEFT(COALESCE(CAST(`furnished` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`furnished` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'furnished', LEFT(COALESCE(CAST(`furnished` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`furnished` AS CHAR), 500);

-- laundry
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'laundry', LEFT(COALESCE(CAST(`laundry` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`laundry` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'laundry', LEFT(COALESCE(CAST(`laundry` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`laundry` AS CHAR), 500);

-- garage
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'garage', LEFT(COALESCE(CAST(`garage` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`garage` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'garage', LEFT(COALESCE(CAST(`garage` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`garage` AS CHAR), 500);

-- garage_count
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'garage_count', LEFT(COALESCE(CAST(`garage_count` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`garage_count` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'garage_count', LEFT(COALESCE(CAST(`garage_count` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`garage_count` AS CHAR), 500);

-- clubhouse
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'clubhouse', LEFT(COALESCE(CAST(`clubhouse` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`clubhouse` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'clubhouse', LEFT(COALESCE(CAST(`clubhouse` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`clubhouse` AS CHAR), 500);

-- date_posted
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'date_posted', LEFT(COALESCE(CAST(YEAR(`date_posted`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`date_posted`) AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'date_posted', LEFT(COALESCE(CAST(YEAR(`date_posted`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(YEAR(`date_posted`) AS CHAR), 500);

-- year_built
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`year_built` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`year_built` AS CHAR), 500);

-- available_at
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'available_at', LEFT(COALESCE(CAST(YEAR(`available_at`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`available_at`) AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'available_at', LEFT(COALESCE(CAST(YEAR(`available_at`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(YEAR(`available_at`) AS CHAR), 500);

-- availability_status
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'availability_status', LEFT(COALESCE(CAST(`availability_status` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`availability_status` AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'availability_status', LEFT(COALESCE(CAST(`availability_status` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(`availability_status` AS CHAR), 500);

-- scraped_at_month
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'scraped_at_month', LEFT(COALESCE(CAST(DATE_FORMAT(`scraped_at`, '%Y-%m') AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(DATE_FORMAT(`scraped_at`, '%Y-%m') AS CHAR), 500);
INSERT INTO freq_renthub_listings (county_code, column_name, column_value, frequency)
SELECT '0', 'scraped_at_month', LEFT(COALESCE(CAST(DATE_FORMAT(`scraped_at`, '%Y-%m') AS CHAR), '[NULL]'), 500), COUNT(*)
FROM renthub_listings GROUP BY LEFT(CAST(DATE_FORMAT(`scraped_at`, '%Y-%m') AS CHAR), 500);
