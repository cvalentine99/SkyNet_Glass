/**
 * ThreatTable — Blocked IP threat intelligence table
 * Design: Glass Cockpit — monospace IPs, severity badges, expandable rows
 * Accepts data via props; no direct sample data import.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
} from "lucide-react";

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

interface ThreatTableProps {
  data: BlockedIP[];
}

const severityConfig: Record<string, { label: string; className: string; bg: string }> = {
  critical: { label: "CRIT", className: "text-severity-critical", bg: "bg-severity-critical/15" },
  high: { label: "HIGH", className: "text-severity-high", bg: "bg-severity-high/15" },
  medium: { label: "MED", className: "text-severity-medium", bg: "bg-severity-medium/15" },
  low: { label: "LOW", className: "text-severity-low", bg: "bg-severity-low/15" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] || severityConfig.low;
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wider", config.className, config.bg)}>
      {config.label}
    </span>
  );
}

function ExpandedRow({ ip }: { ip: BlockedIP }) {
  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <td colSpan={6} className="px-4 py-3 border-t border-border/5">
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground mb-1 uppercase tracking-wider text-[10px] font-medium">Associated Domains</p>
            <div className="space-y-0.5">
              {ip.associatedDomains.length > 0 ? (
                ip.associatedDomains.map((d, i) => (
                  <p key={i} className="font-mono text-foreground">{d}</p>
                ))
              ) : (
                <p className="font-mono text-muted-foreground">—</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 uppercase tracking-wider text-[10px] font-medium">First Seen</p>
            <p className="font-mono text-foreground">{ip.firstSeen || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 uppercase tracking-wider text-[10px] font-medium">Last Seen</p>
            <p className="font-mono text-foreground">{ip.lastSeen || "—"}</p>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

export function ThreatTable({ data }: ThreatTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"hits" | "severity">("hits");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const filtered = data
    .filter((ip) =>
      ip.ip.includes(searchQuery) ||
      ip.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ip.banReason.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === "hits") {
        return sortDir === "desc" ? b.hits - a.hits : a.hits - b.hits;
      }
      const diff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      return sortDir === "desc" ? diff : -diff;
    });

  const toggleSort = (field: "hits" | "severity") => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Threat Intelligence</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Banned IPs with AlienVault enrichment
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search IPs, countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border
              text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50
              w-[200px] font-mono"
          />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30" style={{ background: "oklch(0.1 0.005 260 / 60%)" }}>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                IP Address
              </th>
              <th
                className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("severity")}
              >
                <span className="flex items-center gap-1">
                  Severity <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                Ban Reason
              </th>
              <th
                className="text-right px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("hits")}
              >
                <span className="flex items-center justify-end gap-1">
                  Hits <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                Country
              </th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                Intel
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((ip) => (
                <motion.tbody key={ip.ip} layout>
                  <tr
                    className={cn(
                      "border-b border-border/10 hover:bg-accent/30 transition-colors cursor-pointer",
                      expandedRow === ip.ip && "bg-accent/20"
                    )}
                    onClick={() => setExpandedRow(expandedRow === ip.ip ? null : ip.ip)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground tabular-nums">{ip.ip}</span>
                        {expandedRow === ip.ip ? (
                          <ChevronUp className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <SeverityBadge severity={ip.severity} />
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{ip.banReason}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gold font-medium">
                      {ip.hits.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{ip.country}</td>
                    <td className="px-4 py-2.5 text-center">
                      <a
                        href={ip.alienVaultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-gold hover:text-gold/80 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedRow === ip.ip && <ExpandedRow ip={ip} />}
                  </AnimatePresence>
                </motion.tbody>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
