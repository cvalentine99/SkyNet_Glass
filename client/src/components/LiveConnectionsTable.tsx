/**
 * LiveConnectionsTable — Recent blocked connections (Inbound/Outbound/HTTP)
 * Design: Glass Cockpit — monospace IPs, severity-coded, tabbed interface
 * 
 * Uses the actual SkynetConnection shape from the parser:
 *   { ip, banReason, alienVaultUrl, country, associatedDomains }
 * Includes ban button per row to add IPs to Skynet blacklist.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Globe,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export interface ConnectionEntry {
  ip: string;
  banReason: string;
  alienVaultUrl: string;
  country: string;
  associatedDomains: string[];
}

interface LiveConnectionsTableProps {
  inboundConnections: ConnectionEntry[];
  outboundConnections: ConnectionEntry[];
  httpConnections: ConnectionEntry[];
}

type TabId = "inbound" | "outbound" | "http";

function BanButton({ ip }: { ip: string }) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);

  const ban = trpc.skynet.banIP.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Banned ${ip}`, { description: "IP added to Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed to ban ${ip}`, { description: result.error || "Unknown error" });
      }
      setConfirming(false);
    },
    onError: (err) => {
      toast.error("Ban failed", { description: err.message });
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => ban.mutate({ ip, comment: `Banned from Skynet Glass dashboard` })}
          disabled={ban.isPending}
          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-severity-critical/20 text-severity-critical
            hover:bg-severity-critical/30 transition-colors"
        >
          {ban.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary/50 text-muted-foreground
            hover:bg-secondary/80 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold
        bg-severity-critical/10 text-severity-critical/70 hover:bg-severity-critical/20 hover:text-severity-critical
        transition-colors"
      title={`Ban ${ip}`}
    >
      <ShieldAlert className="w-2.5 h-2.5" />
      Ban
    </button>
  );
}

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
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">IP Address</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Country</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Ban Reason</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Domains</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Intel</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentTab.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No data available — connect your router to see live connections
                </td>
              </tr>
            ) : (
              currentTab.data.map((conn, i) => (
                <motion.tr
                  key={`${conn.ip}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/10 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-foreground tabular-nums whitespace-nowrap">
                    {conn.ip}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {conn.country || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                      {conn.banReason || "*"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={conn.associatedDomains.join(", ")}>
                    {conn.associatedDomains.length > 0
                      ? conn.associatedDomains.slice(0, 2).join(", ") + (conn.associatedDomains.length > 2 ? ` +${conn.associatedDomains.length - 2}` : "")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {conn.alienVaultUrl ? (
                      <a
                        href={conn.alienVaultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold/80 transition-colors inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="text-[10px]">OTX</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <BanButton ip={conn.ip} />
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
