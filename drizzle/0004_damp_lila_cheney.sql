CREATE TABLE `skynet_stats_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipsBanned` int NOT NULL DEFAULT 0,
	`rangesBanned` int NOT NULL DEFAULT 0,
	`inboundBlocks` int NOT NULL DEFAULT 0,
	`outboundBlocks` int NOT NULL DEFAULT 0,
	`totalBlocks` int NOT NULL DEFAULT 0,
	`uniqueCountries` int NOT NULL DEFAULT 0,
	`uniquePorts` int NOT NULL DEFAULT 0,
	`contentHash` varchar(64),
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skynet_stats_history_id` PRIMARY KEY(`id`)
);
