// ============================================================
// Skynet Glass — Realistic Sample Data
// Shaped to match the original Skynet router dashboard data model
// ============================================================

// --- KPI Summary ---
export const kpiData = {
  ipsBanned: 1247,
  rangesBanned: 89,
  inboundBlocks: 45832,
  outboundBlocks: 2156,
  totalBlocks: 47988,
  monitoringSince: "2026-01-15",
  logSize: "14.2 MB",
  blockRate: 96.8,
  topThreatCountry: "China",
};

// NOTE: No hourly/daily timeline data — Skynet stats.js only provides totals.
// The BlockedConnectionsChart now shows an honest inbound vs outbound bar comparison.

// --- Top Inbound Port Hits ---
export const inboundPortHits = [
  { port: 23, service: "Telnet", hits: 12847 },
  { port: 22, service: "SSH", hits: 8934 },
  { port: 445, service: "SMB", hits: 6721 },
  { port: 3389, service: "RDP", hits: 4523 },
  { port: 80, service: "HTTP", hits: 3891 },
  { port: 443, service: "HTTPS", hits: 2456 },
  { port: 8080, service: "HTTP-Alt", hits: 1823 },
  { port: 25, service: "SMTP", hits: 1456 },
  { port: 1433, service: "MSSQL", hits: 1234 },
  { port: 3306, service: "MySQL", hits: 987 },
  { port: 5900, service: "VNC", hits: 876 },
  { port: 8443, service: "HTTPS-Alt", hits: 654 },
  { port: 21, service: "FTP", hits: 543 },
  { port: 53, service: "DNS", hits: 432 },
  { port: 161, service: "SNMP", hits: 321 },
];

// --- Top Source Port Hits ---
export const sourcePortHits = [
  { port: 54832, hits: 3421 },
  { port: 49152, hits: 2987 },
  { port: 61423, hits: 2654 },
  { port: 55891, hits: 2341 },
  { port: 48976, hits: 1987 },
  { port: 52341, hits: 1765 },
  { port: 59876, hits: 1543 },
  { port: 45123, hits: 1321 },
  { port: 63421, hits: 1198 },
  { port: 51234, hits: 987 },
  { port: 47891, hits: 876 },
  { port: 56789, hits: 765 },
  { port: 43210, hits: 654 },
  { port: 58765, hits: 543 },
  { port: 50123, hits: 432 },
];

// --- Top Blocked IPs with Threat Intelligence ---
export interface BlockedIP {
  ip: string;
  hits: number;
  country: string;
  countryCode: string;
  banReason: string;
  severity: "critical" | "high" | "medium" | "low";
  alienVaultUrl: string;
  associatedDomains: string[];
  firstSeen: string;
  lastSeen: string;
}

