/**
 * OutboundBlocksChart — Top blocks by IP (Inbound/Outbound/Devices)
 * Mirrors original Skynet sections:
 * - Top 10 Blocks (Inbound)
 * - Top 10 Blocks (Outbound)
 * - Top 10 Blocked Devices (Outbound)
 * - Top 10 HTTP(s) Blocks (Outbound)
 * Design: Glass Cockpit — multi-tab chart with grouped bars
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
import { chartColors } from "@/lib/data";

const inboundBlocks = [
  { ip: "185.220.101.34", hits: 4521 },
  { ip: "45.148.10.92", hits: 3876 },
  { ip: "103.145.13.205", hits: 2943 },
  { ip: "91.240.118.172", hits: 2456 },
  { ip: "222.186.30.112", hits: 2134 },
  { ip: "193.42.33.45", hits: 1876 },
  { ip: "118.25.6.39", hits: 1654 },
  { ip: "5.188.206.14", hits: 1432 },
  { ip: "141.98.10.63", hits: 1287 },
  { ip: "89.248.167.131", hits: 1098 },
];

const outboundBlocks = [
  { ip: "45.33.32.156", hits: 342 },
  { ip: "185.141.63.120", hits: 287 },
  { ip: "91.215.85.209", hits: 234 },
  { ip: "104.21.32.1", hits: 198 },
  { ip: "172.67.181.1", hits: 176 },
  { ip: "23.227.38.32", hits: 154 },
  { ip: "185.220.101.34", hits: 132 },
  { ip: "45.148.10.92", hits: 121 },
  { ip: "103.145.13.205", hits: 98 },
  { ip: "91.240.118.172", hits: 87 },
];

const blockedDevices = [
  { ip: "192.168.1.105", hits: 456 },
  { ip: "192.168.1.42", hits: 387 },
  { ip: "192.168.1.200", hits: 234 },
  { ip: "192.168.1.15", hits: 198 },
  { ip: "192.168.1.88", hits: 167 },
  { ip: "192.168.1.33", hits: 143 },
  { ip: "192.168.1.77", hits: 121 },
  { ip: "192.168.1.150", hits: 98 },
  { ip: "192.168.1.220", hits: 76 },
  { ip: "192.168.1.5", hits: 54 },
];

const httpBlocks = [
  { ip: "malware-c2.example.com", hits: 234 },
  { ip: "phishing.evil.com", hits: 198 },
  { ip: "tracker.ads.net", hits: 176 },
  { ip: "crypto-miner.io", hits: 154 },
  { ip: "data-exfil.ru", hits: 132 },
  { ip: "botnet-relay.cn", hits: 121 },
  { ip: "spam-sender.org", hits: 98 },
  { ip: "exploit-kit.net", hits: 87 },
  { ip: "ransomware.cc", hits: 76 },
  { ip: "keylogger.xyz", hits: 65 },
];

const tabs = [
  { id: "inbound", label: "Inbound", data: inboundBlocks },
  { id: "outbound", label: "Outbound", data: outboundBlocks },
  { id: "devices", label: "Devices", data: blockedDevices },
  { id: "http", label: "HTTP(s)", data: httpBlocks },
] as const;

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
    </div>
  );
};

export function OutboundBlocksChart() {
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound" | "devices" | "http">("inbound");
  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const barColor = activeTab === "inbound" ? chartColors.gold
    : activeTab === "outbound" ? chartColors.cyan
    : activeTab === "devices" ? chartColors.amber
    : chartColors.red;

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
          <Bar dataKey="hits" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {currentTab.data.map((_, index) => (
              <Cell
                key={index}
                fill={barColor}
                fillOpacity={1 - index * 0.07}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
