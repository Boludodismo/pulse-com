ALTER TABLE `stock_movements`
  ADD COLUMN `alertAt` datetime NULL AFTER `expiresAt`;

ALTER TABLE `material_lots`
  ADD COLUMN `alertAt` datetime NULL AFTER `expiresAt`;

ALTER TABLE `procedure_consumables`
  ADD COLUMN `materialLotId` int NULL AFTER `inventoryItemId`,
  ADD COLUMN `lotNumber` varchar(100) NULL AFTER `materialLotId`,
  ADD COLUMN `expiresAt` datetime NULL AFTER `lotNumber`;

CREATE INDEX `procedure_consumables_lot_idx`
  ON `procedure_consumables` (`materialLotId`);
