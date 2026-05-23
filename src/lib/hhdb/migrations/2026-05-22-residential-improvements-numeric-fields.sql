-- Convert residential_improvements string fields to numeric types
-- living_area: VARCHAR(20) -> INT UNSIGNED (square footage)
-- bedrooms, full_bath, half_bath: VARCHAR(10) -> SMALLINT UNSIGNED

ALTER TABLE residential_improvements
    MODIFY COLUMN living_area INT UNSIGNED COMMENT 'Square footage - all islands',
    MODIFY COLUMN bedrooms SMALLINT UNSIGNED COMMENT 'Honolulu/Hawaii/Kauai (Maui uses combined field)',
    MODIFY COLUMN full_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: Full Bath, Hawaii: Full Baths (Maui uses combined field)',
    MODIFY COLUMN half_bath SMALLINT UNSIGNED COMMENT 'Honolulu/Kauai: Half Bath, Hawaii: Half Baths (Maui uses combined field)';
