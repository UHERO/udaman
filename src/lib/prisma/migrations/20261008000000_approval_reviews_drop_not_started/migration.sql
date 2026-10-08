-- The review board drops its "Not Started" column: a review exists only once
-- someone has started it, so new reviews begin "In Progress". Move existing
-- cards over and change the default to match.
UPDATE `approval_reviews`
  SET `board_status` = 'in_progress'
  WHERE `board_status` = 'not_started';

ALTER TABLE `approval_reviews`
  MODIFY COLUMN `board_status` VARCHAR(20) NOT NULL DEFAULT 'in_progress';
