-- renthub_listings: tmk is narrowed to the condo unit (CPR) when the listing
-- address names one (cpr_match), so tmk widens to VARCHAR(30) like
-- properties.tmk; building_type becomes a bucket (single-family, apartment,
-- condo, townhouse, mobile-home, commercial, other) with the vendor's text
-- kept in building_type_raw; renthub_loads records the mainland strays the
-- loader now drops (rows outside Hawaii with no Hawaii ZIP — the 121 Las Vegas
-- "RNT" listings and 29 others).
--
-- HAND-APPLIED, to a server that already has the 2026-10-05 tables:
--
--   mysql -h $HH_DB_HOST -u $HH_DB_USER -p hawaii_housing_database \
--     < src/lib/hhdb/migrations/2026-10-06-renthub-building-type-and-strays.sql
--
-- Then reload so every row gets its bucket and CPR, and the strays are deleted:
--
--   bun run renthub load --force
--
-- Until that reload, building_type still holds the vendor's text and
-- building_type_raw / cpr_match are NULL. A fresh install needs only
-- 2026-10-05-create-renthub-listings.sql, which already has these columns.

ALTER TABLE `renthub_listings`
    MODIFY COLUMN `tmk` VARCHAR(30) NULL COMMENT 'The unit''s CPR TMK when cpr_match is set, else the parcel (CPR 0000); NULL when unmatched',
    MODIFY COLUMN `tmk_address` VARCHAR(255) NULL COMMENT 'qPublic site address that matched (the unit''s, when cpr_match is set)',
    ADD COLUMN `cpr_match` VARCHAR(16) NULL COMMENT 'How tmk was narrowed to a condo unit: unit, unit_variant (K1142 → 1142, PH8), house_address (CPR''d lot of houses); NULL = parcel-level tmk' AFTER `tmk_address`,
    MODIFY COLUMN `building_type` VARCHAR(32) NULL COMMENT 'single-family, apartment, condo, townhouse, mobile-home, commercial, other (BUILDING_TYPES in renthub/columns.ts)',
    ADD COLUMN `building_type_raw` VARCHAR(32) NULL COMMENT 'Building type as the vendor gives it (SFR, house, APT, CON, TH, unknown, ...)' AFTER `building_type`;

ALTER TABLE `renthub_loads`
    ADD COLUMN `rows_dropped` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Mainland strays not loaded: outside Hawaii and no Hawaii ZIP' AFTER `rows_in_file`,
    ADD COLUMN `rows_cpr` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Rows whose tmk was narrowed to a condo unit (cpr_match set)' AFTER `rows_dropped`;
