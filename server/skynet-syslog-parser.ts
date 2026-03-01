/**
 * Skynet Syslog Parser
 *
 * Parses iptables LOG entries from the router's syslog / skynet.log.
 * Each line follows the standard syslog + iptables LOG format:
 *
 *   Mon DD HH:MM:SS hostname kernel: [BLOCKED - INBOUND] IN=eth0 OUT= MAC=... SRC=1.2.3.4 DST=192.168.1.1 LEN=40 TOS=0x00 PREC=0x00 TTL=240 ID=12345 PROTO=TCP SPT=54321 DPT=22 SEQ=0 ACK=0 WINDOW=1024 RES=0x00 SYN URGP=0 OPT (...)
 *
 * Supported direction prefixes:
 *   [BLOCKED - INBOUND]
 *   [BLOCKED - OUTBOUND]
 *   [BLOCKED - INVALID]
 *   [BLOCKED - IOT]
 */

export type SkynetLogDirection = "INBOUND" | "OUTBOUND" | "INVALID" | "IOT";

export interface SkynetLogEntry {
  /** Raw line number (1-indexed) for reference */
  lineNum: number;
  /** Syslog timestamp string: "Mon DD HH:MM:SS" */
  timestamp: string;
  /** Parsed Date object (uses current year since syslog omits year) */
  date: Date;
  /** Router hostname from syslog header */
  hostname: string;
  /** Direction: INBOUND, OUTBOUND, INVALID, IOT */
  direction: SkynetLogDirection;
  /** Input interface (e.g. eth0, br0) */
  inInterface: string;
  /** Output interface (empty for inbound) */
  outInterface: string;
  /** MAC address */
  mac: string;
  /** Source IP address */
  srcIp: string;
  /** Destination IP address */
  dstIp: string;
  /** Packet length */
  length: number;
  /** Time to Live */
  ttl: number;
  /** IP protocol: TCP, UDP, ICMP, etc. */
  protocol: string;
  /** Source port (TCP/UDP only, 0 for ICMP) */
  srcPort: number;
  /** Destination port (TCP/UDP only, 0 for ICMP) */
  dstPort: number;
  /** TCP flags present (SYN, ACK, FIN, RST, PSH, URG) */
  tcpFlags: string[];
  /** Raw log line for reference */
  raw: string;
}

/** Month abbreviation → 0-indexed month number */
const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Known TCP flags that iptables LOG can emit */
const TCP_FLAGS = ["SYN", "ACK", "FIN", "RST", "PSH", "URG", "CWR", "ECE"];

/**
 * Extract a key=value field from a log line.
 * Returns the value string, or empty string if not found.
 */
function extractField(line: string, key: string): string {
  const regex = new RegExp(`${key}=([^ ]+)`);
  const match = line.match(regex);
  return match ? match[1] : "";
}

/**
 * Parse the syslog timestamp "Mon DD HH:MM:SS" into a Date.
 * Since syslog doesn't include year, we use the current year.
 * If the resulting date is in the future, we subtract one year.
 */
export function parseSyslogTimestamp(monthStr: string, day: string, time: string): Date {
  const month = MONTH_MAP[monthStr];
  if (month === undefined) return new Date(0);

  const [hours, minutes, seconds] = time.split(":").map(Number);
  const now = new Date();
  const year = now.getFullYear();

  const date = new Date(year, month, parseInt(day, 10), hours, minutes, seconds);

  // If date is in the future, it's from last year
  if (date > now) {
    date.setFullYear(year - 1);
  }

  return date;
}

/**
 * Parse the direction from the [BLOCKED - XXX] prefix.
 */
export function parseDirection(line: string): SkynetLogDirection | null {
  if (line.includes("[BLOCKED - INBOUND]")) return "INBOUND";
  if (line.includes("[BLOCKED - OUTBOUND]")) return "OUTBOUND";
  if (line.includes("[BLOCKED - INVALID]")) return "INVALID";
  if (line.includes("[BLOCKED - IOT]")) return "IOT";
  return null;
}

/**
 * Extract TCP flags from a log line.
 * iptables LOG places flags as standalone words after the key=value pairs.
 */
export function extractTcpFlags(line: string): string[] {
  const flags: string[] = [];
  for (const flag of TCP_FLAGS) {
    // Match flag as a standalone word (not part of a key=value)
    const regex = new RegExp(`\\b${flag}\\b`);
    if (regex.test(line)) {
      // Make sure it's not part of a key=value pair
      const kvRegex = new RegExp(`\\w+=${flag}`);
      if (!kvRegex.test(line)) {
        flags.push(flag);
      }
    }
  }
  return flags;
}

/**
 * Parse a single syslog line into a structured SkynetLogEntry.
 * Returns null if the line is not a valid Skynet BLOCKED entry.
 */
