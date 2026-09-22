-- CreateTable
CREATE TABLE `api_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `name` VARCHAR(255) NULL,
    `hostname` VARCHAR(255) NULL,
    `api_key` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `github_nickname` VARCHAR(255) NULL,

    UNIQUE INDEX `index_api_applications_on_universe_and_name`(`universe` ASC, `name` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ar_internal_metadata` (
    `key` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`key` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aremos_series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NULL,
    `frequency` VARCHAR(255) NULL,
    `description` VARCHAR(255) NULL,
    `start` VARCHAR(255) NULL,
    `end` VARCHAR(255) NULL,
    `data` LONGTEXT NULL,
    `aremos_data` LONGTEXT NULL,
    `aremos_update_date` DATE NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    INDEX `index_aremos_series_on_name`(`name` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authorizations` (
    `user_id` INTEGER NOT NULL,
    `provider` VARCHAR(255) NOT NULL,
    `provider_user_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,

    INDEX `fk_rails_4ecef5b8c5`(`user_id` ASC),
    INDEX `index_authorizations_on_provider_user_id`(`provider_user_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_code` (
    `last_branch_code_number` INTEGER NOT NULL DEFAULT 0
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data_list_id` INTEGER NULL,
    `default_geo_id` INTEGER NULL,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `hidden` BOOLEAN NULL DEFAULT false,
    `masked` BOOLEAN NOT NULL DEFAULT false,
    `header` BOOLEAN NULL DEFAULT false,
    `list_order` INTEGER NULL,
    `order` INTEGER NULL,
    `name` VARCHAR(255) NULL,
    `ancestry` VARCHAR(255) NULL,
    `default_handle` VARCHAR(255) NULL,
    `default_freq` ENUM('A', 'S', 'Q', 'M', 'W', 'D') NULL,
    `meta` VARCHAR(255) NULL,
    `description` VARCHAR(500) NULL,

    INDEX `fk_rails_c390c9a75e`(`default_geo_id` ASC),
    INDEX `fk_rails_cats_data_list_id`(`data_list_id` ASC),
    INDEX `index_categories_on_ancestry`(`ancestry` ASC),
    FULLTEXT INDEX `index_categories_on_name`(`name`),
    INDEX `index_categories_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_list_measurements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data_list_id` INTEGER NULL,
    `measurement_id` INTEGER NULL,
    `list_order` INTEGER NOT NULL DEFAULT 0,
    `indent` ENUM('indent0', 'indent1', 'indent2', 'indent3') NOT NULL DEFAULT 'indent0',

    INDEX `index_data_list_measurements_on_data_list_id`(`data_list_id` ASC),
    UNIQUE INDEX `index_data_list_measurements_on_data_list_id_and_measurement_id`(`data_list_id` ASC, `measurement_id` ASC),
    INDEX `index_data_list_measurements_on_measurement_id`(`measurement_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `name` VARCHAR(255) NULL,
    `startyear` INTEGER NULL,
    `endyear` INTEGER NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,
    `owned_by` INTEGER NULL,

    INDEX `index_data_lists_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_lists_series` (
    `data_list_id` INTEGER NOT NULL,
    `series_id` INTEGER NOT NULL,

    INDEX `index_data_lists_series_on_data_list_id`(`data_list_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_points` (
    `xseries_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `data_source_id` INTEGER NOT NULL,
    `current` BOOLEAN NULL,
    `value` DOUBLE NULL,
    `pseudo_history` INTEGER NULL DEFAULT 0,
    `history` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `change` DOUBLE NULL,
    `yoy` DOUBLE NULL,
    `ytd` DOUBLE NULL,

    INDEX `idx_data_points_xseries_current_date`(`xseries_id` ASC, `current` ASC, `date` ASC),
    INDEX `idx_data_points_xseries_updated`(`xseries_id` ASC, `updated_at` ASC),
    INDEX `index_on_data_source_id`(`data_source_id` ASC),
    PRIMARY KEY (`xseries_id` ASC, `date` ASC, `created_at` ASC, `data_source_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_source_actions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data_source_id` INTEGER NULL,
    `series_id` INTEGER NULL,
    `user_id` INTEGER NULL,
    `user_email` VARCHAR(255) NULL,
    `action` VARCHAR(255) NULL,
    `priority` INTEGER NULL,
    `eval` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    INDEX `fk_rails_cbe5366b13`(`series_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_source_downloads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data_source_id` INTEGER NULL,
    `download_id` INTEGER NULL,
    `last_file_vers_used` DATETIME(0) NOT NULL DEFAULT ('1970-01-01 00:00:00'),
    `last_eval_options_used` VARCHAR(1000) NULL,

    UNIQUE INDEX `index_data_source_downloads_on_data_source_id_and_download_id`(`data_source_id` ASC, `download_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `series_id` INTEGER NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `priority` INTEGER NULL DEFAULT 100,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `reload_nightly` BOOLEAN NULL DEFAULT true,
    `pseudo_history` BOOLEAN NOT NULL DEFAULT false,
    `clear_before_load` BOOLEAN NOT NULL DEFAULT false,
    `eval` VARCHAR(500) NULL,
    `scale` VARCHAR(255) NOT NULL DEFAULT '1.0',
    `presave_hook` VARCHAR(255) NULL,
    `color` VARCHAR(255) NULL,
    `runtime` FLOAT NULL,
    `last_run_at` DATETIME(0) NULL,
    `last_run_in_seconds` DECIMAL(17, 3) NULL,
    `last_error` VARCHAR(255) NULL,
    `last_error_at` DATETIME(0) NULL,
    `dependencies` TEXT NULL,
    `description` TEXT NULL,

    FULLTEXT INDEX `index_data_sources_on_dependencies`(`dependencies`),
    FULLTEXT INDEX `index_data_sources_on_description`(`description`),
    INDEX `index_data_sources_on_series_id`(`series_id` ASC),
    INDEX `index_data_sources_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dbedt_uploads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `upload_at` DATETIME(0) NULL,
    `active` BOOLEAN NULL,
    `cats_status` ENUM('processing', 'ok', 'fail') NULL,
    `series_status` ENUM('processing', 'ok', 'fail') NULL,
    `cats_filename` VARCHAR(255) NULL,
    `series_filename` VARCHAR(255) NULL,
    `last_error` VARCHAR(255) NULL,
    `last_error_at` DATETIME(0) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `downloads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `handle` VARCHAR(255) NULL,
    `sort1` INTEGER NULL,
    `sort2` INTEGER NULL,
    `url` VARCHAR(255) NULL,
    `filename_ext` ENUM('xlsx', 'xls', 'zip', 'csv', 'txt', 'pdf') NULL,
    `post_parameters` TEXT NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `last_download_at` DATETIME(0) NULL,
    `last_change_at` DATETIME(0) NULL,
    `date_sensitive` BOOLEAN NOT NULL DEFAULT false,
    `freeze_file` BOOLEAN NULL,
    `file_to_extract` VARCHAR(255) NULL,
    `sheet_override` VARCHAR(255) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `index_downloads_on_handle`(`handle` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dsd_log_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `download_id` INTEGER NULL,
    `time` DATETIME(0) NULL,
    `url` VARCHAR(255) NULL,
    `location` VARCHAR(255) NULL,
    `status` INTEGER NULL,
    `dl_changed` BOOLEAN NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `mimetype` VARCHAR(255) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dvw_uploads` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `upload_at` DATETIME(0) NULL,
    `active` BOOLEAN NULL,
    `cats_status` ENUM('processing', 'ok', 'fail') NULL,
    `series_status` ENUM('processing', 'ok', 'fail') NULL,
    `filename` VARCHAR(255) NULL,
    `last_error` VARCHAR(255) NULL,
    `last_error_at` DATETIME(0) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `export_id` INTEGER NULL,
    `series_id` INTEGER NULL,
    `list_order` INTEGER NULL,

    INDEX `index_export_series_on_export_id`(`export_id` ASC),
    UNIQUE INDEX `index_export_series_on_export_id_and_series_id`(`export_id` ASC, `series_id` ASC),
    INDEX `index_export_series_on_series_id`(`series_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `updated_by` INTEGER NULL,
    `owned_by` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_toggles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `name` VARCHAR(255) NULL,
    `description` VARCHAR(255) NULL,
    `status` BOOLEAN NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NULL,
    `version` VARCHAR(255) NULL,
    `published` BOOLEAN NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `new_forecast_tsd_filename` VARCHAR(255) NULL,
    `new_forecast_tsd_label` VARCHAR(255) NULL,
    `old_forecast_tsd_filename` VARCHAR(255) NULL,
    `old_forecast_tsd_label` VARCHAR(255) NULL,
    `history_tsd_filename` VARCHAR(255) NULL,
    `history_tsd_label` VARCHAR(255) NULL,
    `comments` TEXT NULL,

    UNIQUE INDEX `index_forecast_snapshots_on_name_and_version`(`name` ASC, `version` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `geo_trees` (
    `parent_id` INTEGER NOT NULL,
    `child_id` INTEGER NOT NULL,

    INDEX `fk_rails_20ee9a0990`(`parent_id` ASC),
    INDEX `fk_rails_5c6299c1f9`(`child_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `geographies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `handle` VARCHAR(255) NULL,
    `display_name` VARCHAR(255) NULL,
    `display_name_short` VARCHAR(255) NULL,
    `fips` VARCHAR(255) NULL,
    `list_order` INTEGER NULL,
    `geotype` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `index_geographies_on_universe_and_handle`(`universe` ASC, `handle` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measurement_series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `measurement_id` INTEGER NULL,
    `series_id` INTEGER NULL,

    INDEX `index_measurement_series_on_measurement_id`(`measurement_id` ASC),
    UNIQUE INDEX `index_measurement_series_on_measurement_id_and_series_id`(`measurement_id` ASC, `series_id` ASC),
    INDEX `index_measurement_series_on_series_id`(`series_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measurements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unit_id` INTEGER NULL,
    `source_id` INTEGER NULL,
    `source_detail_id` INTEGER NULL,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `prefix` VARCHAR(255) NOT NULL,
    `data_portal_name` VARCHAR(255) NULL,
    `table_prefix` VARCHAR(255) NULL,
    `table_postfix` VARCHAR(255) NULL,
    `frequency_transform` VARCHAR(255) NULL,
    `percent` BOOLEAN NULL,
    `real` BOOLEAN NULL,
    `decimals` INTEGER NOT NULL DEFAULT 1,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `seasonally_adjusted` BOOLEAN NULL,
    `seasonal_adjustment` ENUM('seasonally_adjusted', 'not_seasonally_adjusted', 'not_applicable') NULL,
    `source_link` VARCHAR(255) NULL,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_rails_c5bad45aff`(`unit_id` ASC),
    INDEX `fk_rails_e96addabdb`(`source_id` ASC),
    INDEX `fk_rails_f4c727584e`(`source_detail_id` ASC),
    INDEX `index_measurements_on_universe`(`universe` ASC),
    UNIQUE INDEX `index_measurements_on_universe_and_prefix`(`universe` ASC, `prefix` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `new_dbedt_uploads` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `upload_at` DATETIME(0) NULL,
    `active` BOOLEAN NULL,
    `status` ENUM('processing', 'ok', 'fail') NULL,
    `filename` VARCHAR(255) NULL,
    `last_error_at` DATETIME(0) NULL,
    `last_error` VARCHAR(255) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nta_uploads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `upload_at` DATETIME(0) NULL,
    `active` BOOLEAN NULL,
    `cats_status` ENUM('processing', 'ok', 'fail') NULL,
    `series_status` ENUM('processing', 'ok', 'fail') NULL,
    `series_filename` VARCHAR(255) NULL,
    `last_error` VARCHAR(255) NULL,
    `last_error_at` DATETIME(0) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packager_outputs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `path` VARCHAR(255) NULL,
    `last_new_data` DATE NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `public_data_points` (
    `series_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `value` DOUBLE NULL,
    `pseudo_history` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`series_id` ASC, `date` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reload_job_series` (
    `reload_job_id` BIGINT NULL,
    `series_id` BIGINT NULL,

    INDEX `index_reload_job_series_on_reload_job_id`(`reload_job_id` ASC),
    UNIQUE INDEX `index_reload_job_series_on_reload_job_id_and_series_id`(`reload_job_id` ASC, `series_id` ASC),
    INDEX `index_reload_job_series_on_series_id`(`series_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reload_jobs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `status` ENUM('processing', 'done', 'fail') NULL,
    `finished_at` DATETIME(0) NULL,
    `params` VARCHAR(255) NULL,
    `update_public` BOOLEAN NOT NULL DEFAULT false,
    `error` VARCHAR(255) NULL,

    INDEX `index_reload_jobs_on_user_id`(`user_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schema_migrations` (
    `version` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `unique_schema_migrations`(`version` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `series` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `xseries_id` INTEGER NOT NULL,
    `geography_id` INTEGER NULL,
    `unit_id` INTEGER NULL,
    `source_id` INTEGER NULL,
    `source_detail_id` INTEGER NULL,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `decimals` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(255) NULL,
    `dataPortalName` VARCHAR(255) NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `dependency_depth` INTEGER NULL DEFAULT 0,
    `source_link` VARCHAR(255) NULL,
    `investigation_notes` VARCHAR(500) NULL,
    `scratch` INTEGER NOT NULL DEFAULT 0,

    INDEX `fk_rails_1961e72b74`(`unit_id` ASC),
    INDEX `fk_rails_36c9ba7209`(`source_detail_id` ASC),
    INDEX `fk_rails_6f2f66e327`(`source_id` ASC),
    INDEX `fk_rails_963076a967`(`geography_id` ASC),
    INDEX `fk_rails_b3202f6d25`(`xseries_id` ASC),
    INDEX `index_series_on_name`(`name` ASC),
    INDEX `index_series_on_universe`(`universe` ASC),
    UNIQUE INDEX `index_series_on_universe_and_name`(`universe` ASC, `name` ASC),
    UNIQUE INDEX `index_series_on_universe_and_xseries_id`(`universe` ASC, `xseries_id` ASC),
    FULLTEXT INDEX `name_data_portal_name_description`(`name`, `dataPortalName`),
    INDEX `series_univ_x_id`(`universe` ASC, `xseries_id` ASC, `id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `series_reload_logs` (
    `batch_id` VARCHAR(255) NOT NULL,
    `series_id` INTEGER NOT NULL,
    `depth` INTEGER NULL,
    `job_id` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`batch_id` ASC, `series_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `source_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,
    `description` VARCHAR(1000) NULL,

    INDEX `index_source_details_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `description` VARCHAR(255) NULL,
    `link` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `index_sources_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tsd_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `forecast_snapshot_id` INTEGER NULL,
    `filename` VARCHAR(255) NULL,
    `latest_forecast` BOOLEAN NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'FC', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `short_label` VARCHAR(255) NULL,
    `long_label` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `index_units_on_universe_and_short_label_and_long_label`(`universe` ASC, `short_label` ASC, `long_label` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_series` (
    `user_id` BIGINT NULL,
    `series_id` BIGINT NULL,

    INDEX `index_user_series_on_series_id`(`series_id` ASC),
    INDEX `index_user_series_on_user_id`(`user_id` ASC),
    UNIQUE INDEX `index_user_series_on_user_id_and_series_id`(`user_id` ASC, `series_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `universe` ENUM('UHERO', 'DBEDT', 'NTA', 'COH', 'CCOM') NOT NULL DEFAULT 'UHERO',
    `role` ENUM('external', 'fsonly', 'internal', 'admin', 'dev') NOT NULL DEFAULT 'external',
    `mnemo_search` BOOLEAN NOT NULL DEFAULT false,
    `email` VARCHAR(255) NOT NULL DEFAULT '',
    `encrypted_password` VARCHAR(128) NOT NULL DEFAULT '',
    `password_salt` VARCHAR(255) NULL DEFAULT '',
    `reset_password_token` VARCHAR(255) NULL,
    `remember_token` VARCHAR(255) NULL,
    `remember_created_at` DATETIME(0) NULL,
    `sign_in_count` INTEGER NULL DEFAULT 0,
    `current_sign_in_at` DATETIME(0) NULL,
    `last_sign_in_at` DATETIME(0) NULL,
    `current_sign_in_ip` VARCHAR(255) NULL,
    `last_sign_in_ip` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `reset_password_sent_at` DATETIME(0) NULL,

    UNIQUE INDEX `index_users_on_email`(`email` ASC),
    UNIQUE INDEX `index_users_on_reset_password_token`(`reset_password_token` ASC),
    INDEX `index_users_on_universe`(`universe` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `xseries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `primary_series_id` INTEGER NULL,
    `restricted` BOOLEAN NOT NULL DEFAULT false,
    `quarantined` BOOLEAN NULL DEFAULT false,
    `frequency` VARCHAR(255) NULL,
    `seasonally_adjusted` BOOLEAN NULL,
    `seasonal_adjustment` ENUM('seasonally_adjusted', 'not_seasonally_adjusted', 'not_applicable') NULL,
    `aremos_missing` INTEGER NULL,
    `aremos_diff` FLOAT NULL,
    `mult` INTEGER NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,
    `units` INTEGER NOT NULL DEFAULT 1,
    `percent` BOOLEAN NULL,
    `real` BOOLEAN NULL,
    `base_year` INTEGER NULL,
    `frequency_transform` VARCHAR(255) NULL,
    `last_demetra_date` DATE NULL,
    `last_demetra_datestring` VARCHAR(255) NULL,
    `factor_application` VARCHAR(255) NULL,
    `factors` TEXT NULL,

    INDEX `fk_rails_4d09425f97`(`primary_series_id` ASC),
    INDEX `xseries_quar_id`(`quarantined` ASC, `id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `authorizations` ADD CONSTRAINT `fk_rails_4ecef5b8c5` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `fk_rails_c390c9a75e` FOREIGN KEY (`default_geo_id`) REFERENCES `geographies`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `fk_rails_cats_data_list_id` FOREIGN KEY (`data_list_id`) REFERENCES `data_lists`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `data_source_actions` ADD CONSTRAINT `fk_rails_cbe5366b13` FOREIGN KEY (`series_id`) REFERENCES `series`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `geo_trees` ADD CONSTRAINT `fk_rails_20ee9a0990` FOREIGN KEY (`parent_id`) REFERENCES `geographies`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `geo_trees` ADD CONSTRAINT `fk_rails_5c6299c1f9` FOREIGN KEY (`child_id`) REFERENCES `geographies`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `measurements` ADD CONSTRAINT `fk_rails_c5bad45aff` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `measurements` ADD CONSTRAINT `fk_rails_e96addabdb` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `measurements` ADD CONSTRAINT `fk_rails_f4c727584e` FOREIGN KEY (`source_detail_id`) REFERENCES `source_details`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `fk_rails_1961e72b74` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `fk_rails_36c9ba7209` FOREIGN KEY (`source_detail_id`) REFERENCES `source_details`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `fk_rails_6f2f66e327` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `fk_rails_963076a967` FOREIGN KEY (`geography_id`) REFERENCES `geographies`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `fk_rails_b3202f6d25` FOREIGN KEY (`xseries_id`) REFERENCES `xseries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `xseries` ADD CONSTRAINT `fk_rails_4d09425f97` FOREIGN KEY (`primary_series_id`) REFERENCES `series`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
