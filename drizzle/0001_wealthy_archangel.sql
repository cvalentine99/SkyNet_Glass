CREATE TABLE `skynet_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routerAddress` varchar(255) NOT NULL,
	`routerPort` int NOT NULL DEFAULT 80,
	`routerProtocol` varchar(10) NOT NULL DEFAULT 'http',
	`statsPath` varchar(255) NOT NULL DEFAULT '/ext/skynet/stats.js',
	`pollingInterval` int NOT NULL DEFAULT 300,
	`pollingEnabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skynet_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skynet_stats_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statsJson` json,
	`contentHash` varchar(64),
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_stats_cache_id` PRIMARY KEY(`id`)
);
