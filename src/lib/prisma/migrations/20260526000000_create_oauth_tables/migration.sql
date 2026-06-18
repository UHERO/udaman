-- OAuth 2.1 authorization server tables (for MCP)
-- Token + code values stored as SHA-256 hex hashes 

DROP TABLE IF EXISTS oauth_access_tokens;
DROP TABLE IF EXISTS oauth_authorization_codes;
DROP TABLE IF EXISTS oauth_clients;

CREATE TABLE `oauth_clients` (
  `id`                         INT NOT NULL AUTO_INCREMENT,
  `client_id`                  VARCHAR(64)  NOT NULL,
  `client_name`                VARCHAR(255) NULL,
  `redirect_uris`              JSON         NOT NULL,
  `grant_types`                JSON         NOT NULL,
  `response_types`             JSON         NOT NULL,
  `token_endpoint_auth_method` VARCHAR(32)  NOT NULL DEFAULT 'none',
  `scope`                      VARCHAR(64)  NOT NULL DEFAULT 'mcp',
  `created_at`                 DATETIME(0)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_oauth_clients_client_id` (`client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `oauth_authorization_codes` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `code_hash`             CHAR(64)      NOT NULL,
  `client_id`             VARCHAR(64)   NOT NULL,
  `user_id`               INT           NOT NULL,
  `redirect_uri`          VARCHAR(2048) NOT NULL,
  `scope`                 VARCHAR(64)   NOT NULL DEFAULT 'mcp',
  `code_challenge`        VARCHAR(128)  NOT NULL,
  `code_challenge_method` VARCHAR(8)    NOT NULL DEFAULT 'S256',
  `expires_at`            DATETIME(0)   NOT NULL,
  `consumed_at`           DATETIME(0)   NULL,
  `created_at`            DATETIME(0)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_oauth_auth_codes_code_hash` (`code_hash`),
  INDEX `idx_oauth_auth_codes_expires_at` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `oauth_access_tokens` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `token_hash` CHAR(64)     NOT NULL,
  `client_id`  VARCHAR(64)  NOT NULL,
  `user_id`    INT          NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `scope`      VARCHAR(64)  NOT NULL DEFAULT 'mcp',
  `expires_at` DATETIME(0)  NOT NULL,
  `revoked_at` DATETIME(0)  NULL,
  `created_at` DATETIME(0)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_oauth_access_tokens_token_hash` (`token_hash`),
  INDEX `idx_oauth_access_tokens_user_id` (`user_id`),
  INDEX `idx_oauth_access_tokens_expires_at` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
