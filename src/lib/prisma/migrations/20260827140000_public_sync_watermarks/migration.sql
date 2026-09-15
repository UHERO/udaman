-- Per-universe watermark for the incremental public_data_points sync.
-- synced_at      = start time of the last successful sync (any mode)
-- full_synced_at = start time of the last successful FULL pass; the sync
--                  self-heals with a full pass when this is older than 24h.
-- Timestamps are HST wall-clock (app convention), stamped from DB NOW().
CREATE TABLE `public_sync_watermarks` (
  `universe`       VARCHAR(10)  NOT NULL,
  `synced_at`      DATETIME(0)  NULL,
  `full_synced_at` DATETIME(0)  NULL,
  PRIMARY KEY (`universe`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
