CREATE TABLE IF NOT EXISTS `device_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceIp` varchar(45) NOT NULL,
	`deviceName` varchar(255),
	`macAddress` varchar(17),
	`policyType` enum('block_outbound','block_all') NOT NULL DEFAULT 'block_outbound',
	`enabled` int NOT NULL DEFAULT 1,
	`reason` text,
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skynet_alert_config` (
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
CREATE TABLE IF NOT EXISTS `skynet_alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`delivered` int NOT NULL DEFAULT 0,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skynet_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routerAddress` varchar(255) NOT NULL,
	`sshPort` int NOT NULL DEFAULT 22,
	`routerPort` int NOT NULL DEFAULT 80,
	`routerProtocol` varchar(10) NOT NULL DEFAULT 'http',
	`statsPath` varchar(255) NOT NULL DEFAULT '/user/skynet/stats.js',
	`pollingInterval` int NOT NULL DEFAULT 300,
	`pollingEnabled` int NOT NULL DEFAULT 1,
	`username` varchar(255),
	`password` varchar(512),
	`targetLat` float,
	`targetLng` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skynet_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skynet_stats_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statsJson` json,
	`contentHash` varchar(64),
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_stats_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `skynet_stats_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipsBanned` int NOT NULL DEFAULT 0,
	`rangesBanned` int NOT NULL DEFAULT 0,
	`inboundBlocks` int NOT NULL DEFAULT 0,
	`outboundBlocks` int NOT NULL DEFAULT 0,
	`totalBlocks` int NOT NULL DEFAULT 0,
	`uniqueCountries` int NOT NULL DEFAULT 0,
	`uniquePorts` int NOT NULL DEFAULT 0,
	`countryData` json,
	`contentHash` varchar(64),
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_stats_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
