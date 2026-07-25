CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`passcode` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `digital_sales` ADD `digitalLevelAtSaleTime` enum('1','2','3') DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `commissionAtOrderTime` int DEFAULT 0 NOT NULL;