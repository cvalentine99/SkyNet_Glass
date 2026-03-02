/**
 * DashboardHeader — Top header bar with title, monitoring info, and actions
 * Design: Glass Cockpit — gradient text title, status indicators
 */
import { motion } from "framer-motion";
import { RefreshCw, Clock, HardDrive, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DataSourceBadge } from "@/components/DataSourceBadge";

interface DashboardHeaderProps {
  monitoringSince: string;
  logSize: string;
  isUsingLiveData: boolean;
  hasConfig: boolean;
  fetchedAt?: Date | string | null;
  hasData?: boolean;
  error?: string | null;
}

export function DashboardHeader({
  monitoringSince,
  logSize,
  isUsingLiveData,
  hasConfig,
  fetchedAt,
  hasData = false,
  error,
}: DashboardHeaderProps) {
  const fetchNow = trpc.skynet.fetchNow.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Statistics updated", {
          description: result.changed
            ? "New data received from router"
            : "Data unchanged since last fetch",
        });
      } else {
        toast.error("Fetch failed", {
          description: result.error ?? "Could not reach router",
        });
      }
    },
    onError: (err) => {
      toast.error("Update failed", { description: err.message });
    },
  });

  const triggerGenstats = trpc.skynet.triggerGenstats.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Regeneration triggered", {
          description: "Router is rebuilding stats (~45s). Click Update Stats after.",
        });
      } else {
        toast.error("Trigger failed", { description: result.error ?? "Unknown error" });
      }
    },
  });

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between mb-6"
    >
      <div>
        <h1 className="text-2xl font-bold gradient-text tracking-tight">
          Skynet Statistics
        </h1>
        <div className="flex items-center gap-4 mt-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Monitoring since {monitoringSince}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <HardDrive className="w-3 h-3" />
            <span>Log size: {logSize}</span>
          </div>
          {isUsingLiveData ? (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Wifi className="w-3 h-3 text-severity-low" />
              <span className="text-severity-low font-medium">Live</span>
            </div>
          ) : hasConfig ? (
            <div className="flex items-center gap-1.5 text-[11px]">
              <WifiOff className="w-3 h-3 text-severity-medium" />
              <span className="text-severity-medium font-medium">Offline</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px]">
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Not Connected</span>
            </div>
          )}
        </div>
        {/* Data Source Badge */}
        <DataSourceBadge
          fetchedAt={fetchedAt ?? null}
          isLive={isUsingLiveData}
          hasData={hasData}
          error={error}
          className="mt-2"
        />
      </div>

      <div className="flex items-center gap-2">
        {hasConfig && (
          <button
            onClick={() => triggerGenstats.mutate()}
            disabled={triggerGenstats.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              glass-card text-muted-foreground
              hover:text-foreground hover:border-border/50
              transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {triggerGenstats.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Regenerate
          </button>
        )}
        <button
          onClick={() => {
            if (hasConfig) {
              fetchNow.mutate();
            } else {
              toast("Configure your router first", {
                description: "Go to Settings to connect to your Skynet router",
              });
            }
          }}
          disabled={fetchNow.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
            bg-gold/10 text-gold border border-gold/20
            hover:bg-gold/20 hover:border-gold/30
            transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          {fetchNow.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Update Stats
        </button>
      </div>
    </motion.header>
  );
}
