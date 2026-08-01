CREATE TABLE `profit_settlement_merchants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementId` int NOT NULL,
	`merchantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_settlement_merchants_id` PRIMARY KEY(`id`)
);
