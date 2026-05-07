SET @Q = CHAR(34);

UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT(@Q, 'MEDRENT_ACS@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts * 12 / 0.3'), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'NEEDEDINC\_RENT@%.A' AND s.name NOT LIKE 'NEEDEDINC\_RENT\_CRAIG@%' AND ds.universe = 'HHF';

UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT(@Q, 'MEDRENT_CRAIG@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts * 12 / 0.3'), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'NEEDEDINC\_RENT\_CRAIG@%.A' AND ds.universe = 'HHF';

UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT(@Q, 'MEDPRICETG_SFR@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts * 32 * (', @Q, 'RMORT@US.A', @Q, '.ts / 1200) * ((', @Q, 'RMORT@US.A', @Q, '.ts / 1200 + 1) ** 360) / ((', @Q, 'RMORT@US.A', @Q, '.ts / 1200 + 1) ** 360 - 1)'), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'NEEDEDINC\_SFR@%.A' AND ds.universe = 'HHF';

UPDATE data_sources ds JOIN series s ON s.id = ds.series_id SET ds.`eval` = CONCAT(@Q, 'MEDPRICETG_CND@', SUBSTRING_INDEX(SUBSTRING_INDEX(s.name, '@', -1), '.', 1), '.A', @Q, '.ts * 32 * (', @Q, 'RMORT@US.A', @Q, '.ts / 1200) * ((', @Q, 'RMORT@US.A', @Q, '.ts / 1200 + 1) ** 360) / ((', @Q, 'RMORT@US.A', @Q, '.ts / 1200 + 1) ** 360 - 1)'), ds.updated_at = NOW() WHERE s.universe = 'HHF' AND s.name LIKE 'NEEDEDINC\_CND@%.A' AND ds.universe = 'HHF';
