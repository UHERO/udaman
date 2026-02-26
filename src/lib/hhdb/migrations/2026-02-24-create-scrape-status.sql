-- Create scrape_status table to track QPub scrape/parse/load pipeline per property
CREATE TABLE scrape_status (
    tmk           VARCHAR(30)  NOT NULL PRIMARY KEY,
    scrape_status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    scraped_at    DATETIME     NULL,
    parse_status  ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    parsed_at     DATETIME     NULL,
    load_status   ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    loaded_at     DATETIME     NULL,
    retry_count   TINYINT      NOT NULL DEFAULT 0,
    error         TEXT         NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,

    INDEX idx_scrape_status (scrape_status),
    INDEX idx_scraped_at    (scraped_at),
    INDEX idx_parse_status  (parse_status),
    INDEX idx_load_status   (load_status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tracks QPub scrape → parse → load pipeline status per property';
