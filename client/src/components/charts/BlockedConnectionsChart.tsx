/**
 * BlockedConnectionsChart — 24h/7d blocked connections area chart
 * Design: Glass Cockpit — gold/cyan gradient fills on dark background
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { blockedConnections24h, blockedConnections7d, chartColors } from "@/lib/data";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium tabular-nums" style={{ color: entry.color }}>
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export function BlockedConnectionsChart() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d">("24h");
  const data = timeRange === "24h" ? blockedConnections24h : blockedConnections7d;
  const xKey = timeRange === "24h" ? "time" : "day";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Blocked Connections</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Inbound & outbound firewall blocks</p>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
          {(["24h", "7d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                timeRange === range
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientInbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.gold} stopOpacity={0.4} />
              <stop offset="100%" stopColor={chartColors.gold} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradientOutbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.cyan} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColors.cyan} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
            axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: "'Inter'" }}
            iconType="circle"
            iconSize={6}
          />
          <Area
            type="monotone"
            dataKey="inbound"
            name="Inbound"
            stroke={chartColors.gold}
            strokeWidth={2}
            fill="url(#gradientInbound)"
            dot={false}
            activeDot={{ r: 4, fill: chartColors.gold, stroke: "oklch(0.05 0 0)", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="outbound"
            name="Outbound"
            stroke={chartColors.cyan}
            strokeWidth={1.5}
            fill="url(#gradientOutbound)"
            dot={false}
            activeDot={{ r: 3, fill: chartColors.cyan, stroke: "oklch(0.05 0 0)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
