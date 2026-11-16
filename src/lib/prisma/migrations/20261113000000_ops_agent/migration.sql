-- Ops agent backbone (docs/2026-11-13-ops-agent-design.md).
--
-- ops_issues          one row per (kind, subject); `open_fingerprint` holds the
--                     fingerprint until the issue is closed, so a unique index
--                     on it means one live issue per problem and recurrences
--                     reopen the same row.
-- ops_issue_events    append-only timeline (UI, Slack, MCP, agent, reconciler).
-- ops_proposals       changes awaiting review, in one queue. `lane` is the
--                     work class (errors | metadata) and only orders it.
-- ops_agent_runs      one row per agent run (cost, tokens, outcome).
-- ops_agent_run_steps the runner's tool-call log, for /admin/agent.
-- ops_settings        autonomy levels, queue size, required metadata fields,
--                     reviewers, budget (key/value).
-- ops_service_tokens  bearer tokens that authenticate the agent to /api/mcp/ops.
--
-- All DATETIMEs are HST wall-clock (NOW()).

CREATE TABLE `ops_issues` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `universe` VARCHAR(10) NOT NULL DEFAULT 'UHERO',
  `kind` VARCHAR(32) NOT NULL,
  `fingerprint` VARCHAR(191) NOT NULL,
  `open_fingerprint` VARCHAR(191) NULL,
  `subject_type` VARCHAR(32) NOT NULL,
  `subject_id` INT NULL,
  `subject_field` VARCHAR(64) NULL,
  `group_key` VARCHAR(191) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `severity` VARCHAR(10) NOT NULL DEFAULT 'normal',
  `owner` VARCHAR(10) NOT NULL DEFAULT 'agent',
  `assignee_user_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `summary` TEXT NULL,
  `detail` LONGTEXT NULL,
  `first_seen_at` DATETIME NOT NULL,
  `last_seen_at` DATETIME NOT NULL,
  `last_checked_at` DATETIME NULL,
  `occurrence_count` INT NOT NULL DEFAULT 1,
  `snoozed_until` DATETIME NULL,
  `dismissed_reason` VARCHAR(500) NULL,
  `resolved_at` DATETIME NULL,
  `resolution_path` VARCHAR(32) NULL,
  `resolved_by_user_id` INT NULL,
  `resolution_note` TEXT NULL,
  `reopen_count` INT NOT NULL DEFAULT 0,
  `last_human_event_at` DATETIME NULL,
  `last_agent_event_at` DATETIME NULL,
  `slack_channel` VARCHAR(64) NULL,
  `slack_ts` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_ops_issues_open_fingerprint` (`open_fingerprint`),
  INDEX `idx_ops_issues_universe_status` (`universe`, `status`),
  INDEX `idx_ops_issues_group_key` (`group_key`),
  INDEX `idx_ops_issues_subject` (`subject_type`, `subject_id`),
  INDEX `idx_ops_issues_slack_ts` (`slack_ts`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_issue_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `issue_id` INT NOT NULL,
  `actor_type` VARCHAR(10) NOT NULL,
  `actor_user_id` INT NULL,
  `via` VARCHAR(16) NOT NULL,
  `type` VARCHAR(32) NOT NULL,
  `body` TEXT NULL,
  `payload` LONGTEXT NULL,
  `slack_ts` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_issue_events_issue` (`issue_id`, `created_at`),
  UNIQUE INDEX `uniq_ops_issue_events_slack_ts` (`slack_ts`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_proposals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `universe` VARCHAR(10) NOT NULL DEFAULT 'UHERO',
  `issue_id` INT NULL,
  `group_key` VARCHAR(191) NULL,
  `kind` VARCHAR(32) NOT NULL,
  `lane` VARCHAR(16) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'queued',
  `summary` VARCHAR(500) NOT NULL,
  `targets` LONGTEXT NOT NULL,
  `evidence` LONGTEXT NULL,
  `dry_run` LONGTEXT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `days_pending` INT NOT NULL DEFAULT 1,
  `created_by_user_id` INT NULL,
  `posted_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `reviewed_by_user_id` INT NULL,
  `reviewed_via` VARCHAR(16) NULL,
  `reviewed_at` DATETIME NULL,
  `review_note` TEXT NULL,
  `applied_at` DATETIME NULL,
  `apply_result` LONGTEXT NULL,
  `slack_channel` VARCHAR(64) NULL,
  `slack_ts` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_proposals_status_lane` (`universe`, `status`, `lane`),
  INDEX `idx_ops_proposals_issue` (`issue_id`),
  INDEX `idx_ops_proposals_hash` (`content_hash`),
  INDEX `idx_ops_proposals_slack_ts` (`slack_ts`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_agent_runs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `universe` VARCHAR(10) NOT NULL DEFAULT 'UHERO',
  `trigger` VARCHAR(16) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'running',
  `model` VARCHAR(64) NOT NULL,
  `git_sha` VARCHAR(64) NULL,
  `started_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  `input_tokens` BIGINT NOT NULL DEFAULT 0,
  `output_tokens` BIGINT NOT NULL DEFAULT 0,
  `cache_write_tokens` BIGINT NOT NULL DEFAULT 0,
  `cache_read_tokens` BIGINT NOT NULL DEFAULT 0,
  `web_search_requests` INT NOT NULL DEFAULT 0,
  `cost_usd` DECIMAL(10, 4) NOT NULL DEFAULT 0,
  `issues_investigated` INT NOT NULL DEFAULT 0,
  `proposals_created` INT NOT NULL DEFAULT 0,
  `stop_reason` VARCHAR(64) NULL,
  `summary` TEXT NULL,
  `error` TEXT NULL,
  `slack_ts` VARCHAR(32) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_agent_runs_started` (`universe`, `started_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_agent_run_steps` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `run_id` INT NOT NULL,
  `issue_id` INT NULL,
  `seq` INT NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `tool_name` VARCHAR(128) NULL,
  `input` LONGTEXT NULL,
  `output` LONGTEXT NULL,
  `is_error` BOOLEAN NOT NULL DEFAULT false,
  `duration_ms` INT NULL,
  `cost_usd` DECIMAL(10, 4) NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_agent_run_steps_run` (`run_id`, `seq`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_settings` (
  `key` VARCHAR(96) NOT NULL,
  `value` VARCHAR(1000) NOT NULL,
  `updated_by_user_id` INT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_service_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `user_id` INT NOT NULL,
  `created_by_user_id` INT NULL,
  `created_at` DATETIME NOT NULL,
  `last_used_at` DATETIME NULL,
  `revoked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_ops_service_tokens_hash` (`token_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ties a loader edit to the issue that prompted it.
ALTER TABLE `data_source_actions` ADD COLUMN `ops_issue_id` INT NULL AFTER `eval`;

-- The agent's own account: edits are attributed to it. Empty password, so it
-- can't sign in to the UI; it authenticates only via ops_service_tokens.
INSERT IGNORE INTO `users` (`universe`, `role`, `email`, `name`, `created_at`, `updated_at`)
VALUES ('UHERO', 'internal', 'udaman-agent@uhero.hawaii.edu', 'UDAMAN Agent', NOW(), NOW());
