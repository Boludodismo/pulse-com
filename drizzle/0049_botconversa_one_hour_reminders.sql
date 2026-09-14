ALTER TABLE message_automation_settings
  ADD COLUMN one_hour_reminders_enabled TINYINT NOT NULL DEFAULT 0
  AFTER appointment_send_time;
