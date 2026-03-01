/**
 * Sidebar — Glass Cockpit navigation panel
 * Design: Compact 64px icon mode, expandable to 240px
 * Obsidian Glass tokens: --sidebar, gold accent on active items
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Shield,
  BarChart3,
  Globe,
  Network,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Lock,
  Eye,
} from "lucide-react";

const navItems = [
  { icon: Shield, label: "Dashboard", id: "dashboard", active: true },
  { icon: BarChart3, label: "Port Statistics", id: "ports" },
  { icon: Globe, label: "Threat Map", id: "threats" },
  { icon: Network, label: "Connections", id: "connections" },
  { icon: AlertTriangle, label: "Alerts", id: "alerts" },
  { icon: Lock, label: "Banned IPs", id: "banned" },
  { icon: Eye, label: "AlienVault", id: "alienvault" },
  { icon: Activity, label: "Live Monitor", id: "monitor" },
  { icon: Settings, label: "Settings", id: "settings" },
];

interface SidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "fixed left-0 top-0 h-screen z-50 flex flex-col",
        "border-r border-sidebar-border",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        expanded ? "w-[240px]" : "w-[64px]"
      )}
      style={{
        background: "oklch(0.08 0.005 260)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-sidebar-border">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/sidebar-logo-CRhnW6JZ6vvSSa38Jt7uQr.webp"
          alt="Skynet"
          className="w-8 h-8 object-contain"
        />
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-3 font-semibold text-sm gradient-text whitespace-nowrap overflow-hidden"
            >
              SKYNET
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-hidden">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-all duration-200",
                "relative group",
                expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                isActive
                  ? "text-gold bg-sidebar-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gold"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-gold")} />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Tooltip for collapsed mode */}
              {!expanded && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium
                  bg-popover text-popover-foreground border border-border
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                  whitespace-nowrap z-50 shadow-lg">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Expand/Collapse Toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center py-2 rounded-lg
            text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50
            transition-all duration-200"
        >
          {expanded ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
