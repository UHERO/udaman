-- Seed the Statistics Canada ingest source (src/core/ingest/sources/statcan):
-- one downloader storing two artifacts per vector asked for by
-- load_from_extract("statcan", …) load statements (<vector>/full, the
-- whole history, refreshed every fullRefreshDays; <vector>/updates, every
-- point released since), one extractor. WDS releases at 8:30 ET, so the
-- schedule is after that. Idempotent.

INSERT IGNORE INTO `data_downloaders`
  (`handle`, `source_key`, `strategy`, `config`, `schedule`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('statcan', 'statcan', 'custom', '{"fullRefreshDays": 90}', '0 6 * * *', 1,
   'Statistics Canada WDS: full history once per vector (and every fullRefreshDays), then every point released since (getBulkVectorDataByRange). Vectors come from load_from_extract("statcan", …) load statements.',
   NOW(), NOW());

INSERT IGNORE INTO `data_extractors`
  (`handle`, `source_key`, `config`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('statcan', 'statcan', '{}', 1,
   'StatCan vectors: series_id ("v2062810"), frequency. Values as published (scalar factor not applied).',
   NOW(), NOW());

INSERT IGNORE INTO `extractor_inputs` (`extractor_id`, `downloader_id`, `role`)
SELECT e.id, d.id, NULL
FROM `data_extractors` e
JOIN `data_downloaders` d ON d.handle = 'statcan'
WHERE e.handle = 'statcan';