export function parseSyslogLine(line: string, lineNum: number): SkynetLogEntry | null {
  // Must contain a BLOCKED prefix
  const direction = parseDirection(line);
  if (!direction) return null;

  // Parse syslog header: "Mon DD HH:MM:SS hostname kernel:"
  // Some lines may have extra spaces for single-digit days
  const headerMatch = line.match(
    /^(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+kernel:/
  );
  if (!headerMatch) return null;

  const [, monthStr, day, time, hostname] = headerMatch;
  const date = parseSyslogTimestamp(monthStr, day, time);

  return {
    lineNum,
    timestamp: `${monthStr} ${day.padStart(2, " ")} ${time}`,
    date,
    hostname,
    direction,
    inInterface: extractField(line, "IN"),
    outInterface: extractField(line, "OUT"),
    mac: extractField(line, "MAC"),
    srcIp: extractField(line, "SRC"),
    dstIp: extractField(line, "DST"),
    length: parseInt(extractField(line, "LEN"), 10) || 0,
    ttl: parseInt(extractField(line, "TTL"), 10) || 0,
    protocol: extractField(line, "PROTO"),
    srcPort: parseInt(extractField(line, "SPT"), 10) || 0,
    dstPort: parseInt(extractField(line, "DPT"), 10) || 0,
    tcpFlags: extractTcpFlags(line),
    raw: line,
  };
}

/**
 * Parse multiple syslog lines into structured entries.
 * Filters out non-Skynet lines automatically.
 */
export function parseSyslogLines(rawText: string): SkynetLogEntry[] {
  const lines = rawText.split("\n");
  const entries: SkynetLogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const entry = parseSyslogLine(line, i + 1);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Filter log entries by various criteria.
 */
export interface LogFilter {
  direction?: SkynetLogDirection | "ALL";
  srcIp?: string;
  dstIp?: string;
  ipSearch?: string; // matches either src or dst
  protocol?: string;
  port?: number; // matches either src or dst port
  dstPort?: number;
  minDate?: Date;
  maxDate?: Date;
}

export function filterLogEntries(
  entries: SkynetLogEntry[],
  filter: LogFilter
): SkynetLogEntry[] {
  return entries.filter((entry) => {
    if (filter.direction && filter.direction !== "ALL" && entry.direction !== filter.direction) {
      return false;
    }
    if (filter.srcIp && !entry.srcIp.includes(filter.srcIp)) {
      return false;
    }
    if (filter.dstIp && !entry.dstIp.includes(filter.dstIp)) {
      return false;
    }
    if (filter.ipSearch) {
      const search = filter.ipSearch;
      if (!entry.srcIp.includes(search) && !entry.dstIp.includes(search)) {
        return false;
      }
    }
    if (filter.protocol && entry.protocol.toUpperCase() !== filter.protocol.toUpperCase()) {
      return false;
    }
    if (filter.port !== undefined) {
      if (entry.srcPort !== filter.port && entry.dstPort !== filter.port) {
        return false;
      }
    }
    if (filter.dstPort !== undefined && entry.dstPort !== filter.dstPort) {
      return false;
    }
    if (filter.minDate && entry.date < filter.minDate) {
      return false;
    }
    if (filter.maxDate && entry.date > filter.maxDate) {
      return false;
    }
    return true;
  });
}

/**
 * Get summary statistics from log entries.
 */
export interface LogSummary {
  totalEntries: number;
  inboundCount: number;
  outboundCount: number;
  invalidCount: number;
  iotCount: number;
  uniqueSrcIps: number;
  uniqueDstIps: number;
  topSrcIps: { ip: string; count: number }[];
  topDstPorts: { port: number; count: number }[];
  topProtocols: { protocol: string; count: number }[];
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

export function summarizeLogEntries(entries: SkynetLogEntry[]): LogSummary {
  const srcIpCounts = new Map<string, number>();
  const dstPortCounts = new Map<number, number>();
  const protocolCounts = new Map<string, number>();
  let inbound = 0, outbound = 0, invalid = 0, iot = 0;
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const entry of entries) {
    switch (entry.direction) {
      case "INBOUND": inbound++; break;
      case "OUTBOUND": outbound++; break;
      case "INVALID": invalid++; break;
      case "IOT": iot++; break;
    }

    srcIpCounts.set(entry.srcIp, (srcIpCounts.get(entry.srcIp) || 0) + 1);
    if (entry.dstPort > 0) {
      dstPortCounts.set(entry.dstPort, (dstPortCounts.get(entry.dstPort) || 0) + 1);
    }
    protocolCounts.set(entry.protocol, (protocolCounts.get(entry.protocol) || 0) + 1);

    if (!oldest || entry.date < oldest) oldest = entry.date;
    if (!newest || entry.date > newest) newest = entry.date;
  }

  const topSrcIps = Array.from(srcIpCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const topDstPorts = Array.from(dstPortCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([port, count]) => ({ port, count }));

  const topProtocols = Array.from(protocolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([protocol, count]) => ({ protocol, count }));

  return {
    totalEntries: entries.length,
    inboundCount: inbound,
    outboundCount: outbound,
    invalidCount: invalid,
    iotCount: iot,
    uniqueSrcIps: srcIpCounts.size,
    uniqueDstIps: new Set(entries.map(e => e.dstIp)).size,
    topSrcIps,
    topDstPorts,
    topProtocols,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}
