CREATE TABLE `app_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `level` ENUM('info','warn','error') NOT NULL DEFAULT 'info',
  `category` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `user_id` INT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_app_logs_category_created` (`category`, `created_at`),
  INDEX `idx_app_logs_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
