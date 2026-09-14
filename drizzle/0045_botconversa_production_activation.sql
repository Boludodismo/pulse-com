ALTER TABLE `whatsapp_integrations`
  ADD COLUMN `production_activated_at` timestamp NULL,
  ADD COLUMN `production_activated_by_user_id` int NULL;
