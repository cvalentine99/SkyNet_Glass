CREATE TABLE `skynet_alert_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertsEnabled` int NOT NULL DEFAULT 0,
	`blockSpikeThreshold` int NOT NULL DEFAULT 1000,
	`blockSpikeEnabled` int NOT NULL DEFAULT 1,
	`newCountryEnabled` int NOT NULL DEFAULT 1,
	`newPortEnabled` int NOT NULL DEFAULT 0,
	`countryMinBlocks` int NOT NULL DEFAULT 50,
	`cooldownMinutes` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skynet_alert_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skynet_alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`delivered` int NOT NULL DEFAULT 0,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `skynet_config` ADD `targetLat` float;--> statement-breakpoint
ALTER TABLE `skynet_config` ADD `targetLng` float;--> statement-breakpoint
ALTER TABLE `skynet_stats_history` ADD `countryData` json;