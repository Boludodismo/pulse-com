-- Automação de lembretes por estúdio. Mudança somente aditiva; não remove dados legados.
CREATE TABLE IF NOT EXISTS `message_automation_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `appointment_reminders_enabled` tinyint NOT NULL DEFAULT 0,
  `appointment_days_before` int NOT NULL DEFAULT 1,
  `appointment_send_time` varchar(5) NOT NULL DEFAULT '10:00',
  `birthday_messages_enabled` tinyint NOT NULL DEFAULT 0,
  `birthday_send_time` varchar(5) NOT NULL DEFAULT '10:00',
  `birthday_message_template` text NULL,
  `timezone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  `last_appointment_cycle_at` timestamp NULL,
  `last_birthday_cycle_at` timestamp NULL,
  `last_error` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_automation_settings_studio_unique` (`studio_id`)
);

-- Preserva a preferência já existente exclusivamente para o estúdio principal legado.
INSERT IGNORE INTO `message_automation_settings` (
  `studio_id`,
  `appointment_reminders_enabled`,
  `appointment_days_before`,
  `appointment_send_time`,
  `birthday_messages_enabled`,
  `birthday_send_time`,
  `birthday_message_template`,
  `timezone`
)
SELECT
  1,
  `enableAppointmentReminders`,
  COALESCE(`reminderDaysBefore`, 1),
  COALESCE(`reminderSendTime`, '10:00'),
  `enableBirthdayReminders`,
  COALESCE(`reminderSendTime`, '10:00'),
  'Olá, {nome_cliente}! 🎉 Hoje é um dia especial. O time {nome_estudio} deseja um feliz aniversário, com muita saúde e realizações!',
  'America/Sao_Paulo'
FROM `studioSettings`
ORDER BY `id`
LIMIT 1;
