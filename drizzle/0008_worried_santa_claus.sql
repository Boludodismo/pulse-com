ALTER TABLE `clients` ADD `number` varchar(20);--> statement-breakpoint
ALTER TABLE `clients` ADD `complement` varchar(100);--> statement-breakpoint
ALTER TABLE `clients` ADD `reference` varchar(255);--> statement-breakpoint
ALTER TABLE `clients` ADD `gender` enum('Homem','Mulher','Outros');