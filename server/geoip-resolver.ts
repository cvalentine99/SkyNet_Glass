/**
 * GeoIP Resolver
 *
 * Resolves IP addresses to country, ASN, and ISP information
 * using the free ip-api.com batch endpoint.
 *
 * Features:
 *   - In-memory cache with 24h TTL
 *   - Batch lookups (up to 100 IPs per request)
 *   - Rate limiting (max 15 requests/minute)
 *   - Skips private/reserved IPs
 */

import axios from "axios";

// ─── Types ─────────────────────────────────────────────────

export interface GeoInfo {
  countryCode: string;
  country: string;
  city: string;
  isp: string;
  org: string;
  as: string;       // "AS15169 Google LLC"
  asname: string;   // "GOOGLE"
  lat: number;
  lon: number;
  /** Flag emoji derived from country code */
  flag: string;
}

interface CacheEntry {
  data: GeoInfo;
  expiresAt: number;
}

// ─── Constants ─────────────────────────────────────────────

const BATCH_URL = "http://ip-api.com/batch";
const BATCH_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_REQUEST_INTERVAL_MS = 4200; // ~14.3 req/min (under 15/min limit)

// ─── Private IP detection ──────────────────────────────────

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^224\./,
  /^255\./,
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

// ─── Flag emoji helper ─────────────────────────────────────

export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ─── Cache ─────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();

function getCached(ip: string): GeoInfo | null {
  const entry = cache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(ip);
    return null;
  }
  return entry.data;
}

function setCache(ip: string, data: GeoInfo): void {
  cache.set(ip, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/** Get current cache size (for monitoring) */
export function getCacheSize(): number {
  return cache.size;
}

/** Clear the entire cache */
export function clearCache(): void {
  cache.clear();
}

// ─── Rate limiter ──────────────────────────────────────────

let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

// ─── Batch Lookup ──────────────────────────────────────────

/**
 * Look up GeoIP data for a batch of IPs (max 100).
 * Returns a Map of IP → GeoInfo.
 */
async function batchLookup(ips: string[]): Promise<Map<string, GeoInfo>> {
  const result = new Map<string, GeoInfo>();
  if (ips.length === 0) return result;

  await waitForRateLimit();

  try {
    const response = await axios.post(
      `${BATCH_URL}?fields=status,country,countryCode,city,isp,org,as,asname,lat,lon,query`,
      ips.slice(0, BATCH_SIZE),
      {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = response.data as Array<{
      status: string;
      country?: string;
      countryCode?: string;
      city?: string;
      isp?: string;
      org?: string;
      as?: string;
      asname?: string;
      lat?: number;
      lon?: number;
      query: string;
    }>;

    for (const item of data) {
      if (item.status !== "success") continue;

      const geo: GeoInfo = {
        countryCode: item.countryCode || "",
        country: item.country || "",
        city: item.city || "",
        isp: item.isp || "",
        org: item.org || "",
        as: item.as || "",
        asname: item.asname || "",
        lat: item.lat || 0,
        lon: item.lon || 0,
        flag: getFlagEmoji(item.countryCode || ""),
      };

      result.set(item.query, geo);
      setCache(item.query, geo);
    }
  } catch (err: any) {
    console.warn("[GeoIP] Batch lookup failed:", err.message);
  }

  return result;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Resolve a single IP to GeoIP data.
 * Returns cached data if available, otherwise does a batch lookup.
 */
export async function resolveIP(ip: string): Promise<GeoInfo | null> {
  // Skip private IPs
  if (isPrivateIP(ip)) {
    return {
      countryCode: "LAN",
      country: "Local Network",
      city: "",
      isp: "",
      org: "",
      as: "",
      asname: "",
      lat: 0,
      lon: 0,
      flag: "🏠",
    };
  }

  // Check cache
  const cached = getCached(ip);
  if (cached) return cached;

  // Single lookup
  const results = await batchLookup([ip]);
  return results.get(ip) || null;
}

/**
 * Resolve multiple IPs to GeoIP data.
 * Uses cache where possible and batches the rest.
 * Returns a Map of IP → GeoInfo.
 */
export async function resolveIPs(ips: string[]): Promise<Map<string, GeoInfo>> {
  const result = new Map<string, GeoInfo>();
  const uncachedPublicIPs: string[] = [];

  // Deduplicate and check cache
  const uniqueIPs = Array.from(new Set(ips));

  for (const ip of uniqueIPs) {
    // Handle private IPs
    if (isPrivateIP(ip)) {
      result.set(ip, {
        countryCode: "LAN",
        country: "Local Network",
        city: "",
        isp: "",
        org: "",
        as: "",
        asname: "",
        lat: 0,
        lon: 0,
        flag: "🏠",
      });
      continue;
    }

    // Check cache
    const cached = getCached(ip);
    if (cached) {
      result.set(ip, cached);
      continue;
    }

    uncachedPublicIPs.push(ip);
  }

  // Batch lookup uncached IPs in groups of 100
  for (let i = 0; i < uncachedPublicIPs.length; i += BATCH_SIZE) {
    const batch = uncachedPublicIPs.slice(i, i + BATCH_SIZE);
    const batchResults = await batchLookup(batch);
    batchResults.forEach((geo, ip) => {
      result.set(ip, geo);
    });
  }

  return result;
}
