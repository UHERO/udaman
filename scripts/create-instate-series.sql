-- Create INSTATE_SFR and INSTATE_CND series for all HHF geos that have series.
-- These are the "Hawaii Buyers" series in the Property Transactions chart.
-- Data comes from factbook txt file column instate.SFR / instate.CND.
--
-- Run: mysql -u <user> -p udaman < scripts/create-instate-series.sql

SET @Q = CHAR(34);

-- ═══════════════════════════════════════════════════════════════════════
-- INSTATE_SFR
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'INSTATE_SFR', 'instate_SFR', 0, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'INSTATE_SFR');

INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:INSTATE_SFR:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('INSTATE_SFR@', g.handle, '.A'));

INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('INSTATE_SFR@', g.handle, '.A'), 0, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:INSTATE_SFR:', g.handle);

UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:INSTATE_SFR:%' AND x.primary_series_id IS NULL;

UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:INSTATE_SFR:%';

INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'INSTATE_SFR' WHERE s.universe = 'HHF' AND s.name LIKE 'INSTATE_SFR@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'INSTATE_SFR', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: INSTATE_SFR @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'INSTATE_SFR@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');

-- ═══════════════════════════════════════════════════════════════════════
-- INSTATE_CND
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO measurements (universe, prefix, data_portal_name, decimals, `percent`, seasonal_adjustment, created_at, updated_at)
SELECT 'HHF', 'INSTATE_CND', 'instate_CND', 0, 0, 'not_applicable', NOW(), NOW()
FROM dual WHERE NOT EXISTS (SELECT 1 FROM measurements WHERE universe = 'HHF' AND prefix = 'INSTATE_CND');

INSERT INTO xseries (frequency, seasonal_adjustment, frequency_transform, created_at, updated_at)
SELECT 'year', 'not_applicable', CONCAT('HHF:INSTATE_CND:', g.handle), NOW(), NOW()
FROM geographies g
WHERE g.universe = 'HHF'
  AND EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('POPULATION@', g.handle, '.A'))
  AND NOT EXISTS (SELECT 1 FROM series s WHERE s.universe = 'HHF' AND s.name = CONCAT('INSTATE_CND@', g.handle, '.A'));

INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT x.id, g.id, 'HHF', CONCAT('INSTATE_CND@', g.handle, '.A'), 0, NOW(), NOW()
FROM xseries x
JOIN geographies g ON g.universe = 'HHF' AND x.frequency_transform = CONCAT('HHF:INSTATE_CND:', g.handle);

UPDATE xseries x JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF' SET x.primary_series_id = s.id WHERE x.frequency_transform LIKE 'HHF:INSTATE_CND:%' AND x.primary_series_id IS NULL;

UPDATE xseries SET frequency_transform = NULL WHERE frequency_transform LIKE 'HHF:INSTATE_CND:%';

INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id FROM series s JOIN measurements m ON m.universe = 'HHF' AND m.prefix = 'INSTATE_CND' WHERE s.universe = 'HHF' AND s.name LIKE 'INSTATE_CND@%.A' AND NOT EXISTS (SELECT 1 FROM measurement_series ms WHERE ms.measurement_id = m.id AND ms.series_id = s.id);

INSERT INTO data_sources (series_id, universe, `eval`, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT s.id, 'HHF', CONCAT('Series.load_from_factbook(', @Q, 'INSTATE_CND', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), CONCAT('Factbook: INSTATE_CND @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), 0, '1.0', 0, 1, NOW(), NOW()
FROM series s WHERE s.universe = 'HHF' AND s.name LIKE 'INSTATE_CND@%.A' AND NOT EXISTS (SELECT 1 FROM data_sources ds WHERE ds.series_id = s.id AND ds.universe = 'HHF');

-- ═══════════════════════════════════════════════════════════════════════
-- Link to data list (property-transactions)
-- ═══════════════════════════════════════════════════════════════════════

SET @dl_id = (SELECT dl.id FROM data_lists dl WHERE dl.universe = 'HHF' AND dl.name = 'property-transactions' LIMIT 1);
SET @m_sfr = (SELECT id FROM measurements WHERE universe = 'HHF' AND prefix = 'INSTATE_SFR' LIMIT 1);
SET @m_cnd = (SELECT id FROM measurements WHERE universe = 'HHF' AND prefix = 'INSTATE_CND' LIMIT 1);
INSERT IGNORE INTO data_list_measurements (data_list_id, measurement_id, list_order, indent) VALUES (@dl_id, @m_sfr, 1, 'indent0');
INSERT IGNORE INTO data_list_measurements (data_list_id, measurement_id, list_order, indent) VALUES (@dl_id, @m_cnd, 2, 'indent0');
