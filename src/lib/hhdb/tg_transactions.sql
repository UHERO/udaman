-- Title Guaranty API data. Remote-only durable table: it is NOT in
-- hhdb-schema.sql / ALL_DATA_TABLES, so a qpub rebuild never drops it, and
-- it is loaded in bulk from TG outside this app (the loader keeps the previous
-- copy as tg_transactions_bak). Column names are camelCase — the loader's
-- spelling — and every query in the app (tg-series.ts, the dashboard
-- collection, the list view) uses them verbatim.
--
-- Mirrors SHOW CREATE TABLE on the remote as of 2026-09-22 (after that day's
-- reload). If the loader recreates the table, re-apply the KEYs below that it
-- does not know about — 2026-09-22 it rebuilt idx_tg_out_of_state with only
-- three of its five columns and the Transactions > Exploration page timed out.
--
-- The read model (src/core/catalog/models/hhdb-tg-transaction.ts) lists the
-- same columns in the same order; tg-transactions-ddl.test.ts keeps them equal.

CREATE TABLE IF NOT EXISTS `tg_transactions` (
  `id` INT NOT NULL,
  `taxKey` VARCHAR(13) NULL,
  `tmk` VARCHAR(18) NULL,
  `recDate` DATE NULL,
  `docType` VARCHAR(100) NULL,
  `firstPartyName` VARCHAR(255) NULL,
  `secondPartyName` VARCHAR(255) NULL,
  `conveyanceAmount` INT NULL,
  `considerationAmount` BIGINT NULL,
  `condoName` VARCHAR(255) NULL,
  `taxClass` VARCHAR(50) NULL,
  `transactionType` VARCHAR(50) NULL,
  `neighborhood` VARCHAR(100) NULL,
  `region` VARCHAR(100) NULL,
  `ownerName` VARCHAR(255) NULL,
  `lessee` VARCHAR(255) NULL,
  `mailingAddress` VARCHAR(255) NULL,
  `mailingApartmentNo` VARCHAR(70) NULL,
  `mailingCity` VARCHAR(100) NULL,
  `mailingState` VARCHAR(50) NULL,
  `mailingZipCode` VARCHAR(20) NULL,
  `mailingCountry` VARCHAR(100) NULL,
  `totalMarketValue` INT NULL,
  `buildingMarketValue` INT NULL,
  `landMarketValue` INT NULL,
  `buildingValue` INT NULL,
  `landValue` INT NULL,
  `totalAssessedValue` INT NULL,
  `buildingExemption` INT NULL,
  `landExemption` INT NULL,
  `totalExemption` INT NULL,
  `netValue` INT NULL,
  `totalNetValue` INT NULL,
  `currentTotalMarketValue` INT NULL,
  `currentBuildingMarketValue` INT NULL,
  `currentLandMarketValue` INT NULL,
  `currentBuildingValue` INT NULL,
  `currentLandValue` INT NULL,
  `currentTotalAssessedValue` INT NULL,
  `currentBuildingExemption` INT NULL,
  `currentLandExemption` INT NULL,
  `currentTotalExemption` INT NULL,
  `currentNetValue` INT NULL,
  `currentTotalNetValue` INT NULL,
  `propertyAddress` VARCHAR(255) NULL,
  `zoning` VARCHAR(50) NULL,
  `propertyArea` VARCHAR(50) NULL,
  `mortgageType` VARCHAR(100) NULL,
  `maturityDate` DATE NULL,
  PRIMARY KEY (`id`),
  -- Single-column indexes: the list view's sort / prefix-search whitelist
  -- (TG_SORTABLE_COLUMNS in the read model).
  INDEX `idx_taxKey` (`taxKey`),
  INDEX `idx_tmk` (`tmk`),
  INDEX `idx_recDate` (`recDate`),
  INDEX `idx_neighborhood` (`neighborhood`),
  INDEX `idx_mailing_state` (`mailingState`),
  INDEX `idx_mailing_zip` (`mailingZipCode`),
  -- Covering indexes for tg-series.ts (sales / dollar-volume series).
  INDEX `idx_tg_loader_state` (`docType`, `recDate`, `considerationAmount`, `taxClass`, `mailingState`, `mailingCountry`, `taxKey`),
  INDEX `idx_tg_loader_county` (`taxKey`, `docType`, `recDate`, `considerationAmount`, `taxClass`, `mailingState`, `mailingCountry`),
  -- Covering index for the Exploration tab's out-of-state charts
  -- (migrations/2026-09-08-tg-out-of-state-index.sql). All five columns
  -- are required: without mailingState the queries fall back to ~650k row
  -- lookups and time out.
  INDEX `idx_tg_out_of_state` (`conveyanceAmount`, `recDate`, `mailingState`, `mailingZipCode`, `mailingCity`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Title Guaranty API Data';
