-- Frequency counts for the Transactions (TG) summary tab — same EAV shape and
-- the same INSERTs as every other freq_ table in ../hhdb-freq-tables.sql.
--
-- This file is the SAFE way to add it to a live server: it creates and fills
-- freq_tg_transactions only. Do NOT source all of hhdb-freq-tables.sql for
-- this — that script DROPs every freq_ table and they stay empty until the
-- (slow) full regeneration finishes.
--
-- tg_transactions is ~3.7M rows; each column below is two full scans, so
-- expect the fill to take a few minutes. Run it in a quiet window.
--
-- Applied by hand:
--   mariadb -h <host> -u <user> -p hawaii_housing_database < 2026-09-22-freq-tg-transactions.sql
-- Safe to re-run any time (e.g. after a TG reload) to refresh the counts.
--
-- To have the weekly event (evt_weekly_freq_refresh → sp_regenerate_freq_tables)
-- keep it fresh from then on, re-create that procedure from hhdb-freq-tables.sql:
-- run ONLY the section from "DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables"
-- through "END //" + "DELIMITER ;" (it now ends with a freq_tg_transactions block).
--
-- Column names are camelCase (the table's own spelling). Per-county rows are
-- limited to real county digits: TG's 9-9-9-… placeholder parcel and rows with
-- no TMK count toward '0' (State) only. Dates are counted by year.

CREATE TABLE IF NOT EXISTS freq_tg_transactions (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE freq_tg_transactions;

-- tmk
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tmk', LEFT(COALESCE(CAST(`tmk` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`tmk` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'tmk', LEFT(COALESCE(CAST(`tmk` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`tmk` AS CHAR), 500);

-- recDate
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'recDate', LEFT(COALESCE(CAST(YEAR(`recDate`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`recDate`) AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'recDate', LEFT(COALESCE(CAST(YEAR(`recDate`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(YEAR(`recDate`) AS CHAR), 500);

-- docType
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'docType', LEFT(COALESCE(CAST(`docType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`docType` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'docType', LEFT(COALESCE(CAST(`docType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`docType` AS CHAR), 500);

-- conveyanceAmount
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'conveyanceAmount', LEFT(COALESCE(CAST(`conveyanceAmount` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`conveyanceAmount` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'conveyanceAmount', LEFT(COALESCE(CAST(`conveyanceAmount` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`conveyanceAmount` AS CHAR), 500);

-- considerationAmount
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'considerationAmount', LEFT(COALESCE(CAST(`considerationAmount` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`considerationAmount` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'considerationAmount', LEFT(COALESCE(CAST(`considerationAmount` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`considerationAmount` AS CHAR), 500);

-- condoName
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'condoName', LEFT(COALESCE(CAST(`condoName` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`condoName` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'condoName', LEFT(COALESCE(CAST(`condoName` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`condoName` AS CHAR), 500);

-- taxClass
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'taxClass', LEFT(COALESCE(CAST(`taxClass` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`taxClass` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'taxClass', LEFT(COALESCE(CAST(`taxClass` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`taxClass` AS CHAR), 500);

-- transactionType
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'transactionType', LEFT(COALESCE(CAST(`transactionType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`transactionType` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'transactionType', LEFT(COALESCE(CAST(`transactionType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`transactionType` AS CHAR), 500);

-- neighborhood
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`neighborhood` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'neighborhood', LEFT(COALESCE(CAST(`neighborhood` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`neighborhood` AS CHAR), 500);

-- region
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'region', LEFT(COALESCE(CAST(`region` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`region` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'region', LEFT(COALESCE(CAST(`region` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`region` AS CHAR), 500);

-- mailingCity
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mailingCity', LEFT(COALESCE(CAST(`mailingCity` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`mailingCity` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'mailingCity', LEFT(COALESCE(CAST(`mailingCity` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`mailingCity` AS CHAR), 500);

-- mailingState
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mailingState', LEFT(COALESCE(CAST(`mailingState` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`mailingState` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'mailingState', LEFT(COALESCE(CAST(`mailingState` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`mailingState` AS CHAR), 500);

-- mailingZipCode
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mailingZipCode', LEFT(COALESCE(CAST(`mailingZipCode` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`mailingZipCode` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'mailingZipCode', LEFT(COALESCE(CAST(`mailingZipCode` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`mailingZipCode` AS CHAR), 500);

-- mailingCountry
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mailingCountry', LEFT(COALESCE(CAST(`mailingCountry` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`mailingCountry` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'mailingCountry', LEFT(COALESCE(CAST(`mailingCountry` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`mailingCountry` AS CHAR), 500);

-- mortgageType
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'mortgageType', LEFT(COALESCE(CAST(`mortgageType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(`mortgageType` AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'mortgageType', LEFT(COALESCE(CAST(`mortgageType` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(`mortgageType` AS CHAR), 500);

-- maturityDate
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'maturityDate', LEFT(COALESCE(CAST(YEAR(`maturityDate`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions WHERE LEFT(tmk, 1) IN ('1', '2', '3', '4') GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`maturityDate`) AS CHAR), 500);
INSERT INTO freq_tg_transactions (county_code, column_name, column_value, frequency)
SELECT '0', 'maturityDate', LEFT(COALESCE(CAST(YEAR(`maturityDate`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM tg_transactions GROUP BY LEFT(CAST(YEAR(`maturityDate`) AS CHAR), 500);
