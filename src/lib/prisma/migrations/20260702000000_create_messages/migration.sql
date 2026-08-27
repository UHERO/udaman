-- Messages table for tracking all outbound notifications (email, slack, sms)

CREATE TABLE `messages` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `channel`    ENUM('email', 'slack', 'sms') NOT NULL,
  `sender`     VARCHAR(100) NULL,
  `from_addr`  VARCHAR(255) NULL,
  `recipient`  VARCHAR(500) NOT NULL,
  `subject`    VARCHAR(500) NULL,
  `body`       TEXT NOT NULL,
  `status`     ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `error`      TEXT NULL,
  `user_id`    INT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_messages_channel_created` (`channel`, `created_at`),
  INDEX `idx_messages_user_created` (`user_id`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
