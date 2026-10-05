-- Frequency counts for insurance_policies and insurance_claims (FICOH) — same
-- EAV shape and the same INSERTs as every other freq_ table in
-- ../hhdb-freq-tables.sql. Generated from the Summary-tab fields of the two
-- tables in src/core/catalog/types/hhdb-data-dictionary.ts (the `summary`
-- flags on POLICY_COLUMNS / CLAIM_COLUMNS); freq-insurance.test.ts keeps both
-- files in step.
--
-- This file is the SAFE way to add them to a live server: it creates and
-- fills these two freq_ tables only. Do NOT source all of hhdb-freq-tables.sql
-- for this — that script DROPs every freq_ table. Apply after the first
-- `bun run ficoh load`, and again after any reload:
--
--   mariadb -h <host> -u <user> -p hawaii_housing_database < 2026-10-05-freq-insurance.sql
--
-- To have the weekly event (evt_weekly_freq_refresh → sp_regenerate_freq_tables)
-- keep them fresh, re-create that procedure from hhdb-freq-tables.sql: run ONLY
-- the section from "DROP PROCEDURE IF EXISTS sp_regenerate_freq_tables" through
-- "END //" + "DELIMITER ;".
--
-- Counts are aggregates, in line with FICOH's aggregate-only reporting rule;
-- no identifying column (policy / claim number, address) is counted.
-- Per-county INSERTs skip rows with no TMK (county_code is NOT NULL); those
-- count toward '0' (State) only. Dates are counted by year.

