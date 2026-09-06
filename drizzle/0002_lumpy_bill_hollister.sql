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
