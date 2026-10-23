-- Lag limit for a loader: notify when its newest data point is more than
-- this many days past the end of its period (see
-- LoaderCollection.checkLoaderLag). NULL means the loader isn't monitored,
-- which is right for static history loaders.
ALTER TABLE `data_sources` ADD COLUMN `max_lag_days` INT NULL AFTER `presave_hook`;
