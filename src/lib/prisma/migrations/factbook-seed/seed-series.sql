-- HHF Universe Series + Loaders Seed
--
-- Creates series for each (measurement × geography) combination where the
-- geography actually appears in the factbook file (70 of 97 geos), along
-- with their xseries records, measurement_series links, and data_sources
-- (loaders) with load_from_factbook eval expressions.
--
-- Prerequisite: seed.sql must have been run first (categories, data lists,
-- measurements, geographies).
--
-- Run: mysql -u root uhero_db_dev < src/lib/prisma/migrations/factbook-seed/seed-series.sql

DELIMITER //

CREATE PROCEDURE seed_hhf_series()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_prefix VARCHAR(255);
  DECLARE v_measurement_id INT;
  DECLARE v_decimals INT;
  DECLARE v_is_percent TINYINT;
  DECLARE v_geo_handle VARCHAR(255);
  DECLARE v_geo_id INT;
  DECLARE v_name VARCHAR(255);
  DECLARE v_xseries_id INT;
  DECLARE v_series_id INT;
  DECLARE v_created INT DEFAULT 0;
  DECLARE v_skipped INT DEFAULT 0;

  -- Only create series for geographies that actually appear in the factbook
  -- file (65 zipcodes + 4 counties + 1 state = 70 geos). Many ZCTAs from
  -- geo-data.csv are filtered out upstream due to small populations.
  DECLARE cur CURSOR FOR
    SELECT m.prefix, m.id, m.decimals, m.`percent`, g.handle, g.id
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
    ORDER BY m.prefix, g.handle;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_prefix, v_measurement_id, v_decimals, v_is_percent, v_geo_handle, v_geo_id;
    IF done THEN LEAVE read_loop; END IF;

    SET v_name = CONCAT(v_prefix, '@', v_geo_handle, '.A');

    -- Skip if series already exists
    IF NOT EXISTS (SELECT 1 FROM series WHERE name = v_name AND universe = 'HHF') THEN
      -- Create xseries
      INSERT INTO xseries (frequency, seasonal_adjustment, percent, created_at, updated_at)
      VALUES ('year', 'not_applicable', IF(v_is_percent, 1, NULL), NOW(), NOW());
      SET v_xseries_id = LAST_INSERT_ID();

      -- Create series
      INSERT INTO series (xseries_id, geography_id, universe, name, decimals, created_at, updated_at)
      VALUES (v_xseries_id, v_geo_id, 'HHF', v_name, v_decimals, NOW(), NOW());
      SET v_series_id = LAST_INSERT_ID();

      -- Set primary_series_id on xseries
      UPDATE xseries SET primary_series_id = v_series_id WHERE id = v_xseries_id;

      -- Link measurement to series
      INSERT IGNORE INTO measurement_series (measurement_id, series_id)
      VALUES (v_measurement_id, v_series_id);

      -- Create loader with eval expression
      INSERT INTO data_sources (series_id, universe, eval, description, priority, scale, disabled, reload_nightly, created_at, updated_at)
      VALUES (
        v_series_id,
        'HHF',
        CONCAT('Series.load_from_factbook("', v_prefix, '", "', v_geo_handle, '")'),
        CONCAT('Factbook: ', v_prefix, ' @ ', v_geo_handle),
        0,
        '1.0',
        0,
        1,
        NOW(), NOW()
      );

      SET v_created = v_created + 1;
    ELSE
      SET v_skipped = v_skipped + 1;
    END IF;
  END LOOP;

  CLOSE cur;

  SELECT v_created AS series_created, v_skipped AS series_skipped;
END //

DELIMITER ;

CALL seed_hhf_series();
DROP PROCEDURE IF EXISTS seed_hhf_series;
