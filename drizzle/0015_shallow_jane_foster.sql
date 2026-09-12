ALTER TABLE `anamnesisRecords` ADD `riskLevel` enum('low','medium','high','critical') DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` ADD `riskFactors` text;