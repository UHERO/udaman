-- Data Registry: descriptive catalog of upstream data providers (BEA, DBEDT, ...)
-- One row per external source. author_id references the users table.

DROP TABLE IF EXISTS registry_posts;

CREATE TABLE `registry_posts` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(500)  NOT NULL,
  `source`      VARCHAR(255)  NOT NULL,
  `access`      VARCHAR(255)  NOT NULL,
  `owner`       VARCHAR(255)  NOT NULL,
  `contact`     VARCHAR(255)  NOT NULL,
  `format`      VARCHAR(16)   NOT NULL,
  `security`    VARCHAR(32)   NOT NULL,
  `description` TEXT          NOT NULL,
  `author_id`   INT           NOT NULL,
  `created_at`  DATETIME(0)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME(0)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_registry_posts_author_id` (`author_id`),
  CONSTRAINT `fk_registry_posts_author`
    FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
