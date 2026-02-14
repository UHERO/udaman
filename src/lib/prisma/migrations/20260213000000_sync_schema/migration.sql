-- DropForeignKey
ALTER TABLE `authorizations` DROP FOREIGN KEY `fk_rails_4ecef5b8c5`;

-- DropIndex (IF EXISTS — these indexes may not be present in all environments)
DROP INDEX IF EXISTS `idx_data_points_xseries_current_date` ON `data_points`;

-- DropIndex
DROP INDEX IF EXISTS `idx_data_points_xseries_updated` ON `data_points`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `email_verified` DATETIME(3) NULL,
    ADD COLUMN `image` VARCHAR(255) NULL,
    ADD COLUMN `name` VARCHAR(255) NULL;

-- DropTable
DROP TABLE `authorizations`;

-- DropTable
DROP TABLE `branch_code`;

-- CreateTable
CREATE TABLE `accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `provider` VARCHAR(255) NOT NULL,
    `provider_account_id` VARCHAR(255) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(255) NULL,
    `scope` VARCHAR(255) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(255) NULL,

    INDEX `index_accounts_on_user_id`(`user_id`),
    UNIQUE INDEX `index_accounts_on_provider_and_provider_account_id`(`provider`, `provider_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_token` VARCHAR(255) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expires` DATETIME(0) NOT NULL,

    UNIQUE INDEX `index_sessions_on_session_token`(`session_token`),
    INDEX `index_sessions_on_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `identifier` VARCHAR(255) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires` DATETIME(0) NOT NULL,

    PRIMARY KEY (`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `dp_xdc_uac` ON `data_points`(`xseries_id`, `date`, `current`, `updated_at`, `created_at`);

-- CreateIndex
CREATE INDEX `index_on_xseries_id` ON `data_points`(`xseries_id`);

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `fk_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
