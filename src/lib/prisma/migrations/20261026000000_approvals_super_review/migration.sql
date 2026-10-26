-- Manual "reviewed" mark. A form normally counts as reviewed once it has
-- REQUIRED_REVIEWS sign-offs, but not every form needs that many; the author
-- (or an admin) can mark it reviewed with fewer, the same way released_at is
-- an explicit mark.
ALTER TABLE `approvals`
  ADD COLUMN `super_review_at` DATETIME NULL AFTER `form_data`,
  ADD COLUMN `super_review_user_id` INT NULL AFTER `super_review_at`;
