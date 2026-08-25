-- Review pipeline for approvals (pre-release forms).
--
-- A form is "reviewed" once it has REQUIRED_REVIEWS (3, see
-- models/approval.ts) rows here. Status is derived from the count at read
-- time, never stored, so the threshold can change without a data migration.
--
-- A review is primarily an attestation checkbox plus free-form notes. One
-- review per person per form; re-submitting updates the existing row.

CREATE TABLE `approval_reviews` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `approval_id`      INT NOT NULL,
  `reviewer_user_id` INT NOT NULL,
  -- Display name denormalized for the same reason as approvals.author: a
  -- signed attestation shouldn't re-attribute itself if the user is renamed.
  `reviewer`         VARCHAR(255) NOT NULL,
  `attested`         TINYINT(1) NOT NULL DEFAULT 1,
  `notes`            TEXT NULL,
  `created_at`       TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_approval_reviews_approval_reviewer` (`approval_id`, `reviewer_user_id`),
  INDEX `idx_approval_reviews_reviewer` (`reviewer_user_id`),
  CONSTRAINT `fk_approval_reviews_approval`
    FOREIGN KEY (`approval_id`) REFERENCES `approvals` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- "Released" is an explicit mark by the author or an admin, not derived from
-- target_release_date, because target dates slip.
ALTER TABLE `approvals`
  ADD COLUMN `released_at` DATETIME(0) NULL AFTER `form_data`,
  ADD COLUMN `released_by_user_id` INT NULL AFTER `released_at`;
