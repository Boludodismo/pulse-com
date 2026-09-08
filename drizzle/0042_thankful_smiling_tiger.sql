-- Compatibilidade controlada para banco MySQL novo.
-- Esta migration substitui uma migration histórica destrutiva que divergia do schema atual.
-- Mantém as tabelas e colunas legadas usadas pelo CRM e adiciona apenas campos esperados pelo código atual.

ALTER TABLE `materials`
  ADD COLUMN `avgPrice` decimal(10,2) NOT NULL DEFAULT '0';
--> statement-breakpoint
ALTER TABLE `purchase_orders`
  ADD COLUMN `totalAmount` decimal(10,2) NULL;
--> statement-breakpoint
ALTER TABLE `purchase_order_items`
  ADD COLUMN `materialName` varchar(255) NULL,
  ADD COLUMN `materialUnit` varchar(50) NULL;
--> statement-breakpoint
ALTER TABLE `collaboratorRates`
  MODIFY COLUMN `userId` int NULL,
  MODIFY COLUMN `artistId` int NOT NULL,
  MODIFY COLUMN `percentage` int NOT NULL DEFAULT 50,
  ADD COLUMN `notes` varchar(500) NULL;
--> statement-breakpoint
ALTER TABLE `whatsapp_integrations`
  ADD COLUMN `studio_id` int NULL;
--> statement-breakpoint
ALTER TABLE `message_templates`
  ADD COLUMN `studio_id` int NULL,
  MODIFY COLUMN `trigger` enum('appointment_created','appointment_confirmed','appointment_reminder_24h','appointment_reminder_2h','appointment_reminder_1h','appointment_cancelled','appointment_rescheduled','care_guide','custom') NOT NULL;
--> statement-breakpoint
ALTER TABLE `message_queue`
  ADD COLUMN `studio_id` int NULL;
