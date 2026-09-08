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
	`date` timestamp NOT NULL,
	`duration` int NOT NULL,
	`service` varchar(255) NOT NULL,
	`artist` varchar(255) NOT NULL,
	`status` enum('agendado','confirmado','concluido','cancelado','reagendado') NOT NULL DEFAULT 'agendado',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
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
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`birthDate` timestamp,
	`instagram` varchar(100),
	`cep` varchar(10),
	`street` varchar(255),
	`neighborhood` varchar(100),
	`city` varchar(100),
	`state` varchar(50),
	`country` varchar(50) DEFAULT 'Brasil',
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
