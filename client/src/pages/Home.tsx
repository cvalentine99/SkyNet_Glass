/**
 * Home — Skynet Glass Dashboard
 * Design: Glass Cockpit — multi-panel dashboard with sidebar navigation
 * Layout: Compact sidebar + responsive grid main content
 * Ultrawide optimized: 3-col on >1600px, 2-col on desktop, 1-col on mobile
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
import { useSkynetStats } from "@/hooks/useSkynetStats";
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

          {/* Live data banner */}
          {!skynet.hasConfig && (
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
              <BlockedConnectionsChart />
            </div>
            <ConnectionTypesChart />
          </div>

          {/* Port Statistics + Country Distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <PortHitsChart />
            <CountryDistributionChart />
          </div>

          {/* Top Blocks by IP (Inbound/Outbound/Devices/HTTP) */}
          <div className="mb-4">
            <OutboundBlocksChart />
          </div>

          {/* Recent Blocked Connections (Inbound/Outbound/HTTP) */}
          <div className="mb-4">
            <LiveConnectionsTable />
          </div>

          {/* Threat Map */}
          <div className="mb-4">
            <ThreatMapPanel />
          </div>

          {/* Threat Intelligence Table */}
          <div className="mb-8">
            <ThreatTable />
          </div>

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
