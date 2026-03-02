/**
 * DataSourceBadge — Shows data source and freshness across all pages.
 * Three states:
 *   LIVE_ROUTER_DATA  — fetched from router within last 5 minutes
 *   DB_CACHED_REAL_DATA — real data from DB cache, older than 5 min
 *   ERROR_STALE — fetch failed or no data available
 *
 * Also shows "Last Updated: <timestamp>" when fetchedAt is available.
 */
import { cn } from "@/lib/utils";
import { Wifi, Database, AlertTriangle, Clock } from "lucide-react";

export type DataSourceState = "LIVE_ROUTER_DATA" | "DB_CACHED_REAL_DATA" | "ERROR_STALE";

interface DataSourceBadgeProps {
  fetchedAt: Date | string | null;
  isLive: boolean;
  hasData: boolean;
  error?: string | null;
  className?: string;
}

function getState(props: DataSourceBadgeProps): DataSourceState {
  if (!props.hasData || props.error) return "ERROR_STALE";
  if (!props.fetchedAt) return "ERROR_STALE";

  const fetchedDate = typeof props.fetchedAt === "string" ? new Date(props.fetchedAt) : props.fetchedAt;
  const ageMs = Date.now() - fetchedDate.getTime();
  const FIVE_MIN = 5 * 60 * 1000;

  if (props.isLive && ageMs < FIVE_MIN) return "LIVE_ROUTER_DATA";
  if (props.hasData) return "DB_CACHED_REAL_DATA";
  return "ERROR_STALE";
}

const CONFIG: Record<DataSourceState, {
  icon: typeof Wifi;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  LIVE_ROUTER_DATA: {
    icon: Wifi,
    label: "LIVE ROUTER DATA",
    color: "text-severity-low",
    bgColor: "bg-severity-low/10",
    borderColor: "border-severity-low/30",
  },
  DB_CACHED_REAL_DATA: {
    icon: Database,
    label: "CACHED REAL DATA",
    color: "text-severity-medium",
    bgColor: "bg-severity-medium/10",
    borderColor: "border-severity-medium/30",
  },
  ERROR_STALE: {
    icon: AlertTriangle,
    label: "ERROR / STALE",
    color: "text-severity-critical",
    bgColor: "bg-severity-critical/10",
    borderColor: "border-severity-critical/30",
  },
};

export function DataSourceBadge(props: DataSourceBadgeProps) {
  const state = getState(props);
  const cfg = CONFIG[state];
  const Icon = cfg.icon;

  const fetchedDate = props.fetchedAt
    ? typeof props.fetchedAt === "string"
      ? new Date(props.fetchedAt)
      : props.fetchedAt
    : null;

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", props.className)}>
      {/* Data Source Badge */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border",
          cfg.bgColor,
          cfg.borderColor,
          cfg.color
        )}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
      </div>

      {/* Last Updated Timestamp */}
      {fetchedDate && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="font-mono tabular-nums">
            Last Updated: {fetchedDate.toLocaleString()}
          </span>
        </div>
      )}

      {/* Stale warning */}
      {state === "ERROR_STALE" && props.error && (
        <span className="text-[11px] text-severity-critical/80 truncate max-w-[300px]">
          {props.error}
        </span>
      )}
      {state === "DB_CACHED_REAL_DATA" && fetchedDate && (
        <span className="text-[11px] text-severity-medium/80">
          Data is {formatAge(fetchedDate)} old — waiting for next poll
        </span>
      )}
    </div>
  );
}

function formatAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
