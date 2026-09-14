CREATE TABLE `message_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integrationId` int NOT NULL,
	`appointmentId` int,
	`clientId` int,
	`recipientPhone` varchar(30) NOT NULL,
	`recipientName` varchar(255),
	`recipientType` enum('client','artist') NOT NULL,
	`message` text NOT NULL,
	`trigger` varchar(100),
	`status` enum('pendente','enviada','erro','cancelada','respondida') NOT NULL DEFAULT 'pendente',
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`errorMessage` text,
	`providerMessageId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`trigger` enum('appointment_created','appointment_confirmed','appointment_reminder_24h','appointment_reminder_2h','appointment_cancelled','appointment_rescheduled','custom') NOT NULL,
	`recipientType` enum('client','artist') NOT NULL,
	`message` text NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `whatsapp_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'WhatsApp Principal',
	`provider` enum('botconversa','zapi','meta') NOT NULL,
	`phoneNumber` varchar(30) NOT NULL,
	`apiToken` varchar(1000) NOT NULL,
	`instanceId` varchar(255),
	`webhookUrl` varchar(500),
	`status` enum('ativo','inativo','erro','aguardando') NOT NULL DEFAULT 'aguardando',
	`lastTestedAt` timestamp,
	`lastErrorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
