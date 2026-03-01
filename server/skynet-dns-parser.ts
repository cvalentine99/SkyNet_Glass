/**
 * skynet-dns-parser.ts
 * Parses dnsmasq log entries to identify DNS queries, replies, and sinkholed domains.
 * Also parses DHCP leases to map client IPs to device names.
 *
 * dnsmasq log format:
 *   Mon DD HH:MM:SS dnsmasq[PID]: query[TYPE] DOMAIN from CLIENT_IP
 *   Mon DD HH:MM:SS dnsmasq[PID]: reply DOMAIN is RESOLVED_IP
 *   Mon DD HH:MM:SS dnsmasq[PID]: config DOMAIN is NXDOMAIN
 *   Mon DD HH:MM:SS dnsmasq[PID]: config DOMAIN is 0.0.0.0
 *   Mon DD HH:MM:SS dnsmasq[PID]: forwarded DOMAIN to UPSTREAM_DNS
 *   Mon DD HH:MM:SS dnsmasq[PID]: cached DOMAIN is RESOLVED_IP
 *
 * DHCP lease format:
 *   EPOCH MAC_ADDR IP_ADDR HOSTNAME CLIENT_ID
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DnsQueryEntry {
  lineNumber: number;
  timestamp: string;       // raw timestamp from log
  action: "query" | "reply" | "config" | "forwarded" | "cached";
  queryType?: string;      // A, AAAA, CNAME, PTR, etc.
  domain: string;
  clientIp?: string;       // only present on query lines
  resolvedIp?: string;     // only present on reply/config/cached lines
  isSinkholed: boolean;    // true if config line (NXDOMAIN, 0.0.0.0, etc.)
  deviceName?: string;     // resolved from DHCP leases
}

export interface DhcpLease {
  epoch: number;
  mac: string;
  ip: string;
  hostname: string;
  clientId: string;
}

export interface DnsSinkholeSummary {
  totalQueries: number;
  totalSinkholed: number;
  sinkholedPercent: number;
  uniqueDevices: number;
  uniqueBlockedDomains: number;
  topBlockedDomains: Array<{ domain: string; count: number }>;
  topOffendingDevices: Array<{ ip: string; hostname: string; count: number }>;
  queryTypeBreakdown: Record<string, number>;
  timeSpan: { earliest: string; latest: string } | null;
}

// ─── DHCP Lease Parser ──────────────────────────────────────────────────────

export function parseDhcpLeases(raw: string): Map<string, DhcpLease> {
  const leaseMap = new Map<string, DhcpLease>();
  const lines = raw.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: EPOCH MAC IP HOSTNAME CLIENT_ID
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

    const epoch = parseInt(parts[0], 10);
    if (isNaN(epoch)) continue;

    const lease: DhcpLease = {
      epoch,
      mac: parts[1],
      ip: parts[2],
      hostname: parts[3] === "*" ? "Unknown" : parts[3],
      clientId: parts[4] || "*",
    };

    leaseMap.set(lease.ip, lease);
  }

  return leaseMap;
}

// ─── dnsmasq Log Parser ─────────────────────────────────────────────────────

// Match: "Mon DD HH:MM:SS dnsmasq[PID]: ACTION ..."
const DNSMASQ_LINE_RE =
  /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+dnsmasq\[\d+\]:\s+(.+)$/;

// Match query lines: "query[TYPE] DOMAIN from CLIENT_IP"
const QUERY_RE = /^query\[(\w+)\]\s+(\S+)\s+from\s+(\S+)$/;

// Match reply/cached lines: "reply|cached DOMAIN is VALUE"
const REPLY_RE = /^(reply|cached)\s+(\S+)\s+is\s+(.+)$/;

// Match config (sinkhole) lines: "config DOMAIN is VALUE"
const CONFIG_RE = /^config\s+(\S+)\s+is\s+(.+)$/;

// Match forwarded lines: "forwarded DOMAIN to UPSTREAM"
const FORWARDED_RE = /^forwarded\s+(\S+)\s+to\s+(\S+)$/;

// Sinkhole indicators
const SINKHOLE_VALUES = new Set([
  "nxdomain",
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "nodata",
  "<cname>",
]);

function isSinkholedValue(value: string): boolean {
  return SINKHOLE_VALUES.has(value.toLowerCase());
}

export function parseDnsmasqLine(
  line: string,
  lineNumber: number,
  leaseMap?: Map<string, DhcpLease>
): DnsQueryEntry | null {
  const match = DNSMASQ_LINE_RE.exec(line.trim());
  if (!match) return null;

  const timestamp = match[1];
  const payload = match[2];

  // Try query[TYPE] DOMAIN from CLIENT_IP
  const queryMatch = QUERY_RE.exec(payload);
  if (queryMatch) {
    const clientIp = queryMatch[3];
    const deviceName = leaseMap?.get(clientIp)?.hostname;
    return {
      lineNumber,
      timestamp,
      action: "query",
      queryType: queryMatch[1],
      domain: queryMatch[2],
      clientIp,
      isSinkholed: false,
      deviceName: deviceName || undefined,
    };
  }

  // Try config DOMAIN is VALUE (sinkhole)
  const configMatch = CONFIG_RE.exec(payload);
  if (configMatch) {
    return {
      lineNumber,
      timestamp,
      action: "config",
      domain: configMatch[1],
      resolvedIp: configMatch[2],
      isSinkholed: true,
    };
  }

  // Try reply|cached DOMAIN is VALUE
  const replyMatch = REPLY_RE.exec(payload);
  if (replyMatch) {
    const action = replyMatch[1] as "reply" | "cached";
    const resolvedIp = replyMatch[3];
    return {
      lineNumber,
      timestamp,
      action,
      domain: replyMatch[2],
      resolvedIp,
      isSinkholed: isSinkholedValue(resolvedIp),
    };
  }

  // Try forwarded DOMAIN to UPSTREAM
  const fwdMatch = FORWARDED_RE.exec(payload);
  if (fwdMatch) {
    return {
      lineNumber,
      timestamp,
      action: "forwarded",
      domain: fwdMatch[1],
      resolvedIp: fwdMatch[2],
      isSinkholed: false,
    };
  }

  return null;
}

export function parseDnsmasqLines(
  raw: string,
  leaseMap?: Map<string, DhcpLease>
): DnsQueryEntry[] {
  const lines = raw.split("\n");
  const entries: DnsQueryEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const entry = parseDnsmasqLine(lines[i], i + 1, leaseMap);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

// ─── Sinkhole-Focused Parsing ───────────────────────────────────────────────

/**
 * Correlates query + config lines to build a list of sinkholed requests.
 * For each "config DOMAIN is NXDOMAIN/0.0.0.0" line, we look backwards
 * for the most recent "query[TYPE] DOMAIN from CLIENT_IP" to identify
 * which device made the request.
 */
