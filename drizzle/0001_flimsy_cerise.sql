CREATE TABLE `digital_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` int NOT NULL,
	`type` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`merchantName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`productType` varchar(255) NOT NULL,
	`productPrice` int NOT NULL,
	`proofImageKey` text,
	`proofImageUrl` text,
	`status` enum('delivered','cancelled') NOT NULL DEFAULT 'delivered',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`passcode` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `merchants_id` PRIMARY KEY(`id`),
	CONSTRAINT `merchants_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `physical_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`merchantId` int NOT NULL,
	`merchantName` varchar(255) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`productType` varchar(255) NOT NULL,
	`productPrice` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`totalPrice` int NOT NULL,
	`province` varchar(255) NOT NULL,
	`district` varchar(255) NOT NULL,
	`notes` text,
	`status` enum('new','preparing','shipped','delivered','cancelled') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `physical_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `physical_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`price` int NOT NULL,
	`type` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `physical_products_id` PRIMARY KEY(`id`)
);
