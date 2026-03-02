/**
 * Ipsets — Active Ipset Browser
 * Design: Glass Cockpit — two-tab view for Blacklist and Whitelist
 * Layout: 2-col on ultrawide (table + summary), 1-col on mobile
 *
 * Features:
 *   - Browse Skynet-Blacklist + Skynet-BlockedRanges (ban list)
 *   - Browse Skynet-Whitelist + Skynet-WhitelistDomains (allow list)
 *   - Filter by address, category, comment search, type (IP/range)
 *   - Category breakdown summary panel
 *   - Quick actions: unban/remove from whitelist
 *   - GeoIP enrichment: country flag + ASN for each entry
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";

import { GlassCard } from "@/components/GlassCard";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldBan,
  ShieldCheck,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Ban,
  CheckCircle2,
  Globe,
  Server,
  Filter,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { DataSourceBadge } from "@/components/DataSourceBadge";

// ─── Types ─────────────────────────────────────────────────

type TabId = "blacklist" | "whitelist";

interface IpsetEntry {
  setName: string;
  address: string;
  isRange: boolean;
  timeout: number | null;
  comment: string;
  category: string;
  detail: string;
}

interface IpsetSummary {
  totalEntries: number;
  categories: { category: string; count: number }[];
  sets: { setName: string; count: number }[];
  rangeCount: number;
  ipCount: number;
}

interface GeoInfo {
  countryCode: string;
  country: string;
  city: string;
  isp: string;
  org: string;
  as: string;
  asname: string;
  flag: string;
}

// ─── Category Colors ───────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Malware: "text-red-400",
  AiProtect: "text-orange-400",
  Manual: "text-yellow-400",
  "Manual (Domain)": "text-amber-400",
  "Manual (Glass)": "text-gold",
  Country: "text-blue-400",
  ASN: "text-purple-400",
  CDN: "text-green-400",
  "VPN/System": "text-cyan-400",
  Private: "text-emerald-400",
  Other: "text-muted-foreground",
  Unknown: "text-muted-foreground",
};

const CATEGORY_BG: Record<string, string> = {
  Malware: "bg-red-500/10 border-red-500/20",
  AiProtect: "bg-orange-500/10 border-orange-500/20",
  Manual: "bg-yellow-500/10 border-yellow-500/20",
  "Manual (Domain)": "bg-amber-500/10 border-amber-500/20",
  "Manual (Glass)": "bg-gold/10 border-gold/20",
  Country: "bg-blue-500/10 border-blue-500/20",
  ASN: "bg-purple-500/10 border-purple-500/20",
  CDN: "bg-green-500/10 border-green-500/20",
  "VPN/System": "bg-cyan-500/10 border-cyan-500/20",
  Private: "bg-emerald-500/10 border-emerald-500/20",
  Other: "bg-muted/50 border-border",
  Unknown: "bg-muted/50 border-border",
};

// ─── Export helpers ────────────────────────────────────────

function exportCSV(entries: IpsetEntry[], filename: string) {
  const header = "Address,Set,Category,Detail,Comment,Type\n";
  const rows = entries.map(e =>
    `"${e.address}","${e.setName}","${e.category}","${e.detail}","${e.comment}","${e.isRange ? "range" : "ip"}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(entries: IpsetEntry[], filename: string) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────

export default function Ipsets() {
  const [activeTab, setActiveTab] = useState<TabId>("blacklist");
  const [addressSearch, setAddressSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [commentSearch, setCommentSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ip" | "range" | "all">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  // Reset filters when switching tabs
  useEffect(() => {
    setAddressSearch("");
    setCategoryFilter("all");
    setCommentSearch("");
    setTypeFilter("all");
    setExpandedRow(null);
    setPage(0);
  }, [activeTab]);

  // ─── Data Fetching ─────────────────────────────────────

  const blacklistQuery = trpc.skynet.getBlacklist.useQuery(
    {
      addressSearch: addressSearch || undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      commentSearch: commentSearch || undefined,
      type: typeFilter,
    },
    { enabled: activeTab === "blacklist", refetchOnWindowFocus: false }
  );

  const whitelistQuery = trpc.skynet.getWhitelist.useQuery(
    {
      addressSearch: addressSearch || undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      commentSearch: commentSearch || undefined,
      type: typeFilter,
    },
    { enabled: activeTab === "whitelist", refetchOnWindowFocus: false }
  );

  const activeQuery = activeTab === "blacklist" ? blacklistQuery : whitelistQuery;
  const entries = activeQuery.data?.entries ?? [];
  const summary = activeQuery.data?.summary ?? null;
  const error = activeQuery.data?.error ?? null;
  const isLoading = activeQuery.isLoading;

  // Paginate entries
  const paginatedEntries = useMemo(() => {
    return entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [entries, page]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  // Collect unique IPs for GeoIP lookup (only non-range entries)
  const ipsToResolve = useMemo(() => {
    return paginatedEntries
      .filter(e => !e.isRange)
      .map(e => e.address)
      .slice(0, 100); // Limit to 100 for API
  }, [paginatedEntries]);

  const geoQuery = trpc.skynet.resolveGeoIP.useQuery(
    { ips: ipsToResolve },
    { enabled: ipsToResolve.length > 0, refetchOnWindowFocus: false, staleTime: 60000 }
  );

  const geoMap = geoQuery.data?.geoMap ?? {};

  // ─── Mutations ─────────────────────────────────────────

  const unbanIPMut = trpc.skynet.unbanIP.useMutation({
    onSuccess: () => {
      toast.success("IP unbanned successfully");
      blacklistQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unbanRangeMut = trpc.skynet.unbanRange.useMutation({
    onSuccess: () => {
      toast.success("Range unbanned successfully");
      blacklistQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeWlIPMut = trpc.skynet.removeWhitelistIP.useMutation({
    onSuccess: () => {
      toast.success("Removed from whitelist");
      whitelistQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeWlDomainMut = trpc.skynet.removeWhitelistDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain removed from whitelist");
      whitelistQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Actions ───────────────────────────────────────────

  const handleRemoveEntry = useCallback((entry: IpsetEntry) => {
    if (activeTab === "blacklist") {
      if (entry.isRange) {
        unbanRangeMut.mutate({ range: entry.address });
      } else {
        unbanIPMut.mutate({ ip: entry.address });
      }
    } else {
      // Whitelist removal
      if (entry.category === "Manual (Domain)" && entry.detail) {
        removeWlDomainMut.mutate({ domain: entry.detail });
      } else {
        removeWlIPMut.mutate({ ip: entry.address.replace(/\/\d+$/, "") });
      }
    }
  }, [activeTab, unbanIPMut, unbanRangeMut, removeWlIPMut, removeWlDomainMut]);

  const handleRefresh = useCallback(() => {
    activeQuery.refetch();
    toast.info("Refreshing ipset data...");
  }, [activeQuery]);

  const handleExport = useCallback((format: "csv" | "json") => {
    const filename = `skynet-${activeTab}-${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") {
      exportCSV(entries, `${filename}.csv`);
    } else {
      exportJSON(entries, `${filename}.json`);
    }
    toast.success(`Exported ${entries.length} entries as ${format.toUpperCase()}`);
  }, [entries, activeTab]);

  // ─── Category list for filter dropdown ─────────────────

  const availableCategories = useMemo(() => {
    if (!summary) return [];
    return summary.categories.map(c => c.category);
  }, [summary]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeSection="ipsets" />

      <main className="flex-1 ml-[64px] p-4 lg:p-6 2xl:p-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold gradient-text tracking-tight">
            Active Ipset Browser
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Browse and manage Skynet's ban list and whitelist in real-time
          </p>
          <DataSourceBadge
            fetchedAt={activeQuery.dataUpdatedAt ? new Date(activeQuery.dataUpdatedAt) : null}
            isLive={!!activeQuery.data && !error}
            hasData={entries.length > 0}
            error={error}
            className="mt-1"
          />
        </motion.header>

        {/* Tab Bar */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("blacklist")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "blacklist"
                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }`}
          >
            <ShieldBan className="w-4 h-4" />
            Ban List
            {blacklistQuery.data?.summary && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-mono">
                {blacklistQuery.data.summary.totalEntries.toLocaleString()}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("whitelist")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "whitelist"
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Whitelist
            {whitelistQuery.data?.summary && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-mono">
                {whitelistQuery.data.summary.totalEntries.toLocaleString()}
              </span>
            )}
          </button>

          <div className="flex-1" />

          {/* Export buttons */}
          <button
            onClick={() => handleExport("csv")}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50
              border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50
              border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              bg-gold/10 text-gold hover:bg-gold/20 border border-gold/20 transition-all
              disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <GlassCard className="mb-4 border-l-2 border-l-destructive">
            <p className="text-sm text-destructive">{error}</p>
          </GlassCard>
        )}

        {/* Main Content: 2-col on ultrawide */}
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-4">
          {/* Left: Filter Bar + Table */}
          <div className="space-y-4">
            {/* Filter Bar */}
            <GlassCard className="!p-3" delay={0.05}>
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

                {/* Address search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search IP / CIDR..."
                    value={addressSearch}
                    onChange={(e) => { setAddressSearch(e.target.value); setPage(0); }}
                    className="pl-8 pr-3 py-1.5 rounded-md text-xs bg-muted/30 border border-border
                      text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1
                      focus:ring-gold/50 w-44"
                  />
                </div>

                {/* Category filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
                  className="px-2.5 py-1.5 rounded-md text-xs bg-muted/30 border border-border
                    text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                >
                  <option value="all">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Comment search */}
                <input
                  type="text"
                  placeholder="Search comment..."
                  value={commentSearch}
                  onChange={(e) => { setCommentSearch(e.target.value); setPage(0); }}
                  className="px-3 py-1.5 rounded-md text-xs bg-muted/30 border border-border
                    text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1
                    focus:ring-gold/50 w-40"
                />

                {/* Type filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value as "ip" | "range" | "all"); setPage(0); }}
                  className="px-2.5 py-1.5 rounded-md text-xs bg-muted/30 border border-border
                    text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                >
                  <option value="all">All Types</option>
                  <option value="ip">IPs Only</option>
                  <option value="range">Ranges Only</option>
                </select>

                <span className="text-[11px] text-muted-foreground ml-auto">
                  {entries.length.toLocaleString()} entries
                  {entries.length !== (summary?.totalEntries ?? 0) && summary
                    ? ` of ${summary.totalEntries.toLocaleString()}`
                    : ""}
                </span>
              </div>
            </GlassCard>

            {/* Table */}
            <GlassCard noPadding delay={0.1}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium w-8"></th>
                      <th className="text-left px-3 py-3 font-medium">Address</th>
                      <th className="text-left px-3 py-3 font-medium">Country</th>
                      <th className="text-left px-3 py-3 font-medium">Category</th>
                      <th className="text-left px-3 py-3 font-medium">Detail</th>
                      <th className="text-left px-3 py-3 font-medium">Set</th>
                      <th className="text-right px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Loading ipset data from router...</p>
                        </td>
                      </tr>
                    ) : paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16">
                          <div className="text-muted-foreground">
                            {activeTab === "blacklist" ? (
                              <ShieldBan className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            ) : (
                              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            )}
                            <p className="text-sm">
                              {error
                                ? "Unable to fetch ipset data"
                                : entries.length === 0
                                  ? `No ${activeTab === "blacklist" ? "banned" : "whitelisted"} entries found`
                                  : "No entries match your filters"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((entry, idx) => {
                        const geo = geoMap[entry.address] as GeoInfo | undefined;
                        const isExpanded = expandedRow === `${entry.address}-${idx}`;
                        const rowKey = `${entry.address}-${idx}`;

                        return (
                          <motion.tr
                            key={rowKey}
                            initial={false}
                            className={`border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer ${
                              isExpanded ? "bg-muted/10" : ""
                            }`}
                            onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                          >
                            <td className="px-4 py-2.5">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-foreground">
                                {entry.address}
                              </span>
                              {entry.isRange && (
                                <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] bg-blue-500/15 text-blue-400 font-medium">
                                  CIDR
                                </span>
                              )}
                              {!entry.isRange && (
                                <a
                                  href={`https://www.abuseipdb.com/check/${entry.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-1.5 inline-flex items-center text-gold/60 hover:text-gold transition-colors"
                                  title="Check on AbuseIPDB"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {geo ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-base leading-none">{geo.flag}</span>
                                  <span className="text-muted-foreground">{geo.countryCode}</span>
                                </span>
                              ) : entry.isRange ? (
                                <span className="text-muted-foreground/50">—</span>
                              ) : (
                                <span className="text-muted-foreground/50">...</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                CATEGORY_BG[entry.category] || CATEGORY_BG.Other
                              } ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other}`}>
                                {entry.category}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title={entry.detail}>
                              {entry.detail || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {entry.setName.replace("Skynet-", "")}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`${activeTab === "blacklist" ? "Unban" : "Remove"} ${entry.address}?`)) {
                                    handleRemoveEntry(entry);
                                  }
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                  activeTab === "blacklist"
                                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                                }`}
                              >
                                {activeTab === "blacklist" ? "Unban" : "Remove"}
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Expanded Row Detail */}
              <AnimatePresence>
                {expandedRow && paginatedEntries.map((entry, idx) => {
                  const rowKey = `${entry.address}-${idx}`;
                  if (expandedRow !== rowKey) return null;
                  const geo = geoMap[entry.address] as GeoInfo | undefined;

                  return (
                    <motion.div
                      key={`detail-${rowKey}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gold/20 bg-gold/5 overflow-hidden"
                    >
                      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground block mb-1">Full Comment</span>
                          <span className="text-foreground font-mono text-[11px]">{entry.comment || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">Set Name</span>
                          <span className="text-foreground">{entry.setName}</span>
                        </div>
                        {entry.timeout !== null && (
                          <div>
                            <span className="text-muted-foreground block mb-1">Timeout</span>
                            <span className="text-foreground">{entry.timeout}s</span>
                          </div>
                        )}
                        {geo && (
                          <>
                            <div>
                              <span className="text-muted-foreground block mb-1">Country</span>
                              <span className="text-foreground">{geo.flag} {geo.country}</span>
                            </div>
                            {geo.city && (
                              <div>
                                <span className="text-muted-foreground block mb-1">City</span>
                                <span className="text-foreground">{geo.city}</span>
                              </div>
                            )}
                            {geo.isp && (
                              <div>
                                <span className="text-muted-foreground block mb-1">ISP</span>
                                <span className="text-foreground">{geo.isp}</span>
                              </div>
                            )}
                            {geo.org && (
                              <div>
                                <span className="text-muted-foreground block mb-1">Organization</span>
                                <span className="text-foreground">{geo.org}</span>
                              </div>
                            )}
                            {geo.as && (
                              <div>
                                <span className="text-muted-foreground block mb-1">ASN</span>
                                <span className="text-foreground font-mono text-[11px]">{geo.as}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-muted/30 text-muted-foreground
                        hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-muted/30 text-muted-foreground
                        hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right: Summary Panel */}
          <div className="space-y-4">
            {/* Summary Stats */}
            <GlassCard delay={0.15}>
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                {activeTab === "blacklist" ? (
                  <ShieldBan className="w-4 h-4 text-red-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                )}
                {activeTab === "blacklist" ? "Ban List" : "Whitelist"} Summary
              </h3>

              {summary ? (
                <div className="space-y-4">
                  {/* Total / IP / Range counts */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-muted/20">
                      <div className="text-lg font-bold text-foreground font-mono">
                        {summary.totalEntries.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/20">
                      <div className="text-lg font-bold text-foreground font-mono">
                        {summary.ipCount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">IPs</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/20">
                      <div className="text-lg font-bold text-foreground font-mono">
                        {summary.rangeCount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Ranges</div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div>
                    <h4 className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                      Categories
                    </h4>
                    <div className="space-y-1.5">
                      {summary.categories.map(({ category, count }) => {
                        const pct = summary.totalEntries > 0 ? (count / summary.totalEntries) * 100 : 0;
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              setCategoryFilter(categoryFilter === category ? "all" : category);
                              setPage(0);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all
                              hover:bg-muted/30 ${categoryFilter === category ? "bg-muted/40 ring-1 ring-gold/30" : ""}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              CATEGORY_COLORS[category]?.replace("text-", "bg-") || "bg-muted-foreground"
                            }`} />
                            <span className="text-foreground flex-1 text-left truncate">{category}</span>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {count.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground/60 font-mono text-[10px] w-10 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Set Breakdown */}
                  <div>
                    <h4 className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                      Sets
                    </h4>
                    <div className="space-y-1">
                      {summary.sets.map(({ setName, count }) => (
                        <div key={setName} className="flex items-center justify-between px-2 py-1 text-xs">
                          <span className="text-muted-foreground">{setName.replace("Skynet-", "")}</span>
                          <span className="text-foreground font-mono">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GeoIP Cache Info */}
                  {geoQuery.data && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          GeoIP Cache
                        </span>
                        <span className="font-mono">{geoQuery.data.cacheSize} entries</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data available
                </p>
              )}
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  );
}
