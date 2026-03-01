/**
 * KpiCard — Animated KPI display with glass bezel
 * Design: Glass Cockpit instrument gauge aesthetic
 * Features: Smooth animated counter that transitions on value changes,
 *           severity color, text mode for non-numeric values
 */
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardBaseProps {
  title: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  severity?: "critical" | "high" | "medium" | "low" | "neutral";
  suffix?: string;
  delay?: number;
}

interface KpiCardNumberProps extends KpiCardBaseProps {
  value: number;
  isText?: false;
}

interface KpiCardTextProps extends KpiCardBaseProps {
  value: string;
  isText: true;
}

type KpiCardProps = KpiCardNumberProps | KpiCardTextProps;

/**
 * Animated counter that smoothly transitions between values.
 * Uses requestAnimationFrame with cubic ease-out for buttery animation.
 * Animates both on initial mount AND when the target value changes.
 */
function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const from = prevTarget.current;
    const to = target;
    prevTarget.current = target;

    // Skip animation if going from 0 to 0
    if (from === 0 && to === 0) return;

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setCount(current);
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

export function KpiCard(props: KpiCardProps) {
  const {
    title,
    icon: Icon,
    trend,
    severity = "neutral",
    suffix = "",
    delay = 0,
  } = props;

  const isText = props.isText === true;
  const numericValue = isText ? 0 : (props.value as number);
  const textValue = isText ? (props.value as string) : "";
  const animatedValue = useAnimatedCounter(numericValue, 1200);

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
        <div className={cn("text-2xl font-bold tabular-nums", severityColors[severity])}>
          {isText ? (
            <AnimatePresence mode="wait">
              <motion.span
                key={textValue}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-lg inline-block"
              >
                {textValue}
              </motion.span>
            </AnimatePresence>
          ) : (
            <>
              {formatNumber(animatedValue)}
              {suffix && <span className="text-sm font-normal ml-1 text-muted-foreground">{suffix}</span>}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
