/**
 * CountryDistributionChart — Horizontal bar chart for threat origins by country
 * Design: Glass Cockpit — severity-graded bars
 * Accepts data via props; no direct sample data import.
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

const BAR_COLORS = [
  "#E74C3C", "#E74C3C",
  "#D4A843", "#D4A843",
  "#C9A962", "#C9A962",
  "#4ECDC4", "#4ECDC4",
  "#45B764", "#64748B",
];

export interface CountryData {
  country: string;
  code: string;
  blocks: number;
  percentage: number;
}

interface CountryDistributionChartProps {
  data: CountryData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground mb-1">
        {item.country} <span className="text-muted-foreground">({item.code})</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Blocks:</span>
        <span className="font-mono font-medium text-gold tabular-nums">
          {item.blocks.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-muted-foreground">Share:</span>
        <span className="font-mono font-medium text-gold tabular-nums">
          {item.percentage}%
        </span>
      </div>
    </div>
  );
};

export function CountryDistributionChart({ data }: CountryDistributionChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className="glass-card p-5"
    >
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-foreground">Threat Origins</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Blocked connections by country</p>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 5, bottom: 0 }}
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
            dataKey="country"
            tick={{ fill: "oklch(0.85 0.005 85)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={85}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 3%)" }} />
          <Bar dataKey="blocks" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLORS[index] || "#64748B"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
