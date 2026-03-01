import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { skynetConfig, skynetStatsCache, type SkynetConfig } from "../drizzle/schema";
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
}): Promise<SkynetConfig> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getSkynetConfig();

  if (existing) {
    await db
      .update(skynetConfig)
      .set({
        routerAddress: config.routerAddress,
        routerPort: config.routerPort,
        routerProtocol: config.routerProtocol,
        statsPath: config.statsPath,
        pollingInterval: config.pollingInterval,
        pollingEnabled: config.pollingEnabled ? 1 : 0,
      })
      .where(eq(skynetConfig.id, existing.id));

    return { ...existing, ...config, pollingEnabled: config.pollingEnabled ? 1 : 0 };
  }

  const result = await db.insert(skynetConfig).values({
    routerAddress: config.routerAddress,
    routerPort: config.routerPort,
    routerProtocol: config.routerProtocol,
    statsPath: config.statsPath,
    pollingInterval: config.pollingInterval,
    pollingEnabled: config.pollingEnabled ? 1 : 0,
  });

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
