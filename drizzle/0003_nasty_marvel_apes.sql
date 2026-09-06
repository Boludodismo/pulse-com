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
