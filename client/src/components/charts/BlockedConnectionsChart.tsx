/**
 * BlockedConnectionsChart — Blocked connections summary
 * 
 * ACCURACY NOTE: The original Skynet stats.js does NOT contain hourly or daily
 * timeline data. It only provides total inbound/outbound block counts.
 * This chart now honestly shows a summary bar comparison of inbound vs outbound
 * totals instead of fabricating a fake temporal distribution.
 */
import { motion } from "framer-motion";
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
};

interface BlockedConnectionsChartProps {
  inboundBlocks: number;
  outboundBlocks: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground mb-1">{item.payload.name}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: item.payload.fill }} />
        <span className="text-muted-foreground">Blocks:</span>
        <span className="font-mono font-medium tabular-nums" style={{ color: item.payload.fill }}>
          {item.value.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export function BlockedConnectionsChart({ inboundBlocks, outboundBlocks }: BlockedConnectionsChartProps) {
  const totalBlocks = inboundBlocks + outboundBlocks;
  const isEmpty = totalBlocks === 0;
  const inboundPct = totalBlocks > 0 ? Math.round((inboundBlocks / totalBlocks) * 100) : 0;
  const outboundPct = totalBlocks > 0 ? Math.round((outboundBlocks / totalBlocks) * 100) : 0;

  const data = [
    { name: "Inbound", value: inboundBlocks, fill: CHART_COLORS.gold },
    { name: "Outbound", value: outboundBlocks, fill: CHART_COLORS.cyan },
  ];

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
          <p className="text-[11px] text-muted-foreground mt-0.5">Total inbound vs outbound firewall blocks</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-foreground font-mono tabular-nums">{totalBlocks.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">total blocks</p>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.1 0.005 260 / 40%)" }}>
          <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS.gold }} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Inbound</p>
            <p className="text-sm font-bold font-mono tabular-nums" style={{ color: CHART_COLORS.gold }}>
              {inboundBlocks.toLocaleString()}
            </p>
          </div>
          <span className="ml-auto text-xs font-mono text-muted-foreground tabular-nums">{inboundPct}%</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.1 0.005 260 / 40%)" }}>
          <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS.cyan }} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outbound</p>
            <p className="text-sm font-bold font-mono tabular-nums" style={{ color: CHART_COLORS.cyan }}>
              {outboundBlocks.toLocaleString()}
            </p>
          </div>
          <span className="ml-auto text-xs font-mono text-muted-foreground tabular-nums">{outboundPct}%</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
          <div className="text-center">
            <p className="mb-1">No block count data in stats.js</p>
            <p className="text-[10px]">Skynet may need to regenerate statistics</p>
          </div>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
            axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 3%)" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={80}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        {isEmpty ? "Click 'Regenerate' then 'Update Stats' to populate" : "Totals from stats.js — Skynet does not provide hourly/daily breakdown data"}
      </p>
    </motion.div>
  );
}
