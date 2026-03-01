/**
 * Home — Skynet Glass Dashboard
 * Design: Glass Cockpit — multi-panel dashboard with sidebar navigation
 * Layout: Compact sidebar + responsive grid main content
 * Ultrawide optimized: 3-col on >1600px, 2-col on desktop, 1-col on mobile
 *
 * All chart components receive data via props from useSkynetStats.
 * Shows loading skeletons while waiting for live data from the router.
 */
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { KpiCard } from "@/components/KpiCard";
import { GlassCard } from "@/components/GlassCard";
import { BlockedConnectionsChart } from "@/components/charts/BlockedConnectionsChart";
import { PortHitsChart } from "@/components/charts/PortHitsChart";
import { ConnectionTypesChart } from "@/components/charts/ConnectionTypesChart";
import { CountryDistributionChart } from "@/components/charts/CountryDistributionChart";
import { OutboundBlocksChart } from "@/components/charts/OutboundBlocksChart";
import { ThreatMapPanel } from "@/components/ThreatMapPanel";
import { ThreatTable } from "@/components/ThreatTable";
import { LiveConnectionsTable } from "@/components/LiveConnectionsTable";
import {
  KpiRowSkeleton,
  ChartSkeleton,
  DonutSkeleton,
  HBarSkeleton,
  TableSkeleton,
  MapSkeleton,
} from "@/components/DashboardSkeletons";
import { useSkynetStats } from "@/hooks/useSkynetStats";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Target,
  Percent,
  Globe,
  Zap,
} from "lucide-react";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/hero-bg-mi2aViN66MoWoiQ3BpV4R2.webp";

