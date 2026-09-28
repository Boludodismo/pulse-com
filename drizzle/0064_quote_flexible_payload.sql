-- Preserve existing quote rows while allowing multiple projects and image metadata.
ALTER TABLE `quote_proposals` MODIFY COLUMN `payload` MEDIUMTEXT NOT NULL;
