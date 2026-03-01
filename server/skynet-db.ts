import { eq, desc, gte } from "drizzle-orm";
import { getDb } from "./db";
import {
  skynetConfig,
  skynetStatsCache,
  skynetStatsHistory,
  skynetAlertConfig,
  skynetAlertHistory,
  devicePolicies,
  type SkynetConfig,
  type SkynetStatsHistory,
  type SkynetAlertConfig,
  type SkynetAlertHistory,
  type DevicePolicy,
  type InsertDevicePolicy,
} from "../drizzle/schema";
import type { SkynetStats } from "./skynet-parser";

// ─── Config CRUD ────────────────────────────────────────────

export async function getSkynetConfig(): Promise<SkynetConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(skynetConfig).limit(1);
  return rows[0] ?? null;
}

export async function upsertSkynetConfig(config: {
  routerAddress: string;
  routerPort: number;
  routerProtocol: string;
  statsPath: string;
  pollingInterval: number;
  pollingEnabled: boolean;
  username?: string | null;
  password?: string | null;
  targetLat?: number | null;
  targetLng?: number | null;
}): Promise<SkynetConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getSkynetConfig();

  const values: Record<string, any> = {
    routerAddress: config.routerAddress,
    routerPort: config.routerPort,
    routerProtocol: config.routerProtocol,
    statsPath: config.statsPath,
    pollingInterval: config.pollingInterval,
    pollingEnabled: config.pollingEnabled ? 1 : 0,
    username: config.username ?? null,
    password: config.password ?? null,
  };

  // Only update target location if explicitly provided
  if (config.targetLat !== undefined) {
    values.targetLat = config.targetLat;
  }
  if (config.targetLng !== undefined) {
    values.targetLng = config.targetLng;
  }

  if (existing) {
    await db
      .update(skynetConfig)
      .set(values)
      .where(eq(skynetConfig.id, existing.id));

    return { ...existing, ...values } as SkynetConfig;
  }

  await db.insert(skynetConfig).values(values as any);

  const inserted = await getSkynetConfig();
  return inserted!;
}

/**
 * Update just the target location fields.
 */
export async function updateTargetLocation(lat: number | null, lng: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await getSkynetConfig();
  if (!existing) return;

  await db
    .update(skynetConfig)
    .set({ targetLat: lat, targetLng: lng })
    .where(eq(skynetConfig.id, existing.id));
}

// ─── Stats Cache ────────────────────────────────────────────

export async function getCachedStats(): Promise<{ stats: SkynetStats; fetchedAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(skynetStatsCache)
    .orderBy(desc(skynetStatsCache.fetchedAt))
    .limit(1);
  if (!rows[0] || !rows[0].statsJson) return null;
  return {
    stats: rows[0].statsJson as unknown as SkynetStats,
    fetchedAt: rows[0].fetchedAt,
  };
}

export async function saveCachedStats(stats: SkynetStats, contentHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Keep only the latest cache entry — delete old ones
  await db.delete(skynetStatsCache);

  await db.insert(skynetStatsCache).values({
    statsJson: stats as any,
    contentHash,
    fetchedAt: new Date(),
  });
}

export async function getLastContentHash(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ contentHash: skynetStatsCache.contentHash })
    .from(skynetStatsCache)
    .orderBy(desc(skynetStatsCache.fetchedAt))
    .limit(1);
  return rows[0]?.contentHash ?? null;
}

// ─── Historical Stats ──────────────────────────────────────

/**
 * Save a historical stats snapshot.
 * Called after each successful stats fetch when data has changed.
 * Now also stores country distribution data for historical playback.
 */
export async function saveStatsSnapshot(params: {
  ipsBanned: number;
  rangesBanned: number;
  inboundBlocks: number;
  outboundBlocks: number;
  totalBlocks: number;
  uniqueCountries: number;
  uniquePorts: number;
  contentHash: string;
  countryData?: Array<{ code: string; country: string; blocks: number }>;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(skynetStatsHistory).values({
    ipsBanned: params.ipsBanned,
    rangesBanned: params.rangesBanned,
    inboundBlocks: params.inboundBlocks,
    outboundBlocks: params.outboundBlocks,
    totalBlocks: params.totalBlocks,
    uniqueCountries: params.uniqueCountries,
    uniquePorts: params.uniquePorts,
    countryData: params.countryData ? (params.countryData as any) : null,
    contentHash: params.contentHash,
    snapshotAt: new Date(),
  });
}

/**
 * Get historical stats snapshots within a time range.
 * @param hoursBack - How many hours back to look (default 24)
 * @param limit - Max number of rows (default 500)
 */
export async function getStatsHistory(hoursBack: number = 24, limit: number = 500): Promise<SkynetStatsHistory[]> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(skynetStatsHistory)
    .where(gte(skynetStatsHistory.snapshotAt, since))
    .orderBy(desc(skynetStatsHistory.snapshotAt))
    .limit(limit);

  return rows;
}

