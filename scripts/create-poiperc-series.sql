-- Create POIPERC_GROCERY, POIPERC_RECREATION, POIPERC_RESTAURANTS_BARS
-- measurements + series for all HHF geos that have series.
-- Data comes from supplemental CSV (factbooktablelong-2026.csv) via load_from_factbook.
--
-- Run: mysql -u <user> -p udaman < scripts/create-poiperc-series.sql

SET @Q = CHAR(34);

-- ═══════════════════════════════════════════════════════════════════════
-- POIPERC_GROCERY
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Create measurement
INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'POIPERC_GROCERY', 'poiperc_grocery', 1, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'POIPERC_GROCERY');

-- Step 2: Create xseries with temporary marker
INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:POIPERC_GROCERY:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POIPERC_GROCERY@', g.handle, '.A'));

-- Step 3: Create series records
INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('POIPERC_GROCERY@', g.handle, '.A'), 1, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:POIPERC_GROCERY:', g.handle);

-- Step 4: Set primary_series_id on xseries
UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:POIPERC_GROCERY:%' AND x.primary_series_id IS NULL;

-- Step 5: Clear temporary marker
UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:POIPERC_GROCERY:%';

-- Step 6: Link measurement to series
INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'POIPERC_GROCERY' WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_GROCERY@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

-- Step 7: Create loaders
INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'POIPERC_GROCERY', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: POIPERC_GROCERY @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_GROCERY@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');

-- ═══════════════════════════════════════════════════════════════════════
-- POIPERC_RECREATION
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'POIPERC_RECREATION', 'poiperc_recreation', 1, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'POIPERC_RECREATION');

INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:POIPERC_RECREATION:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POIPERC_RECREATION@', g.handle, '.A'));

INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('POIPERC_RECREATION@', g.handle, '.A'), 1, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:POIPERC_RECREATION:', g.handle);

UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:POIPERC_RECREATION:%' AND x.primary_series_id IS NULL;

UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:POIPERC_RECREATION:%';

INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'POIPERC_RECREATION' WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_RECREATION@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'POIPERC_RECREATION', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: POIPERC_RECREATION @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_RECREATION@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');

-- ═══════════════════════════════════════════════════════════════════════
-- POIPERC_RESTAURANTS_BARS
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'POIPERC_RESTAURANTS_BARS', 'poiperc_restaurants_bars', 1, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'POIPERC_RESTAURANTS_BARS');

INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:POIPERC_RESTAURANTS_BARS:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POIPERC_RESTAURANTS_BARS@', g.handle, '.A'));

INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('POIPERC_RESTAURANTS_BARS@', g.handle, '.A'), 1, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:POIPERC_RESTAURANTS_BARS:', g.handle);

UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:POIPERC_RESTAURANTS_BARS:%' AND x.primary_series_id IS NULL;

UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:POIPERC_RESTAURANTS_BARS:%';

INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'POIPERC_RESTAURANTS_BARS' WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_RESTAURANTS_BARS@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'POIPERC_RESTAURANTS_BARS', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: POIPERC_RESTAURANTS_BARS @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'POIPERC_RESTAURANTS_BARS@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');
