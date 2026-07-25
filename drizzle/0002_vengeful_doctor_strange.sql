ALTER TABLE `merchants` DROP INDEX `merchants_phone_unique`;--> statement-breakpoint
ALTER TABLE `physical_orders` MODIFY COLUMN `status` enum('new','preparing','shipped','delivered','cancelled','returned') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `merchants` ADD `username` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `merchantType` enum('physical','digital') DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `commission` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `digitalLevel` enum('1','2','3') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `failedAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `lockedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `merchants` ADD CONSTRAINT `merchants_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `merchants` DROP COLUMN `phone`;