export interface SinkholedRequest {
  timestamp: string;
  domain: string;
  clientIp: string;
  deviceName: string;
  queryType: string;
  sinkholedTo: string;  // NXDOMAIN, 0.0.0.0, etc.
  lineNumber: number;
}

export function extractSinkholedRequests(
  raw: string,
  leaseMap?: Map<string, DhcpLease>
): SinkholedRequest[] {
  const lines = raw.split("\n");
  const results: SinkholedRequest[] = [];

  // Track the most recent query for each domain to correlate with config lines
  // Key: domain, Value: { clientIp, queryType, timestamp }
  const recentQueries = new Map<
    string,
    { clientIp: string; queryType: string; timestamp: string }
  >();

  for (let i = 0; i < lines.length; i++) {
    const entry = parseDnsmasqLine(lines[i], i + 1, leaseMap);
    if (!entry) continue;

    if (entry.action === "query" && entry.clientIp) {
      recentQueries.set(entry.domain, {
        clientIp: entry.clientIp,
        queryType: entry.queryType || "A",
        timestamp: entry.timestamp,
      });
    }

    if (entry.isSinkholed && (entry.action === "config" || entry.action === "reply" || entry.action === "cached")) {
      const queryInfo = recentQueries.get(entry.domain);
      const clientIp = queryInfo?.clientIp || "unknown";
      const deviceName =
        leaseMap?.get(clientIp)?.hostname || "Unknown";

      results.push({
        timestamp: entry.timestamp,
        domain: entry.domain,
        clientIp,
        deviceName,
        queryType: queryInfo?.queryType || "A",
        sinkholedTo: entry.resolvedIp || "NXDOMAIN",
        lineNumber: entry.lineNumber,
      });
    }
  }

  return results;
}

// ─── Filtering ──────────────────────────────────────────────────────────────

export interface DnsFilterOptions {
  deviceIp?: string;
  domain?: string;
  queryType?: string;
}

export function filterSinkholedRequests(
  entries: SinkholedRequest[],
  filters: DnsFilterOptions
): SinkholedRequest[] {
  return entries.filter((e) => {
    if (filters.deviceIp && !e.clientIp.includes(filters.deviceIp)) {
      return false;
    }
    if (
      filters.domain &&
      !e.domain.toLowerCase().includes(filters.domain.toLowerCase())
    ) {
      return false;
    }
    if (
      filters.queryType &&
      filters.queryType !== "ALL" &&
      e.queryType !== filters.queryType
    ) {
      return false;
    }
    return true;
  });
}

// ─── Summarization ──────────────────────────────────────────────────────────

export function summarizeSinkholedRequests(
  entries: SinkholedRequest[]
): DnsSinkholeSummary {
  const domainCounts = new Map<string, number>();
  const deviceCounts = new Map<string, { hostname: string; count: number }>();
  const queryTypes = new Map<string, number>();
  const uniqueDomains = new Set<string>();
  const uniqueDevices = new Set<string>();

  for (const e of entries) {
    // Domain counts
    domainCounts.set(e.domain, (domainCounts.get(e.domain) || 0) + 1);
    uniqueDomains.add(e.domain);

    // Device counts
    if (e.clientIp !== "unknown") {
      uniqueDevices.add(e.clientIp);
      const existing = deviceCounts.get(e.clientIp);
      if (existing) {
        existing.count++;
      } else {
        deviceCounts.set(e.clientIp, {
          hostname: e.deviceName,
          count: 1,
        });
      }
    }

    // Query type counts
    queryTypes.set(e.queryType, (queryTypes.get(e.queryType) || 0) + 1);
  }

  // Top blocked domains
  const topBlockedDomains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Top offending devices
  const topOffendingDevices = Array.from(deviceCounts.entries())
    .map(([ip, data]) => ({ ip, hostname: data.hostname, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Query type breakdown
  const queryTypeBreakdown: Record<string, number> = {};
  Array.from(queryTypes.entries()).forEach(([type, count]) => {
    queryTypeBreakdown[type] = count;
  });

  // Time span
  let timeSpan: { earliest: string; latest: string } | null = null;
  if (entries.length > 0) {
    timeSpan = {
      earliest: entries[0].timestamp,
      latest: entries[entries.length - 1].timestamp,
    };
  }

  return {
    totalQueries: entries.length,
    totalSinkholed: entries.length,
    sinkholedPercent: 100, // all entries passed in are sinkholed
    uniqueDevices: uniqueDevices.size,
    uniqueBlockedDomains: uniqueDomains.size,
    topBlockedDomains,
    topOffendingDevices,
    queryTypeBreakdown,
    timeSpan,
  };
}
