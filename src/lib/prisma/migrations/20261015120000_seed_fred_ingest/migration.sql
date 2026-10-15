-- Seed the FRED ingest source (src/core/ingest/sources/fred): one
-- downloader storing one artifact per (series, frequency, aggregation)
-- asked for by load_from_extract("fred", …) load statements, one
-- extractor. Idempotent.

INSERT IGNORE INTO `data_downloaders`
  (`handle`, `source_key`, `strategy`, `config`, `schedule`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('fred', 'fred', 'custom', '{}', '20 6 * * *', 1,
   'FRED API v1, one request per series/frequency/aggregation (FRED has no multi-series endpoint). Requests come from load_from_extract("fred", …) load statements.',
   NOW(), NOW());

INSERT IGNORE INTO `data_extractors`
  (`handle`, `source_key`, `config`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('fred', 'fred', '{}', 1,
   'FRED series: series_id, frequency, aggregation.',
   NOW(), NOW());

INSERT IGNORE INTO `extractor_inputs` (`extractor_id`, `downloader_id`, `role`)
SELECT e.id, d.id, NULL
FROM `data_extractors` e
JOIN `data_downloaders` d ON d.handle = 'fred'
WHERE e.handle = 'fred';
