/**
 * Sidebar — Glass Cockpit navigation panel
 * Design: Compact 64px icon mode, expandable to 240px
 * Features:
 *   - Scroll-spy: auto-highlights active section via IntersectionObserver
 *   - Keyboard shortcuts: 1-5 to jump between sections
 *   - 5 items: Dashboard (top), Ports/Threats/Connections (scroll-to), Settings (page)
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Shield,
  BarChart3,
  Globe,
  Network,
  Settings,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldAlert,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

export type SidebarItem = {
  icon: typeof Shield;
  label: string;
  id: string;
  shortcut?: string;
  /** If set, navigates to this route instead of scrolling */
  route?: string;
  /** If set, scrolls to this element ID on the dashboard */
  scrollTo?: string;
};

const navItems: SidebarItem[] = [
  { icon: Shield, label: "Dashboard", id: "dashboard", route: "/", shortcut: "1" },
  { icon: BarChart3, label: "Port Statistics", id: "ports", scrollTo: "section-ports", shortcut: "2" },
  { icon: Globe, label: "Threat Map", id: "threats", scrollTo: "section-threats", shortcut: "3" },
  { icon: Network, label: "Connections", id: "connections", scrollTo: "section-connections", shortcut: "4" },
  { icon: ShieldAlert, label: "Manage", id: "manage", route: "/manage", shortcut: "5" },
  { icon: ScrollText, label: "Logs", id: "logs", route: "/logs", shortcut: "6" },
  { icon: Settings, label: "Settings", id: "settings", route: "/settings", shortcut: "7" },
];

// Section IDs that the scroll-spy observes
const SCROLL_SPY_SECTIONS = ["section-ports", "section-threats", "section-connections"];

interface SidebarProps {
  activeSection?: string;
  onExport?: () => void;
}

export function Sidebar({ activeSection: propActiveSection, onExport }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [location, navigate] = useLocation();
  const [scrollSpySection, setScrollSpySection] = useState<string | null>(null);

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    if (location !== "/") return;

    const observers: IntersectionObserver[] = [];
    const visibleSections = new Map<string, number>();

    for (const sectionId of SCROLL_SPY_SECTIONS) {
      const el = document.getElementById(sectionId);
      if (!el) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              visibleSections.set(sectionId, entry.intersectionRatio);
            } else {
              visibleSections.delete(sectionId);
            }
          }

          // Find the most visible section
          if (visibleSections.size === 0) {
            setScrollSpySection(null);
          } else {
            let best = "";
            let bestRatio = 0;
            Array.from(visibleSections.entries()).forEach(([id, ratio]) => {
              if (ratio > bestRatio) {
                best = id;
                bestRatio = ratio;
              }
            });
            setScrollSpySection(best);
          }
        },
        {
          rootMargin: "-10% 0px -40% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );

      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [location]);

  // Map scroll-spy section IDs to sidebar item IDs
  const scrollSpyItemId = scrollSpySection
    ? navItems.find((n) => n.scrollTo === scrollSpySection)?.id ?? null
    : null;

  // Effective active section: scroll-spy overrides prop when on dashboard
  const activeSection =
    location === "/" && scrollSpyItemId
      ? scrollSpyItemId
      : location === "/settings"
        ? "settings"
        : location === "/manage"
          ? "manage"
          : location === "/logs"
            ? "logs"
            : propActiveSection ?? "dashboard";

  const handleClick = useCallback(
    (item: SidebarItem) => {
      if (item.route) {
        navigate(item.route);
        if (item.route === "/") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else if (item.scrollTo) {
        if (location !== "/") {
          navigate("/");
          setTimeout(() => {
            const el = document.getElementById(item.scrollTo!);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        } else {
          const el = document.getElementById(item.scrollTo);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    [location, navigate]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      // Don't trigger with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const item = navItems.find((n) => n.shortcut === e.key);
      if (item) {
        e.preventDefault();
        handleClick(item);
      }

      // 'E' for export
      if (e.key === "e" && onExport) {
        e.preventDefault();
        onExport();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClick, onExport]);

  const getIsActive = (item: SidebarItem) => {
    return item.id === activeSection;
  };

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
          const isActive = getIsActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
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
              {/* Tooltip for collapsed mode — includes keyboard shortcut */}
              {!expanded && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium
                  bg-popover text-popover-foreground border border-border
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                  whitespace-nowrap z-50 shadow-lg flex items-center gap-2">
                  {item.label}
                  {item.shortcut && (
                    <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              )}
              {/* Shortcut badge in expanded mode */}
              {expanded && item.shortcut && (
                <motion.kbd
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground font-mono"
                >
                  {item.shortcut}
                </motion.kbd>
              )}
            </button>
          );
        })}

        {/* Export button */}
        {onExport && (
          <button
            onClick={onExport}
            className={cn(
              "flex items-center gap-3 rounded-lg transition-all duration-200 mt-2",
              "relative group",
              expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <Download className="w-[18px] h-[18px] shrink-0" />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                >
                  Export Data
                </motion.span>
              )}
            </AnimatePresence>
            {!expanded && (
              <div className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium
                bg-popover text-popover-foreground border border-border
                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                whitespace-nowrap z-50 shadow-lg flex items-center gap-2">
                Export Data
                <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">E</kbd>
              </div>
            )}
            {expanded && (
              <motion.kbd
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-muted/50 text-muted-foreground font-mono"
              >
                E
              </motion.kbd>
            )}
          </button>
        )}
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
