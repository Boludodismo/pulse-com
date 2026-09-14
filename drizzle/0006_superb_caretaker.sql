CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`action` enum('create','update','delete','activate','deactivate') NOT NULL,
	`entity` enum('user','client','appointment','transaction','artist','settings') NOT NULL,
	`entityId` int,
	`entityName` varchar(255),
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
