-- Data Registry: descriptive catalog of upstream data providers (BEA, DBEDT, ...)
-- data_registry table, plus requires_approval / approval_details columns.

DROP TABLE IF EXISTS registry_posts;
DROP TABLE IF EXISTS data_registry;

CREATE TABLE `data_registry` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `title`             VARCHAR(500)  NOT NULL,
  `source`            VARCHAR(255)  NOT NULL,
  `access`            VARCHAR(255)  NOT NULL,
  `owner`             VARCHAR(255)  NOT NULL,
  `contact`           VARCHAR(255)  NOT NULL,
  `format`            VARCHAR(16)   NOT NULL,
  `security`          VARCHAR(32)   NOT NULL,
  `requires_approval` TINYINT(1)    NOT NULL DEFAULT 0,
  `approval_details`  VARCHAR(500)  NULL,
  `description`       TEXT          NOT NULL,
  `author_id`         INT           NOT NULL,
  `created_at`        DATETIME(0)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME(0)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_data_registry_author_id` (`author_id`),
  CONSTRAINT `fk_data_registry_author`
    FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Permissions: internal users can create/read/update entries; delete is
-- gated in the action layer by author-or-admin ownership check instead.
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES
  ('internal', 'data-registry', 'create', 1),
  ('internal', 'data-registry', 'read', 1),
  ('internal', 'data-registry', 'update', 1)
ON DUPLICATE KEY UPDATE `allowed` = 1;
