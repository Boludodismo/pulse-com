ALTER TABLE `appointments`
  MODIFY COLUMN `confirmationStatus` enum('pendente','confirmado','nao_confirmado','atraso','chegada_antecipada','reagendar') DEFAULT 'pendente';
--> statement-breakpoint
ALTER TABLE `notificationLogs`
  MODIFY COLUMN `type` enum('appointment_reminder','birthday_reminder','whatsapp_primary','whatsapp_resend','appointment_response') NOT NULL;
