CREATE TABLE `profit_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`productId` int,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`grossProfit` decimal(14,2) NOT NULL,
	`promotionCost` decimal(14,2) NOT NULL DEFAULT '0',
	`promotionProofUrl` varchar(500),
	`netProfit` decimal(14,2) NOT NULL,
	`merchantShare` decimal(14,2) NOT NULL,
	`managerOverrideShare` decimal(14,2),
	`companyShare` decimal(14,2) NOT NULL,
	`status` enum('draft','confirmed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profit_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `merchants` ADD `role` enum('sales_rep','supervisor','leader','manager') DEFAULT 'sales_rep' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `merchants` ADD `commissionType` enum('fixed','percentage') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `commissionValue` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `overridePercentage` int;