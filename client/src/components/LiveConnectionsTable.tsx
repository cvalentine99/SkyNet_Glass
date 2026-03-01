/**
 * LiveConnectionsTable — Recent blocked connections (Inbound/Outbound/HTTP)
 * Mirrors original Skynet sections:
 * - Last 10 Unique Connections Blocked (Inbound)
 * - Last 10 Unique Connections Blocked (Outbound)
 * - Last 10 Unique HTTP(s) Blocks (Outbound)
 * Design: Glass Cockpit — monospace IPs, severity-coded, tabbed interface
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Globe } from "lucide-react";

interface ConnectionEntry {
  timestamp: string;
  srcIP: string;
  srcPort: number;
  dstIP: string;
  dstPort: number;
  protocol: string;
  reason: string;
}

const inboundConnections: ConnectionEntry[] = [
  { timestamp: "02/28 23:58:12", srcIP: "185.220.101.34", srcPort: 54832, dstIP: "192.168.1.1", dstPort: 22, protocol: "TCP", reason: "Blacklisted IP" },
  { timestamp: "02/28 23:57:45", srcIP: "45.148.10.92", srcPort: 49152, dstIP: "192.168.1.1", dstPort: 23, protocol: "TCP", reason: "Port Scan" },
  { timestamp: "02/28 23:56:33", srcIP: "103.145.13.205", srcPort: 61423, dstIP: "192.168.1.1", dstPort: 23, protocol: "TCP", reason: "Telnet Exploit" },
  { timestamp: "02/28 23:55:21", srcIP: "91.240.118.172", srcPort: 55891, dstIP: "192.168.1.1", dstPort: 445, protocol: "TCP", reason: "SMB Exploit" },
  { timestamp: "02/28 23:54:08", srcIP: "222.186.30.112", srcPort: 48976, dstIP: "192.168.1.1", dstPort: 22, protocol: "TCP", reason: "Brute Force" },
  { timestamp: "02/28 23:53:44", srcIP: "193.42.33.45", srcPort: 52341, dstIP: "192.168.1.1", dstPort: 3389, protocol: "TCP", reason: "RDP Scan" },
  { timestamp: "02/28 23:52:19", srcIP: "118.25.6.39", srcPort: 59876, dstIP: "192.168.1.1", dstPort: 80, protocol: "TCP", reason: "HTTP Flood" },
  { timestamp: "02/28 23:51:02", srcIP: "5.188.206.14", srcPort: 45123, dstIP: "192.168.1.1", dstPort: 8080, protocol: "TCP", reason: "Port Scan" },
  { timestamp: "02/28 23:50:38", srcIP: "141.98.10.63", srcPort: 63421, dstIP: "192.168.1.1", dstPort: 23, protocol: "TCP", reason: "Telnet Exploit" },
  { timestamp: "02/28 23:49:15", srcIP: "89.248.167.131", srcPort: 51234, dstIP: "192.168.1.1", dstPort: 445, protocol: "TCP", reason: "SMB Exploit" },
];

const outboundConnections: ConnectionEntry[] = [
  { timestamp: "02/28 23:57:22", srcIP: "192.168.1.105", srcPort: 54123, dstIP: "45.33.32.156", dstPort: 443, protocol: "TCP", reason: "Known C2 Server" },
  { timestamp: "02/28 23:55:11", srcIP: "192.168.1.42", srcPort: 61234, dstIP: "185.141.63.120", dstPort: 80, protocol: "TCP", reason: "Malware Domain" },
  { timestamp: "02/28 23:53:45", srcIP: "192.168.1.105", srcPort: 49876, dstIP: "91.215.85.209", dstPort: 8443, protocol: "TCP", reason: "Phishing Domain" },
  { timestamp: "02/28 23:51:33", srcIP: "192.168.1.200", srcPort: 52341, dstIP: "104.21.32.1", dstPort: 443, protocol: "TCP", reason: "Adware Domain" },
  { timestamp: "02/28 23:49:22", srcIP: "192.168.1.42", srcPort: 55678, dstIP: "172.67.181.1", dstPort: 80, protocol: "TCP", reason: "Tracking Domain" },
  { timestamp: "02/28 23:47:11", srcIP: "192.168.1.105", srcPort: 48765, dstIP: "23.227.38.32", dstPort: 443, protocol: "TCP", reason: "Known C2 Server" },
  { timestamp: "02/28 23:45:55", srcIP: "192.168.1.200", srcPort: 61432, dstIP: "185.220.101.34", dstPort: 80, protocol: "TCP", reason: "Blacklisted IP" },
  { timestamp: "02/28 23:43:22", srcIP: "192.168.1.42", srcPort: 59123, dstIP: "45.148.10.92", dstPort: 443, protocol: "TCP", reason: "Port Scan Origin" },
  { timestamp: "02/28 23:41:08", srcIP: "192.168.1.105", srcPort: 47654, dstIP: "103.145.13.205", dstPort: 80, protocol: "TCP", reason: "Malware Domain" },
  { timestamp: "02/28 23:39:44", srcIP: "192.168.1.200", srcPort: 53218, dstIP: "91.240.118.172", dstPort: 443, protocol: "TCP", reason: "Phishing Domain" },
];

const httpConnections: ConnectionEntry[] = [
  { timestamp: "02/28 23:58:01", srcIP: "192.168.1.105", srcPort: 54321, dstIP: "malware-c2.example.com" as any, dstPort: 443, protocol: "HTTPS", reason: "Malware C2" },
  { timestamp: "02/28 23:56:44", srcIP: "192.168.1.42", srcPort: 61234, dstIP: "phishing.evil.com" as any, dstPort: 443, protocol: "HTTPS", reason: "Phishing" },
  { timestamp: "02/28 23:54:33", srcIP: "192.168.1.200", srcPort: 49876, dstIP: "tracker.ads.net" as any, dstPort: 80, protocol: "HTTP", reason: "Adware" },
  { timestamp: "02/28 23:52:11", srcIP: "192.168.1.105", srcPort: 52341, dstIP: "crypto-miner.io" as any, dstPort: 443, protocol: "HTTPS", reason: "Cryptominer" },
  { timestamp: "02/28 23:50:22", srcIP: "192.168.1.42", srcPort: 55678, dstIP: "data-exfil.ru" as any, dstPort: 443, protocol: "HTTPS", reason: "Data Exfil" },
  { timestamp: "02/28 23:48:55", srcIP: "192.168.1.200", srcPort: 48765, dstIP: "botnet-relay.cn" as any, dstPort: 80, protocol: "HTTP", reason: "Botnet" },
  { timestamp: "02/28 23:46:33", srcIP: "192.168.1.105", srcPort: 61432, dstIP: "spam-sender.org" as any, dstPort: 25, protocol: "SMTP", reason: "Spam" },
  { timestamp: "02/28 23:44:11", srcIP: "192.168.1.42", srcPort: 59123, dstIP: "exploit-kit.net" as any, dstPort: 443, protocol: "HTTPS", reason: "Exploit Kit" },
  { timestamp: "02/28 23:42:44", srcIP: "192.168.1.200", srcPort: 47654, dstIP: "ransomware.cc" as any, dstPort: 443, protocol: "HTTPS", reason: "Ransomware" },
  { timestamp: "02/28 23:40:22", srcIP: "192.168.1.105", srcPort: 53218, dstIP: "keylogger.xyz" as any, dstPort: 80, protocol: "HTTP", reason: "Keylogger" },
];

const tabs = [
  { id: "inbound", label: "Inbound", icon: ArrowDownToLine, data: inboundConnections },
  { id: "outbound", label: "Outbound", icon: ArrowUpFromLine, data: outboundConnections },
  { id: "http", label: "HTTP(s)", icon: Globe, data: httpConnections },
] as const;

export function LiveConnectionsTable() {
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound" | "http">("inbound");
  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gold" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent Blocked Connections</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Last 10 unique connections per direction</p>
          </div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200",
                activeTab === tab.id
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30" style={{ background: "oklch(0.1 0.005 260 / 60%)" }}>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Time</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Source</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Destination</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Proto</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Reason</th>
            </tr>
          </thead>
          <tbody>
            {currentTab.data.map((conn, i) => (
              <motion.tr
                key={`${conn.timestamp}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-border/10 hover:bg-accent/30 transition-colors"
              >
                <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                  {conn.timestamp}
                </td>
                <td className="px-3 py-2 font-mono text-foreground tabular-nums whitespace-nowrap">
                  {conn.srcIP}<span className="text-muted-foreground">:{conn.srcPort}</span>
                </td>
                <td className="px-3 py-2 font-mono text-foreground tabular-nums whitespace-nowrap">
                  {conn.dstIP}<span className="text-muted-foreground">:{conn.dstPort}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                    {conn.protocol}
                  </span>
                </td>
                <td className="px-3 py-2 text-gold font-medium">{conn.reason}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
