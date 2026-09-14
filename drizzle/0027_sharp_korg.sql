ALTER TABLE `clients` ADD `docType` enum('cpf','passport') DEFAULT 'cpf';--> statement-breakpoint
ALTER TABLE `clients` ADD `docNumber` varchar(50);