-- Data ingest: DataDownloaders acquire raw files unchanged; DataExtractors
-- parse stored raw files into a long CSV (declared dimensions, date, value)
-- that `Series.load_from_extract` reads with named filters.
-- See docs/2026-10-14-downloaders-extractors-spec.md and the Phase 1 report.
--
-- Code lives in src/core/ingest, keyed by `source_key`; these rows hold
-- config only. No table here is specific to one source.

-- One row per thing fetched (a file, a set of discovered files, an API).
CREATE TABLE `data_downloaders` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `handle`        VARCHAR(64)  NOT NULL,
  -- source module whose fetch() runs for strategy 'custom'; NULL for
  -- config-only strategies (static_url, discover_from_page)
  `source_key`    VARCHAR(64)  NULL,
  -- static_url | discover_from_page | custom (api, headless later)
  `strategy`      VARCHAR(32)  NOT NULL DEFAULT 'custom',
  `config`        JSON         NULL,
  -- implementation-owned bookkeeping between runs
  `state`         JSON         NULL,
  -- cron pattern, Pacific/Honolulu; NULL = manual runs only
  `schedule`      VARCHAR(64)  NULL,
  `enabled`       TINYINT(1)   NOT NULL DEFAULT 1,
  -- run claim (atomic UPDATE); stale after a few hours
  `running_since` DATETIME     NULL,
  `notes`         TEXT         NULL,
  `created_at`    DATETIME     NULL,
  `updated_at`    DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index_data_downloaders_on_handle` (`handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per distinct content of one logical file (`artifact_key`, e.g.
-- `collec/2025-12` or a BLS series id) of a downloader: a vintage. A fetch
-- that returns content already stored only bumps `last_seen_at`, so only
-- vintages with a distinct hash are kept. Files are content-addressed under
-- DATA_DIR (`storage_path` is relative to it).
CREATE TABLE `raw_artifacts` (
  `id`            INT           NOT NULL AUTO_INCREMENT,
  `downloader_id` INT           NOT NULL,
  `artifact_key`  VARCHAR(255)  NOT NULL,
  -- sha256 hex of the stored bytes
  `content_hash`  CHAR(64)      NOT NULL,
  `storage_path`  VARCHAR(512)  NOT NULL,
  `resolved_url`  VARCHAR(1024) NULL,
  -- file name as served (Content-Disposition or URL path)
  `original_name` VARCHAR(255)  NULL,
  `content_type`  VARCHAR(128)  NULL,
  `size`          BIGINT        NOT NULL,
  -- the source will not change this key again: never refetched
  `final`         TINYINT(1)    NOT NULL DEFAULT 0,
  -- navigation facts the fetch recorded (page title, revision note, ...)
  `metadata`      JSON          NULL,
  -- first fetch that returned this content / latest fetch that did
  `fetched_at`    DATETIME      NOT NULL,
  `last_seen_at`  DATETIME      NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_raw_artifacts_identity` (`downloader_id`, `artifact_key`, `content_hash`),
  KEY `idx_raw_artifacts_latest` (`downloader_id`, `artifact_key`, `last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per fetch attempt.
CREATE TABLE `fetch_runs` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `downloader_id` INT          NOT NULL,
  -- ok = at least one new vintage; unchanged = every key already stored
  `status`        ENUM('running','ok','unchanged','failed') NOT NULL DEFAULT 'running',
  -- schedule | cli | user:<id> | ...
  `triggered_by`  VARCHAR(64)  NULL,
  `error`         TEXT         NULL,
  `stats`         JSON         NULL,
  `started_at`    DATETIME     NOT NULL,
  `finished_at`   DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fetch_runs_downloader` (`downloader_id`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The artifacts a fetch run stored or saw again (changed = new vintage).
CREATE TABLE `fetch_run_artifacts` (
  `fetch_run_id`    INT        NOT NULL,
  `raw_artifact_id` INT        NOT NULL,
  `changed`         TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`fetch_run_id`, `raw_artifact_id`),
  KEY `idx_fetch_run_artifacts_artifact` (`raw_artifact_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per extraction. `source_key` names the parser module; several
-- extractors may share one module with different config.
CREATE TABLE `data_extractors` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `handle`        VARCHAR(64)  NOT NULL,
  `source_key`    VARCHAR(64)  NOT NULL,
  `config`        JSON         NULL,
  `enabled`       TINYINT(1)   NOT NULL DEFAULT 1,
  `running_since` DATETIME     NULL,
  `notes`         TEXT         NULL,
  `created_at`    DATETIME     NULL,
  `updated_at`    DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index_data_extractors_on_handle` (`handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which downloaders an extractor reads (many-to-many). `role` lets a parser
-- tell its inputs apart (e.g. current vs archive).
CREATE TABLE `extractor_inputs` (
  `extractor_id`  INT         NOT NULL,
  `downloader_id` INT         NOT NULL,
  `role`          VARCHAR(32) NULL,
  PRIMARY KEY (`extractor_id`, `downloader_id`),
  KEY `idx_extractor_inputs_downloader` (`downloader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per parse attempt. Loads read the output of the latest run with
-- status 'ok'. 'unchanged' = inputs_hash matched the last ok run, parse
-- skipped. A failed run whose failures are all soft checks can be accepted
-- (status becomes 'ok'; validation_results keeps the failures).
CREATE TABLE `extraction_runs` (
  `id`                 INT          NOT NULL AUTO_INCREMENT,
  `extractor_id`       INT          NOT NULL,
  `status`             ENUM('running','ok','unchanged','failed') NOT NULL DEFAULT 'running',
  `triggered_by`       VARCHAR(64)  NULL,
  -- the fetch run that led to this parse, if any
  `fetch_run_id`       INT          NULL,
  `input_artifact_ids` JSON         NULL,
  -- sha256 over the input content hashes, extractor config and parser version
  `inputs_hash`        CHAR(64)     NULL,
  `error`              TEXT         NULL,
  `validation_results` JSON         NULL,
  -- counts the parser reported (files parsed, months covered, ...)
  `stats`              JSON         NULL,
  -- relative to DATA_DIR
  `output_path`        VARCHAR(512) NULL,
  `output_hash`        CHAR(64)     NULL,
  `row_count`          INT          NULL,
  `series_count`       INT          NULL,
  `accepted_by`        INT          NULL,
  `accepted_at`        DATETIME     NULL,
  `started_at`         DATETIME     NOT NULL,
  `finished_at`        DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_extraction_runs_latest` (`extractor_id`, `status`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
