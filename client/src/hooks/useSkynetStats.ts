/**
 * useSkynetStats — Fetches Skynet stats from the backend via tRPC.
 * Falls back to sample data when no router is configured or data is unavailable.
 * Provides fully-typed data for every dashboard component.
 */
import { trpc } from "@/lib/trpc";
import * as sampleData from "@/lib/data";

export function useSkynetStats() {
  const statsQuery = trpc.skynet.getStats.useQuery(undefined, {
    refetchInterval: 60_000, // Refetch from cache every 60s
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

  // ---- Blocked Connections Timeline ----
  // The original Skynet stats.js doesn't provide hourly/daily timeline data directly.
  // We synthesize it from the KPI totals when live, or use sample data.
  // When live data is connected, we generate a realistic distribution from the totals.
  const blockedConnections24h = isUsingLiveData
    ? generateTimeline24h(stats!.kpi.inboundBlocks, stats!.kpi.outboundBlocks)
    : sampleData.blockedConnections24h;

  const blockedConnections7d = isUsingLiveData
    ? generateTimeline7d(stats!.kpi.inboundBlocks, stats!.kpi.outboundBlocks)
    : sampleData.blockedConnections7d;

  // ---- Connection Types (for pie chart) ----
  // Derive from port hits — group by service type
  const connectionTypes = isUsingLiveData
    ? deriveConnectionTypes(stats!.inboundPortHits)
    : sampleData.connectionTypes;

  // ---- Country Distribution ----
  // Derive from top blocks country data
  const countryDistribution = isUsingLiveData
    ? deriveCountryDistribution(stats!.topInboundBlocks)
    : sampleData.countryDistribution;

  // ---- Connections Tables ----
  const lastInboundConnections = isUsingLiveData
    ? stats!.lastInboundConnections.map(mapConnection)
    : sampleData.blockedConnections24h.length > 0 ? [] : []; // empty when live but no data

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
  const blockedIPs = isUsingLiveData
    ? stats!.topInboundBlocks.map((b) => ({
        ip: b.ip,
        hits: b.hits,
        country: b.country,
        countryCode: "",
        banReason: "*",
        severity: getSeverity(b.hits),
        alienVaultUrl: `https://otx.alienvault.com/indicator/ip/${b.ip}`,
        associatedDomains: [] as string[],
        firstSeen: "",
        lastSeen: "",
      }))
    : sampleData.blockedIPs;

  return {
    kpiData,
    inboundPortHits,
    sourcePortHits,
    blockedConnections24h,
    blockedConnections7d,
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
    isLoading: statsQuery.isLoading,
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

function mapConnection(c: any) {
  return {
    timestamp: c.timestamp || "",
    srcIP: c.srcIP || c.src || "",
    srcPort: c.srcPort || 0,
    dstIP: c.dstIP || c.dst || "",
    dstPort: c.dstPort || 0,
    protocol: c.protocol || c.proto || "TCP",
    reason: c.reason || c.blockType || "Blocked",
  };
}

/**
 * Generate a 24h timeline from total block counts.
 * Uses a sinusoidal distribution to simulate typical attack patterns
 * (more attacks during night hours UTC).
 */
function generateTimeline24h(totalInbound: number, totalOutbound: number) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Weight: higher activity 00-08 UTC (night scanners)
  const weights = hours.map(h => {
    const rad = ((h - 4) / 24) * Math.PI * 2;
    return 1 + 0.6 * Math.sin(rad);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return hours.map((h, i) => ({
    time: `${String(h).padStart(2, "0")}:00`,
    inbound: Math.round((totalInbound / totalWeight) * weights[i] / 30), // ~30 days avg
    outbound: Math.round((totalOutbound / totalWeight) * weights[i] / 30),
  }));
}

/**
 * Generate a 7-day timeline from total block counts.
 */
function generateTimeline7d(totalInbound: number, totalOutbound: number) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weights = [1.1, 1.0, 1.05, 0.95, 1.0, 0.9, 1.0];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return days.map((day, i) => ({
    day,
    inbound: Math.round((totalInbound / totalWeight) * weights[i] / 4), // ~4 weeks
    outbound: Math.round((totalOutbound / totalWeight) * weights[i] / 4),
  }));
}

/**
 * Derive connection types from port hits for the pie chart.
 * Groups ports into attack categories.
 */
function deriveConnectionTypes(portHits: { port: number; hits: number }[]) {
  const categories: Record<string, number> = {
    "Telnet Exploit": 0,
    "SSH Brute Force": 0,
    "Port Scan": 0,
    "SMB Exploit": 0,
    "HTTP Flood": 0,
    "Other": 0,
  };

  for (const p of portHits) {
    if (p.port === 23) categories["Telnet Exploit"] += p.hits;
    else if (p.port === 22) categories["SSH Brute Force"] += p.hits;
    else if (p.port === 445) categories["SMB Exploit"] += p.hits;
    else if (p.port === 80 || p.port === 443 || p.port === 8080 || p.port === 8443) categories["HTTP Flood"] += p.hits;
    else if (p.port === 3389 || p.port === 5900) categories["Port Scan"] += p.hits;
    else categories["Other"] += p.hits;
  }

  return Object.entries(categories)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Derive country distribution from top inbound blocks.
 * Aggregates hits by country.
 */
function deriveCountryDistribution(blocks: { ip: string; hits: number; country: string }[]) {
  const countryMap: Record<string, { country: string; blocks: number }> = {};

  for (const b of blocks) {
    const country = b.country || "Unknown";
    if (!countryMap[country]) {
      countryMap[country] = { country, blocks: 0 };
    }
    countryMap[country].blocks += b.hits;
  }

  const sorted = Object.values(countryMap).sort((a, b) => b.blocks - a.blocks);
  const totalBlocks = sorted.reduce((sum, c) => sum + c.blocks, 0) || 1;

  // Take top 9 and group the rest as "Others"
  const top = sorted.slice(0, 9).map((c, i) => ({
    country: c.country,
    code: getCountryCode(c.country),
    blocks: c.blocks,
    percentage: Math.round((c.blocks / totalBlocks) * 1000) / 10,
  }));

  const othersBlocks = sorted.slice(9).reduce((sum, c) => sum + c.blocks, 0);
  if (othersBlocks > 0) {
    top.push({
      country: "Others",
      code: "XX",
      blocks: othersBlocks,
      percentage: Math.round((othersBlocks / totalBlocks) * 1000) / 10,
    });
  }

  return top;
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
