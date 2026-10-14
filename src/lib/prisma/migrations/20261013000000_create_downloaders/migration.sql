-- Downloaders: code that fetches an outside source (API batches, scraped
-- report files, a Google Sheet), keeps its source files as Downloads and
-- writes one parsed output Download that load statements read through the
-- downloader's own load method (load_from_bls_api, load_from_dotax_*).
-- See docs/2026-10-12-downloaders-plan.md.
CREATE TABLE `downloaders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `handle` VARCHAR(64) NOT NULL,
  `config` JSON NULL,
  `state` JSON NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  -- reserved: not read yet (reloads stay on the off-hours schedules)
  `reload_on_change` TINYINT(1) NOT NULL DEFAULT 0,
  -- load-time freshness gate in minutes; NULL = only scheduled / manual runs
  `max_age_minutes` INT NULL DEFAULT 1440,
  `running_since` DATETIME NULL,
  `last_run_at` DATETIME NULL,
  `last_success_at` DATETIME NULL,
  `last_change_at` DATETIME NULL,
  `last_error` VARCHAR(500) NULL,
  `last_error_at` DATETIME NULL,
  `last_run_seconds` DECIMAL(10,3) NULL,
  `last_stats` JSON NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index_downloaders_on_handle` (`handle`)
);

-- Source files a downloader fetched (one row per file / zip) and the parsed
-- output it writes. `historical` = final: the owning downloader never
-- refetches it (unlike freeze_file, which is a manual temporary hold).
ALTER TABLE `downloads`
  ADD COLUMN `downloader_id` INT NULL,
  ADD COLUMN `downloader_role` ENUM('source','output') NULL,
  ADD COLUMN `historical` TINYINT(1) NOT NULL DEFAULT 0,
  ADD KEY `index_downloads_on_downloader_id` (`downloader_id`);

INSERT IGNORE INTO `downloaders` (`handle`, `config`, `max_age_minutes`, `notes`, `created_at`, `updated_at`) VALUES
  ('bls_api', '{"refetchYears": 20}', 1440,
   'BLS v2 API, batched 50 series per request. Series are collected from load_from_bls_api load statements.',
   NOW(), NOW()),
  ('dotax_sheet', '{"sheetId": "1hSoKg8bpvZ_a9M00tShsa6NoU9dZfT_gTQua-3Xallo", "range": "Sheet1!A:F"}', 1440,
   'DOTAX Collections Portal Export Data Google Sheet: preliminary statewide collections.',
   NOW(), NOW()),
  ('dotax_current', '{"liveYears": 1, "failOnProblems": true}', 1440,
   'DOTAX Current Monthly Tax Reports (one XLSX per report per month).',
   NOW(), NOW()),
  ('dotax_archive', '{"firstMonth": "2002-01", "failOnProblems": true}', NULL,
   'DOTAX Archived Full Monthly Reports (one zip per month, fetched once).',
   NOW(), NOW());

-- Sidebar item "Downloaders" owns the `downloader` permission resource
-- (same defaults as `download`: admin/dev only).
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES
  ('dev', 'downloader', 'create', 1),
  ('dev', 'downloader', 'read', 1),
  ('dev', 'downloader', 'update', 1),
  ('dev', 'downloader', 'delete', 1),
  ('admin', 'downloader', 'create', 1),
  ('admin', 'downloader', 'read', 1),
  ('admin', 'downloader', 'update', 1),
  ('admin', 'downloader', 'delete', 1),
  ('internal', 'downloader', 'create', 0),
  ('internal', 'downloader', 'read', 0),
  ('internal', 'downloader', 'update', 0),
  ('internal', 'downloader', 'delete', 0),
  ('fellow', 'downloader', 'create', 0),
  ('fellow', 'downloader', 'read', 0),
  ('fellow', 'downloader', 'update', 0),
  ('fellow', 'downloader', 'delete', 0),
  ('fsonly', 'downloader', 'create', 0),
  ('fsonly', 'downloader', 'read', 0),
  ('fsonly', 'downloader', 'update', 0),
  ('fsonly', 'downloader', 'delete', 0),
  ('external', 'downloader', 'create', 0),
  ('external', 'downloader', 'read', 0),
  ('external', 'downloader', 'update', 0),
  ('external', 'downloader', 'delete', 0),
  ('mcp-only', 'downloader', 'create', 0),
  ('mcp-only', 'downloader', 'read', 0),
  ('mcp-only', 'downloader', 'update', 0),
  ('mcp-only', 'downloader', 'delete', 0)
ON DUPLICATE KEY UPDATE `allowed` = VALUES(`allowed`), `updated_at` = NOW();
