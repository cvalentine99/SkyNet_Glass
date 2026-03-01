import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Content hash of the stats.js that produced this snapshot */
  contentHash: varchar("contentHash", { length: 64 }),
  /** When this snapshot was taken */
  snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
});

export type SkynetStatsHistory = typeof skynetStatsHistory.$inferSelect;
