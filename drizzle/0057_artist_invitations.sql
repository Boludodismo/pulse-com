-- Additive invitation extension. No users or credentials are changed.
CREATE TABLE IF NOT EXISTS `studio_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `role` enum('admin','collaborator') NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  `expiresAt` timestamp NOT NULL,
  `invitedByUserId` int NOT NULL,
  `acceptedUserId` int NULL,
  `acceptedAt` timestamp NULL,
  `revokedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `studio_invitations_tokenHash_unique` (`tokenHash`),
  KEY `studio_invitations_studio_idx` (`studioId`),
  KEY `studio_invitations_email_idx` (`email`)
);
--> statement-breakpoint
ALTER TABLE `studio_invitations` ADD COLUMN `artistId` int NULL;
--> statement-breakpoint
ALTER TABLE `studio_invitations` ADD COLUMN `permissionSnapshot` json NULL;
