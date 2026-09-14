CREATE TABLE `collaboratorRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`artistId` int,
	`percentage` decimal(5,2) NOT NULL,
	`studioId` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `signalStatus` enum('aguardando_sinal','sinal_confirmado') DEFAULT 'aguardando_sinal';--> statement-breakpoint
ALTER TABLE `appointments` ADD `paymentStatus` enum('pendente','pago') DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE `appointments` ADD `paymentMethod` enum('dinheiro','pix','cartao_credito','cartao_debito','transferencia','outro');