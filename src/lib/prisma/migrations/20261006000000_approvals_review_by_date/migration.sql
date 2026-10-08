-- "Review by" is when reviewers need to respond. It's tracked separately from
-- target_release_date because the gap between review and release varies by
-- publication type, so the release date alone doesn't tell reviewers when
-- they're needed. Existing forms stay NULL until the author edits them.
ALTER TABLE `approvals`
  ADD COLUMN `review_by_date` DATE NULL AFTER `target_release_date`,
  ADD INDEX `idx_approvals_type_review_by` (`type`, `review_by_date`);