CREATE TABLE IF NOT EXISTS freq_insurance_policies (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS freq_insurance_claims (
  county_code CHAR(1) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  column_value VARCHAR(500),
  frequency BIGINT UNSIGNED NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (county_code, column_name, column_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE freq_insurance_policies;

-- location_no
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'location_no', LEFT(COALESCE(CAST(`location_no` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`location_no` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'location_no', LEFT(COALESCE(CAST(`location_no` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`location_no` AS CHAR), 500);

-- tmk_match
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tmk_match` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`tmk_match` AS CHAR), 500);

-- effective_date
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'effective_date', LEFT(COALESCE(CAST(YEAR(`effective_date`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`effective_date`) AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'effective_date', LEFT(COALESCE(CAST(YEAR(`effective_date`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(YEAR(`effective_date`) AS CHAR), 500);

-- new_renewal
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'new_renewal', LEFT(COALESCE(CAST(`new_renewal` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`new_renewal` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'new_renewal', LEFT(COALESCE(CAST(`new_renewal` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`new_renewal` AS CHAR), 500);

-- form_type
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'form_type', LEFT(COALESCE(CAST(`form_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`form_type` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'form_type', LEFT(COALESCE(CAST(`form_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`form_type` AS CHAR), 500);

-- city
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`city` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'city', LEFT(COALESCE(CAST(`city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`city` AS CHAR), 500);

-- zip
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`zip` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'zip', LEFT(COALESCE(CAST(`zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`zip` AS CHAR), 500);

-- cov_a_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_a_limit', LEFT(COALESCE(CAST(`cov_a_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_a_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_a_limit', LEFT(COALESCE(CAST(`cov_a_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_a_limit` AS CHAR), 500);

-- cov_b_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_b_limit', LEFT(COALESCE(CAST(`cov_b_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_b_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_b_limit', LEFT(COALESCE(CAST(`cov_b_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_b_limit` AS CHAR), 500);

-- cov_c_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_c_limit', LEFT(COALESCE(CAST(`cov_c_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_c_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_c_limit', LEFT(COALESCE(CAST(`cov_c_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_c_limit` AS CHAR), 500);

-- cov_d_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_d_limit', LEFT(COALESCE(CAST(`cov_d_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_d_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_d_limit', LEFT(COALESCE(CAST(`cov_d_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_d_limit` AS CHAR), 500);

-- cov_e_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_e_limit', LEFT(COALESCE(CAST(`cov_e_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_e_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_e_limit', LEFT(COALESCE(CAST(`cov_e_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_e_limit` AS CHAR), 500);

-- cov_f_limit
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'cov_f_limit', LEFT(COALESCE(CAST(`cov_f_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`cov_f_limit` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'cov_f_limit', LEFT(COALESCE(CAST(`cov_f_limit` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`cov_f_limit` AS CHAR), 500);

-- tiv
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tiv', LEFT(COALESCE(CAST(`tiv` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tiv` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'tiv', LEFT(COALESCE(CAST(`tiv` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`tiv` AS CHAR), 500);

-- deductible
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'deductible', LEFT(COALESCE(CAST(`deductible` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`deductible` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'deductible', LEFT(COALESCE(CAST(`deductible` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`deductible` AS CHAR), 500);

-- premium
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'premium', LEFT(COALESCE(CAST(`premium` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`premium` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'premium', LEFT(COALESCE(CAST(`premium` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`premium` AS CHAR), 500);

-- hurricane_premium
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'hurricane_premium', LEFT(COALESCE(CAST(`hurricane_premium` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`hurricane_premium` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'hurricane_premium', LEFT(COALESCE(CAST(`hurricane_premium` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`hurricane_premium` AS CHAR), 500);

-- company_code
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'company_code', LEFT(COALESCE(CAST(`company_code` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`company_code` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'company_code', LEFT(COALESCE(CAST(`company_code` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`company_code` AS CHAR), 500);

-- agency_number
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'agency_number', LEFT(COALESCE(CAST(`agency_number` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`agency_number` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'agency_number', LEFT(COALESCE(CAST(`agency_number` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`agency_number` AS CHAR), 500);

-- producer_key
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'producer_key', LEFT(COALESCE(CAST(`producer_key` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`producer_key` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'producer_key', LEFT(COALESCE(CAST(`producer_key` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`producer_key` AS CHAR), 500);

-- year_built
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`year_built` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'year_built', LEFT(COALESCE(CAST(`year_built` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`year_built` AS CHAR), 500);

-- construction_type
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'construction_type', LEFT(COALESCE(CAST(`construction_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`construction_type` AS CHAR), 500);
INSERT INTO freq_insurance_policies (county_code, column_name, column_value, frequency)
SELECT '0', 'construction_type', LEFT(COALESCE(CAST(`construction_type` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_policies GROUP BY LEFT(CAST(`construction_type` AS CHAR), 500);

TRUNCATE TABLE freq_insurance_claims;

-- policy_match
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'policy_match', LEFT(COALESCE(CAST(`policy_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`policy_match` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'policy_match', LEFT(COALESCE(CAST(`policy_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`policy_match` AS CHAR), 500);

-- tmk_match
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`tmk_match` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'tmk_match', LEFT(COALESCE(CAST(`tmk_match` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`tmk_match` AS CHAR), 500);

-- date_of_loss
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'date_of_loss', LEFT(COALESCE(CAST(YEAR(`date_of_loss`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(YEAR(`date_of_loss`) AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'date_of_loss', LEFT(COALESCE(CAST(YEAR(`date_of_loss`) AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(YEAR(`date_of_loss`) AS CHAR), 500);

-- loss_cause
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'loss_cause', LEFT(COALESCE(CAST(`loss_cause` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`loss_cause` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'loss_cause', LEFT(COALESCE(CAST(`loss_cause` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`loss_cause` AS CHAR), 500);

-- loss_city
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'loss_city', LEFT(COALESCE(CAST(`loss_city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`loss_city` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'loss_city', LEFT(COALESCE(CAST(`loss_city` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`loss_city` AS CHAR), 500);

-- loss_state
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'loss_state', LEFT(COALESCE(CAST(`loss_state` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`loss_state` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'loss_state', LEFT(COALESCE(CAST(`loss_state` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`loss_state` AS CHAR), 500);

-- loss_zip
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'loss_zip', LEFT(COALESCE(CAST(`loss_zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`loss_zip` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'loss_zip', LEFT(COALESCE(CAST(`loss_zip` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`loss_zip` AS CHAR), 500);

-- paid_loss
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'paid_loss', LEFT(COALESCE(CAST(`paid_loss` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`paid_loss` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'paid_loss', LEFT(COALESCE(CAST(`paid_loss` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`paid_loss` AS CHAR), 500);

-- incurred_loss
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'incurred_loss', LEFT(COALESCE(CAST(`incurred_loss` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`incurred_loss` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'incurred_loss', LEFT(COALESCE(CAST(`incurred_loss` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`incurred_loss` AS CHAR), 500);

-- expense_paid
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT LEFT(tmk, 1), 'expense_paid', LEFT(COALESCE(CAST(`expense_paid` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims WHERE tmk IS NOT NULL GROUP BY LEFT(tmk, 1), LEFT(CAST(`expense_paid` AS CHAR), 500);
INSERT INTO freq_insurance_claims (county_code, column_name, column_value, frequency)
SELECT '0', 'expense_paid', LEFT(COALESCE(CAST(`expense_paid` AS CHAR), '[NULL]'), 500), COUNT(*)
FROM insurance_claims GROUP BY LEFT(CAST(`expense_paid` AS CHAR), 500);
