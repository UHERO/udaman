-- CreateTable
CREATE TABLE `universe` (
    `name` VARCHAR(10) NOT NULL,
    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;

-- Seed universe values
INSERT INTO `universe` (`name`) VALUES
    ('UHERO'), ('FC'), ('DBEDT'), ('NTA'), ('COH'), ('CCOM');

-- Convert enum columns to VARCHAR(10) with FK to universe.
-- Explicit CHARACTER SET latin1 ensures FK charset match regardless of table default.

-- api_applications (latin1)
ALTER TABLE `api_applications`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_api_applications_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- categories (utf8mb3)
ALTER TABLE `categories`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_categories_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- data_lists (latin1)
ALTER TABLE `data_lists`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_data_lists_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- data_sources (utf8mb3)
ALTER TABLE `data_sources`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_data_sources_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- feature_toggles (latin1)
ALTER TABLE `feature_toggles`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_feature_toggles_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- geographies (utf8mb3)
ALTER TABLE `geographies`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_geographies_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- measurements (latin1)
ALTER TABLE `measurements`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_measurements_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- series (utf8mb3)
ALTER TABLE `series`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_series_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- source_details (latin1)
ALTER TABLE `source_details`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_source_details_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- sources (latin1)
ALTER TABLE `sources`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_sources_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- units (latin1)
ALTER TABLE `units`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_units_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- users (latin1)
ALTER TABLE `users`
    MODIFY COLUMN `universe` VARCHAR(10) CHARACTER SET latin1 NOT NULL DEFAULT 'UHERO',
    ADD CONSTRAINT `fk_users_universe`
        FOREIGN KEY (`universe`) REFERENCES `universe`(`name`)
        ON UPDATE CASCADE ON DELETE RESTRICT;
