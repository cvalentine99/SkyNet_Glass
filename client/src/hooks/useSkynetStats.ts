/**
 * useSkynetStats — Fetches Skynet stats from the backend via tRPC.
 * Returns empty/zero states when no router is configured.
 * NO MOCK DATA — every value comes from the router or is zero.
 */
import { trpc } from "@/lib/trpc";

/** Shared empty KPI shape */
const EMPTY_KPI = {
  ipsBanned: 0,
  rangesBanned: 0,
  inboundBlocks: 0,
  outboundBlocks: 0,
  totalBlocks: 0,
  monitoringSince: "",
  logSize: "",
  blockRate: 0,
  topThreatCountry: "",
};

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
    : EMPTY_KPI;

  // ---- Port Hits ----
  const inboundPortHits = isUsingLiveData
    ? stats!.inboundPortHits.map((p) => ({
        port: p.port,
        service: getServiceName(p.port),
        hits: p.hits,
      }))
    : [];

  const sourcePortHits = isUsingLiveData
    ? stats!.sourcePortHits.map((p) => ({
        port: p.port,
        hits: p.hits,
      }))
    : [];

  // ---- Port Hit Distribution (for donut chart) ----
  const connectionTypes = isUsingLiveData
    ? derivePortDistribution(stats!.inboundPortHits)
    : [];

  // ---- Country Distribution ----
  const countryDistribution = isUsingLiveData
    ? deriveCountryDistribution(
        stats!.lastInboundConnections,
        stats!.lastOutboundConnections,
        stats!.lastHttpConnections,
        stats!.topInboundBlocks,
        stats!.topOutboundBlocks,
        stats!.topHttpBlocks
      )
    : [];

  // ---- Connections Tables ----
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
    : [];

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
    ? buildBlockedIPs(
        stats!.topInboundBlocks,
        stats!.lastInboundConnections,
        stats!.lastOutboundConnections,
        stats!.lastHttpConnections
      )
    : [];

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
    hasData: hasLiveData,
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

function mapConnection(c: any) {
  return {
    ip: c.ip || "",
    banReason: c.banReason || "*",
    alienVaultUrl: c.alienVaultUrl || "",
    country: c.country || "",
    associatedDomains: Array.isArray(c.associatedDomains) ? c.associatedDomains : [],
  };
}

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

function deriveCountryDistribution(
  inboundConns: any[],
  outboundConns: any[],
  httpConns: any[],
  topInbound: any[],
  topOutbound: any[],
  topHttp: any[]
) {
  const countryMap: Record<string, { country: string; blocks: number }> = {};

  const addCountry = (country: string, hits: number) => {
    if (!country || country === "**" || country === "*") return;
    if (!countryMap[country]) {
      countryMap[country] = { country, blocks: 0 };
    }
    countryMap[country].blocks += hits;
  };

  for (const b of [...topInbound, ...topOutbound, ...topHttp]) {
    addCountry(b.country, b.hits || 1);
  }
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

function buildBlockedIPs(
  topBlocks: any[],
  inboundConns: any[],
  outboundConns: any[],
  httpConns: any[]
) {
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
