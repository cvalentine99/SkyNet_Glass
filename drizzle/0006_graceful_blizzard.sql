CREATE TABLE `device_policies` (
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
