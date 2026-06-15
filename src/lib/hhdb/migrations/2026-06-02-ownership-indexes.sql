ALTER TABLE tg_transactions ADD INDEX idx_mailing_state (mailingState);
ALTER TABLE tg_transactions ADD INDEX idx_mailing_zip (mailingZipCode);
