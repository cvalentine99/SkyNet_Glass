/**
 * DNS Sinkhole Viewer
 *
 * Shows which internal devices are attempting to access blocked domains.
 * Parses dnsmasq logs and correlates with DHCP leases for device identification.
 *
 * Layout: Ultrawide 2-column (table + summary sidebar at 2xl breakpoint)
 * Design: Glass cockpit theme, consistent with other Skynet Glass pages
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { GlassCard } from "@/components/GlassCard";
import {
  Shield,
  RefreshCw,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Monitor,
  Globe,
  AlertTriangle,
  Wifi,
  Filter,
  Pause,
  Play,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SinkholedEntry {
  timestamp: string;
  domain: string;
  clientIp: string;
  deviceName: string;
  queryType: string;
  sinkholedTo: string;
  lineNumber: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncateDomain(domain: string, maxLen: number = 45): string {
  if (domain.length <= maxLen) return domain;
  return domain.slice(0, maxLen - 3) + "...";
}

function getSinkholeBadgeColor(value: string): string {
  const v = value.toLowerCase();
  if (v === "nxdomain") return "text-red-400 bg-red-400/10 border-red-400/20";
  if (v === "0.0.0.0" || v === "::") return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  if (v === "nodata") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  return "text-blue-400 bg-blue-400/10 border-blue-400/20";
}

function getQueryTypeBadge(type: string): string {
  switch (type) {
    case "A": return "text-cyan-400 bg-cyan-400/10";
    case "AAAA": return "text-purple-400 bg-purple-400/10";
    case "CNAME": return "text-green-400 bg-green-400/10";
    case "PTR": return "text-yellow-400 bg-yellow-400/10";
    case "MX": return "text-pink-400 bg-pink-400/10";
    case "TXT": return "text-orange-400 bg-orange-400/10";
    default: return "text-gray-400 bg-gray-400/10";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DnsSinkhole() {
  // ─── Filter State ──────────────────────────────────────────
  const [deviceIp, setDeviceIp] = useState("");
  const [domainSearch, setDomainSearch] = useState("");
  const [queryType, setQueryType] = useState<string>("ALL");
  const [maxLines, setMaxLines] = useState(1000);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────
  const { data, isLoading, error, refetch, isFetching } =
    trpc.skynet.getDnsSinkhole.useQuery(
      {
        maxLines,
        deviceIp: deviceIp || undefined,
        domain: domainSearch || undefined,
        queryType: queryType as any,
      },
      {
        refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
        retry: 1,
      }
    );

  const entries = data?.entries ?? [];
  const summary = data?.summary ?? null;
  const devices = data?.devices ?? [];
  const fetchError = data?.error || (error?.message ?? null);

  // ─── Export Functions ──────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!entries.length) return;
    const header = "Timestamp,Domain,Client IP,Device Name,Query Type,Sinkholed To\n";
    const rows = entries
      .map(
        (e) =>
          `"${e.timestamp}","${e.domain}","${e.clientIp}","${e.deviceName}","${e.queryType}","${e.sinkholedTo}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-sinkhole-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }, [entries]);

  const exportJSON = useCallback(() => {
    if (!entries.length) return;
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-sinkhole-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported");
  }, [entries]);

  // ─── Copy IP ───────────────────────────────────────────────
  const copyIp = useCallback((ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  }, []);

  // ─── Unique device list for filter dropdown ────────────────
  const deviceOptions = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => map.set(d.ip, d.hostname));
    entries.forEach((e) => {
      if (e.clientIp !== "unknown" && !map.has(e.clientIp)) {
        map.set(e.clientIp, e.deviceName);
      }
    });
    return Array.from(map.entries())
      .map(([ip, name]) => ({ ip, name }))
      .sort((a, b) => a.ip.localeCompare(b.ip));
  }, [devices, entries]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-gold" />
            DNS Sinkhole
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Blocked domain requests from internal devices — dnsmasq log analysis
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
              autoRefresh
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {autoRefresh ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {autoRefresh ? `${refreshInterval}s` : "Auto"}
          </button>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-card border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          )}

          {/* Export buttons */}
          <button
            onClick={exportCSV}
            disabled={!entries.length}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={exportJSON}
            disabled={!entries.length}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Error Banner ────────────────────────────────────── */}
      {fetchError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{fetchError}</span>
        </div>
      )}

      {/* ─── Filter Bar ──────────────────────────────────────── */}
      <GlassCard className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

          {/* Device filter */}
          <select
            value={deviceIp}
            onChange={(e) => setDeviceIp(e.target.value)}
            className="bg-background/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground min-w-[160px]"
          >
            <option value="">All Devices</option>
            {deviceOptions.map((d) => (
              <option key={d.ip} value={d.ip}>
                {d.name !== "Unknown" ? `${d.name} (${d.ip})` : d.ip}
              </option>
            ))}
          </select>

          {/* Domain search */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
              placeholder="Search domain..."
              className="w-full bg-background/50 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Query type */}
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="bg-background/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value="ALL">All Types</option>
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="PTR">PTR</option>
            <option value="MX">MX</option>
            <option value="TXT">TXT</option>
          </select>

          {/* Max lines */}
          <select
            value={maxLines}
            onChange={(e) => setMaxLines(Number(e.target.value))}
            className="bg-background/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
            <option value={2000}>2000 lines</option>
            <option value={5000}>5000 lines</option>
          </select>
        </div>
      </GlassCard>

      {/* ─── Main Content ────────────────────────────────────── */}
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] gap-4">
        {/* ─── Sinkhole Table ────────────────────────────────── */}
        <GlassCard className="overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gold" />
              <span className="text-sm font-semibold text-foreground">
                Sinkholed Requests
              </span>
              <span className="text-xs text-muted-foreground">
                {entries.length} entries
              </span>
            </div>
            {isLoading && (
              <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[80px_1fr_130px_130px_60px_100px] gap-2 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30">
            <span>Time</span>
            <span>Domain</span>
            <span>Device</span>
            <span>Client IP</span>
            <span>Type</span>
            <span>Response</span>
          </div>

          {/* Rows */}
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            {entries.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Shield className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No sinkholed requests found</p>
                <p className="text-xs mt-1">
                  {fetchError
                    ? "Check router connection and dnsmasq logging"
                    : "Your network is clean — or try adjusting filters"}
                </p>
              </div>
            ) : (
              entries.map((entry, idx) => (
                <div key={`${entry.lineNumber}-${idx}`}>
                  {/* Main row */}
                  <div
                    onClick={() =>
                      setExpandedRow(expandedRow === idx ? null : idx)
                    }
                    className={`grid grid-cols-[80px_1fr_130px_130px_60px_100px] gap-2 px-4 py-2 text-xs cursor-pointer transition-all hover:bg-white/[0.03] ${
                      expandedRow === idx
                        ? "bg-gold/5 border-l-2 border-l-gold"
                        : "border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Time */}
                    <span className="text-muted-foreground font-mono text-[10px] truncate">
                      {entry.timestamp.split(" ").slice(1).join(" ")}
                    </span>

                    {/* Domain */}
                    <span
                      className="text-foreground font-mono truncate"
                      title={entry.domain}
                    >
                      {truncateDomain(entry.domain)}
                    </span>

                    {/* Device */}
                    <span className="text-cyan-400 truncate flex items-center gap-1">
                      <Monitor className="w-3 h-3 shrink-0" />
                      {entry.deviceName !== "Unknown"
                        ? entry.deviceName
                        : "—"}
                    </span>

                    {/* Client IP */}
                    <span className="text-foreground font-mono truncate flex items-center gap-1">
                      {entry.clientIp}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyIp(entry.clientIp);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-gold transition-all"
                      >
                        {copiedIp === entry.clientIp ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </span>

                    {/* Query Type */}
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${getQueryTypeBadge(
                        entry.queryType
                      )}`}
                    >
                      {entry.queryType}
                    </span>

                    {/* Sinkholed To */}
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium w-fit ${getSinkholeBadgeColor(
                        entry.sinkholedTo
                      )}`}
                    >
                      {entry.sinkholedTo}
                    </span>
                  </div>

                  {/* Expanded detail row */}
                  {expandedRow === idx && (
                    <div className="px-6 py-3 bg-gold/[0.03] border-t border-border/20 border-l-2 border-l-gold">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        {/* Domain Info */}
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Domain Info
                          </h4>
                          <div className="space-y-1">
                            <div>
                              <span className="text-muted-foreground">Full Domain: </span>
                              <span className="text-foreground font-mono break-all">
                                {entry.domain}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Query Type: </span>
                              <span className="text-foreground">{entry.queryType}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Response: </span>
                              <span className="text-red-400 font-medium">
                                {entry.sinkholedTo}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Log Line: </span>
                              <span className="text-foreground">#{entry.lineNumber}</span>
                            </div>
                          </div>
                        </div>

                        {/* Device Info */}
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Device Info
                          </h4>
                          <div className="space-y-1">
                            <div>
                              <span className="text-muted-foreground">Device: </span>
                              <span className="text-cyan-400 font-medium">
                                {entry.deviceName}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">IP Address: </span>
                              <span className="text-foreground font-mono">
                                {entry.clientIp}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Timestamp: </span>
                              <span className="text-foreground">{entry.timestamp}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Quick Actions
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setDeviceIp(entry.clientIp);
                                setExpandedRow(null);
                              }}
                              className="px-2.5 py-1 rounded text-[10px] font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                            >
                              Filter by Device
                            </button>
                            <button
                              onClick={() => {
                                // Extract base domain (last 2 parts)
                                const parts = entry.domain.split(".");
                                const base =
                                  parts.length > 2
                                    ? parts.slice(-2).join(".")
                                    : entry.domain;
                                setDomainSearch(base);
                                setExpandedRow(null);
                              }}
                              className="px-2.5 py-1 rounded text-[10px] font-medium bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all"
                            >
                              Filter by Domain
                            </button>
                            <a
                              href={`/devices?ip=${encodeURIComponent(entry.clientIp)}&name=${encodeURIComponent(entry.deviceName)}`}
                              className="px-2.5 py-1 rounded text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                            >
                              Block Device
                            </a>
                            <a
                              href={`https://www.virustotal.com/gui/domain/${entry.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded text-[10px] font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
                            >
                              VirusTotal
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* ─── Summary Sidebar ───────────────────────────────── */}
        <div className="space-y-4">
          {/* Overview Stats */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gold" />
              Sinkhole Summary
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-red-400">
                  {summary?.totalSinkholed ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Blocked</div>
              </div>
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-cyan-400">
                  {summary?.uniqueDevices ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">Devices</div>
              </div>
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-gold">
                  {summary?.uniqueBlockedDomains ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Domains
                </div>
              </div>
              <div className="bg-background/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-purple-400">
                  {Object.keys(summary?.queryTypeBreakdown ?? {}).length}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Query Types
                </div>
              </div>
            </div>

            {summary?.timeSpan && (
              <div className="mt-3 text-[10px] text-muted-foreground">
                <span>Time span: </span>
                <span className="text-foreground">
                  {summary.timeSpan.earliest} — {summary.timeSpan.latest}
                </span>
              </div>
            )}
          </GlassCard>

          {/* Top Blocked Domains */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-red-400" />
              Top Blocked Domains
            </h3>

            {summary?.topBlockedDomains?.length ? (
              <div className="space-y-1.5">
                {summary.topBlockedDomains.slice(0, 10).map((d, i) => (
                  <button
                    key={d.domain}
                    onClick={() => setDomainSearch(d.domain)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.03] transition-all text-left group"
                  >
                    <span className="text-[10px] text-muted-foreground w-4 text-right">
                      {i + 1}
                    </span>
                    <span className="text-xs text-foreground font-mono truncate flex-1 group-hover:text-gold transition-colors">
                      {truncateDomain(d.domain, 30)}
                    </span>
                    <span className="text-[10px] text-red-400 font-bold">
                      {d.count}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </GlassCard>

          {/* Top Offending Devices */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-cyan-400" />
              Top Offending Devices
            </h3>

            {summary?.topOffendingDevices?.length ? (
              <div className="space-y-1.5">
                {summary.topOffendingDevices.slice(0, 10).map((d, i) => (
                  <button
                    key={d.ip}
                    onClick={() => setDeviceIp(d.ip)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.03] transition-all text-left group"
                  >
                    <span className="text-[10px] text-muted-foreground w-4 text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-cyan-400 font-medium group-hover:text-gold transition-colors block truncate">
                        {d.hostname !== "Unknown" ? d.hostname : d.ip}
                      </span>
                      {d.hostname !== "Unknown" && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {d.ip}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-orange-400 font-bold">
                      {d.count}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </GlassCard>

          {/* Query Type Breakdown */}
          <GlassCard className="p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-purple-400" />
              Query Types
            </h3>

            {summary?.queryTypeBreakdown &&
            Object.keys(summary.queryTypeBreakdown).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(summary.queryTypeBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => setQueryType(type)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/[0.03] transition-all group"
                    >
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getQueryTypeBadge(
                          type
                        )}`}
                      >
                        {type}
                      </span>
                      <span className="text-xs text-foreground font-medium">
                        {count}
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No data</p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
