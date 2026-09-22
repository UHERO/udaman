-- Add primary keys to legacy Rails HABTM join tables (created with id: false).
-- All data is preserved.

-- 1. data_lists_series: dedup then add auto-increment PK
CREATE TABLE `data_lists_series_clean` AS
    SELECT DISTINCT `data_list_id`, `series_id` FROM `data_lists_series`;

TRUNCATE TABLE `data_lists_series`;

INSERT INTO `data_lists_series` (`data_list_id`, `series_id`)
    SELECT `data_list_id`, `series_id` FROM `data_lists_series_clean`;

DROP TABLE `data_lists_series_clean`;

ALTER TABLE `data_lists_series`
    ADD COLUMN `id` INT NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (`id`);

-- 2. geo_trees: add auto-increment PK
ALTER TABLE `geo_trees`
    ADD COLUMN `id` INT NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (`id`);

-- 3. reload_job_series: make columns NOT NULL, add composite PK
ALTER TABLE `reload_job_series`
    MODIFY COLUMN `reload_job_id` BIGINT NOT NULL,
    MODIFY COLUMN `series_id` BIGINT NOT NULL,
    ADD PRIMARY KEY (`reload_job_id`, `series_id`);

-- 4. user_series: make columns NOT NULL, add composite PK
ALTER TABLE `user_series`
    MODIFY COLUMN `user_id` BIGINT NOT NULL,
    MODIFY COLUMN `series_id` BIGINT NOT NULL,
    ADD PRIMARY KEY (`user_id`, `series_id`);