export default function Home() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const skynet = useSkynetStats();

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    if (id !== "dashboard") {
      toast("Feature coming soon", {
        description: `The ${id} section is under development`,
      });
    }
  };

  const { kpiData } = skynet;

  // Show full skeleton when initial load is happening with a configured router
  const showFullSkeleton = skynet.isLoading && skynet.hasConfig;

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      {/* Hero background — subtle, behind everything */}
      <div
        className="fixed inset-0 opacity-15 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background pointer-events-none z-0" />

      {/* Sidebar */}
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Main Content */}
      <main className="ml-[64px] relative z-10 min-h-screen">
        <div className="max-w-[1920px] mx-auto px-6 py-6">
          {/* Header */}
          <DashboardHeader
            monitoringSince={kpiData.monitoringSince}
            logSize={kpiData.logSize}
            isUsingLiveData={skynet.isUsingLiveData}
            hasConfig={skynet.hasConfig}
          />

          {/* Refetching indicator — subtle gold bar at top */}
          <AnimatePresence>
            {skynet.isRefetching && !showFullSkeleton && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-4 h-0.5 rounded-full origin-left"
                style={{
                  background: "linear-gradient(90deg, transparent, oklch(0.769 0.108 85.805), transparent)",
                }}
              />
            )}
          </AnimatePresence>

          {/* Live data banner */}
          {!skynet.hasConfig && !skynet.isLoading && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg glass-card border-gold/20 text-xs">
              <span className="text-gold font-medium">Sample Data Mode</span>
              <span className="text-muted-foreground">
                Connect to your router in{" "}
                <a href="/settings" className="text-gold underline underline-offset-2 hover:text-gold/80">
                  Settings
                </a>{" "}
                to see live firewall data.
              </span>
            </div>
          )}

          {skynet.error && skynet.hasConfig && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg glass-card border-severity-critical/30 text-xs">
              <span className="text-severity-critical font-medium">Connection Error</span>
              <span className="text-muted-foreground">{skynet.error}</span>
            </div>
          )}

          {/* Loading banner when fetching from router */}
          <AnimatePresence>
            {skynet.isFetchingStats && !showFullSkeleton && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg glass-card text-xs"
              >
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "oklch(0.769 0.108 85.805)" }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-gold font-medium">Fetching live data from router...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {showFullSkeleton ? (
              /* ── Full Skeleton State ── */
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* KPI Row Skeleton */}
                <KpiRowSkeleton />

                {/* Primary Charts Row */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="xl:col-span-2">
                    <ChartSkeleton title="Blocked Connections" subtitle="Loading firewall data..." delay={0.1} />
                  </div>
                  <DonutSkeleton title="Attack Types" delay={0.15} />
                </div>

                {/* Port Stats + Country */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                  <HBarSkeleton title="Port Statistics" delay={0.2} />
                  <HBarSkeleton title="Threat Origins" delay={0.25} />
                </div>

                {/* Top Blocks */}
                <div className="mb-4">
                  <HBarSkeleton title="Top Blocks by IP" delay={0.3} />
                </div>

                {/* Recent Connections */}
                <div className="mb-4">
                  <TableSkeleton title="Recent Blocked Connections" rows={6} cols={5} delay={0.35} />
                </div>

                {/* Threat Map */}
                <div className="mb-4">
                  <MapSkeleton delay={0.4} />
                </div>

                {/* Threat Intel Table */}
                <div className="mb-8">
                  <TableSkeleton title="Threat Intelligence" rows={8} cols={6} delay={0.45} />
                </div>
              </motion.div>
            ) : (
              /* ── Data State ── */
              <motion.div
                key="data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
                  <KpiCard
                    title="IPs Banned"
                    value={kpiData.ipsBanned}
                    icon={Shield}
                    severity="critical"
                    trend={{ value: 12, positive: false }}
                    delay={0.05}
                  />
                  <KpiCard
                    title="Ranges Banned"
                    value={kpiData.rangesBanned}
                    icon={Layers}
                    severity="high"
                    delay={0.1}
                  />
                  <KpiCard
                    title="Inbound Blocks"
                    value={kpiData.inboundBlocks}
                    icon={ArrowDownToLine}
                    severity="medium"
                    trend={{ value: 8, positive: false }}
                    delay={0.15}
                  />
                  <KpiCard
                    title="Outbound Blocks"
                    value={kpiData.outboundBlocks}
                    icon={ArrowUpFromLine}
                    severity="low"
                    delay={0.2}
                  />
                  <KpiCard
                    title="Total Blocks"
                    value={kpiData.totalBlocks}
                    icon={Target}
                    severity="neutral"
                    delay={0.25}
                  />
                  <KpiCard
                    title="Block Rate"
                    value={kpiData.blockRate}
                    icon={Percent}
                    suffix="%"
                    severity="neutral"
                    delay={0.3}
                  />
                  <KpiCard
                    title="Top Threat"
                    value={kpiData.ipsBanned > 0 ? kpiData.inboundBlocks : 14523}
                    icon={Globe}
                    severity="critical"
                    delay={0.35}
                  />
                  <KpiCard
                    title="Active Rules"
                    value={kpiData.ipsBanned + kpiData.rangesBanned}
                    icon={Zap}
                    severity="neutral"
                    trend={{ value: 3, positive: true }}
                    delay={0.4}
                  />
                </div>

                {/* Primary Charts Row — Blocked Connections + Attack Types */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="xl:col-span-2">
                    <BlockedConnectionsChart
                      data24h={skynet.blockedConnections24h}
                      data7d={skynet.blockedConnections7d}
                    />
                  </div>
                  <ConnectionTypesChart data={skynet.connectionTypes} />
                </div>

                {/* Port Statistics + Country Distribution */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                  <PortHitsChart
                    inboundPortHits={skynet.inboundPortHits}
                    sourcePortHits={skynet.sourcePortHits}
                  />
                  <CountryDistributionChart data={skynet.countryDistribution} />
                </div>

                {/* Top Blocks by IP (Inbound/Outbound/Devices/HTTP) */}
                <div className="mb-4">
                  <OutboundBlocksChart
                    topInboundBlocks={skynet.topInboundBlocks}
                    topOutboundBlocks={skynet.topOutboundBlocks}
                    topBlockedDevices={skynet.topBlockedDevices}
                    topHttpBlocks={skynet.topHttpBlocks}
                  />
                </div>

                {/* Recent Blocked Connections (Inbound/Outbound/HTTP) */}
                <div className="mb-4">
                  <LiveConnectionsTable
                    inboundConnections={skynet.lastInboundConnections}
                    outboundConnections={skynet.lastOutboundConnections}
                    httpConnections={skynet.lastHttpConnections}
                  />
                </div>

                {/* Threat Map */}
                <div className="mb-4">
                  <ThreatMapPanel countryData={skynet.countryDistribution} />
                </div>

                {/* Threat Intelligence Table */}
                <div className="mb-8">
                  <ThreatTable data={skynet.blockedIPs} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <GlassCard delay={0.7} className="mb-6">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Skynet Firewall Statistics Dashboard</span>
              <div className="flex items-center gap-4">
                {skynet.fetchedAt && (
                  <span className="font-mono tabular-nums">
                    Last updated: {new Date(skynet.fetchedAt).toLocaleTimeString()}
                  </span>
                )}
                <span className="font-mono tabular-nums">v1.0.0 — Obsidian Glass</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
