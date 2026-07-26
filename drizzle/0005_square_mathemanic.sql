ALTER TABLE `physical_orders` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `physical_products` ADD `stock` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_products` ADD `imageKey` text;--> statement-breakpoint
ALTER TABLE `physical_products` ADD `imageUrl` text;