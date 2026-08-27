-- Approvals table — sign-off records for work products before release.
--
-- The first (and currently only) type is `pre_release`, backing the UHERO
-- Pre-Release Form. Submitting the form IS the approval: the lead author is
-- the authenticated submitter, so `created_at` + `author_user_id` together
-- constitute the certification made in section D of the form.
--
-- Structured columns are the ones we list, sort, and filter by. Everything
-- else the form collects lives in `form_data` so the form can evolve without
-- a migration.

CREATE TABLE `approvals` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `type`                ENUM('pre_release') NOT NULL DEFAULT 'pre_release',
  `universe`            VARCHAR(10) NOT NULL DEFAULT 'UHERO',
  `name`                VARCHAR(500) NOT NULL,
  `author`              VARCHAR(255) NOT NULL,
  `author_user_id`      INT NOT NULL,
  `target_release_date` DATE NULL,
  `form_data`           JSON NOT NULL,
  `deleted_at`          DATETIME(0) NULL,
  `created_at`          TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_approvals_universe_created` (`universe`, `created_at`),
  INDEX `idx_approvals_author_user` (`author_user_id`),
  INDEX `idx_approvals_type_release` (`type`, `target_release_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Internal users hold `*/create|read|update` but deliberately not `*/delete`.
-- Authors must be able to withdraw their own form, and the delete is a soft
-- one, so grant this single exact-match override (exact beats wildcard in
-- PermissionCollection.isAllowed). Ownership is enforced in the controller.
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`)
VALUES ('internal', 'approval', 'delete', 1)
ON DUPLICATE KEY UPDATE `allowed` = 1;
