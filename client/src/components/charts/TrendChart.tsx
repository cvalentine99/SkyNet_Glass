/**
 * TrendChart — Historical stats trend visualization
 * Design: Glass Cockpit — area chart showing block counts over time
 * Uses data from the skynet_stats_history table.
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
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
import { TrendingUp, Clock, BarChart3 } from "lucide-react";

type TimeRange = "24h" | "7d" | "30d" | "all";

const timeRangeConfig: { id: TimeRange; label: string; hours: number }[] = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7 Days", hours: 168 },
  { id: "30d", label: "30 Days", hours: 720 },
  { id: "all", label: "All", hours: 8760 },
];

function formatTime(dateStr: string | Date, range: TimeRange): string {
  const d = new Date(dateStr);
  if (range === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "7d") {
    return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-border/50 px-3 py-2 text-xs"
      style={{
        background: "oklch(0.12 0.008 260 / 95%)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {entry.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const selectedRange = timeRangeConfig.find((r) => r.id === timeRange)!;

  const { data: history, isLoading } = trpc.skynet.getHistory.useQuery(
    { hoursBack: selectedRange.hours },
    { refetchInterval: 300_000 } // refresh every 5 min
  );

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    // Reverse so oldest is first (chart reads left to right)
    return [...history].reverse().map((h) => ({
      time: formatTime(h.snapshotAt, timeRange),
      rawTime: new Date(h.snapshotAt).getTime(),
      inbound: h.inboundBlocks,
      outbound: h.outboundBlocks,
      total: h.totalBlocks,
      ipsBanned: h.ipsBanned,
      countries: h.uniqueCountries,
    }));
  }, [history, timeRange]);

  const hasData = chartData.length > 0;

  // Calculate deltas
  const delta = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    return {
      totalChange: last.total - first.total,
      ipsBannedChange: last.ipsBanned - first.ipsBanned,
    };
  }, [chartData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gold" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Block Trends</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Historical block counts over time
              {delta && delta.totalChange !== 0 && (
                <span className={cn(
                  "ml-2 font-mono",
                  delta.totalChange > 0 ? "text-severity-critical" : "text-green-400"
                )}>
                  {delta.totalChange > 0 ? "+" : ""}{delta.totalChange.toLocaleString()} blocks
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
          {timeRangeConfig.map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200",
                timeRange === range.id
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[280px] flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="w-4 h-4 animate-pulse" />
            Loading history...
          </div>
        </div>
      ) : !hasData ? (
        <div className="h-[280px] flex flex-col items-center justify-center gap-3">
          <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Collecting data... Trends will appear after multiple polling cycles</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Historical data requires at least 2 data points. Connect your router and let it collect data over time.
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.75 0.15 30)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="oklch(0.75 0.15 30)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.7 0.12 250)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="oklch(0.7 0.12 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 5%)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "oklch(1 0 0 / 8%)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "oklch(0.55 0.01 260)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "Inter" }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              type="monotone"
              dataKey="inbound"
              name="Inbound Blocks"
              stroke="oklch(0.75 0.15 30)"
              strokeWidth={2}
              fill="url(#gradInbound)"
              dot={false}
              activeDot={{ r: 4, fill: "oklch(0.75 0.15 30)" }}
            />
            <Area
              type="monotone"
              dataKey="outbound"
              name="Outbound Blocks"
              stroke="oklch(0.7 0.12 250)"
              strokeWidth={2}
              fill="url(#gradOutbound)"
              dot={false}
              activeDot={{ r: 4, fill: "oklch(0.7 0.12 250)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
