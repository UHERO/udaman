-- Track which worker processes are alive.
--
-- The scrape runner talks to hhdb directly (no BullMQ), so there's no queue to
-- inspect for liveness. Each process upserts its own row on a timer; the
-- dashboard treats a row as active if last_seen_at is recent.
--
-- Identity is worker_name + pid. worker_name comes from the WORKER_NAME env
-- var, falling back to os.hostname(). The fallback is deliberately a last
-- resort: on macOS the hostname is derived from DHCP/reverse-DNS when
-- `HostName` is unset, so the same machine reports different names on
-- different networks and would register as several distinct workers.
--
-- This table holds only ephemeral liveness state — nothing here is worth
-- preserving, so it is safe to drop and recreate.
DROP TABLE IF EXISTS scraper_heartbeats;

CREATE TABLE scraper_heartbeats (
    id            VARCHAR(120) NOT NULL PRIMARY KEY COMMENT 'worker_name:pid',
    worker_name   VARCHAR(100) NOT NULL COMMENT 'WORKER_NAME env, else hostname',
    -- OS hostname at process start. Kept purely for diagnostics: it shows
    -- which physical box / network a named worker is currently on.
    host          VARCHAR(150) NOT NULL,
    pid           INT UNSIGNED NOT NULL,

    -- Coarse phase: scraping, captcha-sleep, ... — see ScraperState in
    -- src/core/workers/scraper-heartbeat.ts
    state         VARCHAR(40)  NOT NULL DEFAULT 'starting',
    -- Human-readable qualifier for the state, e.g. '3 captchas in a row — sleeping 52m'
    detail        VARCHAR(255) NULL,

    scraped_count INT UNSIGNED NOT NULL DEFAULT 0,
    captcha_count INT UNSIGNED NOT NULL DEFAULT 0,

    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_last_seen_at (last_seen_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Liveness heartbeat for worker processes';
