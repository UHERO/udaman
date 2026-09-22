-- Create TOTALRESIDENTIALAREA measurement + series for all HHF geos that have series.
-- The column already exists in the factbook txt file, so load_from_factbook evals work.
--
-- Run: mysql -u <user> -p udaman < scripts/create-totalresidentialarea-series.sql

-- Step 1: Create measurement if it doesn't exist
INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'TOTALRESIDENTIALAREA', 'totalresidentialarea', 2, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'TOTALRESIDENTIALAREA');

-- Step 2: Find the zoning data list and add the measurement to it
SET @dl_id = (SELECT dl.id FROM data_lists dl WHERE dl.universe = 'HHF' AND dl.name = 'zoning' LIMIT 1);
SET @m_id = (SELECT id FROM measurements WHERE universe = 'HHF' AND prefix = 'TOTALRESIDENTIALAREA' LIMIT 1);
INSERT IGNORE INTO data_list_measurements (data_list_id, measurement_id, list_order, indent) VALUES (@dl_id, @m_id, 10, 'indent0');

-- Step 3: Create xseries records with temporary marker
INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:TOTALRESIDENTIALAREA:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('TOTALRESIDENTIALAREA@', g.handle, '.A'));

-- Step 4: Create series records
INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('TOTALRESIDENTIALAREA@', g.handle, '.A'), 2, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:TOTALRESIDENTIALAREA:', g.handle);

-- Step 5: Set primary_series_id on xseries
UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:TOTALRESIDENTIALAREA:%' AND x.primary_series_id IS NULL;

-- Step 6: Clear temporary marker
UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:TOTALRESIDENTIALAREA:%';

-- Step 7: Link measurement to series
INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'TOTALRESIDENTIALAREA' WHERE s.universe = 'HHF' AND s.name LIKE 'TOTALRESIDENTIALAREA@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

-- Step 8: Create loaders
SET @Q = CHAR(34);
INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'TOTALRESIDENTIALAREA', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: TOTALRESIDENTIALAREA @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'TOTALRESIDENTIALAREA@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');
