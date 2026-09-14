ALTER TABLE `appointments` ADD COLUMN `signalStatus` ENUM('aguardando_sinal','sinal_confirmado') DEFAULT 'aguardando_sinal';
ALTER TABLE `appointments` ADD COLUMN `paymentStatus` ENUM('pendente','pago') DEFAULT 'pendente';
ALTER TABLE `appointments` ADD COLUMN `paymentMethod` ENUM('dinheiro','pix','cartao_credito','cartao_debito','transferencia','outro');
CREATE TABLE `collaboratorRates` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `artistId` int, `percentage` decimal(5,2) NOT NULL, `studioId` int NOT NULL DEFAULT 1, `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (`id`));
