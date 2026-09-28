-- Additive, restart-safe artist-card extension. No existing record is rewritten.
SET @tatuei_card_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'artist_cards' AND column_name = 'presentation') = 0, 'ALTER TABLE `artist_cards` ADD COLUMN `presentation` TEXT NULL', 'SELECT 1');
--> statement-breakpoint
PREPARE tatuei_card_statement FROM @tatuei_card_ddl;
--> statement-breakpoint
EXECUTE tatuei_card_statement;
--> statement-breakpoint
DEALLOCATE PREPARE tatuei_card_statement;
