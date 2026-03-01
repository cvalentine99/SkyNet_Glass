/**
 * ConnectionTypesChart — Donut chart for attack type distribution
 * Design: Glass Cockpit — security-focused color palette
 */
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { connectionTypes, chartColors } from "@/lib/data";

const COLORS = [
  chartColors.red,
  chartColors.gold,
  chartColors.cyan,
  chartColors.green,
  chartColors.amber,
  chartColors.slate,
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="glass-card-bright p-3 text-xs border border-border/20">
      <p className="font-medium text-foreground mb-1">{item.name}</p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Blocks:</span>
        <span className="font-mono font-medium text-gold tabular-nums">
          {item.value.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-muted-foreground">Share:</span>
        <span className="font-mono font-medium tabular-nums" style={{ color: item.payload.fill }}>
          {((item.value / connectionTypes.reduce((a: number, b: { value: number }) => a + b.value, 0)) * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground truncate">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ConnectionTypesChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="glass-card p-5"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Attack Types</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Distribution by connection type</p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={connectionTypes}
            cx="45%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            stroke="oklch(0.05 0 0)"
            strokeWidth={2}
          >
            {connectionTypes.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            content={renderLegend}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
