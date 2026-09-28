-- Per-review message thread, so the author can ask a reviewer for
-- clarification (emailed to them) and both sides keep a visible history
-- alongside the kanban card, independent of the messages audit log table.

CREATE TABLE `review_messages` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `approval_review_id` INT NOT NULL,
  `sender_user_id`   INT NOT NULL,
  `sender`           VARCHAR(255) NOT NULL,
  `body`             TEXT NOT NULL,
  `emailed_at`       DATETIME NULL,
  `created_at`       TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_review_messages_review_created` (`approval_review_id`, `created_at`),
  CONSTRAINT `fk_review_messages_review` FOREIGN KEY (`approval_review_id`)
    REFERENCES `approval_reviews` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
