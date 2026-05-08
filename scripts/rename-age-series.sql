-- Rename AGE0517 → AGE0514 and AGE1824 → AGE1524 (measurements, series, loaders)
-- The factbook file updated these age ranges.
--
-- Run: mysql -u <user> -p udaman < scripts/rename-age-series.sql

SET @Q = CHAR(34);

-- ═══════════════════════════════════════════════════════════════════════
-- AGE0517 → AGE0514
-- ═══════════════════════════════════════════════════════════════════════

-- Measurement
UPDATE measurements SET prefix = 'AGE0514', data_portal_name = 'age0514', updated_at = NOW() WHERE universe = 'HHF' AND prefix = 'AGE0517';

-- Series names
UPDATE series SET name = REPLACE(name, 'AGE0517@', 'AGE0514@'), updated_at = NOW() WHERE universe = 'HHF' AND name LIKE 'AGE0517@%';

-- Loader evals and descriptions
UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT('Series.load_from_factbook(', @Q, 'AGE0514', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), ds.description = CONCAT('Factbook: AGE0514 @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'AGE0514@%.A' AND ds.universe = 'HHF';

-- ═══════════════════════════════════════════════════════════════════════
-- AGE1824 → AGE1524
-- ═══════════════════════════════════════════════════════════════════════

-- Measurement
UPDATE measurements SET prefix = 'AGE1524', data_portal_name = 'age1524', updated_at = NOW() WHERE universe = 'HHF' AND prefix = 'AGE1824';

-- Series names
UPDATE series SET name = REPLACE(name, 'AGE1824@', 'AGE1524@'), updated_at = NOW() WHERE universe = 'HHF' AND name LIKE 'AGE1824@%';

-- Loader evals and descriptions
UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT('Series.load_from_factbook(', @Q, 'AGE1524', @Q, ', ', @Q, SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), @Q, ')'), ds.description = CONCAT('Factbook: AGE1524 @ ', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'AGE1524@%.A' AND ds.universe = 'HHF';
