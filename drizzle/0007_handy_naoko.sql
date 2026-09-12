CREATE TABLE `reportTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`includeSections` text NOT NULL,
	`sectionOrder` text NOT NULL,
	`logsLimit` int NOT NULL DEFAULT 20,
	`usersLimit` int NOT NULL DEFAULT 5,
	`reportTitle` varchar(255),
	`reportSubtitle` text,
	`primaryColor` varchar(7) DEFAULT '#8b5cf6',
	`logoUrl` varchar(500),
	`logoKey` varchar(500),
	`footerText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportTemplates_id` PRIMARY KEY(`id`)
);
