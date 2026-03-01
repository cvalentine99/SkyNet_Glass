/**
 * useSkynetStats — Fetches Skynet stats from the backend via tRPC.
 * Falls back to sample data when no router is configured or data is unavailable.
 * Provides fully-typed data for every dashboard component.
 *
 * ACCURACY NOTES:
 * - No fabricated timeline data — Skynet stats.js has no hourly/daily breakdown
 * - Connection tables use actual SkynetConnection fields (ip, banReason, country, etc.)
 * - Port grouping uses honest service names, not invented attack labels
 * - Country distribution aggregates from ALL connection types
 * - AlienVault URLs use the already-parsed values from stats.js
 */
import { trpc } from "@/lib/trpc";
import * as sampleData from "@/lib/data";

export function useSkynetStats() {
  const statsQuery = trpc.skynet.getStats.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });

  const configQuery = trpc.skynet.getConfig.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
  });

  const statusQuery = trpc.skynet.getStatus.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: 1,
  });

  const hasConfig = !!configQuery.data;
  const hasLiveData = !!statsQuery.data?.stats;
  const isUsingLiveData = hasConfig && hasLiveData;

  const stats = statsQuery.data?.stats;

  // ---- KPI Data ----
  const kpiData = isUsingLiveData
    ? {
        ipsBanned: stats!.kpi.ipsBanned,
        rangesBanned: stats!.kpi.rangesBanned,
        inboundBlocks: stats!.kpi.inboundBlocks,
        outboundBlocks: stats!.kpi.outboundBlocks,
        totalBlocks: stats!.kpi.inboundBlocks + stats!.kpi.outboundBlocks,
        monitoringSince: stats!.kpi.monitoringFrom,
        logSize: stats!.kpi.logSize,
        blockRate: stats!.kpi.inboundBlocks > 0
          ? Math.round(
              (stats!.kpi.inboundBlocks /
                (stats!.kpi.inboundBlocks + stats!.kpi.outboundBlocks || 1)) *
                100 * 10
            ) / 10
          : 0,
        topThreatCountry: "",
      }
    : sampleData.kpiData;

  // ---- Port Hits ----
  const inboundPortHits = isUsingLiveData
    ? stats!.inboundPortHits.map((p) => ({
        port: p.port,
        service: getServiceName(p.port),
        hits: p.hits,
      }))
    : sampleData.inboundPortHits;

  const sourcePortHits = isUsingLiveData
    ? stats!.sourcePortHits.map((p) => ({
        port: p.port,
        hits: p.hits,
      }))
    : sampleData.sourcePortHits;

  // ---- Port Hit Distribution (for donut chart) ----
  // Groups ports by well-known service name — factual, not invented attack labels
  const connectionTypes = isUsingLiveData
    ? derivePortDistribution(stats!.inboundPortHits)
    : sampleData.connectionTypes;

  // ---- Country Distribution ----
  // Aggregates from ALL connection types (inbound + outbound + HTTP + top blocks)
  const countryDistribution = isUsingLiveData
    ? deriveCountryDistribution(
        stats!.lastInboundConnections,
        stats!.lastOutboundConnections,
        stats!.lastHttpConnections,
        stats!.topInboundBlocks,
        stats!.topOutboundBlocks,
        stats!.topHttpBlocks
      )
    : sampleData.countryDistribution;

  // ---- Connections Tables ----
  // Uses actual SkynetConnection shape: { ip, banReason, alienVaultUrl, country, associatedDomains }
  const lastInboundConnections = isUsingLiveData
    ? stats!.lastInboundConnections.map(mapConnection)
    : [];

  const lastOutboundConnections = isUsingLiveData
    ? stats!.lastOutboundConnections.map(mapConnection)
    : [];

  const lastHttpConnections = isUsingLiveData
    ? stats!.lastHttpConnections.map(mapConnection)
    : [];

  // ---- Top Blocks ----
  const topInboundBlocks = isUsingLiveData
    ? stats!.topInboundBlocks.map(b => ({ ip: b.ip, hits: b.hits, country: b.country }))
    : sampleData.blockedIPs.slice(0, 10).map(b => ({ ip: b.ip, hits: b.hits, country: b.country }));

  const topOutboundBlocks = isUsingLiveData
    ? stats!.topOutboundBlocks.map(b => ({ ip: b.ip, hits: b.hits, country: b.country }))
    : [];

  const topHttpBlocks = isUsingLiveData
    ? stats!.topHttpBlocks.map(b => ({ ip: b.ip, hits: b.hits, country: b.country }))
    : [];

  const topBlockedDevices = isUsingLiveData
    ? stats!.topBlockedDevices.map(b => ({ ip: b.label, hits: b.hits, country: "" }))
    : [];

  // ---- Blocked IPs (for threat table) ----
  // Uses the already-parsed alienVaultUrl from stats.js (Fix #7)
  const blockedIPs = isUsingLiveData
    ? buildBlockedIPs(
        stats!.topInboundBlocks,
        stats!.lastInboundConnections,
        stats!.lastOutboundConnections,
        stats!.lastHttpConnections
      )
    : sampleData.blockedIPs;

  return {
    kpiData,
    inboundPortHits,
    sourcePortHits,
    connectionTypes,
    countryDistribution,
    lastInboundConnections,
    lastOutboundConnections,
    lastHttpConnections,
    topInboundBlocks,
    topOutboundBlocks,
    topHttpBlocks,
    topBlockedDevices,
    blockedIPs,

    // Meta
    isUsingLiveData,
    hasConfig,
    isLoading: statsQuery.isLoading || configQuery.isLoading,
    isRefetching: statsQuery.isRefetching,
    isFetchingStats: statsQuery.isFetching && hasConfig,
    error: statsQuery.data?.error ?? null,
    fetchedAt: statsQuery.data?.fetchedAt ?? null,
    pollingStatus: statusQuery.data ?? null,
  };
}

