-- Add description and data_portal_url columns to the universe table
ALTER TABLE `universe`
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `data_portal_url` VARCHAR(255) NULL;
