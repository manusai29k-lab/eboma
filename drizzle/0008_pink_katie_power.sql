ALTER TABLE `merchants` ADD `canViewCosts` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `wholesaleCostAtOrderTime` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `deliveryCostAtOrderTime` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_orders` ADD `grossProfitAtOrderTime` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `physical_products` ADD `wholesaleCost` int;--> statement-breakpoint
ALTER TABLE `physical_products` ADD `deliveryCost` int;