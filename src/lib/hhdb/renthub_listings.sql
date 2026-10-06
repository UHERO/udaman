-- RentHub rental listings: the Hawaii rows of the vendor's nationwide scrape
-- (src/core/crawlers/renthub, `bun run renthub`).
--
-- DURABLE, REMOTE-ONLY tables, like tg_transactions and mls_listings: they are
-- deliberately NOT in hhdb-schema.sql and NOT in ALL_DATA_TABLES
-- (qpub-db-sync.ts), because everything in that list is DROPped and recreated
-- on every qpub rebuild. There is no DROP TABLE here on purpose.
--
-- Source: /Volumes/UHEROroot/datashare/renthub/rawdata/<start>_<end>/HI.csv.gz,
-- one directory per delivery ("batch"). 2014–2022 are annual, 2023 is two
-- halves, 2024-on is biweekly. Batches before 2023-07-28 have 30 columns;
-- later ones add `unit id` and `property id`.
--
-- One row per vendor record `id`. The id is global across batches: the only
-- ids that appear in two batches (12,102 as of the 2026-01-21 delivery) are
-- byte-identical rows from a 2023-08/09 vendor backfill, shipped both in the
-- old annual file and in 2023-07-28_2024-01-01. On a repeated id the loader
-- keeps the values from the NEWER batch (see upsertSql in load.ts).
--
-- The tmk_* columns are not in the vendor data: the loader geocodes each
-- listing from its point (Statewide_TMKs.geojson, next to the parcel CSV on
-- the NAS) and its street address (properties.location_address of parcels
-- near the point); see geocode.ts for the tmk_match ladder.
--
-- The data columns are generated from RENTHUB_COLUMNS in
-- src/core/crawlers/renthub/columns.ts; renthub-listings-ddl.test.ts fails if
-- this file and that list drift apart.
--
-- scraped_at / available_at are the vendor's clock, stored verbatim — NOT
-- Hawaii wall-clock like the app's own DATETIMEs. renthub_loads.loaded_at is
-- HST wall-clock, stamped by the loader.

