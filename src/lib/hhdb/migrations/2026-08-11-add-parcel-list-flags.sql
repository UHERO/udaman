-- Track whether each TMK is still present in the State of Hawaii's
-- authoritative statewide parcel list.
--
-- Parcels drop off that list for ordinary reasons — consolidations, splits,
-- administrative renumbering — and some TMKs we hold (roads, infrastructure,
-- retired numbers) were never on it. Those rows are worth keeping, so this
-- records the fact rather than deleting anything.
--
-- NULL is meaningful: "never checked" is not the same claim as "checked and
-- absent". Rows stay NULL until `bun run qpub parcel-list --execute` runs.
--
-- scrape_status is the durable side (remote-only, never dropped). The columns
-- on properties are a mirror for convenient joins — the rebuild pipeline drops
-- and recreates that table from hhdb-schema.sql, so they are also declared
-- there, and re-stamped afterwards with `qpub parcel-list --properties-only`.

ALTER TABLE scrape_status
    ADD COLUMN in_parcel_list TINYINT(1) NULL DEFAULT NULL
        COMMENT '1 = present in the state parcel list, 0 = absent, NULL = never checked',
    ADD COLUMN parcel_list_version VARCHAR(16) NULL
        COMMENT 'Vintage of the list that set in_parcel_list, e.g. 2026-8',
    ADD COLUMN parcel_list_checked_at DATETIME NULL
        COMMENT 'When in_parcel_list was last evaluated',
    ADD INDEX idx_in_parcel_list (in_parcel_list);

ALTER TABLE properties
    ADD COLUMN in_parcel_list TINYINT(1) NULL DEFAULT NULL
        COMMENT '1 = present in the state parcel list, 0 = absent, NULL = never checked',
    ADD COLUMN parcel_list_version VARCHAR(16) NULL
        COMMENT 'Vintage of the list that set in_parcel_list, e.g. 2026-8',
    ADD COLUMN parcel_list_checked_at DATETIME NULL
        COMMENT 'When in_parcel_list was last evaluated',
    ADD INDEX idx_in_parcel_list (in_parcel_list);
