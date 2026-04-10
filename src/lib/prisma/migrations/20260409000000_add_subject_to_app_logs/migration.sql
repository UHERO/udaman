ALTER TABLE app_logs
  ADD COLUMN subject VARCHAR(50) NULL AFTER user_id,
  ADD COLUMN subject_id INT NULL AFTER subject,
  ADD INDEX idx_app_logs_subject (subject, subject_id, created_at);
