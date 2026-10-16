-- Seed the first ingest sources (src/core/ingest/sources): the two DOTAX
-- report downloaders feeding one `dotax` extractor, the DOTAX Google
-- Sheet, and BLS. Schedules are cron patterns in Pacific/Honolulu, read by
-- the worker at startup (production only). Idempotent.

INSERT IGNORE INTO `data_downloaders`
  (`handle`, `source_key`, `strategy`, `config`, `schedule`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('dotax_current', 'dotax', 'custom', '{"kind": "current", "liveYears": 1}', '10 5 * * *', 1,
   'DOTAX Current Monthly Tax Reports: one XLSX per report per month. Files before this year are final.',
   NOW(), NOW()),
  ('dotax_archive', 'dotax', 'custom', '{"kind": "archive", "firstMonth": "2002-01"}', '0 4 * * 0', 1,
   'DOTAX Archived Full Monthly Reports By Year: one zip per month, final on its first fetch.',
   NOW(), NOW()),
  ('dotax_sheet', 'dotax_sheet', 'custom',
   '{"sheetId": "1hSoKg8bpvZ_a9M00tShsa6NoU9dZfT_gTQua-3Xallo", "range": "Sheet1!A:F"}', '0 5 * * *', 1,
   'DOTAX Collections Portal Export Data Google Sheet: preliminary statewide collections.',
   NOW(), NOW()),
  ('bls', 'bls', 'custom', '{"refetchYears": 20}', '15 6,10 * * *', 1,
   'BLS v2 API, 50 series per request, one artifact per series and window. Series ids come from load_from_extract("bls", …) load statements.',
   NOW(), NOW());

INSERT IGNORE INTO `data_extractors`
  (`handle`, `source_key`, `config`, `enabled`, `notes`, `created_at`, `updated_at`)
VALUES
  ('dotax', 'dotax', '{}', 1,
   'DOTAX monthly reports, current page + archive: type, tax, source, area.',
   NOW(), NOW()),
  ('dotax_sheet', 'dotax_sheet', '{}', 1,
   'DOTAX Collections Portal sheet: type, tax, source (statewide).',
   NOW(), NOW()),
  ('bls', 'bls', '{}', 1,
   'BLS series by id: series_id, frequency.',
   NOW(), NOW());

INSERT IGNORE INTO `extractor_inputs` (`extractor_id`, `downloader_id`, `role`)
SELECT e.id, d.id, x.role
FROM (
  SELECT 'dotax' AS extractor, 'dotax_current' AS downloader, 'current' AS role
  UNION ALL SELECT 'dotax', 'dotax_archive', 'archive'
  UNION ALL SELECT 'dotax_sheet', 'dotax_sheet', NULL
  UNION ALL SELECT 'bls', 'bls', NULL
) x
JOIN `data_extractors` e ON e.handle = x.extractor
JOIN `data_downloaders` d ON d.handle = x.downloader;

-- Sidebar item "Ingest" owns the `ingest` permission resource (same
-- defaults as `download`: admin/dev only).
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`)
SELECT r.role, 'ingest', a.action, r.role IN ('dev', 'admin')
FROM (
  SELECT 'dev' AS role UNION ALL SELECT 'admin' UNION ALL SELECT 'internal'
  UNION ALL SELECT 'fellow' UNION ALL SELECT 'fsonly' UNION ALL SELECT 'external'
  UNION ALL SELECT 'mcp-only'
) r
CROSS JOIN (
  SELECT 'create' AS action UNION ALL SELECT 'read' UNION ALL SELECT 'update'
  UNION ALL SELECT 'delete'
) a
-- (WHERE ends the join, so ON DUPLICATE KEY isn't read as its condition)
WHERE TRUE
ON DUPLICATE KEY UPDATE `allowed` = VALUES(`allowed`), `updated_at` = NOW();
