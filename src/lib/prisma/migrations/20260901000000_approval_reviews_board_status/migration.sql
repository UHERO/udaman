-- Author-set kanban status, independent of the reviewer's own attested
-- checkbox. Lets the author signal review progress without waiting on the
-- reviewer to fill out their form.
ALTER TABLE `approval_reviews`
  ADD COLUMN `board_status` VARCHAR(20) NOT NULL DEFAULT 'not_started' AFTER `notes`;
