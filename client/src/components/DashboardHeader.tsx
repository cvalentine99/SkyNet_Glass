/**
 * DashboardHeader — Top header bar with title, monitoring info, and actions
 * Design: Glass Cockpit — gradient text title, status indicators
 */
import { motion } from "framer-motion";
import { kpiData } from "@/lib/data";
import { RefreshCw, Clock, HardDrive, Wifi } from "lucide-react";
import { toast } from "sonner";

export function DashboardHeader() {
  const handleRefresh = () => {
    toast.success("Statistics updated", {
      description: "Skynet data refreshed successfully",
    });
  };

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
            <span>Monitoring since {kpiData.monitoringSince}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <HardDrive className="w-3 h-3" />
            <span>Log size: {kpiData.logSize}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Wifi className="w-3 h-3 text-severity-low" />
            <span className="text-severity-low font-medium">Active</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleRefresh}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
          bg-gold/10 text-gold border border-gold/20
          hover:bg-gold/20 hover:border-gold/30
          transition-all duration-200 active:scale-95"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Update Stats
      </button>
    </motion.header>
  );
}
