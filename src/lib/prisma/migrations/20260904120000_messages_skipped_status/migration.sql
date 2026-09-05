-- Sends short-circuited by MAIL_DISABLED / SLACK_DISABLED / SMS_DISABLED are
-- still recorded for auditability, but must not be reported as "sent".

ALTER TABLE `messages`
  MODIFY `status` ENUM('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending';
