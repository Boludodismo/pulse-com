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
--> statement-breakpoint
CREATE TABLE `anamnesisRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`hasAllergies` boolean NOT NULL DEFAULT false,
	`allergiesDetails` text,
	`hasDiseases` boolean NOT NULL DEFAULT false,
	`diseasesDetails` text,
	`usesMedication` boolean NOT NULL DEFAULT false,
	`medicationDetails` text,
	`isPregnant` boolean NOT NULL DEFAULT false,
	`hasKeloid` boolean NOT NULL DEFAULT false,
	`acceptedTerms` boolean NOT NULL DEFAULT false,
	`signatureUrl` varchar(500),
	`pdfUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `anamnesisRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`calendarId` int,
	`date` timestamp NOT NULL,
	`duration` int NOT NULL,
	`service` varchar(255) NOT NULL,
	`artist` varchar(255) NOT NULL,
	`status` enum('agendado','confirmado','concluido','cancelado','reagendado') NOT NULL DEFAULT 'agendado',
	`notes` text,
	`referenceImageUrl` varchar(500),
	`referenceImageKey` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`instagram` varchar(100),
	`specialty` varchar(255),
	`bio` text,
	`photoUrl` varchar(500),
	`photoKey` varchar(500),
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(7) NOT NULL DEFAULT '#8b5cf6',
	`isVisible` tinyint NOT NULL DEFAULT 1,
	`isDefault` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`authorId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`artistId` int,
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`birthDate` timestamp,
	`instagram` varchar(100),
	`cep` varchar(10),
	`street` varchar(255),
	`number` varchar(20),
	`complement` varchar(100),
	`reference` varchar(255),
	`neighborhood` varchar(100),
	`city` varchar(100),
	`state` varchar(50),
	`country` varchar(50) DEFAULT 'Brasil',
	`gender` enum('Homem','Mulher','Outros'),
	`totalSpent` int NOT NULL DEFAULT 0,
	`appointmentCount` int NOT NULL DEFAULT 0,
	`loyaltyLevel` enum('Bronze','Prata','Ouro') NOT NULL DEFAULT 'Bronze',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `galleryImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`imageUrl` varchar(500) NOT NULL,
	`imageKey` varchar(500) NOT NULL,
	`description` text,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `galleryImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('appointment_reminder','birthday_reminder') NOT NULL,
	`appointmentId` int,
	`clientId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `studioSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioName` varchar(255),
	`address` varchar(500),
	`city` varchar(100),
	`state` varchar(50),
	`zipCode` varchar(20),
	`phone` varchar(20),
	`email` varchar(320),
	`website` varchar(255),
	`instagram` varchar(100),
	`logoUrl` varchar(500),
	`logoKey` varchar(500),
	`primaryColor` varchar(7) DEFAULT '#8b5cf6',
	`secondaryColor` varchar(7) DEFAULT '#a78bfa',
	`businessHours` text,
	`enableBirthdayReminders` int NOT NULL DEFAULT 1,
	`enableAppointmentReminders` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studioSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`appointmentId` int,
	`type` enum('entrada','saida') NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` text,
	`amount` int NOT NULL,
	`paymentMethod` enum('dinheiro','pix','credito','debito','transferencia') NOT NULL,
	`date` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','artist') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `artistId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` tinyint DEFAULT 1 NOT NULL;