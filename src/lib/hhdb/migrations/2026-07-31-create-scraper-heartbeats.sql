-- Track which scrape-runner processes are alive.
--
-- The scrape runner talks to hhdb directly (no BullMQ), so there's no queue to
-- inspect for liveness. Each process upserts its own row on a timer; the
-- dashboard treats a row as active if last_seen_at is recent.
--
-- Keyed by hostname + pid so one machine can run several instances.
CREATE TABLE scraper_heartbeats (
    id            VARCHAR(120) NOT NULL PRIMARY KEY COMMENT 'hostname:pid',
    hostname      VARCHAR(100) NOT NULL,
    pid           INT UNSIGNED NOT NULL,

    -- Coarse phase: scraping, sleeping, backoff, ... — see ScraperState in
    -- src/core/workers/scraper-heartbeat.ts
    state         VARCHAR(40)  NOT NULL DEFAULT 'starting',
    -- Human-readable qualifier for the state, e.g. 'captcha backoff 52m'
    detail        VARCHAR(255) NULL,

    scraped_count INT UNSIGNED NOT NULL DEFAULT 0,
    captcha_count INT UNSIGNED NOT NULL DEFAULT 0,

    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_last_seen_at (last_seen_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Liveness heartbeat for scrape-runner processes';
