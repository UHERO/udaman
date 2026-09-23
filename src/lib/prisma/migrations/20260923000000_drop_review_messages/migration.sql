-- Removes the review clarification-thread (chat) feature. Replaced by a
-- Slack notification on form submission; the `messages` audit log table is
-- unrelated and stays.

DROP TABLE IF EXISTS `review_messages`;
