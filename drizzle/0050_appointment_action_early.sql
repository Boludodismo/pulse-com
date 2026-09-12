-- Ampliação aditiva dos valores permitidos; links e alertas existentes são preservados.
ALTER TABLE appointment_action_links
  MODIFY COLUMN action ENUM('confirmed', 'early', 'late', 'reschedule_requested') NOT NULL;

ALTER TABLE appointment_action_alerts
  MODIFY COLUMN action ENUM('confirmed', 'early', 'late', 'reschedule_requested') NOT NULL;