CREATE TABLE IF NOT EXISTS `renthub_listings` (
    `id`                  INT UNSIGNED NOT NULL PRIMARY KEY COMMENT 'Vendor record id (CSV "id"); unique across batches',
    `batch`               VARCHAR(21) NOT NULL COMMENT 'Delivery directory the row came from, e.g. 2026-01-07_2026-01-21',

    -- Geocode (src/core/crawlers/renthub/geocode.ts): the parcel the point
    -- falls in on the statewide TMK polygon layer, corrected by matching the
    -- listing address against qPublic site addresses of nearby parcels; then,
    -- on a condo parcel, the unit the address names (AddressIndex.matchCpr).
    `tmk`                 VARCHAR(30) NULL COMMENT 'The unit''s CPR TMK when cpr_match is set, else the parcel (CPR 0000); NULL when unmatched',
    `tmk_match`           VARCHAR(16) NULL COMMENT 'Best first: within_addr (point inside, address agrees), address (nearby parcel has the exact address), fuzzy (same number, similar street), address_far (exact address on the only such parcel within 10 km; vendor point is off), within (point inside, address unconfirmed), nearest (opt-in)',
    `tmk_distance_m`      DECIMAL(6,1) NULL COMMENT 'Metres from the point to the parcel; 0 when inside',
    `tmk_address`         VARCHAR(255) NULL COMMENT 'qPublic site address that matched (the unit''s, when cpr_match is set)',
    `cpr_match`           VARCHAR(16) NULL COMMENT 'How tmk was narrowed to a condo unit: unit, unit_variant (K1142 → 1142, PH8), house_address (CPR''d lot of houses); NULL = parcel-level tmk',
    `coord_decimals`      TINYINT UNSIGNED NULL COMMENT 'Decimal places of the raw lat/lon (the fewer of the two): 4 = ~11 m, 3 = ~110 m; tmk is unreliable below 4',

    -- Data columns: RENTHUB_COLUMNS in src/core/crawlers/renthub/columns.ts, in order.
    `scraped_at`          DATETIME(3) NOT NULL COMMENT 'Vendor scrape time, verbatim; timezone unspecified (not HST)',
    `state`               CHAR(2) NOT NULL COMMENT 'Always HI',
    `city`                VARCHAR(64) NULL COMMENT 'City as the listing gives it',
    `neighborhood`        VARCHAR(64) NULL COMMENT 'Vendor neighborhood; Oahu only (17% blank), a few non-Hawaii strays',
    `zip`                 VARCHAR(10) NULL COMMENT '5-digit ZIP or ZIP+4',
    `address`             VARCHAR(255) NULL COMMENT 'Street address; the vendor placeholder "0" is stored as NULL',
    `company`             VARCHAR(255) NULL COMMENT 'Listing site or property manager (Zillow, HomeRiver Group, Greystar, ...)',
    `building_type`       VARCHAR(32) NULL COMMENT 'single-family, apartment, condo, townhouse, mobile-home, commercial, other (BUILDING_TYPES in renthub/columns.ts)',
    `building_type_raw`   VARCHAR(32) NULL COMMENT 'Building type as the vendor gives it (SFR, house, APT, CON, TH, unknown, ...)',
    `beds`                TINYINT UNSIGNED NULL COMMENT '0 = studio',
    `baths`               DECIMAL(3,1) NULL,
    `sqft`                INT UNSIGNED NULL COMMENT 'Interior square feet; the rare fractional values are rounded',
    `rent_price`          DECIMAL(9,2) NOT NULL COMMENT 'Monthly asking rent in dollars; the vendor drops rents outside ~300-20,000',
    `granite`             BOOLEAN NULL COMMENT 'Amenity flags below are the vendor''s Y/N',
    `stainless`           BOOLEAN NULL,
    `pool`                BOOLEAN NULL,
    `gym`                 BOOLEAN NULL,
    `doorman`             BOOLEAN NULL,
    `furnished`           BOOLEAN NULL,
    `laundry`             BOOLEAN NULL,
    `garage`              BOOLEAN NULL,
    `garage_count`        TINYINT UNSIGNED NULL COMMENT '86% blank',
    `clubhouse`           BOOLEAN NULL,
    `latitude`            DECIMAL(10,7) NULL COMMENT '~150 rows are geocoded outside Hawaii',
    `longitude`           DECIMAL(10,7) NULL,
    `date_posted`         DATE NULL,
    `description`         MEDIUMTEXT NULL COMMENT 'Listing text or an amenity list, newline-separated',
    `year_built`          SMALLINT UNSIGNED NULL COMMENT '99% blank',
    `available_at`        DATETIME(3) NULL COMMENT 'Vendor clock, verbatim; the 1970-01-01 placeholder is stored as NULL',
    `availability_status` VARCHAR(32) NULL COMMENT 'available, coming soon, unavailable, not available, unknown',
    `unit_id`             INT UNSIGNED NULL COMMENT 'Vendor unit id; batches from 2023-07-28 on only',
    `property_id`         INT UNSIGNED NULL COMMENT 'Vendor property (building) id; batches from 2023-07-28 on only',

    INDEX `idx_batch` (`batch`),
    INDEX `idx_tmk` (`tmk`),
    INDEX `idx_scraped_at` (`scraped_at`),
    INDEX `idx_date_posted` (`date_posted`),
    INDEX `idx_zip` (`zip`),
    INDEX `idx_neighborhood` (`neighborhood`),
    INDEX `idx_unit_id` (`unit_id`),
    INDEX `idx_property_id` (`property_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'RentHub rental listings (Hawaii), one row per vendor id; durable, upserted by bun run renthub';

CREATE TABLE IF NOT EXISTS `renthub_loads` (
    `batch`        VARCHAR(21) NOT NULL PRIMARY KEY COMMENT 'Delivery directory name',
    `file_name`    VARCHAR(64) NOT NULL COMMENT 'File loaded from that directory, e.g. HI.csv.gz',
    `file_bytes`   INT UNSIGNED NOT NULL COMMENT 'Size of that file; a different size on disk means the batch is reloaded',
    `rows_in_file` INT UNSIGNED NOT NULL COMMENT 'Data rows parsed from the file',
    `rows_dropped` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Mainland strays not loaded: outside Hawaii and no Hawaii ZIP',
    `rows_cpr`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows whose tmk was narrowed to a condo unit (cpr_match set)',
    `rows_within_addr` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows per tmk_match value, as loaded',
    `rows_address`   INT UNSIGNED NOT NULL DEFAULT 0,
    `rows_fuzzy`     INT UNSIGNED NOT NULL DEFAULT 0,
    `rows_address_far` INT UNSIGNED NOT NULL DEFAULT 0,
    `rows_within`    INT UNSIGNED NOT NULL DEFAULT 0,
    `rows_nearest`   INT UNSIGNED NOT NULL DEFAULT 0,
    `rows_unmatched` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows left with tmk NULL',
    `parcel_layer`   VARCHAR(255) NULL COMMENT 'TMK polygon file the rows were geocoded against',
    `loaded_at`    DATETIME NOT NULL COMMENT 'HST wall-clock; when the load finished'
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'One row per RentHub batch fully loaded into renthub_listings';
