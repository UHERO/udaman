-- Recreate residential_improvements with numeric types for living_area, bedrooms, full_bath, half_bath.
-- Old data had comma-formatted strings (e.g. "2,898") incompatible with in-place ALTER.
-- All existing records have last_year_observed=NULL from the old loader and will be
-- repopulated on the next rebuild.

DROP TABLE IF EXISTS residential_improvements;

CREATE TABLE residential_improvements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tmk VARCHAR(30) NOT NULL,
    scraped_at DATETIME NOT NULL,
    last_year_observed SMALLINT UNSIGNED,
    -- Fields present on all or most islands
    building_number VARCHAR(10),
    year_built SMALLINT UNSIGNED,
    eff_year_built SMALLINT UNSIGNED COMMENT 'Effective year built',
    living_area INT UNSIGNED COMMENT 'Square footage - all islands (Honolulu/Maui/Kauai: "Living Area", Hawaii: "Square Feet")',
    bedrooms SMALLINT UNSIGNED COMMENT 'Honolulu/Hawaii/Kauai (Maui uses combined field)',
    full_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: "Full Bath", Hawaii: "Full Baths" (Maui uses combined field)',
    half_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: "Half Bath", Hawaii: "Half Baths" (Maui uses combined field)',
    -- Island-specific fields
    occupancy VARCHAR(50) COMMENT 'Honolulu only',
    framing VARCHAR(100) COMMENT 'Honolulu/Hawaii: "Framing", Maui: "Construction Type"',
    percent_complete VARCHAR(10) COMMENT 'Maui/Kauai - format: "100%"',
    heating_cooling VARCHAR(100) COMMENT 'Maui only',
    exterior_wall VARCHAR(100) COMMENT 'Maui/Hawaii',
    roof_material VARCHAR(100) COMMENT 'Maui/Hawaii',
    fireplace VARCHAR(50) COMMENT 'Maui/Hawaii',
    grade VARCHAR(50) COMMENT 'Maui/Hawaii',
    building_value BIGINT UNSIGNED COMMENT 'Maui only - format: "$50,600"',
    total_room_count VARCHAR(10) COMMENT 'Hawaii only',
    -- Condo-specific fields (nullable - only for condo units)
    condo_style VARCHAR(50),
    condo_view VARCHAR(50),
    floor_level VARCHAR(20),
    parking_spaces VARCHAR(10),
    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
    INDEX idx_tmk (tmk),
    INDEX idx_last_year_observed (last_year_observed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
