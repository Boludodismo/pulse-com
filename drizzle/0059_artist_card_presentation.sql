-- Add optional editorial presentation to artist_cards (version 1)
-- Preserves all existing data; new field is nullable
ALTER TABLE `artist_cards`
ADD COLUMN `presentation` TEXT NULL COMMENT 'Editorial presentation JSON (version 1)' AFTER `images`;

