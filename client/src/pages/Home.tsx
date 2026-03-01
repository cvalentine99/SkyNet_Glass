/**
 * Home — Skynet Glass Dashboard
 * Design: Glass Cockpit — multi-panel dashboard with sidebar navigation
 * Layout: Compact sidebar + responsive grid main content
 * Ultrawide optimized: 3-col on >1600px, 2-col on desktop, 1-col on mobile
 *
 * Sections mirror the original Skynet router dashboard:
 * 1. Key Stats (KPI row)
 * 2. Top 10 Targeted Ports (Inbound) — PortHitsChart
 * 3. Top 10 Source Ports (Inbound) — PortHitsChart (source tab)
 * 4. Last 10 Unique Connections Blocked (In/Out/HTTP) — LiveConnectionsTable
 * 5. Top 10 Blocks (Inbound/Outbound) — OutboundBlocksChart
 * 6. Top 10 Blocked Devices (Outbound) — OutboundBlocksChart (devices tab)
 * 7. Top 10 HTTP(s) Blocks (Outbound) — OutboundBlocksChart (http tab)
 * Plus: Blocked Connections chart, Attack Types, Country Distribution, Threat Map, Threat Intel table
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
import { kpiData } from "@/lib/data";
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

  const handleSectionChange = (id: string) => {
    setActiveSection(id);
    if (id !== "dashboard") {
      toast("Feature coming soon", {
        description: `The ${id} section is under development`,
      });
    }
  };

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
          <DashboardHeader />

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
              value={14523}
              icon={Globe}
              severity="critical"
              delay={0.35}
            />
            <KpiCard
              title="Active Rules"
              value={1336}
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
              <span className="font-mono tabular-nums">v1.0.0 — Obsidian Glass</span>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
