import { eq, desc, gte } from "drizzle-orm";
import { getDb } from "./db";
import { skynetConfig, skynetStatsCache, skynetStatsHistory, type SkynetConfig, type SkynetStatsHistory } from "../drizzle/schema";
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
}): Promise<SkynetConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getSkynetConfig();

  const values = {
    routerAddress: config.routerAddress,
    routerPort: config.routerPort,
    routerProtocol: config.routerProtocol,
    statsPath: config.statsPath,
    pollingInterval: config.pollingInterval,
    pollingEnabled: config.pollingEnabled ? 1 : 0,
    username: config.username ?? null,
    password: config.password ?? null,
  };

  if (existing) {
    await db
      .update(skynetConfig)
      .set(values)
      .where(eq(skynetConfig.id, existing.id));

    return { ...existing, ...values };
  }

  await db.insert(skynetConfig).values(values);

  const inserted = await getSkynetConfig();
  return inserted!;
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