export const blockedIPs: BlockedIP[] = [
  {
    ip: "185.220.101.34",
    hits: 4521,
    country: "Germany",
    countryCode: "DE",
    banReason: "Brute Force SSH",
    severity: "critical",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/185.220.101.34",
    associatedDomains: ["tor-exit.spiritof.de", "exit-relay.tor.net"],
    firstSeen: "2026-01-18",
    lastSeen: "2026-02-28",
  },
  {
    ip: "45.148.10.92",
    hits: 3876,
    country: "Russia",
    countryCode: "RU",
    banReason: "Port Scan",
    severity: "critical",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/45.148.10.92",
    associatedDomains: ["scan.botnet.ru"],
    firstSeen: "2026-01-22",
    lastSeen: "2026-02-28",
  },
  {
    ip: "103.145.13.205",
    hits: 2943,
    country: "China",
    countryCode: "CN",
    banReason: "Telnet Exploit",
    severity: "critical",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/103.145.13.205",
    associatedDomains: ["botnet-c2.cn", "mirai.exploit.cn"],
    firstSeen: "2026-02-01",
    lastSeen: "2026-02-28",
  },
  {
    ip: "91.240.118.172",
    hits: 2456,
    country: "Netherlands",
    countryCode: "NL",
    banReason: "SMB Exploit",
    severity: "high",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/91.240.118.172",
    associatedDomains: ["proxy.anon-vpn.nl"],
    firstSeen: "2026-02-05",
    lastSeen: "2026-02-27",
  },
  {
    ip: "222.186.30.112",
    hits: 2134,
    country: "China",
    countryCode: "CN",
    banReason: "Brute Force SSH",
    severity: "high",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/222.186.30.112",
    associatedDomains: ["attack-node.cn"],
    firstSeen: "2026-01-28",
    lastSeen: "2026-02-28",
  },
  {
    ip: "193.42.33.45",
    hits: 1876,
    country: "Romania",
    countryCode: "RO",
    banReason: "RDP Brute Force",
    severity: "high",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/193.42.33.45",
    associatedDomains: ["rdp-scanner.ro", "brute.attack.ro"],
    firstSeen: "2026-02-10",
    lastSeen: "2026-02-28",
  },
  {
    ip: "118.25.6.39",
    hits: 1654,
    country: "China",
    countryCode: "CN",
    banReason: "HTTP Flood",
    severity: "high",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/118.25.6.39",
    associatedDomains: ["ddos-node.tencent.cn"],
    firstSeen: "2026-02-12",
    lastSeen: "2026-02-27",
  },
  {
    ip: "5.188.206.14",
    hits: 1432,
    country: "Russia",
    countryCode: "RU",
    banReason: "Port Scan",
    severity: "medium",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/5.188.206.14",
    associatedDomains: ["scanner.vps.ru"],
    firstSeen: "2026-02-14",
    lastSeen: "2026-02-26",
  },
  {
    ip: "141.98.10.63",
    hits: 1287,
    country: "Lithuania",
    countryCode: "LT",
    banReason: "Telnet Exploit",
    severity: "medium",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/141.98.10.63",
    associatedDomains: ["iot-scanner.lt"],
    firstSeen: "2026-02-08",
    lastSeen: "2026-02-28",
  },
  {
    ip: "89.248.167.131",
    hits: 1098,
    country: "Netherlands",
    countryCode: "NL",
    banReason: "SMB Exploit",
    severity: "medium",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/89.248.167.131",
    associatedDomains: ["recyber.net", "scan.recyber.net"],
    firstSeen: "2026-02-15",
    lastSeen: "2026-02-28",
  },
  {
    ip: "61.177.172.140",
    hits: 987,
    country: "China",
    countryCode: "CN",
    banReason: "Brute Force SSH",
    severity: "medium",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/61.177.172.140",
    associatedDomains: ["chinanet.cn"],
    firstSeen: "2026-02-18",
    lastSeen: "2026-02-27",
  },
  {
    ip: "176.111.174.200",
    hits: 876,
    country: "Ukraine",
    countryCode: "UA",
    banReason: "DNS Amplification",
    severity: "low",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/176.111.174.200",
    associatedDomains: ["dns-amp.ua"],
    firstSeen: "2026-02-20",
    lastSeen: "2026-02-28",
  },
  {
    ip: "209.141.40.193",
    hits: 765,
    country: "United States",
    countryCode: "US",
    banReason: "HTTP Flood",
    severity: "low",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/209.141.40.193",
    associatedDomains: ["buyvm.net"],
    firstSeen: "2026-02-22",
    lastSeen: "2026-02-28",
  },
  {
    ip: "45.95.169.11",
    hits: 654,
    country: "Germany",
    countryCode: "DE",
    banReason: "Port Scan",
    severity: "low",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/45.95.169.11",
    associatedDomains: ["scanner.de"],
    firstSeen: "2026-02-24",
    lastSeen: "2026-02-28",
  },
  {
    ip: "170.64.159.78",
    hits: 543,
    country: "Singapore",
    countryCode: "SG",
    banReason: "SNMP Scan",
    severity: "low",
    alienVaultUrl: "https://otx.alienvault.com/indicator/ip/170.64.159.78",
    associatedDomains: ["do-sg.net"],
    firstSeen: "2026-02-25",
    lastSeen: "2026-02-28",
  },
];

// --- Country Distribution ---
export const countryDistribution = [
  { country: "China", code: "CN", blocks: 14523, percentage: 30.3 },
  { country: "Russia", code: "RU", blocks: 8721, percentage: 18.2 },
  { country: "United States", code: "US", blocks: 5432, percentage: 11.3 },
  { country: "Netherlands", code: "NL", blocks: 3876, percentage: 8.1 },
  { country: "Germany", code: "DE", blocks: 3421, percentage: 7.1 },
  { country: "Romania", code: "RO", blocks: 2987, percentage: 6.2 },
  { country: "Brazil", code: "BR", blocks: 2345, percentage: 4.9 },
  { country: "India", code: "IN", blocks: 1876, percentage: 3.9 },
  { country: "Vietnam", code: "VN", blocks: 1543, percentage: 3.2 },
  { country: "Others", code: "XX", blocks: 3264, percentage: 6.8 },
];

// --- Port Hit Distribution (for pie chart) ---
// Uses honest service names derived from port numbers, NOT fabricated attack labels.
export const connectionTypes = [
  { name: "Telnet (23)", value: 12847 },
  { name: "SSH (22)", value: 8934 },
  { name: "SMB (445)", value: 6721 },
  { name: "RDP (3389)", value: 4523 },
  { name: "HTTP (80)", value: 3891 },
  { name: "Other", value: 9072 },
];

// Chart color palette
export const chartColors = {
  gold: "#C9A962",
  cyan: "#4ECDC4",
  green: "#45B764",
  amber: "#D4A843",
  red: "#E74C3C",
  slate: "#64748B",
  goldDim: "rgba(201, 169, 98, 0.3)",
  cyanDim: "rgba(78, 205, 196, 0.3)",
};
