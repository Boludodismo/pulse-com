ALTER TABLE `users`
  ADD COLUMN `accessStatus` enum('active','suspended','expired') NOT NULL DEFAULT 'active',
  ADD COLUMN `accessExpiresAt` timestamp NULL;

CREATE TABLE `studio_invitations` (
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

CREATE TABLE `user_module_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `studioId` int NOT NULL,
  `module` enum('clients','appointments','stock','finance','anamnesis','pod','reports') NOT NULL,
  `canRead` tinyint NOT NULL DEFAULT 0,
  `canWrite` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_permissions_user_studio_module_unique` (`userId`,`studioId`,`module`),
  KEY `user_module_permissions_studio_idx` (`studioId`)
);
