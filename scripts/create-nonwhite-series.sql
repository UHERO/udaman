-- Create NONWHITE@{geo}.A series for all HHF geos that have series.
-- Eval: "HAWPI@{geo}.A".ts + "ASIAN@{geo}.A".ts + "BLACK@{geo}.A".ts
--
-- Run: mysql -u <user> -p --default-character-set=utf8mb4 udaman < scripts/create-nonwhite-series.sql

SET @Q = CHAR(34);

-- Step 1: Create NONWHITE measurement if it doesn't exist
INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'NONWHITE', 'nonwhite', 1, 1, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'NONWHITE');

-- Step 2: Create xseries records with temporary marker
INSERT INTO xseries (frequency, seasonal_adjustment, percent, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', 1, CONCAT('HHF:NONWHITE:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('HAWPI@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('NONWHITE@', g.handle, '.A'));

-- Step 3: Create series records
INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('NONWHITE@', g.handle, '.A'), 1, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:NONWHITE:', g.handle);

-- Step 4: Set primary_series_id on xseries
UPDATE xseries x
JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF'
SET x.primary_series_id = s.id
WHERE x.frequency_transform LIKE 'HHF:NONWHITE:%' AND x.primary_series_id IS NULL;

-- Step 5: Clear temporary marker
UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:NONWHITE:%';

-- Step 6: Link measurement to series
INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id
FROM series s
JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'NONWHITE'
WHERE s.universe = 'HHF' AND s.name LIKE 'NONWHITE@%.A'
  AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

-- Step 7: Create loaders with arithmetic eval
INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT(@Q, 'HAWPI@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts + ', @Q, 'ASIAN@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts + ', @Q, 'BLACK@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts'), CONCAT('HAWPI + ASIAN + BLACK @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s
WHERE s.universe = 'HHF' AND s.name LIKE 'NONWHITE@%.A'
  AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');
