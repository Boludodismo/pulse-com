CREATE TABLE `passwordResetTokens` (
`id` int AUTO_INCREMENT NOT NULL,
`userId` int NOT NULL,
`token` varchar(128) NOT NULL,
`expiresAt` timestamp NOT NULL,
`usedAt` timestamp,
`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT `idx_password_reset_token` UNIQUE(`token`)
);
