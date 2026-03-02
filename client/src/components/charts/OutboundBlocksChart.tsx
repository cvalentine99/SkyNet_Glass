/**
 * OutboundBlocksChart — Top blocks by IP (Inbound/Outbound/Devices/HTTP)
 * Design: Glass Cockpit — multi-tab chart with grouped bars
 * Accepts data via props; no direct sample data import.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CHART_COLORS = {
  gold: "#C9A962",
  cyan: "#4ECDC4",
  green: "#45B764",
  amber: "#D4A843",
  red: "#E74C3C",
  slate: "#64748B",
};

interface BlockEntry {
  ip: string;
  hits: number;
  country?: string;
}

interface OutboundBlocksChartProps {
  topInboundBlocks: BlockEntry[];
  topOutboundBlocks: BlockEntry[];
  topBlockedDevices: BlockEntry[];
  topHttpBlocks: BlockEntry[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground font-mono mb-1">{item?.ip}</p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Blocks:</span>
        <span className="font-mono font-medium text-gold tabular-nums">
          {payload[0]?.value?.toLocaleString()}
        </span>
      </div>
      {item?.country && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-muted-foreground">Country:</span>
          <span className="text-foreground">{item.country}</span>
        </div>
      )}
    </div>
  );
};

type TabId = "inbound" | "outbound" | "devices" | "http";

export function OutboundBlocksChart({
  topInboundBlocks,
  topOutboundBlocks,
  topBlockedDevices,
  topHttpBlocks,
}: OutboundBlocksChartProps) {
  const [activeTab, setActiveTab] = useState<TabId>("inbound");

  const tabs: { id: TabId; label: string; data: BlockEntry[] }[] = [
    { id: "inbound", label: "Inbound", data: topInboundBlocks },
    { id: "outbound", label: "Outbound", data: topOutboundBlocks },
    { id: "devices", label: "Devices", data: topBlockedDevices },
    { id: "http", label: "HTTP(s)", data: topHttpBlocks },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const barColor = activeTab === "inbound" ? CHART_COLORS.gold
    : activeTab === "outbound" ? CHART_COLORS.cyan
    : activeTab === "devices" ? CHART_COLORS.amber
    : CHART_COLORS.red;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Top Blocks by IP</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Top 10 {activeTab === "devices" ? "blocked devices" : `${activeTab} blocks`}
          </p>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 capitalize",
                activeTab === tab.id
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {currentTab.data.length === 0 ? (
        <div className="flex items-center justify-center h-[340px] text-muted-foreground text-sm">
          No data available — connect your router to see live blocks
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={currentTab.data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
              axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="ip"
              tick={{ fill: "oklch(0.85 0.005 85)", fontSize: 10, fontFamily: "'JetBrains Mono'" }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 3%)" }} />
            <Bar dataKey="hits" radius={[0, 4, 4, 0]} maxBarSize={22}
              onClick={(entry: any) => {
                if (entry?.ip) window.open(`https://www.abuseipdb.com/check/${encodeURIComponent(entry.ip)}`, '_blank');
              }}
              className="cursor-pointer"
            >
              {currentTab.data.map((_, index) => {
                // Gradient from bright to dim for visual ranking
                const opacity = 0.95 - index * 0.065;
                return (
                  <Cell
                    key={index}
                    fill={barColor}
                    fillOpacity={Math.max(opacity, 0.3)}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
