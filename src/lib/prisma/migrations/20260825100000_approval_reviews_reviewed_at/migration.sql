-- The "Reviewed" checkbox is a timestamp: when the reviewer signed off.
-- NULL = notes only, not yet signed off; such rows don't count toward
-- REQUIRED_REVIEWS. `attested` is kept in sync for older readers.
ALTER TABLE `approval_reviews`
  ADD COLUMN `reviewed_at` DATETIME(0) NULL AFTER `attested`;

UPDATE `approval_reviews` SET `reviewed_at` = `created_at` WHERE `attested` = 1;
