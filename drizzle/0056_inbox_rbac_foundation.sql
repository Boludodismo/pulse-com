-- Restore only the existing RBAC table when absent from imported databases. No grants.
CREATE TABLE IF NOT EXISTS `user_module_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `studioId` int NOT NULL,
  `module` enum('clients','appointments','stock','finance','anamnesis','pod','reports','intelligent_inbox','inbox_conversations','inbox_summaries','inbox_priorities','inbox_opportunities','inbox_settings','inbox_suggestions') NOT NULL,
  `canRead` tinyint NOT NULL DEFAULT 0,
  `canWrite` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_permissions_user_studio_module_unique` (`userId`,`studioId`,`module`),
  KEY `user_module_permissions_studio_idx` (`studioId`)
);
