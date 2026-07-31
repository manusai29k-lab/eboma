CREATE TABLE `profit_settlement_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`proofUrl` varchar(500),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profit_settlement_payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `profit_settlement_shares` ADD `payoutId` int;