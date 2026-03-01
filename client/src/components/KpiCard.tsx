/**
 * KpiCard — Animated KPI display with glass bezel
 * Design: Glass Cockpit instrument gauge aesthetic
 * Features: Animated counter, severity color, sparkline-ready
 */
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  severity?: "critical" | "high" | "medium" | "low" | "neutral";
  suffix?: string;
  delay?: number;
}

function useAnimatedCounter(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return count;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return n.toLocaleString();
  return n.toString();
}

const severityColors: Record<string, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
  neutral: "text-gold",
};

const severityBg: Record<string, string> = {
  critical: "bg-severity-critical/10",
  high: "bg-severity-high/10",
  medium: "bg-severity-medium/10",
  low: "bg-severity-low/10",
  neutral: "bg-gold/10",
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  severity = "neutral",
  suffix = "",
  delay = 0,
}: KpiCardProps) {
  const animatedValue = useAnimatedCounter(value, 1800);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "glass-card p-5 relative overflow-hidden group",
        severity === "critical" && "pulse-critical"
      )}
    >
      {/* Scan line effect on hover */}
      <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div
          className="absolute top-0 h-full w-[60%]"
          style={{
            background: "linear-gradient(90deg, transparent, oklch(0.769 0.108 85.805 / 5%), transparent)",
            animation: "scan-line 1.5s ease-in-out",
          }}
        />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-lg", severityBg[severity])}>
          <Icon className={cn("w-4 h-4", severityColors[severity])} />
        </div>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              trend.positive ? "text-severity-low" : "text-severity-critical"
            )}
          >
            {trend.positive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {title}
        </p>
        <p className={cn("text-2xl font-bold tabular-nums", severityColors[severity])}>
          {formatNumber(animatedValue)}
          {suffix && <span className="text-sm font-normal ml-1 text-muted-foreground">{suffix}</span>}
        </p>
      </div>
    </motion.div>
  );
}
