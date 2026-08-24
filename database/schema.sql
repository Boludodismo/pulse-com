-- ============================================
-- TATTOO STUDIO CRM - DATABASE SCHEMA
-- ============================================
-- MySQL 8.0+ / TiDB Compatible
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================

-- Set character set and collation
SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;

-- ============================================
-- TABLE: studios
-- Estúdios cadastrados no sistema
-- ============================================
CREATE TABLE IF NOT EXISTS `studios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320),
  `phone` VARCHAR(20),
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(50),
  `zipCode` VARCHAR(20),
  `masterKey` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Chave mestre para cadastro',
  `isActive` TINYINT NOT NULL DEFAULT 1 COMMENT '1 = ativo, 0 = desativado',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_studios_isActive` (`isActive`),
  INDEX `idx_studios_masterKey` (`masterKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: users
-- Usuários do sistema (superadmin, admin, collaborator)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `openId` VARCHAR(64) NOT NULL UNIQUE COMMENT 'ID OAuth da Manus',
  `name` TEXT,
  `email` VARCHAR(320),
  `loginMethod` VARCHAR(64),
  `role` ENUM('superadmin', 'admin', 'collaborator') NOT NULL DEFAULT 'collaborator',
  `studioId` INT COMMENT 'NULL para superadmin, ID do estúdio para admin/collaborator',
  `artistId` INT COMMENT 'Vincula colaborador a um artista específico (apenas para role=collaborator)',
  `isActive` TINYINT NOT NULL DEFAULT 1 COMMENT '1 = ativo, 0 = desativado',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_openId` (`openId`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_studioId` (`studioId`),
  INDEX `idx_users_artistId` (`artistId`),
  INDEX `idx_users_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: artists
-- Tatuadores/Artistas do estúdio
-- ============================================
CREATE TABLE IF NOT EXISTS `artists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studioId` INT NOT NULL COMMENT 'Estúdio ao qual o artista pertence',
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320),
  `phone` VARCHAR(20),
  `instagram` VARCHAR(100),
  `specialty` VARCHAR(255) COMMENT 'Especialidade (ex: realismo, old school, etc)',
  `bio` TEXT,
  `photoUrl` VARCHAR(500),
  `photoKey` VARCHAR(500),
  `active` INT NOT NULL DEFAULT 1 COMMENT 'boolean',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_artists_studioId` (`studioId`),
  INDEX `idx_artists_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: clients
-- Gestão completa de clientes do estúdio
-- ============================================
CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studioId` INT NOT NULL COMMENT 'Estúdio ao qual o cliente pertence',
  `artistId` INT COMMENT 'Artista responsável pelo cliente',
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320),
  `phone` VARCHAR(20),
  `birthDate` TIMESTAMP,
  `instagram` VARCHAR(100),
  -- Endereço
  `cep` VARCHAR(10),
  `street` VARCHAR(255),
  `number` VARCHAR(20),
  `complement` VARCHAR(100),
  `reference` VARCHAR(255),
  `neighborhood` VARCHAR(100),
  `city` VARCHAR(100),
  `state` VARCHAR(50),
  `country` VARCHAR(50) DEFAULT 'Brasil',
  -- Dados pessoais
  `gender` ENUM('Homem', 'Mulher', 'Outros'),
  -- Métricas calculadas
  `totalSpent` INT NOT NULL DEFAULT 0 COMMENT 'em centavos',
  `appointmentCount` INT NOT NULL DEFAULT 0,
  `loyaltyLevel` ENUM('Bronze', 'Prata', 'Ouro') NOT NULL DEFAULT 'Bronze',
  -- Timestamps
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clients_studioId` (`studioId`),
  INDEX `idx_clients_artistId` (`artistId`),
  INDEX `idx_clients_name` (`name`),
  INDEX `idx_clients_email` (`email`),
  INDEX `idx_clients_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: appointments
-- Sistema de agendamentos
-- ============================================
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studioId` INT NOT NULL COMMENT 'Estúdio ao qual o agendamento pertence',
  `clientId` INT NOT NULL,
  `calendarId` INT COMMENT 'ID do calendário personalizado (opcional)',
  `date` TIMESTAMP NOT NULL,
  `duration` INT NOT NULL COMMENT 'em minutos',
  `service` VARCHAR(255) NOT NULL,
  `artist` VARCHAR(255) NOT NULL,
  `status` ENUM('agendado', 'confirmado', 'concluido', 'cancelado', 'reagendado') NOT NULL DEFAULT 'agendado',
  `notes` TEXT,
  `referenceImageUrl` VARCHAR(500) COMMENT 'URL da imagem de referência no S3',
  `referenceImageKey` VARCHAR(500) COMMENT 'Chave da imagem no S3',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_appointments_studioId` (`studioId`),
  INDEX `idx_appointments_clientId` (`clientId`),
  INDEX `idx_appointments_date` (`date`),
  INDEX `idx_appointments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: anamnesisRecords
-- Fichas de anamnese digital
-- ============================================
CREATE TABLE IF NOT EXISTS `anamnesisRecords` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` INT NOT NULL,
  `appointmentId` INT,
  -- Informações de saúde
  `hasAllergies` BOOLEAN NOT NULL DEFAULT FALSE,
  `allergiesDetails` TEXT,
  `hasDiseases` BOOLEAN NOT NULL DEFAULT FALSE,
  `diseasesDetails` TEXT,
  `usesMedication` BOOLEAN NOT NULL DEFAULT FALSE,
  `medicationDetails` TEXT,
  `isPregnant` BOOLEAN NOT NULL DEFAULT FALSE,
  `hasKeloid` BOOLEAN NOT NULL DEFAULT FALSE,
  -- Nível de risco calculado automaticamente
  `riskLevel` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  `riskFactors` TEXT COMMENT 'JSON com fatores de risco identificados',
  -- Consentimento
  `acceptedTerms` BOOLEAN NOT NULL DEFAULT FALSE,
  `signatureUrl` VARCHAR(500),
  `pdfUrl` VARCHAR(500),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_anamnesis_clientId` (`clientId`),
  INDEX `idx_anamnesis_riskLevel` (`riskLevel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: transactions
-- Controle financeiro
-- ============================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studioId` INT NOT NULL COMMENT 'Estúdio ao qual a transação pertence',
  `clientId` INT COMMENT 'null para despesas gerais',
  `appointmentId` INT,
  `type` ENUM('entrada', 'saida') NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `amount` INT NOT NULL COMMENT 'em centavos',
  `paymentMethod` ENUM('dinheiro', 'pix', 'credito', 'debito', 'transferencia') NOT NULL,
  `date` TIMESTAMP NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_transactions_studioId` (`studioId`),
  INDEX `idx_transactions_clientId` (`clientId`),
  INDEX `idx_transactions_type` (`type`),
  INDEX `idx_transactions_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: clientNotes
-- Notas do tatuador sobre clientes
-- ============================================
CREATE TABLE IF NOT EXISTS `clientNotes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` INT NOT NULL,
  `authorId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clientNotes_clientId` (`clientId`),
  INDEX `idx_clientNotes_authorId` (`authorId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: galleryImages
-- Galeria de trabalhos por cliente
-- ============================================
CREATE TABLE IF NOT EXISTS `galleryImages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` INT NOT NULL,
  `appointmentId` INT,
  `imageUrl` VARCHAR(500) NOT NULL,
  `imageKey` VARCHAR(500) NOT NULL,
  `description` TEXT,
  `tags` TEXT COMMENT 'JSON string',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_galleryImages_clientId` (`clientId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: notificationLogs
-- Histórico de notificações enviadas
-- ============================================
CREATE TABLE IF NOT EXISTS `notificationLogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `type` ENUM('appointment_reminder', 'birthday_reminder') NOT NULL,
  `appointmentId` INT,
  `clientId` INT,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('sent', 'failed') NOT NULL,
  `sentAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notificationLogs_type` (`type`),
  INDEX `idx_notificationLogs_clientId` (`clientId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: studioSettings
-- Configurações do estúdio
-- ============================================
CREATE TABLE IF NOT EXISTS `studioSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  -- Informações básicas
  `studioName` VARCHAR(255),
  `address` VARCHAR(500),
  `city` VARCHAR(100),
  `state` VARCHAR(50),
  `zipCode` VARCHAR(20),
  `phone` VARCHAR(20),
  `email` VARCHAR(320),
  `website` VARCHAR(255),
  `instagram` VARCHAR(100),
  -- Identidade visual
  `logoUrl` VARCHAR(500),
  `logoKey` VARCHAR(500),
  `primaryColor` VARCHAR(7) DEFAULT '#8b5cf6' COMMENT 'roxo',
  `secondaryColor` VARCHAR(7) DEFAULT '#a78bfa',
  -- Horário de funcionamento (JSON string)
  `businessHours` TEXT COMMENT '{ "monday": { "open": "09:00", "close": "18:00" }, ... }',
  -- Configurações de notificações
  `enableBirthdayReminders` INT NOT NULL DEFAULT 1 COMMENT 'boolean',
  `enableAppointmentReminders` INT NOT NULL DEFAULT 1,
  -- Timestamps
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: auditLogs
-- Registro de todas as ações importantes do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS `auditLogs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studioId` INT COMMENT 'Estúdio ao qual a ação pertence',
  `userId` INT NOT NULL,
  `action` VARCHAR(100) NOT NULL COMMENT 'create, update, delete, etc',
  `entity` VARCHAR(100) NOT NULL COMMENT 'client, appointment, transaction, etc',
  `entityId` INT,
  `details` TEXT COMMENT 'JSON com detalhes da ação',
  `ipAddress` VARCHAR(45),
  `userAgent` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_auditLogs_studioId` (`studioId`),
  INDEX `idx_auditLogs_userId` (`userId`),
  INDEX `idx_auditLogs_action` (`action`),
  INDEX `idx_auditLogs_entity` (`entity`),
  INDEX `idx_auditLogs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: reportTemplates
-- Templates de relatórios personalizados
-- ============================================
CREATE TABLE IF NOT EXISTS `reportTemplates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `type` ENUM('financial', 'clients', 'appointments', 'custom') NOT NULL,
  `config` TEXT COMMENT 'JSON com configuração do relatório',
  `createdBy` INT NOT NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reportTemplates_type` (`type`),
  INDEX `idx_reportTemplates_createdBy` (`createdBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: customCalendars
-- Calendários personalizados por artista
-- ============================================
CREATE TABLE IF NOT EXISTS `customCalendars` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `artistId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `color` VARCHAR(7) DEFAULT '#8b5cf6',
  `description` TEXT,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customCalendars_artistId` (`artistId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

-- users -> studios
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- users -> artists
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_artistId`
  FOREIGN KEY (`artistId`) REFERENCES `artists`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- artists -> studios
ALTER TABLE `artists`
  ADD CONSTRAINT `fk_artists_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- clients -> studios
ALTER TABLE `clients`
  ADD CONSTRAINT `fk_clients_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- clients -> artists
ALTER TABLE `clients`
  ADD CONSTRAINT `fk_clients_artistId`
  FOREIGN KEY (`artistId`) REFERENCES `artists`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- appointments -> studios
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appointments_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- appointments -> clients
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appointments_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- appointments -> customCalendars
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appointments_calendarId`
  FOREIGN KEY (`calendarId`) REFERENCES `customCalendars`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- anamnesisRecords -> clients
ALTER TABLE `anamnesisRecords`
  ADD CONSTRAINT `fk_anamnesisRecords_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- anamnesisRecords -> appointments
ALTER TABLE `anamnesisRecords`
  ADD CONSTRAINT `fk_anamnesisRecords_appointmentId`
  FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- transactions -> studios
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- transactions -> clients
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- transactions -> appointments
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_appointmentId`
  FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- clientNotes -> clients
ALTER TABLE `clientNotes`
  ADD CONSTRAINT `fk_clientNotes_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- clientNotes -> users
ALTER TABLE `clientNotes`
  ADD CONSTRAINT `fk_clientNotes_authorId`
  FOREIGN KEY (`authorId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- galleryImages -> clients
ALTER TABLE `galleryImages`
  ADD CONSTRAINT `fk_galleryImages_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- galleryImages -> appointments
ALTER TABLE `galleryImages`
  ADD CONSTRAINT `fk_galleryImages_appointmentId`
  FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- notificationLogs -> clients
ALTER TABLE `notificationLogs`
  ADD CONSTRAINT `fk_notificationLogs_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- notificationLogs -> appointments
ALTER TABLE `notificationLogs`
  ADD CONSTRAINT `fk_notificationLogs_appointmentId`
  FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- auditLogs -> studios
ALTER TABLE `auditLogs`
  ADD CONSTRAINT `fk_auditLogs_studioId`
  FOREIGN KEY (`studioId`) REFERENCES `studios`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- auditLogs -> users
ALTER TABLE `auditLogs`
  ADD CONSTRAINT `fk_auditLogs_userId`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- reportTemplates -> users
ALTER TABLE `reportTemplates`
  ADD CONSTRAINT `fk_reportTemplates_createdBy`
  FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- customCalendars -> artists
ALTER TABLE `customCalendars`
  ADD CONSTRAINT `fk_customCalendars_artistId`
  FOREIGN KEY (`artistId`) REFERENCES `artists`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Insert default studio settings
INSERT INTO `studioSettings` (
  `studioName`,
  `primaryColor`,
  `secondaryColor`,
  `enableBirthdayReminders`,
  `enableAppointmentReminders`
) VALUES (
  'Meu Estúdio',
  '#8b5cf6',
  '#a78bfa',
  1,
  1
) ON DUPLICATE KEY UPDATE `id`=`id`;

-- ============================================
-- END OF SCHEMA
-- ============================================
