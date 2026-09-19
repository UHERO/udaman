-- Create mls_listings + mls_listing_history for the MLS listings scraper
-- (src/core/crawlers/mls, plan: docs/2026-09-18-mls-scraper-plan.md).
--
-- REMOTE-DURABLE, HAND-APPLIED. These tables live only on the remote hhdb and
-- are not part of the qpub rebuild: they are deliberately absent from
-- hhdb-schema.sql and from ALL_DATA_TABLES in qpub-db-sync.ts (tables listed
-- there are DROPped and recreated on every rebuild). Apply this file to the
-- remote by hand, once:
--
--   mysql -h $HH_DB_HOST -u $HH_DB_USER -p hawaii_housing_database \
--     < src/lib/hhdb/migrations/2026-09-18-create-mls-listings.sql
--
-- It is CREATE TABLE IF NOT EXISTS with no DROP, so re-running it is a no-op
-- and can never destroy first_seen_at or the history timeline.
--
-- The DDL below is identical to src/lib/hhdb/mls_listings.sql (the canonical
-- copy); mls-listings-ddl.test.ts asserts the two match and that the column
-- set equals MLS_LOADER_COLUMNS + MLS_COLUMNS. DATETIMEs are Hawaii
-- wall-clock, stamped by the loader with NOW().

