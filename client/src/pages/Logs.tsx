/**
 * Logs — Real-time Skynet Syslog Viewer
 * Design: Glass Cockpit — aviation instrument panel aesthetic
 * Layout: Full-width log table with filter bar, summary sidebar, ultrawide optimized
 *
 * Features:
 *   - Real-time auto-refresh with configurable interval
 *   - Filter by direction, IP, protocol, port
 *   - Color-coded log entries by direction
 *   - Expandable row detail
 *   - Summary statistics sidebar
 *   - Keyboard shortcut: R to refresh
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ScrollText,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Cpu,
  Search,
  X,
  Pause,
  Play,
  Clock,
  Shield,
  Globe,
  Wifi,
} from "lucide-react";

type Direction = "INBOUND" | "OUTBOUND" | "INVALID" | "IOT" | "ALL";

const DIRECTION_CONFIG: Record<string, { color: string; bg: string; icon: typeof ArrowDownCircle; label: string }> = {
  INBOUND: { color: "text-severity-high", bg: "bg-severity-high/10", icon: ArrowDownCircle, label: "IN" },
  OUTBOUND: { color: "text-chart-2", bg: "bg-chart-2/10", icon: ArrowUpCircle, label: "OUT" },
  INVALID: { color: "text-severity-critical", bg: "bg-severity-critical/10", icon: AlertTriangle, label: "INV" },
  IOT: { color: "text-severity-medium", bg: "bg-severity-medium/10", icon: Cpu, label: "IOT" },
};

/** Map well-known ports to service names */
function portToService(port: number): string {
  const map: Record<number, string> = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1723: "PPTP",
    3306: "MySQL", 3389: "RDP", 5060: "SIP", 5900: "VNC",
    8080: "HTTP-Alt", 8443: "HTTPS-Alt", 8888: "HTTP-Proxy",
  };
  return map[port] || "";
}

/** Format a date for display */
function formatLogTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return dateStr;
  }
}

function formatLogDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function Logs() {
  // ─── Filter State ────────────────────────────────────────
  const [direction, setDirection] = useState<Direction>("ALL");
  const [ipSearch, setIpSearch] = useState("");
  const [protocol, setProtocol] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [maxLines, setMaxLines] = useState(500);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // ─── Data Query ──────────────────────────────────────────
  const queryInput = useMemo(() => ({
    maxLines,
    direction,
    ipSearch: ipSearch || undefined,
    protocol: protocol || undefined,
    port: portFilter ? parseInt(portFilter, 10) : undefined,
  }), [maxLines, direction, ipSearch, protocol, portFilter]);

  const { data, isLoading, isFetching, refetch } = trpc.skynet.getLogs.useQuery(
    queryInput,
    {
      refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
      refetchOnWindowFocus: false,
    }
  );

  // ─── Keyboard Shortcuts ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "r") {
        e.preventDefault();
        refetch();
        toast.success("Logs refreshed");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refetch]);

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success("Logs refreshed");
  }, [refetch]);

  const clearFilters = useCallback(() => {
    setDirection("ALL");
    setIpSearch("");
    setProtocol("");
    setPortFilter("");
  }, []);

  const hasActiveFilters = direction !== "ALL" || ipSearch || protocol || portFilter;

  const entries = data?.entries ?? [];
  const summary = data?.summary ?? null;
  const error = data?.error ?? null;
  const rawLineCount = data?.rawLineCount ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.05 0 0)" }}>
      <Sidebar />

      <main className="ml-[64px] p-6 max-w-[2200px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <ScrollText className="w-6 h-6 text-gold" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Syslog Viewer</h1>
              <p className="text-sm text-muted-foreground">
                Real-time Skynet firewall log entries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card/50">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  autoRefresh ? "text-severity-low" : "text-muted-foreground"
                )}
              >
                {autoRefresh ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {autoRefresh ? "LIVE" : "PAUSED"}
              </button>
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="bg-transparent text-xs text-muted-foreground border-none outline-none cursor-pointer"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                "border border-gold/30 text-gold hover:bg-gold/10 transition-all",
                isFetching && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Error Banner */}
        {error && (
          <GlassCard className="mb-4 border border-severity-critical/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-severity-critical shrink-0" />
              <div>
                <p className="text-sm font-medium text-severity-critical">Failed to fetch logs</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Main Layout: Filters + Table + Summary */}
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-4">
          {/* Left: Filters + Table */}
          <div className="space-y-4">
            {/* Filter Bar */}
            <GlassCard noPadding delay={0.05}>
              <div className="p-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground mb-3"
                >
                  <Filter className="w-4 h-4 text-gold" />
                  Filters
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold/20 text-gold font-mono">
                      ACTIVE
                    </span>
                  )}
                  {showFilters ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                        {/* Direction */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Direction
                          </label>
                          <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as Direction)}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50"
                          >
                            <option value="ALL">All</option>
                            <option value="INBOUND">Inbound</option>
                            <option value="OUTBOUND">Outbound</option>
                            <option value="INVALID">Invalid</option>
                            <option value="IOT">IoT</option>
                          </select>
                        </div>

                        {/* IP Search */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            IP Address
                          </label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={ipSearch}
                              onChange={(e) => setIpSearch(e.target.value)}
                              placeholder="Search IP..."
                              className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50 placeholder:text-muted-foreground/50"
                            />
                          </div>
                        </div>

                        {/* Protocol */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Protocol
                          </label>
                          <select
                            value={protocol}
                            onChange={(e) => setProtocol(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50"
                          >
                            <option value="">All</option>
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                            <option value="ICMP">ICMP</option>
                          </select>
                        </div>

                        {/* Port */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Port
                          </label>
                          <input
                            type="text"
                            value={portFilter}
                            onChange={(e) => setPortFilter(e.target.value.replace(/\D/g, ""))}
                            placeholder="Any port..."
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50 placeholder:text-muted-foreground/50"
                          />
                        </div>

                        {/* Max Lines */}
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Max Lines
                          </label>
                          <select
                            value={maxLines}
                            onChange={(e) => setMaxLines(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50"
                          >
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                            <option value={500}>500</option>
                            <option value={1000}>1,000</option>
                            <option value={2000}>2,000</option>
                          </select>
                        </div>

                        {/* Clear Filters */}
                        <div className="flex items-end">
                          {hasActiveFilters && (
                            <button
                              onClick={clearFilters}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>

            {/* Log Table */}
            <GlassCard noPadding delay={0.1}>
              {/* Table Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {entries.length} entries
                  </span>
                  {rawLineCount > 0 && rawLineCount !== entries.length && (
                    <span className="text-xs text-muted-foreground">
                      (of {rawLineCount} total)
                    </span>
                  )}
                  {isFetching && (
                    <span className="flex items-center gap-1 text-xs text-gold">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading...
                    </span>
                  )}
                </div>
                {autoRefresh && (
                  <span className="flex items-center gap-1 text-xs text-severity-low">
                    <span className="w-1.5 h-1.5 rounded-full bg-severity-low animate-pulse" />
                    Live — {refreshInterval}s
                  </span>
                )}
              </div>

              {/* Empty State */}
              {!isLoading && entries.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ScrollText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">No log entries found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                    {hasActiveFilters
                      ? "Try adjusting your filters to see more results"
                      : "Connect your router in Settings to see live syslog entries. Skynet must have logging enabled."}
                  </p>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 border-b border-border/50 flex items-center gap-4">
                      <div className="w-12 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-20 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-28 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-28 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-12 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-16 h-5 rounded bg-muted/30 animate-pulse" />
                      <div className="w-16 h-5 rounded bg-muted/30 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {/* Log Entries */}
              {!isLoading && entries.length > 0 && (
                <div className="overflow-x-auto">
                  {/* Column Headers */}
                  <div className="grid grid-cols-[60px_70px_140px_140px_60px_80px_80px_1fr] gap-2 px-4 py-2 border-b border-border/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card/80 backdrop-blur-sm min-w-[800px]">
                    <div>Dir</div>
                    <div>Time</div>
                    <div>Source IP</div>
                    <div>Destination IP</div>
                    <div>Proto</div>
                    <div>Src Port</div>
                    <div>Dst Port</div>
                    <div>Details</div>
                  </div>

                  {/* Rows */}
                  <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
                    {entries.map((entry, idx) => {
                      const dirConfig = DIRECTION_CONFIG[entry.direction];
                      const DirIcon = dirConfig?.icon ?? Shield;
                      const isExpanded = expandedRow === idx;
                      const service = portToService(entry.dstPort);

                      return (
                        <div key={`${entry.lineNum}-${idx}`}>
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : idx)}
                            className={cn(
                              "grid grid-cols-[60px_70px_140px_140px_60px_80px_80px_1fr] gap-2 px-4 py-2.5 w-full text-left",
                              "border-b border-border/30 hover:bg-muted/20 transition-colors min-w-[800px]",
                              isExpanded && "bg-muted/20"
                            )}
                          >
                            {/* Direction */}
                            <div className="flex items-center">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                                dirConfig?.bg, dirConfig?.color
                              )}>
                                <DirIcon className="w-3 h-3" />
                                {dirConfig?.label ?? entry.direction}
                              </span>
                            </div>

                            {/* Time */}
                            <div className="flex flex-col">
                              <span className="text-xs text-foreground font-mono">
                                {formatLogTime(entry.date as any)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatLogDate(entry.date as any)}
                              </span>
                            </div>

                            {/* Source IP */}
                            <div className="text-xs font-mono text-foreground truncate">
                              {entry.srcIp}
                            </div>

                            {/* Destination IP */}
                            <div className="text-xs font-mono text-foreground truncate">
                              {entry.dstIp}
                            </div>

                            {/* Protocol */}
                            <div className="text-xs font-mono text-muted-foreground">
                              {entry.protocol}
                            </div>

                            {/* Source Port */}
                            <div className="text-xs font-mono text-muted-foreground">
                              {entry.srcPort > 0 ? entry.srcPort : "—"}
                            </div>

                            {/* Destination Port */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-foreground">
                                {entry.dstPort > 0 ? entry.dstPort : "—"}
                              </span>
                              {service && (
                                <span className="text-[10px] text-gold/70 font-medium">
                                  {service}
                                </span>
                              )}
                            </div>

                            {/* Details / Flags */}
                            <div className="flex items-center gap-1.5">
                              {entry.tcpFlags.length > 0 && (
                                <div className="flex gap-0.5">
                                  {entry.tcpFlags.map((flag) => (
                                    <span
                                      key={flag}
                                      className="px-1 py-0.5 rounded text-[9px] font-mono bg-muted/40 text-muted-foreground"
                                    >
                                      {flag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <ChevronRight className={cn(
                                "w-3 h-3 text-muted-foreground/50 ml-auto transition-transform",
                                isExpanded && "rotate-90"
                              )} />
                            </div>
                          </button>

                          {/* Expanded Detail */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden border-b border-border/30"
                              >
                                <div className="px-6 py-4 bg-muted/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Interface</span>
                                    <span className="font-mono text-foreground">
                                      IN={entry.inInterface || "—"} OUT={entry.outInterface || "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Packet Length</span>
                                    <span className="font-mono text-foreground">{entry.length} bytes</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">TTL</span>
                                    <span className="font-mono text-foreground">{entry.ttl}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">TCP Flags</span>
                                    <span className="font-mono text-foreground">
                                      {entry.tcpFlags.length > 0 ? entry.tcpFlags.join(", ") : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Hostname</span>
                                    <span className="font-mono text-foreground">{entry.hostname || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Full Timestamp</span>
                                    <span className="font-mono text-foreground">{entry.timestamp}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Service</span>
                                    <span className="font-mono text-foreground">
                                      {service || `Port ${entry.dstPort}`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block mb-0.5">Line #</span>
                                    <span className="font-mono text-foreground">{entry.lineNum}</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right: Summary Sidebar */}
          <div className="space-y-4">
            {/* Summary Stats */}
            <GlassCard delay={0.15}>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-gold" />
                <h3 className="text-sm font-semibold text-foreground">Log Summary</h3>
              </div>

              {summary ? (
                <div className="space-y-3">
                  {/* Direction Breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-severity-high">
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                        Inbound
                      </span>
                      <span className="font-mono font-bold text-foreground">{summary.inboundCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-chart-2">
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        Outbound
                      </span>
                      <span className="font-mono font-bold text-foreground">{summary.outboundCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-severity-critical">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Invalid
                      </span>
                      <span className="font-mono font-bold text-foreground">{summary.invalidCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-severity-medium">
                        <Cpu className="w-3.5 h-3.5" />
                        IoT
                      </span>
                      <span className="font-mono font-bold text-foreground">{summary.iotCount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total Entries</span>
                      <span className="font-mono font-bold text-gold">{summary.totalEntries.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Unique Source IPs</span>
                      <span className="font-mono text-foreground">{summary.uniqueSrcIps.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Unique Dest IPs</span>
                      <span className="font-mono text-foreground">{summary.uniqueDstIps.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Time Span */}
                  {summary.oldestEntry && summary.newestEntry && (
                    <div className="border-t border-border/50 pt-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        Time Span
                      </div>
                      <div className="text-xs font-mono text-foreground">
                        {new Date(summary.oldestEntry).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">to</div>
                      <div className="text-xs font-mono text-foreground">
                        {new Date(summary.newestEntry).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No summary available
                </div>
              )}
            </GlassCard>

            {/* Top Source IPs */}
            {summary && summary.topSrcIps.length > 0 && (
              <GlassCard delay={0.2}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-gold" />
                  <h3 className="text-sm font-semibold text-foreground">Top Source IPs</h3>
                </div>
                <div className="space-y-1.5">
                  {summary.topSrcIps.slice(0, 8).map((item, i) => (
                    <button
                      key={item.ip}
                      onClick={() => setIpSearch(item.ip)}
                      className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}</span>
                        <span className="text-xs font-mono text-foreground group-hover:text-gold transition-colors">
                          {item.ip}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{item.count}x</span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Top Destination Ports */}
            {summary && summary.topDstPorts.length > 0 && (
              <GlassCard delay={0.25}>
                <div className="flex items-center gap-2 mb-3">
                  <Wifi className="w-4 h-4 text-gold" />
                  <h3 className="text-sm font-semibold text-foreground">Top Targeted Ports</h3>
                </div>
                <div className="space-y-1.5">
                  {summary.topDstPorts.slice(0, 8).map((item, i) => {
                    const svc = portToService(item.port);
                    return (
                      <button
                        key={item.port}
                        onClick={() => setPortFilter(String(item.port))}
                        className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/20 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}</span>
                          <span className="text-xs font-mono text-foreground group-hover:text-gold transition-colors">
                            {item.port}
                          </span>
                          {svc && (
                            <span className="text-[10px] text-gold/60">{svc}</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{item.count}x</span>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            {/* Protocol Breakdown */}
            {summary && summary.topProtocols.length > 0 && (
              <GlassCard delay={0.3}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-gold" />
                  <h3 className="text-sm font-semibold text-foreground">Protocols</h3>
                </div>
                <div className="space-y-2">
                  {summary.topProtocols.map((item) => {
                    const pct = summary.totalEntries > 0
                      ? ((item.count / summary.totalEntries) * 100).toFixed(1)
                      : "0";
                    return (
                      <div key={item.protocol}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono text-foreground">{item.protocol}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded-full bg-gold/60"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
