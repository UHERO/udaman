ALTER TABLE tg_transactions ADD INDEX idx_mailing_state (mailing_state);
ALTER TABLE tg_transactions ADD INDEX idx_mailing_zip (mailing_zip_code);
