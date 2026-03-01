/**
 * PortHitsChart — Bar chart for inbound/source port hits
 * Design: Glass Cockpit — gold bars with glass card container
 * Accepts data via props; no direct sample data import.
 */
import { useState } from "react";
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
  green: "#45B764",
  amber: "#D4A843",
  slate: "#64748B",
};

interface PortHit {
  port: number;
  hits: number;
  service?: string;
}

interface PortHitsChartProps {
  inboundPortHits: PortHit[];
  sourcePortHits: PortHit[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  const item = payload[0]?.payload;
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground mb-1">
        Port {item?.port || label}
        {item?.service && <span className="text-muted-foreground ml-1">({item.service})</span>}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Hits:</span>
        <span className="font-mono font-medium text-gold tabular-nums">
          {payload[0]?.value?.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export function PortHitsChart({ inboundPortHits, sourcePortHits }: PortHitsChartProps) {
  const [view, setView] = useState<"inbound" | "source">("inbound");
  const [chartType, setChartType] = useState<"horizontal" | "vertical">("horizontal");

  const rawData = view === "inbound" ? inboundPortHits : sourcePortHits;
  const data = rawData.slice(0, 10).map(d => ({
    ...d,
    label: view === "inbound" ? `${d.port} (${d.service || ''})` : `${d.port}`,
  }));

  const isHorizontal = chartType === "horizontal";

  const barColors = [
    CHART_COLORS.gold, CHART_COLORS.gold, CHART_COLORS.gold,
    CHART_COLORS.cyan, CHART_COLORS.cyan, CHART_COLORS.cyan,
    CHART_COLORS.green, CHART_COLORS.green,
    CHART_COLORS.amber, CHART_COLORS.amber,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Port Statistics</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Top {view === "inbound" ? "targeted inbound" : "source"} ports by hit count
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
            {(["inbound", "source"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 capitalize ${
                  view === v ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
            {(["horizontal", "vertical"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                  chartType === t ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "horizontal" ? "H" : "V"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        {isHorizontal ? (
          <BarChart
            data={data}
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
              dataKey="label"
              tick={{ fill: "oklch(0.85 0.005 85)", fontSize: 10, fontFamily: "'JetBrains Mono'" }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 3%)" }} />
            <Bar dataKey="hits" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {data.map((_, index) => (
                <Cell key={index} fill={barColors[index] || CHART_COLORS.slate} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 5, right: 5, left: -10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
            <XAxis
              dataKey="port"
              tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 10, fontFamily: "'JetBrains Mono'" }}
              axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: "oklch(0.65 0.01 260)", fontSize: 11, fontFamily: "'JetBrains Mono'" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 3%)" }} />
            <Bar dataKey="hits" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((_, index) => (
                <Cell key={index} fill={barColors[index] || CHART_COLORS.slate} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}
