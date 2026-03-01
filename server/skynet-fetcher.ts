/**
 * Skynet Fetcher
 *
 * Fetches stats.js from the router, parses it, and caches the result.
 * Also provides a polling manager that can be started/stopped.
 */

import axios from "axios";
import { createHash } from "crypto";
import { parseSkynetStats, type SkynetStats } from "./skynet-parser";
import {
  getSkynetConfig,
  getCachedStats,
  saveCachedStats,
  getLastContentHash,
} from "./skynet-db";

// ─── In-memory state ────────────────────────────────────────

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let lastFetchTime: Date | null = null;
let lastFetchError: string | null = null;
let isFetching = false;

// ─── Fetch stats from router ────────────────────────────────

export async function fetchStatsFromRouter(): Promise<{
  stats: SkynetStats | null;
  error: string | null;
  changed: boolean;
}> {
  if (isFetching) {
    return { stats: null, error: "Fetch already in progress", changed: false };
  }

  isFetching = true;
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { stats: null, error: "No router configuration found. Please configure your router connection first.", changed: false };
    }

    const url = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}${config.statsPath}`;

    const response = await axios.get(url, {
      timeout: 15000,
      // Accept self-signed certs for router HTTPS
      httpsAgent: config.routerProtocol === "https"
        ? new (await import("https")).Agent({ rejectUnauthorized: false })
        : undefined,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const rawJs = response.data as string;

    // Check if content changed
    const hash = createHash("md5").update(rawJs).digest("hex");
    const lastHash = await getLastContentHash();
    const changed = hash !== lastHash;

    // Parse the stats
    const stats = parseSkynetStats(rawJs);

    // Cache the result
    await saveCachedStats(stats, hash);

    lastFetchTime = new Date();
    lastFetchError = null;

    return { stats, error: null, changed };
  } catch (err: any) {
    const errorMsg = err.code === "ECONNREFUSED"
      ? "Connection refused — is the router reachable?"
      : err.code === "ETIMEDOUT" || err.code === "ECONNABORTED"
        ? "Connection timed out — check router address and port"
        : err.response?.status === 404
          ? "stats.js not found — is Skynet WebUI enabled?"
          : err.response?.status === 401 || err.response?.status === 403
            ? "Authentication required — check router credentials"
            : `Fetch failed: ${err.message}`;

    lastFetchError = errorMsg;
    return { stats: null, error: errorMsg, changed: false };
  } finally {
    isFetching = false;
  }
}

// ─── Trigger router stat regeneration ───────────────────────

export async function triggerRouterGenstats(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { success: false, error: "No router configuration found" };
    }

    const baseUrl = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}`;

    // The router's httpd expects a form POST to /start_apply.htm
    await axios.post(
      `${baseUrl}/start_apply.htm`,
      new URLSearchParams({
        action_script: "start_SkynetStats",
        action_mode: "apply",
        action_wait: "45",
        modified: "0",
        current_page: "",
        next_page: "",
      }).toString(),
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpsAgent: config.routerProtocol === "https"
          ? new (await import("https")).Agent({ rejectUnauthorized: false })
          : undefined,
      }
    );

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to trigger stat regeneration: ${err.message}`,
    };
  }
}

// ─── Polling Manager ────────────────────────────────────────

export async function startPolling(): Promise<void> {
  stopPolling();

  const config = await getSkynetConfig();
  if (!config || !config.pollingEnabled) return;

  const intervalMs = (config.pollingInterval || 300) * 1000;

  // Initial fetch
  await fetchStatsFromRouter();

  pollingTimer = setInterval(async () => {
    await fetchStatsFromRouter();
  }, intervalMs);

  console.log(`[Skynet] Polling started — interval: ${config.pollingInterval}s`);
}

export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log("[Skynet] Polling stopped");
  }
}

export function getPollingStatus() {
  return {
    isPolling: pollingTimer !== null,
    isFetching,
    lastFetchTime,
    lastFetchError,
  };
}

// ─── Get stats (from cache or fresh fetch) ──────────────────

export async function getStats(): Promise<{
  stats: SkynetStats | null;
  fetchedAt: Date | null;
  source: "cache" | "fresh" | "none";
  error: string | null;
}> {
  // Try cache first
  const cached = await getCachedStats();
  if (cached) {
    return {
      stats: cached.stats,
      fetchedAt: cached.fetchedAt,
      source: "cache",
      error: null,
    };
  }

  // No cache — try fresh fetch
  const result = await fetchStatsFromRouter();
  if (result.stats) {
    return {
      stats: result.stats,
      fetchedAt: new Date(),
      source: "fresh",
      error: null,
    };
  }

  return {
    stats: null,
    fetchedAt: null,
    source: "none",
    error: result.error,
  };
}
