/**
 * Logs — Operator-Grade Skynet Syslog Viewer
 * Design: Glass Cockpit — aviation instrument panel aesthetic
 *
 * Features:
 *   - Full structured diagnostics panel when empty (SSH status, file probes, match counts)
 *   - Actionable empty states: retry, test SSH, open settings, copy diagnostics
 *   - Real-time auto-refresh with configurable interval
 *   - Filter by direction, IP, protocol, port
 *   - Color-coded log entries by direction
 *   - Expandable row detail with GeoIP
 *   - Summary statistics sidebar
 *   - Keyboard shortcut: R to refresh
 *   - CSV/JSON export
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocation } from "wouter";
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
  Download,
  WifiOff,
  CheckCircle2,
  XCircle,
  FileText,
  Terminal,
  Settings,
  Copy,
  ExternalLink,
  HardDrive,
  Activity,
} from "lucide-react";
import { DataSourceBadge } from "@/components/DataSourceBadge";

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

function formatLogTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return dateStr; }
}

function formatLogDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

// ─── Diagnostics Types (mirrors backend SyslogDiagnostics) ──
interface SyslogFileDiag {
  path: string;
  exists: boolean;
  readable: boolean;
  totalLines: number;
  matchingLines: number;
}

interface SyslogDiagnostics {
  sshOk: boolean;
  sshError: string | null;
  configFound: boolean;
  routerAddress: string | null;
  pathsChecked: string[];
  files: SyslogFileDiag[];
  grepPattern: string;
  totalMatchingLines: number;
  fetchDurationMs: number;
}

// ─── Diagnostic Panel Component ─────────────────────────────

function DiagnosticPanel({
  diagnostics,
  error,
  onRetry,
  isFetching,
}: {
  diagnostics: SyslogDiagnostics | null;
  error: string | null;
  onRetry: () => void;
  isFetching: boolean;
}) {
  const [, navigate] = useLocation();
  const diag = diagnostics;

  // Determine the overall situation
  const noConfig = diag && !diag.configFound;
  const sshFailed = diag && diag.configFound && !diag.sshOk;
  const noFilesExist = diag && diag.sshOk && diag.files.every(f => !f.exists);
  const filesExistButUnreadable = diag && diag.sshOk && diag.files.some(f => f.exists) && diag.files.filter(f => f.exists).every(f => !f.readable);
  const filesReadableButEmpty = diag && diag.sshOk && diag.files.some(f => f.readable) && diag.totalMatchingLines === 0;
  const hasMatchingLines = diag && diag.totalMatchingLines > 0;

  // Build a copyable diagnostic summary
  const diagText = useMemo(() => {
    if (!diag) return "No diagnostics available";
    const lines: string[] = [
      `SkyNet Glass — Syslog Diagnostic Report`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Router Config: ${diag.configFound ? "Found" : "NOT CONFIGURED"}`,
      `Router Address: ${diag.routerAddress || "N/A"}`,
      `SSH Connection: ${diag.sshOk ? "OK" : "FAILED"}`,
      diag.sshError ? `SSH Error: ${diag.sshError}` : "",
      `Fetch Duration: ${diag.fetchDurationMs}ms`,
      ``,
      `Grep Pattern: ${diag.grepPattern}`,
      `Total Matching Lines: ${diag.totalMatchingLines}`,
      ``,
      `File Probes:`,
      ...diag.files.map(f =>
        `  ${f.path}: ${f.exists ? "EXISTS" : "MISSING"} | ${f.readable ? "READABLE" : "UNREADABLE"} | ${f.totalLines} lines | ${f.matchingLines} matches`
      ),
      ``,
      error ? `Error: ${error}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }, [diag, error]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(diagText).then(() => {
      toast.success("Diagnostic report copied to clipboard");
    });
  }, [diagText]);

  // Determine situation label and color
  let situationLabel = "UNKNOWN";
  let situationColor = "text-muted-foreground";
  let situationBg = "bg-muted/20";
  let situationIcon = <Activity className="w-5 h-5" />;

  if (noConfig) {
    situationLabel = "NO ROUTER CONFIGURED";
    situationColor = "text-severity-critical";
    situationBg = "bg-severity-critical/10";
    situationIcon = <WifiOff className="w-5 h-5 text-severity-critical" />;
  } else if (sshFailed) {
    situationLabel = "SSH CONNECTION FAILED";
    situationColor = "text-severity-critical";
    situationBg = "bg-severity-critical/10";
    situationIcon = <XCircle className="w-5 h-5 text-severity-critical" />;
  } else if (noFilesExist) {
    situationLabel = "NO LOG FILES FOUND ON ROUTER";
    situationColor = "text-severity-high";
    situationBg = "bg-severity-high/10";
    situationIcon = <FileText className="w-5 h-5 text-severity-high" />;
  } else if (filesExistButUnreadable) {
    situationLabel = "LOG FILES EXIST BUT UNREADABLE";
    situationColor = "text-severity-high";
    situationBg = "bg-severity-high/10";
    situationIcon = <FileText className="w-5 h-5 text-severity-high" />;
  } else if (filesReadableButEmpty) {
    situationLabel = "LOG FILES READABLE — NO SKYNET ENTRIES";
    situationColor = "text-severity-medium";
    situationBg = "bg-severity-medium/10";
    situationIcon = <FileText className="w-5 h-5 text-severity-medium" />;
  } else if (hasMatchingLines) {
    situationLabel = "ENTRIES FOUND (DISPLAY ISSUE)";
    situationColor = "text-severity-low";
    situationBg = "bg-severity-low/10";
    situationIcon = <CheckCircle2 className="w-5 h-5 text-severity-low" />;
  }

  return (
    <div className="py-6 px-6 space-y-5">
      {/* Situation Header */}
      <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border", situationBg, `border-current/20`)}>
        {situationIcon}
        <div>
          <p className={cn("text-sm font-bold tracking-wide", situationColor)}>{situationLabel}</p>
          {error && <p className="text-xs text-muted-foreground mt-0.5">{error}</p>}
        </div>
      </div>

      {/* Diagnostic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SSH Status Card */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Terminal className="w-4 h-4 text-gold" />
            SSH Connection
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Config Found</span>
              <span className={diag?.configFound ? "text-severity-low font-bold" : "text-severity-critical font-bold"}>
                {diag?.configFound ? "YES" : "NO"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Router Address</span>
              <span className="font-mono text-foreground">{diag?.routerAddress || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SSH Status</span>
              <span className={diag?.sshOk ? "text-severity-low font-bold" : "text-severity-critical font-bold"}>
                {diag?.sshOk ? "CONNECTED" : "FAILED"}
              </span>
            </div>
            {diag?.sshError && (
              <div className="mt-1 px-2 py-1.5 rounded bg-severity-critical/10 border border-severity-critical/20">
                <span className="text-severity-critical font-mono text-[11px] break-all">{diag.sshError}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fetch Duration</span>
              <span className="font-mono text-foreground">{diag?.fetchDurationMs ?? 0}ms</span>
            </div>
          </div>
        </div>

        {/* File Probe Card */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <HardDrive className="w-4 h-4 text-gold" />
            Log File Probes
          </div>
          <div className="space-y-1.5">
            {diag?.files.map((f) => (
              <div key={f.path} className="flex items-center gap-2 text-xs font-mono">
                {/* Status icon */}
                {f.exists && f.readable && f.matchingLines > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-severity-low shrink-0" />
                ) : f.exists && f.readable ? (
                  <FileText className="w-3.5 h-3.5 text-severity-medium shrink-0" />
                ) : f.exists ? (
                  <XCircle className="w-3.5 h-3.5 text-severity-high shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={cn(
                  "truncate",
                  f.exists ? "text-foreground" : "text-muted-foreground/50"
                )}>
                  {f.path}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {!f.exists ? "MISSING" :
                   !f.readable ? "UNREADABLE" :
                   `${f.totalLines}L / ${f.matchingLines}M`}
                </span>
              </div>
            )) ?? (
              <p className="text-xs text-muted-foreground">No probe data (SSH did not connect)</p>
            )}
          </div>
          {diag && diag.sshOk && (
            <div className="pt-2 border-t border-border/30 flex justify-between text-xs">
              <span className="text-muted-foreground">Total Matching Lines</span>
              <span className={cn(
                "font-bold font-mono",
                diag.totalMatchingLines > 0 ? "text-severity-low" : "text-severity-critical"
              )}>
                {diag.totalMatchingLines}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grep Pattern */}
      {diag && (
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="w-4 h-4 text-gold" />
            Search Pattern
          </div>
          <div className="px-3 py-2 rounded bg-black/40 font-mono text-[11px] text-gold/80 break-all">
            grep -iE &quot;{diag.grepPattern}&quot;
          </div>
          <p className="text-[11px] text-muted-foreground">
            Applied across all readable log files. Matches iptables LOG entries tagged by Skynet.
          </p>
        </div>
      )}

      {/* Situation-Specific Guidance */}
      <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Shield className="w-4 h-4 text-gold" />
          What To Do
        </div>
        <div className="text-xs text-muted-foreground space-y-2">
          {noConfig && (
            <>
              <p>No router connection has been configured. You must set the router IP address, SSH port, and credentials before logs can be fetched.</p>
              <p className="font-medium text-foreground">Go to Settings → enter your router's IP, SSH port (usually 22), username, and password → click Save → then return here.</p>
            </>
          )}
          {sshFailed && (
            <>
              <p>The app attempted to connect to <span className="font-mono text-foreground">{diag?.routerAddress}</span> via SSH but the connection failed.</p>
              <p className="font-medium text-foreground">Common causes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Authentication failed</strong> — wrong username/password in Settings</li>
                <li><strong>Connection refused</strong> — SSH is not enabled on the router (Administration → System → Enable SSH: LAN only)</li>
                <li><strong>Timed out</strong> — wrong IP address, or router is unreachable from this server</li>
                <li><strong>Host unreachable</strong> — network path issue between this server and the router</li>
              </ul>
            </>
          )}
          {noFilesExist && (
            <>
              <p>SSH connected successfully, but none of the standard syslog paths contain log files. This usually means syslog logging is disabled on the router.</p>
              <p className="font-medium text-foreground">Router-side prerequisites:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Administration → System → Enable Syslog: <strong>Yes</strong></li>
                <li>Skynet → Settings → Logging: <strong>Enabled</strong></li>
                <li>After enabling, wait for traffic to be blocked, then retry</li>
              </ul>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
                Checked: {diag?.pathsChecked.join(", ")}
              </p>
            </>
          )}
          {filesExistButUnreadable && (
            <>
              <p>Log files exist on the router but are not readable by the SSH user. This is a permissions issue.</p>
              <p className="font-medium text-foreground">Fix: SSH into the router manually and run:</p>
              <div className="px-3 py-2 rounded bg-black/40 font-mono text-[11px] text-gold/80">
                chmod 644 /tmp/syslog.log /jffs/syslog.log 2&gt;/dev/null
              </div>
            </>
          )}
          {filesReadableButEmpty && (
            <>
              <p>SSH connected, log files exist and are readable, but <strong>zero lines match Skynet's BLOCKED pattern</strong>. This means either:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Skynet has not blocked any traffic yet (new install or very low traffic)</li>
                <li>Skynet's iptables LOG target is not enabled</li>
                <li>The syslog is being rotated and the current file has no Skynet entries</li>
              </ul>
              <p className="font-medium text-foreground mt-2">To verify Skynet logging is active, SSH into the router and run:</p>
              <div className="px-3 py-2 rounded bg-black/40 font-mono text-[11px] text-gold/80">
                iptables -L -n | grep -c LOG
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1">If the count is 0, Skynet's LOG rules are not active. Restart Skynet: <code className="text-gold/60">firewall restart</code></p>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRetry}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
            bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30
            disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          {isFetching ? "Fetching..." : "Retry Fetch"}
        </button>

        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
            bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-all"
        >
          <Settings className="w-4 h-4" />
          Open Settings
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
            bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-all"
        >
          <Copy className="w-4 h-4" />
          Copy Diagnostics
        </button>

        {diag?.routerAddress && (
          <a
            href={`http://${diag.routerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-muted/30 text-foreground border border-border hover:bg-muted/50 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Router Admin
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Logs Page ─────────────────────────────────────────

export default function Logs() {
  // ─── Filter State ────────────────────────────────────────
  const [direction, setDirection] = useState<Direction>("ALL");
  const [ipSearch, setIpSearch] = useState("");
  const [protocol, setProtocol] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [maxLines, setMaxLines] = useState(500);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10);
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
  const diagnostics = data?.diagnostics as SyslogDiagnostics | null ?? null;
  const rawLineCount = data?.rawLineCount ?? 0;
  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt as any) : null;
  const logsHasData = entries.length > 0;
  const logsIsLive = logsHasData && !error;

  // ─── GeoIP for visible entries ──────────────────────────
  const uniqueSrcIps = useMemo(() => {
    const ips = new Set<string>();
    entries.forEach(e => {
      if (e.srcIp && !e.srcIp.startsWith("10.") && !e.srcIp.startsWith("192.168.") && !e.srcIp.startsWith("172.")) {
        ips.add(e.srcIp);
      }
    });
    return Array.from(ips).slice(0, 100);
  }, [entries]);

  const geoQuery = trpc.skynet.resolveGeoIP.useQuery(
    { ips: uniqueSrcIps },
    { enabled: uniqueSrcIps.length > 0, refetchOnWindowFocus: false, staleTime: 60000 }
  );
  const geoMap = geoQuery.data?.geoMap ?? {};

  // ─── Export Helpers ─────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const header = "Direction,Timestamp,Source IP,Destination IP,Protocol,Src Port,Dst Port,TTL,Length,TCP Flags,Country\n";
    const rows = entries.map(e => {
      const geo = geoMap[e.srcIp];
      return `"${e.direction}","${e.timestamp}","${e.srcIp}","${e.dstIp}","${e.protocol}",${e.srcPort},${e.dstPort},${e.ttl},${e.length},"${e.tcpFlags.join(" ")}","${(geo as any)?.country || ""}"`.trim();
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skynet-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${entries.length} log entries as CSV`);
  }, [entries, geoMap]);

  const handleExportJSON = useCallback(() => {
    const enriched = entries.map(e => ({
      ...e,
      geo: geoMap[e.srcIp] || null,
    }));
    const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skynet-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${entries.length} log entries as JSON`);
  }, [entries, geoMap]);

  // Should we show the diagnostic panel?
  const showDiagnostics = !isLoading && entries.length === 0;

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
              <DataSourceBadge
                fetchedAt={fetchedAt}
                isLive={logsIsLive}
                hasData={logsHasData}
                error={error}
                className="mt-1"
              />
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

            {/* Export buttons */}
            <button
              onClick={handleExportCSV}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50
                border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50
                border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30
                disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Error Banner (only when there ARE entries but also an error) */}
        {error && entries.length > 0 && (
          <GlassCard className="mb-4 border border-severity-critical/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-severity-critical shrink-0" />
              <div>
                <p className="text-sm font-medium text-severity-critical">Partial fetch error</p>
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
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
                  {hasActiveFilters && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold/20 text-gold">
                      ACTIVE
                    </span>
                  )}
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
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Direction
                          </label>
                          <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as Direction)}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground outline-none focus:border-gold/50"
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
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            IP Address
                          </label>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={ipSearch}
                              onChange={(e) => setIpSearch(e.target.value)}
                              placeholder="Search IP..."
                              className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground outline-none focus:border-gold/50 placeholder:text-muted-foreground/50"
                            />
                          </div>
                        </div>

                        {/* Protocol */}
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Protocol
                          </label>
                          <select
                            value={protocol}
                            onChange={(e) => setProtocol(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground outline-none focus:border-gold/50"
                          >
                            <option value="">All</option>
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                            <option value="ICMP">ICMP</option>
                          </select>
                        </div>

                        {/* Port */}
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Dst Port
                          </label>
                          <input
                            type="text"
                            value={portFilter}
                            onChange={(e) => setPortFilter(e.target.value.replace(/\D/g, ""))}
                            placeholder="e.g. 443"
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground outline-none focus:border-gold/50 placeholder:text-muted-foreground/50"
                          />
                        </div>

                        {/* Max Lines */}
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Max Lines
                          </label>
                          <select
                            value={maxLines}
                            onChange={(e) => setMaxLines(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-foreground outline-none focus:border-gold/50"
                          >
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                            <option value={2000}>2000</option>
                          </select>
                        </div>

                        {/* Clear */}
                        <div className="flex items-end">
                          {hasActiveFilters && (
                            <button
                              onClick={clearFilters}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                                text-severity-critical hover:bg-severity-critical/10 transition-colors"
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

              {/* Diagnostic Panel (replaces old empty state) */}
              {showDiagnostics && (
                <DiagnosticPanel
                  diagnostics={diagnostics}
                  error={error}
                  onRetry={handleRefresh}
                  isFetching={isFetching}
                />
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
                  <div className="grid grid-cols-[60px_70px_140px_60px_140px_60px_80px_80px_1fr] gap-2 px-4 py-2 border-b border-border/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card/80 backdrop-blur-sm min-w-[900px]">
                    <div>Dir</div>
                    <div>Time</div>
                    <div>Source IP</div>
                    <div>Country</div>
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
                              "grid grid-cols-[60px_70px_140px_60px_140px_60px_80px_80px_1fr] gap-2 px-4 py-2.5 w-full text-left",
                              "border-b border-border/30 hover:bg-muted/20 transition-colors min-w-[900px]",
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

                            {/* Country */}
                            <div className="flex items-center gap-1">
                              {geoMap[entry.srcIp] ? (
                                <>
                                  <span className="text-sm leading-none">{(geoMap[entry.srcIp] as any).flag}</span>
                                  <span className="text-[10px] text-muted-foreground">{(geoMap[entry.srcIp] as any).countryCode}</span>
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40">—</span>
                              )}
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
                                  {geoMap[entry.srcIp] && (
                                    <>
                                      <div>
                                        <span className="text-muted-foreground block mb-0.5">Country</span>
                                        <span className="font-mono text-foreground">
                                          {(geoMap[entry.srcIp] as any).flag} {(geoMap[entry.srcIp] as any).country}
                                        </span>
                                      </div>
                                      {(geoMap[entry.srcIp] as any).city && (
                                        <div>
                                          <span className="text-muted-foreground block mb-0.5">City</span>
                                          <span className="font-mono text-foreground">{(geoMap[entry.srcIp] as any).city}</span>
                                        </div>
                                      )}
                                      {(geoMap[entry.srcIp] as any).isp && (
                                        <div>
                                          <span className="text-muted-foreground block mb-0.5">ISP</span>
                                          <span className="font-mono text-foreground">{(geoMap[entry.srcIp] as any).isp}</span>
                                        </div>
                                      )}
                                      {(geoMap[entry.srcIp] as any).as && (
                                        <div>
                                          <span className="text-muted-foreground block mb-0.5">ASN</span>
                                          <span className="font-mono text-foreground text-[11px]">{(geoMap[entry.srcIp] as any).as}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
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
