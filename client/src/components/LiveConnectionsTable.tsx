/**
 * LiveConnectionsTable — Recent blocked connections (Inbound/Outbound/HTTP)
 * Design: Glass Cockpit — monospace IPs, severity-coded, tabbed interface
 *
 * Features:
 *   - Click any row to expand and see full details
 *   - GeoIP enrichment: country, city, ISP, ASN with flag emoji
 *   - One-click ban/whitelist/ban-range actions
 *   - AlienVault OTX threat intel link
 *   - Associated domains display
 *
 * Uses the actual SkynetConnection shape from the parser:
 *   { ip, banReason, alienVaultUrl, country, associatedDomains }
 */
import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
  Loader2,
  ChevronDown,
  MapPin,
  Server,
  Network,
  Link2,
  Copy,
  Check,
  Ban,
  Search,
  Monitor,
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

// ─── Action Buttons ──────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  variant,
  onClick,
  isPending,
  confirming,
  onConfirm,
  onCancel,
}: {
  icon: typeof ShieldAlert;
  label: string;
  variant: "danger" | "success" | "warning";
  onClick?: () => void;
  isPending?: boolean;
  confirming?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const colors = {
    danger: "bg-severity-critical/10 text-severity-critical hover:bg-severity-critical/20 border-severity-critical/20",
    success: "bg-severity-low/10 text-severity-low hover:bg-severity-low/20 border-severity-low/20",
    warning: "bg-gold/10 text-gold hover:bg-gold/20 border-gold/20",
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground">Sure?</span>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="px-2 py-1 rounded text-[9px] font-bold bg-severity-critical/20 text-severity-critical
            hover:bg-severity-critical/30 transition-colors border border-severity-critical/20"
        >
          {isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Yes"}
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 rounded text-[9px] font-bold bg-secondary/50 text-muted-foreground
            hover:bg-secondary/80 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all",
        colors[variant]
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ─── Connection Detail Panel ─────────────────────────────────

function ConnectionDetail({ conn, direction }: { conn: ConnectionEntry; direction: TabId }) {
  const utils = trpc.useUtils();
  const [banConfirm, setBanConfirm] = useState(false);
  const [whitelistConfirm, setWhitelistConfirm] = useState(false);
  const [rangeConfirm, setRangeConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  // GeoIP lookup for this IP
  const geoQuery = trpc.skynet.resolveGeoIP.useQuery(
    { ips: [conn.ip] },
    { staleTime: 24 * 60 * 60 * 1000 } // Cache for 24h
  );

  const geo = geoQuery.data?.geoMap?.[conn.ip];

  // Derive /24 range from IP
  const range24 = useMemo(() => {
    const parts = conn.ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return null;
  }, [conn.ip]);

  // Mutations
  const banIP = trpc.skynet.banIP.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Banned ${conn.ip}`, { description: "IP added to Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed to ban`, { description: result.error || "Unknown error" });
      }
      setBanConfirm(false);
    },
    onError: (err) => {
      toast.error("Ban failed", { description: err.message });
      setBanConfirm(false);
    },
  });

  const whitelistIP = trpc.skynet.whitelistIP.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Whitelisted ${conn.ip}`, { description: "IP added to Skynet whitelist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed to whitelist`, { description: result.error || "Unknown error" });
      }
      setWhitelistConfirm(false);
    },
    onError: (err) => {
      toast.error("Whitelist failed", { description: err.message });
      setWhitelistConfirm(false);
    },
  });

  const banRange = trpc.skynet.banRange.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Banned ${range24}`, { description: "Range added to Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed to ban range`, { description: result.error || "Unknown error" });
      }
      setRangeConfirm(false);
    },
    onError: (err) => {
      toast.error("Ban range failed", { description: err.message });
      setRangeConfirm(false);
    },
  });

  const handleCopyIP = useCallback(() => {
    navigator.clipboard.writeText(conn.ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [conn.ip]);

  const directionLabel = direction === "inbound" ? "Inbound" : direction === "outbound" ? "Outbound" : "HTTP(s)";
  const directionColor = direction === "inbound" ? "text-gold" : direction === "outbound" ? "text-blue-400" : "text-purple-400";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="px-4 py-4 bg-secondary/20 border-t border-border/20">
        {/* Top row: IP + Actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          {/* IP Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/40 flex items-center justify-center">
              {geo?.flag ? (
                <span className="text-lg">{geo.flag}</span>
              ) : (
                <Globe className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-mono font-bold text-foreground">{conn.ip}</span>
                <button
                  onClick={handleCopyIP}
                  className="p-1 rounded hover:bg-secondary/40 transition-colors"
                  title="Copy IP"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-severity-low" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-[10px] font-medium", directionColor)}>{directionLabel}</span>
                <span className="text-[10px] text-muted-foreground">•</span>
                <span className="text-[10px] text-muted-foreground">
                  {conn.banReason || "No reason specified"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              icon={ShieldAlert}
              label="Ban IP"
              variant="danger"
              confirming={banConfirm}
              isPending={banIP.isPending}
              onClick={() => setBanConfirm(true)}
              onConfirm={() => banIP.mutate({ ip: conn.ip, comment: `Banned from Skynet Glass — ${directionLabel} connection` })}
              onCancel={() => setBanConfirm(false)}
            />
            {range24 && (
              <ActionButton
                icon={Ban}
                label={`Ban ${range24}`}
                variant="warning"
                confirming={rangeConfirm}
                isPending={banRange.isPending}
                onClick={() => setRangeConfirm(true)}
                onConfirm={() => banRange.mutate({ range: range24, comment: `Range ban from Skynet Glass — ${conn.ip}` })}
                onCancel={() => setRangeConfirm(false)}
              />
            )}
            <ActionButton
              icon={ShieldCheck}
              label="Whitelist IP"
              variant="success"
              confirming={whitelistConfirm}
              isPending={whitelistIP.isPending}
              onClick={() => setWhitelistConfirm(true)}
              onConfirm={() => whitelistIP.mutate({ ip: conn.ip, comment: `Whitelisted from Skynet Glass — ${directionLabel} connection` })}
              onCancel={() => setWhitelistConfirm(false)}
            />
            {conn.alienVaultUrl && (
              <a
                href={conn.alienVaultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border
                  bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                AlienVault OTX
              </a>
            )}
            <a
              href={`/devices?ip=${encodeURIComponent(conn.ip)}`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border
                bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20 transition-all"
            >
              <Monitor className="w-3 h-3" />
              Block Device
            </a>
            <a
              href={`/ipsets?search=${encodeURIComponent(conn.ip)}`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border
                bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground border-border/30 transition-all"
            >
              <Search className="w-3 h-3" />
              Check Ipsets
            </a>
            <a
              href={`https://www.abuseipdb.com/check/${encodeURIComponent(conn.ip)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border
                bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              AbuseIPDB
            </a>
          </div>
        </div>

        {/* Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-3">
          {/* GeoIP Info */}
          <div className="rounded-lg bg-secondary/30 border border-border/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location</span>
            </div>
            {geoQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Resolving...</span>
              </div>
            ) : geo ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{geo.flag}</span>
                  <span className="text-xs text-foreground font-medium">{geo.country}</span>
                  <span className="text-[10px] text-muted-foreground">({geo.countryCode})</span>
                </div>
                {geo.city && geo.city !== "Unknown" && (
                  <p className="text-[10px] text-muted-foreground pl-6">{geo.city}</p>
                )}
                {geo.lat !== 0 && (
                  <p className="text-[10px] text-muted-foreground pl-6 font-mono">
                    {geo.lat.toFixed(4)}, {geo.lon.toFixed(4)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-foreground">{conn.country || "Unknown"}</p>
                <p className="text-[10px] text-muted-foreground">GeoIP data unavailable</p>
              </div>
            )}
          </div>

          {/* Network Info */}
          <div className="rounded-lg bg-secondary/30 border border-border/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Server className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Network</span>
            </div>
            {geoQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Resolving...</span>
              </div>
            ) : geo ? (
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] text-muted-foreground">ISP</p>
                  <p className="text-xs text-foreground font-medium">{geo.isp || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">ASN</p>
                  <p className="text-xs text-foreground font-mono">{geo.as || "Unknown"}</p>
                </div>
                {geo.org && geo.org !== geo.isp && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Organization</p>
                    <p className="text-xs text-foreground">{geo.org}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Network data unavailable</p>
            )}
          </div>

          {/* Ban Info */}
          <div className="rounded-lg bg-secondary/30 border border-border/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Network className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Block Details</span>
            </div>
            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] text-muted-foreground">Direction</p>
                <p className={cn("text-xs font-medium", directionColor)}>{directionLabel}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Ban Reason</p>
                <p className="text-xs text-foreground">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                    {conn.banReason || "No reason"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">/24 Range</p>
                <p className="text-xs text-foreground font-mono">{range24 || "—"}</p>
              </div>
            </div>
          </div>

          {/* Associated Domains */}
          <div className="rounded-lg bg-secondary/30 border border-border/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Domains ({conn.associatedDomains.length})
              </span>
            </div>
            {conn.associatedDomains.length > 0 ? (
              <div className="space-y-1">
                {conn.associatedDomains.map((domain, i) => (
                  <p key={i} className="text-xs text-foreground font-mono truncate" title={domain}>
                    {domain}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">No associated domains</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Table ──────────────────────────────────────────────

export function LiveConnectionsTable({
  inboundConnections,
  outboundConnections,
  httpConnections,
}: LiveConnectionsTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("inbound");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const tabs: { id: TabId; label: string; icon: typeof Activity; data: ConnectionEntry[] }[] = [
    { id: "inbound", label: "Inbound", icon: ArrowDownToLine, data: inboundConnections },
    { id: "outbound", label: "Outbound", icon: ArrowUpFromLine, data: outboundConnections },
    { id: "http", label: "HTTP(s)", icon: Globe, data: httpConnections },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const toggleRow = useCallback((key: string) => {
    setExpandedRow((prev) => (prev === key ? null : key));
  }, []);

  // Reset expanded row when switching tabs
  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setExpandedRow(null);
  }, []);

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
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Last 10 unique connections per direction — click any row for details
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200",
                activeTab === tab.id
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.data.length > 0 && (
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-gold/20" : "bg-secondary/60"
                )}>
                  {tab.data.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide rounded-lg border border-border/50">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[160px]" />
            <col className="w-[120px]" />
            <col style={{ width: '35%' }} />
            <col style={{ width: '25%' }} />
            <col className="w-[60px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/30" style={{ background: "oklch(0.1 0.005 260 / 60%)" }}>
              <th className="px-2 py-2.5"></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">IP Address</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Country</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Ban Reason</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Domains</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Intel</th>
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
              currentTab.data.map((conn, i) => {
                const rowKey = `${activeTab}-${conn.ip}-${i}`;
                const isExpanded = expandedRow === rowKey;

                return (
                  <motion.tbody
                    key={rowKey}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <tr
                      onClick={() => toggleRow(rowKey)}
                      className={cn(
                        "border-b border-border/10 cursor-pointer transition-colors",
                        isExpanded
                          ? "bg-accent/40"
                          : "hover:bg-accent/30"
                      )}
                    >
                      <td className="px-2 py-2 text-center">
                        <ChevronDown
                          className={cn(
                            "w-3 h-3 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-180 text-gold"
                          )}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground tabular-nums whitespace-nowrap">
                        {conn.ip}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {conn.country || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground inline-block max-w-full truncate" title={conn.banReason || "*"}>
                          {conn.banReason || "*"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={conn.associatedDomains.join(", ")}>
                        {conn.associatedDomains.length > 0
                          ? conn.associatedDomains.slice(0, 2).join(", ") + (conn.associatedDomains.length > 2 ? ` +${conn.associatedDomains.length - 2}` : "")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {conn.alienVaultUrl ? (
                          <a
                            href={conn.alienVaultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gold inline-flex items-center gap-1 hover:text-gold/80 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="p-0">
                        <AnimatePresence>
                          {isExpanded && (
                            <ConnectionDetail conn={conn} direction={activeTab} />
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  </motion.tbody>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
