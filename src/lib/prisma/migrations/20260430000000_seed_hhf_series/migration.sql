-- HHF Universe Series + Loaders Seed
--
-- Creates series for each (measurement × geography) combination where the
-- geography actually appears in the factbook file (70 of 97 geos), along
-- with their xseries records, measurement_series links, and data_sources
-- (loaders) with load_from_factbook eval expressions.
--
-- Prerequisite: the HHF universe, measurements, and geographies must exist
-- (created by seed.sql or a prior migration).

-- Step 1: Bulk-create xseries records.
-- One per (measurement × geography) pair. We store a temporary marker in
-- frequency_transform ('HHF:<prefix>:<handle>') so we can join back to the
-- measurement and geography when creating series. Cleared in step 4.
INSERT INTO xseries (frequency, seasonal_adjustment, percent, frequency_transform, created_at, updated_at)
SELECT
  'year',
  'not_applicable',
  IF(m.`percent`, 1, NULL),
  CONCAT('HHF:', m.prefix, ':', g.handle),
  NOW(), NOW()
FROM measurements m
CROSS JOIN geographies g
WHERE m.universe = 'HHF' AND g.universe = 'HHF'
  AND g.handle IN (
    'HI', 'HAW', 'HON', 'KAU', 'MAU',
    '96701', '96703', '96704', '96706', '96707', '96708', '96712',
    '96716', '96717', '96719', '96720', '96722', '96725', '96727',
    '96731', '96732', '96734', '96737', '96738', '96740', '96741',
    '96743', '96744', '96746', '96748', '96749', '96750', '96752',
    '96753', '96754', '96755', '96756', '96760', '96761', '96762',
    '96763', '96766', '96768', '96771', '96772', '96778', '96779',
    '96782', '96783', '96785', '96786', '96789', '96790', '96791',
    '96792', '96793', '96795', '96796', '96797', '96813', '96814',
    '96815', '96816', '96817', '96818', '96819', '96821', '96822',
    '96825', '96826'
  )
  AND NOT EXISTS (
    SELECT 1 FROM series s
    WHERE s.name = CONCAT(m.prefix, '@', g.handle, '.A')
      AND s.universe = 'HHF'
  );

-- Step 2: Create series records by joining xseries back via the marker.
INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
SELECT
  x.id,
  g.id,
  'HHF',
  CONCAT(m.prefix, '@', g.handle, '.A'),
  m.decimals,
  NOW(), NOW()
FROM xseries x
JOIN measurements m ON m.universe = 'HHF'
JOIN geographies g ON g.universe = 'HHF'
WHERE x.frequency_transform = CONCAT('HHF:', m.prefix, ':', g.handle);

-- Step 3: Set primary_series_id on xseries.
UPDATE xseries x
JOIN series s ON s.xseries_id = x.id AND s.universe = 'HHF'
SET x.primary_series_id = s.id
WHERE x.frequency_transform LIKE 'HHF:%'
  AND x.primary_series_id IS NULL;

-- Step 4: Clear the temporary marker.
UPDATE xseries
SET frequency_transform = NULL
WHERE frequency_transform LIKE 'HHF:%';

-- Step 5: Link measurements to series.
INSERT IGNORE INTO measurement_series (measurement_id, series_id)
SELECT m.id, s.id
FROM series s
JOIN measurements m ON m.universe = 'HHF'
  AND m.prefix = SUBSTRING_INDEX(s.name, '@', 1)
WHERE s.universe = 'HHF'
  AND NOT EXISTS (
    SELECT 1 FROM measurement_series ms
    WHERE ms.measurement_id = m.id AND ms.series_id = s.id
  );

-- Step 6: Create loaders (data_sources) for each series.
INSERT INTO data_sources (series_id, universe, eval, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
SELECT
  s.id,
  'HHF',
  CONCAT('Series.load_from_factbook("',
    SUBSTRING_INDEX(s.name, '@', 1), '", "',
    SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '")'),
  CONCAT('Factbook: ',
    SUBSTRING_INDEX(s.name, '@', 1), ' @ ',
    SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1)),
  0,
  '1.0',
  0,
  1,
  NOW(), NOW()
FROM series s
WHERE s.universe = 'HHF'
  AND NOT EXISTS (
    SELECT 1 FROM data_sources ds
    WHERE ds.series_id = s.id AND ds.universe = 'HHF'
  );
