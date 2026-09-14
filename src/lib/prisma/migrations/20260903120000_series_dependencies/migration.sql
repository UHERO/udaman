-- One row per (loader, series name it references). Built from the
-- `dependencies` JSON on data_sources by the nightly dependency reset
-- (LoaderCollection.setAllDependencies) and maintained on loader
-- create / recompute / delete.
--
-- Keyed by *name*, not series id, on purpose: dependency matching has
-- always been by name across universes (Series.get_all_dependencies in
-- Rails), and a referenced name may not exist yet. `universe` is the
-- loader's universe, so depth assignment can restrict to UHERO loaders
-- the way the temp-table port did.
CREATE TABLE `series_dependencies` (
  `data_source_id` INT          NOT NULL,
  `series_id`      INT          NOT NULL,
  `universe`       VARCHAR(10)  NOT NULL,
  `dep_name`       VARCHAR(255) NOT NULL,
  PRIMARY KEY (`data_source_id`, `dep_name`),
  INDEX `idx_series_dependencies_dep_name` (`dep_name`),
  INDEX `idx_series_dependencies_series_id` (`series_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