CREATE TABLE IF NOT EXISTS `mls_listings` (
    -- Loader-owned identity / provenance (MLS_LOADER_COLUMNS in columns.ts)
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `mls_board`       VARCHAR(8) NOT NULL COMMENT 'Board that issued the number: HBR (Oahu), HIS (Hawaii/Kauai/Molokai), RAM (Maui)',
    `mls_number`      VARCHAR(16) NOT NULL COMMENT 'MLS number; unique only within mls_board',
    `source_site`     VARCHAR(32) NOT NULL COMMENT 'Site adapter that last wrote the field values, e.g. hicentral',
    `source_priority` SMALLINT NOT NULL DEFAULT 0 COMMENT 'Priority of source_site; a lower-priority site never overwrites this row',
    `source_url`      VARCHAR(512) NULL COMMENT 'Detail page URL the row was parsed from',
    `status`          VARCHAR(32) NOT NULL COMMENT 'Normalized: active, active_under_contract, pending, sold, off_market, unknown',
    `status_raw`      VARCHAR(64) NULL COMMENT 'Status text as the site shows it',

    -- Data columns: generated from MLS_COLUMNS in src/core/crawlers/mls/columns.ts,
    -- in order. text+length -> VARCHAR(n), text -> TEXT, int -> INT,
    -- money -> BIGINT (whole dollars), date -> DATE, year -> SMALLINT.
    `list_price`           BIGINT NULL COMMENT 'Asking price in whole dollars.',
    `sold_price`           BIGINT NULL COMMENT 'Closing price; only present once the listing has sold.',
    `tenure`               VARCHAR(2) NULL COMMENT 'FS (fee simple) or LH (leasehold), parsed from the price suffix.',
    `building_name`        VARCHAR(255) NULL COMMENT 'Condo / project name shown above the address (58% filled).',
    `address`              VARCHAR(255) NULL COMMENT 'Street address line, including unit.',
    `city`                 VARCHAR(100) NULL COMMENT 'City from the address header.',
    `state`                VARCHAR(2) NULL COMMENT 'Two-letter state from the address header.',
    `zip`                  VARCHAR(10) NULL COMMENT 'ZIP code from the address header.',
    `remarks`              TEXT NULL COMMENT 'Public marketing remarks.',
    `sale_conditions`      VARCHAR(255) NULL COMMENT 'Foreclosure, Lender Sale, Probate, … (rare; blank for ordinary sales).',
    `listing_agent`        VARCHAR(255) NULL COMMENT 'Listing agent name.',
    `listing_office`       VARCHAR(255) NULL COMMENT 'Listing brokerage.',
    `property_type`        VARCHAR(50) NULL COMMENT 'Single Family, Condo/Townhouse, or Multi-Family.',
    `bedrooms`             INT NULL COMMENT 'Bedroom count (absent for multi-family).',
    `full_baths`           INT NULL COMMENT 'Full bathroom count.',
    `half_baths`           INT NULL COMMENT 'Half bathroom count.',
    `land_area_sf`         INT NULL COMMENT 'Lot size in square feet (68% filled; usually absent for condos).',
    `living_sf`            INT NULL COMMENT 'Interior living area in square feet.',
    `lanai_sf`             INT NULL COMMENT 'Lanai area in square feet.',
    `other_sf`             INT NULL COMMENT 'Other covered area in square feet.',
    `parking_stalls`       INT NULL COMMENT 'Number of parking stalls (leading integer of the site value).',
    `parking_stalls_desc`  VARCHAR(255) NULL COMMENT 'Parking types (remainder of the Parking Stalls value).',
    `island`               VARCHAR(20) NULL COMMENT 'Island name as the site spells it.',
    `region`               VARCHAR(100) NULL COMMENT 'MLS region, e.g. Diamond Head, Metro Oahu, Puna.',
    `neighborhood`         VARCHAR(100) NULL COMMENT 'MLS neighborhood, e.g. KAHALA AREA.',
    `tmk`                  VARCHAR(18) NULL COMMENT 'Tax Map Key, I-Z-S-PPP-PPP-CCCC — same format as the qPublic tables.',
    `list_date`            DATE NULL COMMENT 'Date the listing went on the market.',
    `date_sold`            DATE NULL COMMENT 'Closing date; only present once sold.',
    `zoning`               VARCHAR(100) NULL COMMENT 'Zoning code and description.',
    `furnished`            VARCHAR(30) NULL COMMENT 'Full, Partial, None, or Negotiable.',
    `year_built`           SMALLINT NULL COMMENT 'Year of original construction.',
    `year_remodeled`       SMALLINT NULL COMMENT 'Year of last remodel (30% filled).',
    `assd_val_land`        BIGINT NULL COMMENT 'County assessed land value.',
    `assd_val_imprv`       BIGINT NULL COMMENT 'County assessed improvement value.',
    `assd_val_total`       BIGINT NULL COMMENT 'County assessed total value.',
    `tax_year`             SMALLINT NULL COMMENT 'Tax year of the assessed values.',
    `monthly_taxes`        BIGINT NULL COMMENT 'Property tax per month.',
    `home_exempt`          VARCHAR(30) NULL COMMENT 'Home exemption as entered by the agent; not reliably numeric.',
    `maintenance_fees`     BIGINT NULL COMMENT 'Monthly maintenance fee (condos).',
    `association_fees`     BIGINT NULL COMMENT 'Monthly association fee.',
    `other_fees`           BIGINT NULL COMMENT 'Other monthly fees.',
    `land_tenure`          VARCHAR(30) NULL COMMENT 'Present only on leasehold listings.',
    `fee_options`          VARCHAR(50) NULL COMMENT 'Whether the fee interest can be purchased.',
    `lessor`               VARCHAR(255) NULL COMMENT 'Land owner, e.g. KSBE, Hawaiian Home Lands.',
    `lease_rent`           VARCHAR(50) NULL COMMENT 'Monthly lease rent / year it is fixed until, e.g. 491.02/2029.',
    `next_step_up`         VARCHAR(50) NULL COMMENT 'Next lease rent step, amount/year.',
    `second_step_up`       VARCHAR(50) NULL COMMENT 'Second lease rent step, amount/year.',
    `fee_purchase`         VARCHAR(50) NULL COMMENT 'Fee purchase price, when offered.',
    `reneg_date`           VARCHAR(50) NULL COMMENT 'Lease renegotiation date.',
    `lease_exp`            VARCHAR(50) NULL COMMENT 'Lease expiration.',
    `elem_school`          VARCHAR(100) NULL COMMENT 'Elementary school.',
    `middle_school`        VARCHAR(100) NULL COMMENT 'Middle school.',
    `high_school`          VARCHAR(100) NULL COMMENT 'High school.',
    `frontage`             TEXT NULL COMMENT 'Ocean, Golf Course, Stream/Canal, …',
    `view`                 TEXT NULL COMMENT 'View types.',
    `pool`                 TEXT NULL COMMENT 'Pool features.',
    `amenities`            TEXT NULL COMMENT 'Property or building amenities.',
    `inclusions`           TEXT NULL COMMENT 'Items included in the sale.',
    `security`             TEXT NULL COMMENT 'Security features.',
    `assn_fee_inclusions`  TEXT NULL COMMENT 'What the association fee covers.',
    `other_fee_inclusions` TEXT NULL COMMENT 'What the other fees cover.',
    `lot_description`      TEXT NULL COMMENT 'Lot characteristics.',
    `topography`           TEXT NULL COMMENT 'Lot topography.',
    `number_of_stories`    VARCHAR(50) NULL COMMENT 'Pick-list text: One, Two, 15-20, 21+ …',
    `building_style`       TEXT NULL COMMENT 'Detach Single Family, High-Rise 7+ Stories, Condotel, …',
    `property_condition`   VARCHAR(100) NULL COMMENT 'Excellent, Above Average, Fair, …',
    `construction`         TEXT NULL COMMENT 'Construction types.',
    `roofing`              TEXT NULL COMMENT 'Roof material.',
    `floor_covering`       TEXT NULL COMMENT 'Floor materials.',
    `disclosures`          TEXT NULL COMMENT 'Seller disclosures.',
    `possession`           TEXT NULL COMMENT 'Possession terms.',
    `terms_accept`         TEXT NULL COMMENT 'Acceptable financing terms.',
    `land_recorded`        VARCHAR(50) NULL COMMENT 'Land Court, Regular System, or Dual Systems.',
    `exclusions`           TEXT NULL COMMENT 'Items excluded from the sale.',
    `easements`            TEXT NULL COMMENT 'Recorded easements.',
    `set_backs`            TEXT NULL COMMENT 'Set-back rules.',
    `studio_units`         INT NULL COMMENT 'Multi-family: studio unit count.',
    `one_bed_units`        INT NULL COMMENT 'Multi-family: 1-bedroom unit count.',
    `two_bed_units`        INT NULL COMMENT 'Multi-family: 2-bedroom unit count.',
    `three_bed_units`      INT NULL COMMENT 'Multi-family: 3-bedroom unit count.',
    `open_house`           TEXT NULL COMMENT 'Scheduled public open houses at fetch time.',

    -- Loader-owned catch-all + bookkeeping
    `extra`         JSON NULL COMMENT 'Site keys with no column of their own, verbatim',
    `html_path`     VARCHAR(512) NULL COMMENT 'NAS path of the cached detail-page HTML',
    `first_seen_at` DATETIME NULL COMMENT 'HST wall-clock; set once on insert, never updated',
    `last_seen_at`  DATETIME NULL COMMENT 'HST wall-clock; last time any list or detail page showed the listing',
    `fetched_at`    DATETIME NULL COMMENT 'HST wall-clock; last detail-page load',
    `parsed_at`     DATETIME NULL COMMENT 'HST wall-clock; last parse written to this row',

    UNIQUE KEY `uq_mls_board_number` (`mls_board`, `mls_number`),
    INDEX `idx_tmk` (`tmk`),
    INDEX `idx_island_status` (`island`, `status`),
    INDEX `idx_list_date` (`list_date`),
    INDEX `idx_date_sold` (`date_sold`),
    INDEX `idx_status_last_seen` (`status`, `last_seen_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'MLS listings, one row per (mls_board, mls_number); durable, upserted by the mls scraper';

CREATE TABLE IF NOT EXISTS `mls_listing_history` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `mls_board`   VARCHAR(8) NOT NULL,
    `mls_number`  VARCHAR(16) NOT NULL,
    `observed_at` DATETIME NOT NULL COMMENT 'HST wall-clock; when the scraper observed the change',
    `status`      VARCHAR(32) NOT NULL COMMENT 'Normalized status as of this observation',
    `list_price`  BIGINT NULL COMMENT 'Whole dollars as of this observation',
    `sold_price`  BIGINT NULL COMMENT 'Whole dollars as of this observation',
    `source_site` VARCHAR(32) NOT NULL COMMENT 'Site adapter that observed the change',
    `change_type` VARCHAR(32) NOT NULL COMMENT 'first_seen | status | price | status+price | off_market',

    INDEX `idx_board_number_observed` (`mls_board`, `mls_number`, `observed_at`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Append-only status / price timeline for mls_listings';
