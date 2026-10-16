-- Seed the DBEDT Data Book ingest source (src/core/ingest/sources/databook):
-- one downloader storing every edition's 24 section workbooks, one
-- extractor matching all editions to the base edition's series. DBEDT
-- publishes once a year (about August to October); the downloader runs once
-- a month, overnight, to pick up a new edition, or a revision to the current
-- one's files, within a month. Population projections run to
-- 2050, hence maxDate. Idempotent.

INSERT IGNORE INTO `data_downloaders`
  (`handle`, `source_key`, `strategy`, `config`, `schedule`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('databook', 'databook', 'custom', '{"firstEdition": 2002}', '30 3 15 * *', 1,
   'DBEDT Data Book: 24 section workbooks per edition, 2002 on. Older editions are final; the newest is refetched every run.',
   NOW(), NOW());

INSERT IGNORE INTO `data_extractors`
  (`handle`, `source_key`, `config`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('databook', 'databook', '{"baseEdition": 2025, "checks": {"maxDate": "2100-01-01"}}', 1,
   'Data Book, every edition matched to the base edition: section, table, name, geo, unit.',
   NOW(), NOW());

INSERT IGNORE INTO `extractor_inputs` (`extractor_id`, `downloader_id`, `role`)
SELECT e.id, d.id, NULL
FROM `data_extractors` e
JOIN `data_downloaders` d ON d.handle = 'databook'
WHERE e.handle = 'databook';
