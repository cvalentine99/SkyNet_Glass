/**
 * useSkynetStats — Fetches Skynet stats from the backend via tRPC.
 * Falls back to sample data when no router is configured or data is unavailable.
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

  // Map live data to the format our components expect, or fall back to sample data
  const stats = statsQuery.data?.stats;

  return {
    // KPI data
    kpiData: isUsingLiveData
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
                  (stats!.kpi.inboundBlocks + stats!.kpi.outboundBlocks)) *
                  100 * 10
              ) / 10
            : 0,
          topThreatCountry: "",
        }
      : sampleData.kpiData,

    // Port hits
    inboundPortHits: isUsingLiveData
      ? stats!.inboundPortHits.map((p) => ({
          port: p.port,
          service: getServiceName(p.port),
          hits: p.hits,
        }))
      : sampleData.inboundPortHits,

    sourcePortHits: isUsingLiveData
      ? stats!.sourcePortHits.map((p) => ({
          port: p.port,
          hits: p.hits,
        }))
      : sampleData.sourcePortHits,

    // Connections tables
    lastInboundConnections: isUsingLiveData
      ? stats!.lastInboundConnections
      : [],

    lastOutboundConnections: isUsingLiveData
      ? stats!.lastOutboundConnections
      : [],

    lastHttpConnections: isUsingLiveData
      ? stats!.lastHttpConnections
      : [],

    // Top blocks
    topInboundBlocks: isUsingLiveData ? stats!.topInboundBlocks : [],
    topOutboundBlocks: isUsingLiveData ? stats!.topOutboundBlocks : [],
    topHttpBlocks: isUsingLiveData ? stats!.topHttpBlocks : [],
    topBlockedDevices: isUsingLiveData ? stats!.topBlockedDevices : [],

    // Blocked IPs (for threat table — map from top blocks)
    blockedIPs: isUsingLiveData
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
      : sampleData.blockedIPs,

    // Meta
    isUsingLiveData,
    hasConfig,
    isLoading: statsQuery.isLoading,
    error: statsQuery.data?.error ?? null,
    fetchedAt: statsQuery.data?.fetchedAt ?? null,
    pollingStatus: statusQuery.data ?? null,

    // Keep sample data available for charts that don't have live equivalents
    sampleData,
  };
}

function getSeverity(hits: number): "critical" | "high" | "medium" | "low" {
  if (hits >= 3000) return "critical";
  if (hits >= 1500) return "high";
  if (hits >= 500) return "medium";
  return "low";
}

function getServiceName(port: number): string {
  const services: Record<number, string> = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    161: "SNMP",
    443: "HTTPS",
    445: "SMB",
    993: "IMAPS",
    995: "POP3S",
    1433: "MSSQL",
    1723: "PPTP",
    3306: "MySQL",
    3389: "RDP",
    5060: "SIP",
    5432: "PostgreSQL",
    5900: "VNC",
    8080: "HTTP-Alt",
    8443: "HTTPS-Alt",
    8888: "HTTP-Alt2",
  };
  return services[port] ?? `Port ${port}`;
}
