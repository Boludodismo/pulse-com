CREATE TABLE `anamnese_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`token` varchar(64) NOT NULL,
	`sentVia` enum('email','whatsapp') NOT NULL,
	`sentTo` varchar(320) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anamnese_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `anamnese_requests_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `anamnese_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anamnese_submissions_id` PRIMARY KEY(`id`)
);
