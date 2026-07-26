CREATE TABLE `settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`merchantName` varchar(255) NOT NULL,
	`merchantType` enum('physical','digital') NOT NULL,
	`amount` int NOT NULL,
	`deliveredCount` int NOT NULL DEFAULT 0,
	`cancelledCount` int NOT NULL DEFAULT 0,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `digital_sales` ADD `settlementId` int;--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `settlementId` int;