// ---- Helper Functions ----

function getSeverity(hits: number): "critical" | "high" | "medium" | "low" {
  if (hits >= 3000) return "critical";
  if (hits >= 1500) return "high";
  if (hits >= 500) return "medium";
  return "low";
}

function getServiceName(port: number): string {
  const services: Record<number, string> = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 161: "SNMP", 443: "HTTPS",
    445: "SMB", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1723: "PPTP",
    3306: "MySQL", 3389: "RDP", 5060: "SIP", 5432: "PostgreSQL",
    5900: "VNC", 8080: "HTTP-Alt", 8443: "HTTPS-Alt", 8888: "HTTP-Alt2",
  };
  return services[port] ?? `Port ${port}`;
}

/**
 * Map a parsed SkynetConnection to the ConnectionEntry shape
 * used by LiveConnectionsTable. Uses the ACTUAL fields from stats.js.
 */
function mapConnection(c: any) {
  return {
    ip: c.ip || "",
    banReason: c.banReason || "*",
    alienVaultUrl: c.alienVaultUrl || "",  // Use parsed URL directly (Fix #7)
    country: c.country || "",
    associatedDomains: Array.isArray(c.associatedDomains) ? c.associatedDomains : [],
  };
}

/**
 * Derive port hit distribution from port hits.
 * Groups by well-known service name — factual labels only.
 */
function derivePortDistribution(portHits: { port: number; hits: number }[]) {
  const groups: Record<string, number> = {};

  for (const p of portHits) {
    const name = getServiceName(p.port);
    groups[name] = (groups[name] || 0) + p.hits;
  }

  return Object.entries(groups)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Derive country distribution from ALL connection sources.
 * Aggregates hits by country from connections + top blocks.
 */
function deriveCountryDistribution(
  inboundConns: any[],
  outboundConns: any[],
  httpConns: any[],
  topInbound: any[],
  topOutbound: any[],
  topHttp: any[]
) {
  const countryMap: Record<string, { country: string; blocks: number }> = {};

  // Helper to add country data
  const addCountry = (country: string, hits: number) => {
    if (!country || country === "**" || country === "*") return;
    if (!countryMap[country]) {
      countryMap[country] = { country, blocks: 0 };
    }
    countryMap[country].blocks += hits;
  };

  // From top blocks (these have hit counts)
  for (const b of [...topInbound, ...topOutbound, ...topHttp]) {
    addCountry(b.country, b.hits || 1);
  }

  // From connection tables (each connection = 1 hit for country counting)
  for (const c of [...inboundConns, ...outboundConns, ...httpConns]) {
    addCountry(c.country, 1);
  }

  const sorted = Object.values(countryMap).sort((a, b) => b.blocks - a.blocks);
  const totalBlocks = sorted.reduce((sum, c) => sum + c.blocks, 0) || 1;

  return sorted.map((c) => ({
    country: c.country,
    code: getCountryCode(c.country),
    blocks: c.blocks,
    percentage: Math.round((c.blocks / totalBlocks) * 1000) / 10,
  }));
}

/**
 * Build the blockedIPs array for the ThreatTable.
 * Uses already-parsed alienVaultUrl from stats.js (Fix #7).
 * Enriches top blocks with connection data where available.
 */
function buildBlockedIPs(
  topBlocks: any[],
  inboundConns: any[],
  outboundConns: any[],
  httpConns: any[]
) {
  // Build a lookup from all connections for enrichment
  const connLookup: Record<string, any> = {};
  for (const c of [...inboundConns, ...outboundConns, ...httpConns]) {
    if (c.ip && !connLookup[c.ip]) {
      connLookup[c.ip] = c;
    }
  }

  return topBlocks.map((b) => {
    const conn = connLookup[b.ip];
    return {
      ip: b.ip,
      hits: b.hits,
      country: b.country,
      countryCode: getCountryCode(b.country),
      banReason: conn?.banReason || "*",
      severity: getSeverity(b.hits),
      alienVaultUrl: conn?.alienVaultUrl || `https://otx.alienvault.com/indicator/ip/${b.ip}`,
      associatedDomains: conn?.associatedDomains || [],
      firstSeen: "",
      lastSeen: "",
    };
  });
}

function getCountryCode(country: string): string {
  const codes: Record<string, string> = {
    "China": "CN", "Russia": "RU", "United States": "US", "Netherlands": "NL",
    "Germany": "DE", "Romania": "RO", "Brazil": "BR", "India": "IN",
    "Vietnam": "VN", "Ukraine": "UA", "Lithuania": "LT", "Singapore": "SG",
    "South Korea": "KR", "Japan": "JP", "France": "FR", "United Kingdom": "GB",
    "Canada": "CA", "Australia": "AU", "Indonesia": "ID", "Thailand": "TH",
    "Taiwan": "TW", "Hong Kong": "HK", "Iran": "IR", "Turkey": "TR",
    "Pakistan": "PK", "Bangladesh": "BD", "Mexico": "MX", "Argentina": "AR",
    "Colombia": "CO", "Egypt": "EG", "Unknown": "??",
  };
  return codes[country] ?? "??";
}
