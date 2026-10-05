-- Create insurance_policies, insurance_claims and insurance_loads for the
-- FICOH homeowners policy / claim loader (src/core/crawlers/ficoh,
-- `bun run ficoh load`).
--
-- REMOTE-DURABLE, HAND-APPLIED. These tables live only on the remote hhdb and
-- are not part of the qpub rebuild: they are deliberately absent from
-- hhdb-schema.sql and from ALL_DATA_TABLES in qpub-db-sync.ts. Apply this file
-- to the remote by hand, once:
--
--   mysql -h $HH_DB_HOST -u $HH_DB_USER -p hawaii_housing_database \
--     < src/lib/hhdb/migrations/2026-10-05-create-insurance-tables.sql
--
-- It is CREATE TABLE IF NOT EXISTS with no DROP, so re-running it is a no-op.
--
-- DATA USE: approved researchers only; aggregate reporting only. Before
-- applying, confirm who can read hawaii_housing_database.
--
-- The DDL below is identical to src/lib/hhdb/insurance.sql (the canonical
-- copy); insurance-ddl.test.ts asserts the two match.

CREATE TABLE IF NOT EXISTS `insurance_policies` (
    `id`                INT UNSIGNED NOT NULL PRIMARY KEY COMMENT 'Line of the row in the Policy Data Set sheet',
    `policy_base`       VARCHAR(13) NULL COMMENT 'Policy across renewals: first 13 characters of a 15-character policy_number; NULL for the older 12-character numbers',
    `location_no`       SMALLINT UNSIGNED NOT NULL COMMENT '1, 2, ... for each insured location under one policy number and term, in file order',
    `tmk`               VARCHAR(30) NULL COMMENT 'TMK geocoded from the address: the condo unit''s CPR TMK when tmk_match = unit, else the parcel (CPR 0000)',
    `tmk_match`         VARCHAR(8) NULL COMMENT 'unit (unit address matched a CPR), address (exact address on one parcel), fuzzy (same number, similar street); NULL when ambiguous or not found',
    `tmk_address`       VARCHAR(255) NULL COMMENT 'qPublic site address that matched',

    -- Data columns: POLICY_COLUMNS in src/core/crawlers/ficoh/columns.ts, in order.
    `policy_number`     VARCHAR(15) NOT NULL COMMENT 'Policy number for this term',
    `effective_date`    DATE NOT NULL,
    `expiration_date`   DATE NOT NULL,
    `new_renewal`       CHAR(1) NULL COMMENT 'N new, R renewal',
    `form_type`         VARCHAR(16) NULL COMMENT 'Condo, Dwelling0, Dwelling6, Dwelling7, Tenant',
    `address`           VARCHAR(255) NULL,
    `city`              VARCHAR(64) NULL COMMENT 'FICOH city / rating area; some combined ("Kihei, Wailea")',
    `zip`               VARCHAR(10) NULL,
    `cov_a_limit`       DECIMAL(12,2) NULL COMMENT 'Dwelling',
    `cov_b_limit`       DECIMAL(12,2) NULL COMMENT 'Other structures',
    `cov_c_limit`       DECIMAL(12,2) NULL COMMENT 'Personal property',
    `cov_d_limit`       DECIMAL(12,2) NULL COMMENT 'Loss of use',
    `cov_e_limit`       DECIMAL(12,2) NULL COMMENT 'Personal liability',
    `cov_f_limit`       DECIMAL(12,2) NULL COMMENT 'Medical payments',
    `tiv`               DECIMAL(12,2) NULL COMMENT 'Total insurable value',
    `deductible`        INT NULL,
    `premium`           DECIMAL(10,2) NULL COMMENT 'Written premium; a few negative (returned)',
    `hurricane_premium` DECIMAL(10,2) NULL,
    `company_code`      TINYINT UNSIGNED NULL COMMENT 'Underwriting company code; no decode provided',
    `agency_number`     SMALLINT UNSIGNED NULL,
    `producer_key`      VARCHAR(8) NULL,
    `year_built`        SMALLINT UNSIGNED NULL COMMENT 'FICOH placeholders 1000 / 9999 stored as NULL',
    `construction_type` TINYINT UNSIGNED NULL COMMENT 'Construction code; no decode provided',

    UNIQUE KEY `uq_policy_term_location` (`policy_number`, `effective_date`, `location_no`),
    INDEX `idx_policy_base` (`policy_base`),
    INDEX `idx_tmk` (`tmk`),
    INDEX `idx_effective_date` (`effective_date`),
    INDEX `idx_zip` (`zip`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'FICOH homeowners policies, one row per policy term x location; approved researchers only, aggregate reporting only';

CREATE TABLE IF NOT EXISTS `insurance_claims` (
    `claim_number`  VARCHAR(16) NOT NULL PRIMARY KEY,
    `policy_id`     INT UNSIGNED NULL COMMENT 'insurance_policies.id in force on date_of_loss; NULL when not found or ambiguous',
    `policy_match`  VARCHAR(16) NULL COMMENT 'term (number + date), term_address (one of several locations, by address), base / base_address (same via the 13-character policy base)',
    `tmk`           VARCHAR(30) NULL COMMENT 'TMK geocoded from the loss address; see insurance_policies.tmk',
    `tmk_match`     VARCHAR(8) NULL COMMENT 'unit, address or fuzzy; see insurance_policies.tmk_match',
    `tmk_address`   VARCHAR(255) NULL COMMENT 'qPublic site address that matched',

    -- Data columns: CLAIM_COLUMNS (after claim_number) in src/core/crawlers/ficoh/columns.ts, in order.
    `policy_number` VARCHAR(15) NOT NULL COMMENT 'Policy number as the claim records it',
    `date_of_loss`  DATE NOT NULL,
    `loss_cause`    VARCHAR(64) NULL,
    `loss_address`  VARCHAR(255) NULL COMMENT '"Unknown" / "Unk" stored as NULL',
    `loss_city`     VARCHAR(64) NULL,
    `loss_state`    VARCHAR(8) NULL,
    `loss_zip`      VARCHAR(10) NULL,
    `paid_loss`     DECIMAL(12,2) NULL,
    `incurred_loss` DECIMAL(12,2) NULL COMMENT 'Paid + outstanding reserve',
    `expense_paid`  DECIMAL(12,2) NULL,

    INDEX `idx_policy_id` (`policy_id`),
    INDEX `idx_policy_number` (`policy_number`),
    INDEX `idx_date_of_loss` (`date_of_loss`),
    INDEX `idx_tmk` (`tmk`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'FICOH homeowners claims, one row per claim; approved researchers only, aggregate reporting only';

CREATE TABLE IF NOT EXISTS `insurance_loads` (
    `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `file_name`         VARCHAR(255) NOT NULL,
    `file_bytes`        BIGINT UNSIGNED NOT NULL,
    `policies`          INT UNSIGNED NOT NULL COMMENT 'Rows loaded into insurance_policies',
    `claims`            INT UNSIGNED NOT NULL COMMENT 'Rows loaded into insurance_claims',
    `policies_geocoded` INT UNSIGNED NOT NULL COMMENT 'Policies with a tmk',
    `claims_geocoded`   INT UNSIGNED NOT NULL COMMENT 'Claims with a tmk',
    `claims_linked`     INT UNSIGNED NOT NULL COMMENT 'Claims with a policy_id',
    `loaded_at`         DATETIME NOT NULL COMMENT 'HST wall-clock; when the load committed'
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'One row per FICOH workbook load (bun run ficoh load)';
