-- ============================================================================
-- Add last_year_observed to snapshot tables, scraped_at to annual/tax-year tables
-- Ensures all periodic data records have tracking fields for change detection
-- and preventing duplicates across scrape cycles.
-- Columns are nullable; existing records will be backfilled separately.
-- ============================================================================

-- ─── Add last_year_observed to snapshot tables (already have scraped_at) ──────

ALTER TABLE owners
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE owners
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE parcels
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE parcels
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE land_classifications
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE land_classifications
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE residential_improvements
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE residential_improvements
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE residential_additions
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE residential_additions
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE commercial_improvements
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE commercial_improvements
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE commercial_improvement_details
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE commercial_improvement_details
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE yard_improvements
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE yard_improvements
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE agricultural_assessments
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE agricultural_assessments
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE accessory_structures
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE accessory_structures
  ADD INDEX idx_last_year_observed (last_year_observed);

ALTER TABLE current_tax_bills
  ADD COLUMN last_year_observed SMALLINT UNSIGNED NULL AFTER scraped_at;
ALTER TABLE current_tax_bills
  ADD INDEX idx_last_year_observed (last_year_observed);

-- ─── Add scraped_at to annual/tax-year tables ──────────────────────

ALTER TABLE assessments
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;
ALTER TABLE assessments
  ADD INDEX idx_scraped_at (scraped_at);

ALTER TABLE historical_tax_summary
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;
ALTER TABLE historical_tax_summary
  ADD INDEX idx_scraped_at (scraped_at);

ALTER TABLE historical_tax_details
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;

ALTER TABLE historical_tax_payments
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;

ALTER TABLE historical_tax_credits
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;

ALTER TABLE appeals
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;

ALTER TABLE dedications
  ADD COLUMN scraped_at DATETIME NULL AFTER tmk;
