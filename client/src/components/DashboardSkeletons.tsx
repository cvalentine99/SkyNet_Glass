/**
 * DashboardSkeletons — Loading skeleton components for the Skynet Glass dashboard.
 * Uses a gold-tinted glass shimmer effect that matches the Obsidian Glass aesthetic.
 * Three variants: KPI cards, chart panels, and table panels.
 */
import { motion } from "framer-motion";

/* ── Shared shimmer bar ── */
function Shimmer({ className = "", delay = 0, style }: { className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded ${className}`}
      style={{ background: "oklch(0.18 0.008 260 / 50%)", ...style }}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, oklch(0.769 0.108 85.805 / 8%) 50%, transparent 100%)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

/* ── KPI Card Skeleton ── */
export function KpiSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="glass-card p-4 space-y-3"
    >
      {/* Icon placeholder */}
      <div className="flex items-center justify-between">
        <Shimmer className="w-8 h-8 rounded-lg" delay={delay} />
        <Shimmer className="w-10 h-4 rounded" delay={delay + 0.1} />
      </div>
      {/* Label */}
      <Shimmer className="w-20 h-3 rounded" delay={delay + 0.15} />
      {/* Value */}
      <Shimmer className="w-16 h-7 rounded" delay={delay + 0.2} />
    </motion.div>
  );
}

/* ── KPI Row Skeleton (8 cards) ── */
export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <KpiSkeleton key={i} delay={i * 0.05} />
      ))}
    </div>
  );
}

/* ── Chart Skeleton ── */
export function ChartSkeleton({
  height = 340,
  delay = 0,
  title,
  subtitle,
}: {
  height?: number;
  delay?: number;
  title?: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1.5">
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : (
            <Shimmer className="w-36 h-4 rounded" delay={delay} />
          )}
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          ) : (
            <Shimmer className="w-52 h-3 rounded" delay={delay + 0.05} />
          )}
        </div>
        <Shimmer className="w-20 h-7 rounded-lg" delay={delay + 0.1} />
      </div>

      {/* Chart area — fake bar/line shapes */}
      <div className="flex items-end gap-1.5" style={{ height }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 20 + Math.sin(i * 0.5 + 1) * 30 + Math.random() * 20;
          return (
            <Shimmer
              key={i}
              className="flex-1 rounded-t"
              delay={delay + i * 0.03}
              style={{ height: `${h}%` } as any}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4">
        <Shimmer className="w-16 h-3 rounded" delay={delay + 0.2} />
        <Shimmer className="w-16 h-3 rounded" delay={delay + 0.25} />
      </div>
    </motion.div>
  );
}

/* ── Donut/Pie Chart Skeleton ── */
export function DonutSkeleton({ delay = 0, title }: { delay?: number; title?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="space-y-1.5 mb-5">
        {title ? (
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        ) : (
          <Shimmer className="w-28 h-4 rounded" delay={delay} />
        )}
        <Shimmer className="w-44 h-3 rounded" delay={delay + 0.05} />
      </div>

      {/* Donut placeholder */}
      <div className="flex items-center justify-center py-6">
        <motion.div
          className="relative"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle
              cx="90" cy="90" r="70"
              fill="none"
              stroke="oklch(0.18 0.008 260 / 50%)"
              strokeWidth="28"
            />
            <motion.circle
              cx="90" cy="90" r="70"
              fill="none"
              stroke="oklch(0.769 0.108 85.805 / 20%)"
              strokeWidth="28"
              strokeDasharray="440"
              initial={{ strokeDashoffset: 440 }}
              animate={{ strokeDashoffset: [440, 110, 440] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      </div>

      {/* Legend */}
      <div className="space-y-2 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Shimmer className="w-3 h-3 rounded-full" delay={delay + i * 0.05} />
            <Shimmer className="w-24 h-3 rounded" delay={delay + i * 0.05 + 0.02} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Horizontal Bar Chart Skeleton ── */
export function HBarSkeleton({ delay = 0, title }: { delay?: number; title?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1.5">
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : (
            <Shimmer className="w-32 h-4 rounded" delay={delay} />
          )}
          <Shimmer className="w-48 h-3 rounded" delay={delay + 0.05} />
        </div>
        <Shimmer className="w-24 h-7 rounded-lg" delay={delay + 0.1} />
      </div>

      {/* Horizontal bars */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => {
          const w = 95 - i * 8 - Math.random() * 5;
          return (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="w-28 h-3 rounded shrink-0" delay={delay + i * 0.04} />
              <Shimmer
                className="h-5 rounded"
                delay={delay + i * 0.04 + 0.02}
                style={{ width: `${w}%` } as any}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Table Skeleton ── */
export function TableSkeleton({
  rows = 6,
  cols = 5,
  delay = 0,
  title,
}: {
  rows?: number;
  cols?: number;
  delay?: number;
  title?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : (
            <Shimmer className="w-40 h-4 rounded" delay={delay} />
          )}
          <Shimmer className="w-56 h-3 rounded" delay={delay + 0.05} />
        </div>
        <Shimmer className="w-28 h-7 rounded-lg" delay={delay + 0.1} />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Header row */}
        <div
          className="flex gap-3 px-4 py-2.5"
          style={{ background: "oklch(0.1 0.005 260 / 60%)" }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Shimmer
              key={i}
              className="h-3 rounded"
              delay={delay + i * 0.03}
              style={{ width: `${100 / cols}%` } as any}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex gap-3 px-4 py-2.5 border-t border-border/10"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Shimmer
                key={c}
                className="h-3 rounded"
                delay={delay + r * 0.04 + c * 0.02}
                style={{ width: `${100 / cols}%` } as any}
              />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Map Skeleton ── */
export function MapSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <Shimmer className="w-36 h-4 rounded" delay={delay} />
          <Shimmer className="w-56 h-3 rounded" delay={delay + 0.05} />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Shimmer className="w-2 h-2 rounded-full" delay={delay + i * 0.05} />
              <Shimmer className="w-12 h-3 rounded" delay={delay + i * 0.05 + 0.02} />
            </div>
          ))}
        </div>
      </div>

      {/* Map placeholder */}
      <motion.div
        className="relative rounded-lg overflow-hidden"
        style={{
          aspectRatio: "16/9",
          background: "oklch(0.1 0.005 260 / 60%)",
        }}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Fake continent shapes */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 450" opacity={0.15}>
          <motion.ellipse
            cx="200" cy="180" rx="80" ry="60"
            fill="oklch(0.769 0.108 85.805)"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.ellipse
            cx="420" cy="160" rx="60" ry="80"
            fill="oklch(0.769 0.108 85.805)"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
          <motion.ellipse
            cx="600" cy="200" rx="100" ry="70"
            fill="oklch(0.769 0.108 85.805)"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
          />
        </svg>

        {/* Scan line */}
        <motion.div
          className="absolute top-0 bottom-0 w-px"
          style={{ background: "oklch(0.769 0.108 85.805 / 40%)" }}
          initial={{ left: "0%" }}
          animate={{ left: "100%" }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {/* Pulsing dots */}
        {[
          { x: "25%", y: "40%" },
          { x: "52%", y: "35%" },
          { x: "75%", y: "45%" },
          { x: "40%", y: "60%" },
          { x: "65%", y: "30%" },
        ].map((pos, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: pos.x,
              top: pos.y,
              background: "oklch(0.769 0.108 85.805 / 60%)",
              boxShadow: "0 0 8px oklch(0.769 0.108 85.805 / 40%)",
            }}
            initial={{ scale: 0.5, opacity: 0.3 }}
            animate={{ scale: [0.5, 1.2, 0.5], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </motion.div>

      {/* Bottom country tags */}
      <div className="flex gap-2 mt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="w-16 h-6 rounded" delay={delay + i * 0.05} />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Full Dashboard Skeleton (all sections) ── */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <KpiRowSkeleton />

      {/* Primary Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartSkeleton title="Blocked Connections" subtitle="Loading firewall data..." delay={0.1} />
        </div>
        <DonutSkeleton title="Attack Types" delay={0.15} />
      </div>

      {/* Port Stats + Country */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <HBarSkeleton title="Port Statistics" delay={0.2} />
        <HBarSkeleton title="Threat Origins" delay={0.25} />
      </div>

      {/* Top Blocks */}
      <HBarSkeleton title="Top Blocks by IP" delay={0.3} />

      {/* Recent Connections */}
      <TableSkeleton title="Recent Blocked Connections" rows={6} cols={5} delay={0.35} />

      {/* Threat Map */}
      <MapSkeleton delay={0.4} />

      {/* Threat Intel Table */}
      <TableSkeleton title="Threat Intelligence" rows={8} cols={6} delay={0.45} />
    </div>
  );
}
