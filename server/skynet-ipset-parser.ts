/**
 * Skynet Ipset Parser
 *
 * Parses the output of `ipset save <setname>` or the skynet.ipset file.
 * Each line has the format:
 *   add <SetName> <ip_or_cidr> [timeout <seconds>] [comment "<reason>"]
 *
 * Also parses `ipset list -t <setname>` header output for set metadata.
 */

// ─── Types ─────────────────────────────────────────────────

export interface IpsetEntry {
  /** The ipset name (e.g. Skynet-Blacklist) */
  setName: string;
  /** IP address or CIDR range */
  address: string;
  /** Whether this is a range (contains /) */
  isRange: boolean;
  /** Timeout in seconds (for WhitelistDomains) */
  timeout: number | null;
  /** Comment / ban reason */
  comment: string;
  /** Parsed category from comment */
  category: string;
  /** Parsed detail from comment (e.g. domain, source) */
  detail: string;
}

export interface IpsetSummary {
  totalEntries: number;
  /** Breakdown by category */
  categories: { category: string; count: number }[];
  /** Breakdown by set name */
  sets: { setName: string; count: number }[];
  /** How many are ranges vs individual IPs */
  rangeCount: number;
  ipCount: number;
}

// ─── Comment Category Parser ───────────────────────────────

/**
 * Parse the comment field into a category and detail.
 *
 * Known comment formats from firewall.sh:
 *   "BanMalware: abuse.ch"
 *   "BanAiProtect: domain.com"
 *   "ManualBan: reason"
 *   "ManualBanD: domain.com"
 *   "Country: CN"
 *   "AS12345 Some ISP Name"
 *   "Private IP"
 *   "CDN-Whitelist: CloudFlare"
 *   "ManualWlistD: domain.com"
 *   "nvram: vpn_server1_sn"
 *   "Banned via Skynet Glass 2026-01-15T12:00:00"
 */
export function parseComment(comment: string): { category: string; detail: string } {
  if (!comment) return { category: "Unknown", detail: "" };

  const trimmed = comment.trim();

  // BanMalware: <source>
  if (trimmed.startsWith("BanMalware:")) {
    return { category: "Malware", detail: trimmed.slice(11).trim() };
  }

  // BanAiProtect: <domain>
  if (trimmed.startsWith("BanAiProtect:")) {
    return { category: "AiProtect", detail: trimmed.slice(13).trim() };
  }

  // ManualBanD: <domain>
  if (trimmed.startsWith("ManualBanD:")) {
    return { category: "Manual (Domain)", detail: trimmed.slice(11).trim() };
  }

  // ManualBan: <reason>
  if (trimmed.startsWith("ManualBan:")) {
    return { category: "Manual", detail: trimmed.slice(10).trim() };
  }

  // Banned via Skynet Glass
  if (trimmed.startsWith("Banned via Skynet Glass")) {
    return { category: "Manual (Glass)", detail: trimmed.slice(22).trim() };
  }

  // Country: <CC>
  if (trimmed.startsWith("Country:")) {
    return { category: "Country", detail: trimmed.slice(8).trim() };
  }

  // CDN-Whitelist: <provider>
  if (trimmed.startsWith("CDN-Whitelist:")) {
    return { category: "CDN", detail: trimmed.slice(14).trim() };
  }

  // ManualWlistD: <domain>
  if (trimmed.startsWith("ManualWlistD:")) {
    return { category: "Manual (Domain)", detail: trimmed.slice(13).trim() };
  }

  // nvram: <key>
  if (trimmed.startsWith("nvram:")) {
    return { category: "VPN/System", detail: trimmed.slice(6).trim() };
  }

  // Private IP
  if (trimmed === "Private IP") {
    return { category: "Private", detail: "RFC1918" };
  }

  // ASN-based: "AS12345 Some ISP"
  if (/^AS\d+/.test(trimmed)) {
    return { category: "ASN", detail: trimmed };
  }

  // Malware: <source> (old format from chkupdate.sh)
  if (trimmed.startsWith("Malware:")) {
    return { category: "Malware", detail: trimmed.slice(8).trim() };
  }

  return { category: "Other", detail: trimmed };
}

// ─── Line Parser ───────────────────────────────────────────

/**
 * Parse a single ipset save line.
 *
 * Format: add <SetName> <address> [timeout <seconds>] [comment "<reason>"]
 */
export function parseIpsetLine(line: string): IpsetEntry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("add ")) return null;

  // Match: add <SetName> <address> [rest...]
  const match = trimmed.match(/^add\s+(\S+)\s+(\S+)(.*)/);
  if (!match) return null;

  const setName = match[1];
  const address = match[2];
  const rest = match[3];

  // Extract timeout if present
  let timeout: number | null = null;
  const timeoutMatch = rest.match(/timeout\s+(\d+)/);
  if (timeoutMatch) {
    timeout = parseInt(timeoutMatch[1], 10);
  }

  // Extract comment if present
  let comment = "";
  const commentMatch = rest.match(/comment\s+"([^"]*)"/);
  if (commentMatch) {
    comment = commentMatch[1];
  }

  const { category, detail } = parseComment(comment);

  return {
    setName,
    address,
    isRange: address.includes("/"),
    timeout,
    comment,
    category,
    detail,
  };
}

// ─── Bulk Parser ───────────────────────────────────────────

/**
 * Parse multiple ipset save lines and optionally filter by set name.
 */
export function parseIpsetLines(
  raw: string,
  filterSet?: string
): IpsetEntry[] {
  if (!raw) return [];

  const lines = raw.split("\n");
  const entries: IpsetEntry[] = [];

  for (const line of lines) {
    const entry = parseIpsetLine(line);
    if (!entry) continue;
    if (filterSet && entry.setName !== filterSet) continue;
    entries.push(entry);
  }

  return entries;
}

// ─── Filter ────────────────────────────────────────────────

export interface IpsetFilter {
  /** Search in address field */
  addressSearch?: string;
  /** Filter by category */
  category?: string;
  /** Search in comment/detail */
  commentSearch?: string;
  /** Only ranges or only IPs */
  type?: "ip" | "range" | "all";
}

export function filterIpsetEntries(
  entries: IpsetEntry[],
  filter: IpsetFilter
): IpsetEntry[] {
  return entries.filter((e) => {
    if (filter.addressSearch) {
      if (!e.address.includes(filter.addressSearch)) return false;
    }
    if (filter.category && filter.category !== "all") {
      if (e.category.toLowerCase() !== filter.category.toLowerCase()) return false;
    }
    if (filter.commentSearch) {
      const search = filter.commentSearch.toLowerCase();
      if (
        !e.comment.toLowerCase().includes(search) &&
        !e.detail.toLowerCase().includes(search)
      )
        return false;
    }
    if (filter.type === "ip" && e.isRange) return false;
    if (filter.type === "range" && !e.isRange) return false;
    return true;
  });
}

// ─── Summary ───────────────────────────────────────────────

export function summarizeIpsetEntries(entries: IpsetEntry[]): IpsetSummary {
  const categoryMap = new Map<string, number>();
  const setMap = new Map<string, number>();
  let rangeCount = 0;
  let ipCount = 0;

  for (const e of entries) {
    categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + 1);
    setMap.set(e.setName, (setMap.get(e.setName) || 0) + 1);
    if (e.isRange) rangeCount++;
    else ipCount++;
  }

  const categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const sets = Array.from(setMap.entries())
    .map(([setName, count]) => ({ setName, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEntries: entries.length,
    categories,
    sets,
    rangeCount,
    ipCount,
  };
}
