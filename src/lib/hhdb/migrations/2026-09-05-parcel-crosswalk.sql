-- Census geography for every land parcel: centroid, 2020 ZCTA, and the
-- census-tract FIPS keys, joined from the parcel/ZCTA/tract crosswalk built
-- off the State's statewide parcel layer.
--
-- The crosswalk is a land layer — one row per parcel, no CPR/condo units —
-- so condo units inherit their parent parcel's values when mirrored onto
-- properties (the same treatment `qpub parcel-list` gives membership).
--
-- parcel_crosswalk is the durable side: remote-only, never dumped over by the
-- rebuild pipeline. The columns on properties are a mirror for convenient
-- joins. properties is dropped and recreated from hhdb-schema.sql on every
-- sync, so they are declared there too, and re-stamped afterwards with
-- `bun run qpub crosswalk --properties-only --execute`.
--
-- latitude / longitude already existed on properties (documented as the
-- parcel centroid, never populated); the crosswalk centroid fills them.

CREATE TABLE parcel_crosswalk (
    parcel_tmk   VARCHAR(13)    NOT NULL PRIMARY KEY
        COMMENT 'Land parcel TMK, dashed, no CPR suffix: I-Z-S-PPP-PPP',
    latitude     DECIMAL(10, 8) NULL COMMENT 'Parcel centroid latitude (WGS84)',
    longitude    DECIMAL(11, 8) NULL COMMENT 'Parcel centroid longitude (WGS84)',
    zcta20       CHAR(5)        NULL COMMENT '2020 ZIP Code Tabulation Area. NULL when the parcel falls in no ZCTA',
    countyfp     CHAR(3)        NULL COMMENT 'Census county FIPS: 001 Hawaii, 003 Honolulu, 005 Kalawao, 007 Kauai, 009 Maui',
    tractce      CHAR(6)        NULL COMMENT 'Census tract code within the county',
    tract_geoid  CHAR(11)       NULL COMMENT 'Full census tract GEOID (state + county + tract)',
    source_file  VARCHAR(255)   NULL COMMENT 'Crosswalk CSV this row was loaded from',
    loaded_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_zcta20 (zcta20),
    INDEX idx_countyfp (countyfp),
    INDEX idx_tract_geoid (tract_geoid)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Parcel centroid, 2020 ZCTA and census tract per land parcel (durable; mirrored onto properties)';

ALTER TABLE properties
    ADD COLUMN zcta20 CHAR(5) NULL
        COMMENT '2020 ZIP Code Tabulation Area of the parcel (from parcel_crosswalk)'
        AFTER longitude,
    ADD COLUMN countyfp CHAR(3) NULL
        COMMENT 'Census county FIPS: 001 Hawaii, 003 Honolulu, 005 Kalawao, 007 Kauai, 009 Maui'
        AFTER zcta20,
    ADD COLUMN tractce CHAR(6) NULL
        COMMENT 'Census tract code within the county'
        AFTER countyfp,
    ADD COLUMN tract_geoid CHAR(11) NULL
        COMMENT 'Full census tract GEOID (state + county + tract)'
        AFTER tractce,
    ADD INDEX idx_zcta20 (zcta20),
    ADD INDEX idx_countyfp (countyfp),
    ADD INDEX idx_tract_geoid (tract_geoid);
