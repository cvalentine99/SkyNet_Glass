/**
 * Home — Skynet Glass Dashboard
 * Layout: Compact sidebar + responsive grid main content
 * Ultrawide optimized: 3-col on >1600px, 2-col on desktop, 1-col on mobile
 *
 * All data comes from useSkynetStats (live router data).
 * When no router is configured, shows empty states with "Connect your router" prompts.
 */
import { useCallback } from "react";
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
import { exportAsJson, exportAsCsv } from "@/lib/export";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Shield,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Target,
  Percent,
  Globe,
  Zap,
  Settings,
} from "lucide-react";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/hero-bg-mi2aViN66MoWoiQ3BpV4R2.webp";

export default function Home() {
  const skynet = useSkynetStats();
  const { kpiData } = skynet;

  // Show full skeleton when initial load is happening with a configured router
  const showFullSkeleton = skynet.isLoading && skynet.hasConfig;

  const handleExport = useCallback(() => {
    if (!skynet.isUsingLiveData) {
      toast("No data to export", {
        description: "Connect your router first to export live data.",
      });
      return;
    }

    // Show format picker toast
    toast("Export Skynet Statistics", {
      description: "Choose export format",
      action: {
        label: "JSON",
        onClick: () => {
          exportAsJson({
            kpiData: kpiData as unknown as Record<string, unknown>,
            inboundPortHits: skynet.inboundPortHits,
            sourcePortHits: skynet.sourcePortHits,
            countryDistribution: skynet.countryDistribution,
            topInboundBlocks: skynet.topInboundBlocks,
            topOutboundBlocks: skynet.topOutboundBlocks,
            connectionTypes: skynet.connectionTypes,
            blockedIPs: skynet.blockedIPs,
            fetchedAt: skynet.fetchedAt,
          });
          toast.success("Exported as JSON");
        },
      },
      cancel: {
        label: "CSV",
        onClick: () => {
          exportAsCsv({
            kpiData: kpiData as unknown as Record<string, unknown>,
            inboundPortHits: skynet.inboundPortHits,
            sourcePortHits: skynet.sourcePortHits,
            countryDistribution: skynet.countryDistribution,
            topInboundBlocks: skynet.topInboundBlocks,
            topOutboundBlocks: skynet.topOutboundBlocks,
            connectionTypes: skynet.connectionTypes,
            blockedIPs: skynet.blockedIPs,
            fetchedAt: skynet.fetchedAt,
          });
          toast.success("Exported as CSV");
        },
      },
    });
  }, [skynet, kpiData]);

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      {/* Hero background */}
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

      <Sidebar activeSection="dashboard" onExport={handleExport} />

      <main className="ml-[64px] relative z-10 min-h-screen">
        <div className="max-w-[1920px] mx-auto px-6 py-6">
          {/* Header */}
          <DashboardHeader
            monitoringSince={kpiData.monitoringSince}
            logSize={kpiData.logSize}
            isUsingLiveData={skynet.isUsingLiveData}
            hasConfig={skynet.hasConfig}
          />

          {/* Refetching indicator */}
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

          {/* No Config Banner */}
          {!skynet.hasConfig && !skynet.isLoading && (
            <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-xl glass-card border-gold/20">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.769 0.108 85.805 / 15%)" }}>
                <Settings className="w-5 h-5 text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">No Router Connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure your router connection in{" "}
                  <a href="/settings" className="text-gold underline underline-offset-2 hover:text-gold/80">
                    Settings
                  </a>{" "}
                  to see live Skynet firewall data. All charts will populate once connected.
                </p>
              </div>
            </div>
          )}

          {/* Connection Error Banner */}
          {skynet.error && skynet.hasConfig && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg glass-card border-severity-critical/30 text-xs">
              <span className="text-severity-critical font-medium">Connection Error</span>
              <span className="text-muted-foreground">{skynet.error}</span>
            </div>
          )}

          {/* Fetching indicator */}
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
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <KpiRowSkeleton />
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="xl:col-span-2">
                    <ChartSkeleton title="Blocked Connections" subtitle="Loading firewall data..." delay={0.1} />
                  </div>
                  <DonutSkeleton title="Port Hit Distribution" delay={0.15} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                  <HBarSkeleton title="Port Statistics" delay={0.2} />
                  <HBarSkeleton title="Threat Origins" delay={0.25} />
                </div>
                <div className="mb-4">
                  <HBarSkeleton title="Top Blocks by IP" delay={0.3} />
                </div>
                <div className="mb-4">
                  <TableSkeleton title="Recent Blocked Connections" rows={6} cols={5} delay={0.35} />
                </div>
                <div className="mb-4">
                  <MapSkeleton delay={0.4} />
                </div>
                <div className="mb-8">
                  <TableSkeleton title="Threat Intelligence" rows={8} cols={6} delay={0.45} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
                  <KpiCard title="IPs Banned" value={kpiData.ipsBanned} icon={Shield} severity="critical" delay={0.05} />
                  <KpiCard title="Ranges Banned" value={kpiData.rangesBanned} icon={Layers} severity="high" delay={0.1} />
                  <KpiCard title="Inbound Blocks" value={kpiData.inboundBlocks} icon={ArrowDownToLine} severity="medium" delay={0.15} />
                  <KpiCard title="Outbound Blocks" value={kpiData.outboundBlocks} icon={ArrowUpFromLine} severity="low" delay={0.2} />
                  <KpiCard title="Total Blocks" value={kpiData.totalBlocks} icon={Target} severity="neutral" delay={0.25} />
                  <KpiCard title="Block Rate" value={kpiData.blockRate} icon={Percent} suffix="%" severity="neutral" delay={0.3} />
                  <KpiCard title="Top Threat" value={kpiData.topThreatCountry || "—"} icon={Globe} severity="critical" isText delay={0.35} />
                  <KpiCard title="Active Rules" value={kpiData.ipsBanned + kpiData.rangesBanned} icon={Zap} severity="neutral" delay={0.4} />
                </div>

                {/* Primary Charts Row */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <div className="xl:col-span-2">
                    <BlockedConnectionsChart inboundBlocks={kpiData.inboundBlocks} outboundBlocks={kpiData.outboundBlocks} />
                  </div>
                  <ConnectionTypesChart data={skynet.connectionTypes} />
                </div>

                {/* Port Statistics + Country Distribution */}
                <div id="section-ports" className="scroll-mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                  <PortHitsChart inboundPortHits={skynet.inboundPortHits} sourcePortHits={skynet.sourcePortHits} />
                  <CountryDistributionChart data={skynet.countryDistribution} />
                </div>

                {/* Top Blocks by IP */}
                <div className="mb-4">
                  <OutboundBlocksChart
                    topInboundBlocks={skynet.topInboundBlocks}
                    topOutboundBlocks={skynet.topOutboundBlocks}
                    topBlockedDevices={skynet.topBlockedDevices}
                    topHttpBlocks={skynet.topHttpBlocks}
                  />
                </div>

                {/* Recent Blocked Connections */}
                <div id="section-connections" className="scroll-mt-6 mb-4">
                  <LiveConnectionsTable
                    inboundConnections={skynet.lastInboundConnections}
                    outboundConnections={skynet.lastOutboundConnections}
                    httpConnections={skynet.lastHttpConnections}
                  />
                </div>

                {/* Threat Map */}
                <div id="section-threats" className="scroll-mt-6 mb-4">
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
