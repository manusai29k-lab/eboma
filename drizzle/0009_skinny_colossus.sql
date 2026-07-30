CREATE TABLE `profit_settlement_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`merchantId` int NOT NULL,
	`role` enum('sales_rep','supervisor','leader','manager') NOT NULL,
	`overridePercentage` int NOT NULL,
	`shareAmount` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_settlement_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `profitSettlementId` int;