// ─── Alert Config CRUD ─────────────────────────────────────

export async function getAlertConfig(): Promise<SkynetAlertConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(skynetAlertConfig).limit(1);
  return rows[0] ?? null;
}

export async function upsertAlertConfig(config: {
  alertsEnabled: boolean;
  blockSpikeThreshold: number;
  blockSpikeEnabled: boolean;
  newCountryEnabled: boolean;
  newPortEnabled: boolean;
  countryMinBlocks: number;
  cooldownMinutes: number;
}): Promise<SkynetAlertConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getAlertConfig();

  const values = {
    alertsEnabled: config.alertsEnabled ? 1 : 0,
    blockSpikeThreshold: config.blockSpikeThreshold,
    blockSpikeEnabled: config.blockSpikeEnabled ? 1 : 0,
    newCountryEnabled: config.newCountryEnabled ? 1 : 0,
    newPortEnabled: config.newPortEnabled ? 1 : 0,
    countryMinBlocks: config.countryMinBlocks,
    cooldownMinutes: config.cooldownMinutes,
  };

  if (existing) {
    await db
      .update(skynetAlertConfig)
      .set(values)
      .where(eq(skynetAlertConfig.id, existing.id));
    return { ...existing, ...values } as SkynetAlertConfig;
  }

  await db.insert(skynetAlertConfig).values(values);
  const inserted = await getAlertConfig();
  return inserted!;
}

// ─── Alert History ──────────────────────────────────────────

export async function saveAlertRecord(params: {
  alertType: string;
  title: string;
  content: string;
  delivered: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(skynetAlertHistory).values({
    alertType: params.alertType,
    title: params.title,
    content: params.content,
    delivered: params.delivered ? 1 : 0,
    triggeredAt: new Date(),
  });
}

export async function getAlertHistory(limit: number = 50): Promise<SkynetAlertHistory[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(skynetAlertHistory)
    .orderBy(desc(skynetAlertHistory.triggeredAt))
    .limit(limit);

  return rows;
}

/**
 * Get the most recent alert of a given type.
 * Used for cooldown checks.
 */
export async function getLastAlertOfType(alertType: string): Promise<SkynetAlertHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(skynetAlertHistory)
    .where(eq(skynetAlertHistory.alertType, alertType))
    .orderBy(desc(skynetAlertHistory.triggeredAt))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Device Policies CRUD ─────────────────────────────────

export async function getDevicePolicies(): Promise<DevicePolicy[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(devicePolicies)
    .orderBy(desc(devicePolicies.createdAt));

  return rows;
}

export async function getDevicePolicyByIp(ip: string): Promise<DevicePolicy | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(devicePolicies)
    .where(eq(devicePolicies.deviceIp, ip))
    .limit(1);

  return rows[0] ?? null;
}

export async function createDevicePolicy(policy: {
  deviceIp: string;
  deviceName?: string | null;
  macAddress?: string | null;
  policyType: "block_outbound" | "block_all";
  reason?: string | null;
  createdBy?: string | null;
}): Promise<DevicePolicy> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(devicePolicies).values({
    deviceIp: policy.deviceIp,
    deviceName: policy.deviceName ?? null,
    macAddress: policy.macAddress ?? null,
    policyType: policy.policyType,
    enabled: 1,
    reason: policy.reason ?? null,
    createdBy: policy.createdBy ?? null,
  });

  const inserted = await getDevicePolicyByIp(policy.deviceIp);
  return inserted!;
}

export async function updateDevicePolicyEnabled(id: number, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(devicePolicies)
    .set({ enabled: enabled ? 1 : 0 })
    .where(eq(devicePolicies.id, id));
}

export async function deleteDevicePolicy(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(devicePolicies).where(eq(devicePolicies.id, id));
}
