import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Skynet router connection configuration.
 * Stores the router's address and polling settings.
 * Only one row expected (singleton config).
 */
export const skynetConfig = mysqlTable("skynet_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Router IP or hostname (e.g., "192.168.1.1") */
  routerAddress: varchar("routerAddress", { length: 255 }).notNull(),
  /** Router HTTP port (default 80 for http, 8443 for https) */
  routerPort: int("routerPort").notNull().default(80),
  /** Protocol: http or https */
  routerProtocol: varchar("routerProtocol", { length: 10 }).notNull().default("http"),
  /** Path to stats.js on the router (default: /user/skynet/stats.js) */
  statsPath: varchar("statsPath", { length: 255 }).notNull().default("/user/skynet/stats.js"),
  /** Polling interval in seconds (default: 300 = 5 minutes) */
  pollingInterval: int("pollingInterval").notNull().default(300),
  /** Whether polling is enabled */
  pollingEnabled: int("pollingEnabled").notNull().default(1),
  /** Router HTTP Basic Auth username (optional) */
  username: varchar("username", { length: 255 }),
  /** Router HTTP Basic Auth password (optional, stored encrypted) */
  password: varchar("password", { length: 512 }),
  /** Router geographic latitude (for Threat Map target location) */
  targetLat: float("targetLat"),
  /** Router geographic longitude (for Threat Map target location) */
  targetLng: float("targetLng"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkynetConfig = typeof skynetConfig.$inferSelect;

/**
 * Cached Skynet stats — stores the last successfully parsed stats.js data.
 * This allows the dashboard to display data even when the router is offline.
 */
export const skynetStatsCache = mysqlTable("skynet_stats_cache", {
  id: int("id").autoincrement().primaryKey(),
  /** The full parsed stats JSON */
  statsJson: json("statsJson"),
  /** Raw stats.js content hash to detect changes */
  contentHash: varchar("contentHash", { length: 64 }),
  /** When the stats were last fetched from the router */
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SkynetStatsCache = typeof skynetStatsCache.$inferSelect;

/**
 * Historical stats snapshots — stores KPI values on each successful fetch.
 * Used to build trend charts showing block counts over time.
 * One row per successful stats fetch.
 */
export const skynetStatsHistory = mysqlTable("skynet_stats_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Total IPs banned at time of snapshot */
  ipsBanned: int("ipsBanned").notNull().default(0),
  /** Total ranges banned at time of snapshot */
  rangesBanned: int("rangesBanned").notNull().default(0),
  /** Total inbound blocks at time of snapshot */
  inboundBlocks: int("inboundBlocks").notNull().default(0),
  /** Total outbound blocks at time of snapshot */
  outboundBlocks: int("outboundBlocks").notNull().default(0),
  /** Total blocks (inbound + outbound) */
  totalBlocks: int("totalBlocks").notNull().default(0),
  /** Number of unique countries seen in this snapshot */
  uniqueCountries: int("uniqueCountries").notNull().default(0),
  /** Number of unique ports targeted in this snapshot */
  uniquePorts: int("uniquePorts").notNull().default(0),
  /** Country distribution JSON — array of {code, country, blocks} */
  countryData: json("countryData"),
  /** Content hash of the stats.js that produced this snapshot */
  contentHash: varchar("contentHash", { length: 64 }),
  /** When this snapshot was taken */
  snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
});

export type SkynetStatsHistory = typeof skynetStatsHistory.$inferSelect;

/**
 * Alert configuration — stores thresholds and toggles for notifications.
 * Singleton row (one per installation).
 */
export const skynetAlertConfig = mysqlTable("skynet_alert_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Enable/disable all alerts */
  alertsEnabled: int("alertsEnabled").notNull().default(0),
  /** Notify when total blocks increase by this amount in one polling cycle */
  blockSpikeThreshold: int("blockSpikeThreshold").notNull().default(1000),
  /** Enable block spike alerts */
  blockSpikeEnabled: int("blockSpikeEnabled").notNull().default(1),
  /** Notify when a new country appears in the data */
  newCountryEnabled: int("newCountryEnabled").notNull().default(1),
  /** Notify when a new port is targeted that wasn't seen before */
  newPortEnabled: int("newPortEnabled").notNull().default(0),
  /** Minimum blocks from a country before alerting (prevents noise) */
  countryMinBlocks: int("countryMinBlocks").notNull().default(50),
  /** Cooldown in minutes between alerts of the same type */
  cooldownMinutes: int("cooldownMinutes").notNull().default(30),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkynetAlertConfig = typeof skynetAlertConfig.$inferSelect;

/**
 * Alert history — log of all notifications sent.
 */
export const skynetAlertHistory = mysqlTable("skynet_alert_history", {
  id: int("id").autoincrement().primaryKey(),
  /** Alert type: block_spike, new_country, new_port */
  alertType: varchar("alertType", { length: 50 }).notNull(),
  /** Human-readable title */
  title: varchar("title", { length: 255 }).notNull(),
  /** Detailed message content */
  content: text("content").notNull(),
  /** Whether the notification was successfully delivered */
  delivered: int("delivered").notNull().default(0),
  /** When the alert was triggered */
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
});

export type SkynetAlertHistory = typeof skynetAlertHistory.$inferSelect;
