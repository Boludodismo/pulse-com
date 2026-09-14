ALTER TABLE `anamnese_requests` ADD `statusRequest` enum('pendente','preenchida','expirada','cancelada') DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `procedureType` enum('tatuagem','piercing','micropigmentacao','laser','consulta','retoque','outro');--> statement-breakpoint
ALTER TABLE `appointments` ADD `procedureTypeOther` varchar(255);