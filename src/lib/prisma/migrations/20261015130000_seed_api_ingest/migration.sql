-- Seed the BEA, EIA and e-Stat ingest sources (src/core/ingest/sources):
-- one downloader and one extractor each. Like BLS and FRED, the fetch
-- list comes from the load_from_extract("<handle>", …) load statements
-- (plus config.extraFilters). Idempotent.

INSERT IGNORE INTO `data_downloaders`
  (`handle`, `source_key`, `strategy`, `config`, `schedule`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('bea', 'bea', 'custom', '{}', '40 6 * * *', 1,
   'BEA API, one request per Regional table and geo (LineCode=ALL) and per NIPA table (Frequency=A,Q,M); one artifact per series asked for.',
   NOW(), NOW()),
  ('eia', 'eia', 'custom', '{}', '50 6 * * *', 1,
   'EIA API v2, one request per route and frequency for every series id and scenario asked for; one artifact per series.',
   NOW(), NOW()),
  ('estatjp', 'estatjp', 'custom', '{}', '55 6 * * *', 1,
   'Japan e-Stat API 3.0, one request per table narrowed to the codes asked for; one artifact per series.',
   NOW(), NOW());

INSERT IGNORE INTO `data_extractors`
  (`handle`, `source_key`, `config`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('bea', 'bea', '{}', 1, 'BEA series: dataset, table, line, geo, frequency.', NOW(), NOW()),
  ('eia', 'eia', '{"checks": {"maxDate": "2100-01-01"}}', 1,
   'EIA series: route, scenario, series_id, frequency. AEO projects to 2050, hence maxDate.', NOW(), NOW()),
  ('estatjp', 'estatjp', '{}', 1, 'e-Stat monthly series: stats_data_id, tab, cat01, cat02, cat03, area.', NOW(), NOW());

INSERT IGNORE INTO `extractor_inputs` (`extractor_id`, `downloader_id`, `role`)
SELECT e.id, d.id, NULL
FROM `data_extractors` e
JOIN `data_downloaders` d ON d.handle = e.handle
WHERE e.handle IN ('bea', 'eia', 'estatjp');
