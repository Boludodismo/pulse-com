ALTER TABLE `purchase_orders`
  ADD COLUMN `receivedAt` bigint NULL AFTER `sentAt`,
  ADD COLUMN `receivedBy` int NULL AFTER `receivedAt`;
--> statement-breakpoint

ALTER TABLE `purchase_order_items`
  ADD COLUMN `catalogVariantId` int NULL AFTER `materialId`,
  ADD COLUMN `receivedQuantity` decimal(12,3) NULL AFTER `notes`,
  ADD COLUMN `receivedBaseQuantity` decimal(12,3) NULL AFTER `receivedQuantity`,
  ADD COLUMN `receivedLotNumber` varchar(100) NULL AFTER `receivedBaseQuantity`,
  ADD COLUMN `receivedExpiresAt` datetime NULL AFTER `receivedLotNumber`,
  ADD COLUMN `receivedAlertAt` datetime NULL AFTER `receivedExpiresAt`,
  ADD COLUMN `qualityStatus` enum('nao_verificada','aprovado','ressalva','recusado') NULL AFTER `receivedAlertAt`,
  ADD COLUMN `qualityNotes` text NULL AFTER `qualityStatus`,
  ADD COLUMN `receivedAt` bigint NULL AFTER `qualityNotes`;
