/**
 * LiveConnectionsTable — Recent blocked connections (Inbound/Outbound/HTTP)
 * Design: Glass Cockpit — monospace IPs, severity-coded, tabbed interface
 * Accepts data via props; no direct sample data import.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Globe } from "lucide-react";

export interface ConnectionEntry {
  timestamp: string;
  srcIP: string;
  srcPort: number;
  dstIP: string;
  dstPort: number;
  protocol: string;
  reason: string;
}

interface LiveConnectionsTableProps {
  inboundConnections: ConnectionEntry[];
  outboundConnections: ConnectionEntry[];
  httpConnections: ConnectionEntry[];
}

type TabId = "inbound" | "outbound" | "http";

export function LiveConnectionsTable({
  inboundConnections,
  outboundConnections,
  httpConnections,
}: LiveConnectionsTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("inbound");

  const tabs: { id: TabId; label: string; icon: typeof Activity; data: ConnectionEntry[] }[] = [
    { id: "inbound", label: "Inbound", icon: ArrowDownToLine, data: inboundConnections },
    { id: "outbound", label: "Outbound", icon: ArrowUpFromLine, data: outboundConnections },
    { id: "http", label: "HTTP(s)", icon: Globe, data: httpConnections },
  ];

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
            {currentTab.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No data available — connect your router to see live connections
                </td>
              </tr>
            ) : (
              currentTab.data.map((conn, i) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
