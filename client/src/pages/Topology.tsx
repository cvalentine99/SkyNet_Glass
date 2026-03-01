/**
 * Topology — Interactive Network Topology Map
 * Shows all LAN devices discovered via DHCP leases, color-coded by blocking status.
 * Router is the central hub node; devices radiate outward in a force-directed layout.
 * Uses HTML5 Canvas for smooth rendering with animated connection lines.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { KpiCard } from "@/components/KpiCard";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Network,
  Monitor,
  Shield,
  ShieldOff,
  ShieldAlert,
  Wifi,
  WifiOff,
  Radar,
  RefreshCw,
  Loader2,
  Search,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Globe,
  Cpu,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */
type TopologyNode = {
  ip: string;
  hostname: string;
  mac: string;
  status: "normal" | "iot_blocked" | "full_blocked" | "dns_active";
  policyType: string | null;
  policyEnabled: boolean;
  policyReason: string | null;
  dnsHits: number;
};

type CanvasNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  data: TopologyNode | null; // null = router hub
  isRouter: boolean;
  angle: number;
  targetX: number;
  targetY: number;
};

/* ─── Status colors & labels ─────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; canvasColor: string; glowColor: string; icon: typeof Shield }> = {
  normal: {
    label: "Normal",
    color: "text-emerald-400",
    canvasColor: "#34d399",
    glowColor: "rgba(52, 211, 153, 0.3)",
    icon: Wifi,
  },
  iot_blocked: {
    label: "IOT Blocked",
    color: "text-amber-400",
    canvasColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.3)",
    icon: WifiOff,
  },
  full_blocked: {
    label: "Fully Blocked",
    color: "text-red-400",
    canvasColor: "#f87171",
    glowColor: "rgba(248, 113, 113, 0.3)",
    icon: ShieldAlert,
  },
  dns_active: {
    label: "DNS Activity",
    color: "text-cyan-400",
    canvasColor: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.3)",
    icon: Radar,
  },
};

/* ─── Canvas Topology Renderer ───────────────────────────── */
function useTopologyCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  nodes: TopologyNode[],
  selectedNode: string | null,
  onNodeClick: (ip: string | null) => void,
) {
  const animRef = useRef<number>(0);
  const canvasNodesRef = useRef<CanvasNode[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to container
    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    // Build canvas nodes
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.parentElement?.clientHeight || 600;
    const cx = w / 2;
    const cy = h / 2;

    // Router hub at center
    const routerNode: CanvasNode = {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      radius: 28,
      data: null,
      isRouter: true,
      angle: 0,
      targetX: cx,
      targetY: cy,
    };

    // Device nodes in concentric rings
    const deviceNodes: CanvasNode[] = nodes.map((node, i) => {
      const count = nodes.length;
      const ringCount = Math.ceil(count / 12);
      const ring = Math.floor(i / 12);
      const posInRing = i % 12;
      const countInRing = ring < ringCount - 1 ? 12 : ((count - 1) % 12) + 1;
      const baseRadius = Math.min(w, h) * 0.25;
      const ringRadius = baseRadius + ring * 70;
      const angleStep = (2 * Math.PI) / Math.max(countInRing, 1);
      const angle = posInRing * angleStep - Math.PI / 2;
      const jitter = (Math.random() - 0.5) * 20;

      const tx = cx + Math.cos(angle) * (ringRadius + jitter);
      const ty = cy + Math.sin(angle) * (ringRadius + jitter);

      return {
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: 14,
        data: node,
        isRouter: false,
        angle,
        targetX: tx,
        targetY: ty,
      };
    });

    canvasNodesRef.current = [routerNode, ...deviceNodes];

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = null;
      hoveredRef.current = null;
    };
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const allNodes = canvasNodesRef.current;
      let clicked: string | null = null;
      for (const n of allNodes) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) {
          if (n.data) clicked = n.data.ip;
          break;
        }
      }
      onNodeClick(clicked);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);

    // Animation loop
    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const allNodes = canvasNodesRef.current;
      const cw = canvas.parentElement?.clientWidth || 800;
      const ch = canvas.parentElement?.clientHeight || 600;

      ctx.clearRect(0, 0, cw, ch);

      // Update positions (spring toward target)
      for (const n of allNodes) {
        if (n.isRouter) {
          n.x = cw / 2;
          n.y = ch / 2;
          n.targetX = cw / 2;
          n.targetY = ch / 2;
          continue;
        }
        // Recalculate target based on current canvas size
        const count = nodes.length;
        const idx = allNodes.indexOf(n) - 1;
        const ring = Math.floor(idx / 12);
        const posInRing = idx % 12;
        const ringCount = Math.ceil(count / 12);
        const countInRing = ring < ringCount - 1 ? 12 : ((count - 1) % 12) + 1;
        const baseRadius = Math.min(cw, ch) * 0.25;
        const ringRadius = baseRadius + ring * 70;
        const angleStep = (2 * Math.PI) / Math.max(countInRing, 1);
        const angle = posInRing * angleStep - Math.PI / 2;
        n.targetX = cw / 2 + Math.cos(angle) * ringRadius;
        n.targetY = ch / 2 + Math.sin(angle) * ringRadius;

        // Spring physics
        const dx = n.targetX - n.x;
        const dy = n.targetY - n.y;
        n.vx += dx * 0.04;
        n.vy += dy * 0.04;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Check hover
      hoveredRef.current = null;
      if (mouseRef.current) {
        for (const n of allNodes) {
          const dx = n.x - mouseRef.current.x;
          const dy = n.y - mouseRef.current.y;
          if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) {
            if (n.data) hoveredRef.current = n.data.ip;
            else hoveredRef.current = "router";
            break;
          }
        }
      }

      // Draw connection lines from router to each device
      const router = allNodes[0];
      for (let i = 1; i < allNodes.length; i++) {
        const n = allNodes[i];
        const status = n.data?.status || "normal";
        const meta = STATUS_META[status];
        const isSelected = selectedNode === n.data?.ip;
        const isHovered = hoveredRef.current === n.data?.ip;

        ctx.beginPath();
        ctx.moveTo(router.x, router.y);
        ctx.lineTo(n.x, n.y);

        if (isSelected || isHovered) {
          ctx.strokeStyle = meta.canvasColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Animated data packet dot along the line
        if (status !== "normal") {
          const speed = status === "full_blocked" ? 1.5 : status === "iot_blocked" ? 1.0 : 0.7;
          const progress = ((t * speed + i * 0.3) % 2) / 2;
          if (progress < 1) {
            const px = router.x + (n.x - router.x) * progress;
            const py = router.y + (n.y - router.y) * progress;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = meta.canvasColor;
            ctx.globalAlpha = 0.8;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      // Draw device nodes
      for (let i = 1; i < allNodes.length; i++) {
        const n = allNodes[i];
        if (!n.data) continue;
        const status = n.data.status;
        const meta = STATUS_META[status];
        const isSelected = selectedNode === n.data.ip;
        const isHovered = hoveredRef.current === n.data.ip;

        // Glow effect
        if (isSelected || isHovered || status !== "normal") {
          const glowRadius = isSelected ? 24 : isHovered ? 20 : 18;
          const pulseScale = 1 + Math.sin(t * 2 + i) * 0.1;
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowRadius * pulseScale);
          grad.addColorStop(0, meta.glowColor);
          grad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowRadius * pulseScale, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? meta.canvasColor
          : `rgba(15, 15, 25, ${isHovered ? 0.95 : 0.85})`;
        ctx.fill();
        ctx.strokeStyle = meta.canvasColor;
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
        ctx.stroke();

        // Device icon (monitor symbol)
        ctx.fillStyle = isSelected ? "rgba(15, 15, 25, 0.9)" : meta.canvasColor;
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Simple device icon: first letter of hostname or IP
        const label = n.data.hostname !== "Unknown"
          ? n.data.hostname.charAt(0).toUpperCase()
          : n.data.ip.split(".")[3];
        ctx.fillText(label, n.x, n.y);

        // Hostname label below
        ctx.font = "10px Inter, sans-serif";
        ctx.fillStyle = isHovered || isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)";
        const displayName = n.data.hostname !== "Unknown"
          ? (n.data.hostname.length > 14 ? n.data.hostname.slice(0, 12) + ".." : n.data.hostname)
          : n.data.ip;
        ctx.fillText(displayName, n.x, n.y + n.radius + 12);

        // DNS hits badge
        if (n.data.dnsHits > 0) {
          const badgeX = n.x + n.radius - 2;
          const badgeY = n.y - n.radius + 2;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#22d3ee";
          ctx.fill();
          ctx.font = "bold 7px Inter, sans-serif";
          ctx.fillStyle = "#000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.data.dnsHits > 99 ? "99+" : String(n.data.dnsHits), badgeX, badgeY);
        }
      }

      // Draw router hub
      {
        const r = router;
        const isHovered = hoveredRef.current === "router";
        // Outer glow
        const pulseScale = 1 + Math.sin(t * 1.5) * 0.08;
        const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 40 * pulseScale);
        grad.addColorStop(0, "rgba(196, 167, 100, 0.25)");
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(r.x, r.y, 40 * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Rotating ring
        ctx.beginPath();
        ctx.arc(r.x, r.y, 34, t * 0.5, t * 0.5 + Math.PI * 1.5);
        ctx.strokeStyle = "rgba(196, 167, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Hub circle
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? "rgba(196, 167, 100, 0.15)" : "rgba(15, 15, 25, 0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(196, 167, 100, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Router icon
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.fillStyle = "rgba(196, 167, 100, 0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("R", r.x, r.y);

        // Label
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = "rgba(196, 167, 100, 0.7)";
        ctx.fillText("Router", r.x, r.y + r.radius + 14);
      }

      // Hover tooltip
      if (hoveredRef.current && hoveredRef.current !== "router" && mouseRef.current) {
        const hovNode = allNodes.find(n => n.data?.ip === hoveredRef.current);
        if (hovNode?.data) {
          const d = hovNode.data;
          const meta = STATUS_META[d.status];
          const lines = [
            d.hostname !== "Unknown" ? d.hostname : "",
            d.ip,
            `MAC: ${d.mac}`,
            `Status: ${meta.label}`,
            d.dnsHits > 0 ? `DNS Hits: ${d.dnsHits}` : "",
          ].filter(Boolean);

          const tx = mouseRef.current.x + 16;
          const ty = mouseRef.current.y - 10;
          const padding = 10;
          const lineHeight = 16;
          const tooltipW = 180;
          const tooltipH = lines.length * lineHeight + padding * 2;

          // Background
          ctx.fillStyle = "rgba(15, 15, 30, 0.92)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
          ctx.fill();
          ctx.stroke();

          // Text
          ctx.font = "11px Inter, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          lines.forEach((line, idx) => {
            ctx.fillStyle = idx === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)";
            if (line.startsWith("Status:")) ctx.fillStyle = meta.canvasColor;
            ctx.fillText(line, tx + padding, ty + padding + idx * lineHeight);
          });
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
      resizeObserver.disconnect();
    };
  }, [nodes, selectedNode, onNodeClick, canvasRef]);
}

/* ─── Main Component ─────────────────────────────────────── */
export default function Topology() {
  const [, navigate] = useLocation();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data, isLoading, refetch, isRefetching } = trpc.skynet.getTopology.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const nodes = useMemo(() => data?.nodes ?? [], [data]);

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (statusFilter !== "all") {
      result = result.filter(n => n.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        n =>
          n.ip.includes(q) ||
          n.hostname.toLowerCase().includes(q) ||
          n.mac.toLowerCase().includes(q)
      );
    }
    return result;
  }, [nodes, statusFilter, searchQuery]);

  const selectedDevice = useMemo(
    () => nodes.find(n => n.ip === selectedNode) ?? null,
    [nodes, selectedNode]
  );

  const handleNodeClick = useCallback((ip: string | null) => {
    setSelectedNode(prev => (prev === ip ? null : ip));
  }, []);

  // Use filtered nodes for the canvas
  useTopologyCanvas(canvasRef, filteredNodes, selectedNode, handleNodeClick);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { normal: 0, iot_blocked: 0, full_blocked: 0, dns_active: 0 };
    for (const n of nodes) {
      counts[n.status]++;
    }
    return counts;
  }, [nodes]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />

      <main className="flex-1 ml-[64px] p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text tracking-tight flex items-center gap-3">
              <Network className="w-6 h-6 text-gold" />
              Network Topology
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Interactive map of LAN devices discovered via DHCP leases
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
              bg-gold/10 text-gold border border-gold/20
              hover:bg-gold/20 hover:border-gold/30
              transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {isRefetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="Total Devices"
            value={data?.totalDevices ?? 0}
            icon={Monitor}
            severity="neutral"
            delay={0}
          />
          <KpiCard
            title="Blocked Devices"
            value={data?.blockedDevices ?? 0}
            icon={ShieldAlert}
            severity={data?.blockedDevices ? "high" : "low"}
            delay={0.05}
          />
          <KpiCard
            title="DNS Active"
            value={data?.dnsActiveDevices ?? 0}
            icon={Radar}
            severity={data?.dnsActiveDevices ? "medium" : "low"}
            delay={0.1}
          />
          <KpiCard
            title="Normal"
            value={statusCounts.normal}
            icon={Shield}
            severity="low"
            delay={0.15}
          />
        </div>

        {/* Main Content: Canvas + Detail Panel */}
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_360px] gap-6">
          {/* Topology Canvas */}
          <GlassCard noPadding className="relative overflow-hidden" style={{ minHeight: "560px" }}>
            {/* Filter bar */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 p-4 bg-gradient-to-b from-background/80 to-transparent">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg text-xs
                    bg-background/60 border border-border/50 text-foreground
                    placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-1 focus:ring-gold/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-xs bg-background/60 border border-border/50 text-foreground
                  focus:outline-none focus:ring-1 focus:ring-gold/30"
              >
                <option value="all">All Status</option>
                <option value="normal">Normal</option>
                <option value="iot_blocked">IOT Blocked</option>
                <option value="full_blocked">Fully Blocked</option>
                <option value="dns_active">DNS Active</option>
              </select>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {filteredNodes.length} device{filteredNodes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: meta.canvasColor }}
                  />
                  <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                </div>
              ))}
            </div>

            {/* Canvas */}
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[560px]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-gold/50" />
                  <span className="text-xs text-muted-foreground">Loading topology...</span>
                </div>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[560px]">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Network className="w-12 h-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No devices discovered</p>
                  <p className="text-xs text-muted-foreground/60 max-w-xs">
                    Connect to your router in Settings to discover LAN devices via DHCP leases
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[560px]">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair"
                  style={{ minHeight: "560px" }}
                />
              </div>
            )}
          </GlassCard>

          {/* Detail Panel */}
          <div className="flex flex-col gap-4">
            {/* Selected Device Detail */}
            <GlassCard>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Device Detail
              </h3>
              {selectedDevice ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: STATUS_META[selectedDevice.status].glowColor,
                        border: `1px solid ${STATUS_META[selectedDevice.status].canvasColor}`,
                      }}
                    >
                      {(() => {
                        const Icon = STATUS_META[selectedDevice.status].icon;
                        return <Icon className="w-5 h-5" style={{ color: STATUS_META[selectedDevice.status].canvasColor }} />;
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedDevice.hostname !== "Unknown" ? selectedDevice.hostname : selectedDevice.ip}
                      </p>
                      <p className={`text-xs ${STATUS_META[selectedDevice.status].color}`}>
                        {STATUS_META[selectedDevice.status].label}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">IP Address</p>
                      <p className="text-xs font-mono text-foreground">{selectedDevice.ip}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MAC Address</p>
                      <p className="text-xs font-mono text-foreground">{selectedDevice.mac}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hostname</p>
                      <p className="text-xs text-foreground">{selectedDevice.hostname}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">DNS Hits</p>
                      <p className="text-xs text-foreground">{selectedDevice.dnsHits}</p>
                    </div>
                  </div>

                  {selectedDevice.policyType && (
                    <div className="p-3 rounded-lg bg-background/40 border border-border/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Active Policy</p>
                      <p className="text-xs font-medium text-foreground">
                        {selectedDevice.policyType === "block_outbound" ? "Block Outbound (IOT)" : "Full Block"}
                      </p>
                      {selectedDevice.policyReason && (
                        <p className="text-[10px] text-muted-foreground mt-1">{selectedDevice.policyReason}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Status: {selectedDevice.policyEnabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => navigate(`/devices?ip=${selectedDevice.ip}&name=${selectedDevice.hostname}`)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                        bg-amber-500/10 text-amber-400 border border-amber-500/20
                        hover:bg-amber-500/20 transition-all"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Manage Device Policy
                    </button>
                    <button
                      onClick={() => navigate(`/dns?device=${selectedDevice.ip}`)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                        bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
                        hover:bg-cyan-500/20 transition-all"
                    >
                      <Radar className="w-3.5 h-3.5" />
                      View DNS Activity
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Monitor className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Click a device on the map</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">to view its details and actions</p>
                </div>
              )}
            </GlassCard>

            {/* Device List */}
            <GlassCard className="max-h-[400px] overflow-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                Device List ({filteredNodes.length})
              </h3>
              <div className="space-y-1.5">
                {filteredNodes.map((node) => {
                  const meta = STATUS_META[node.status];
                  const isSelected = selectedNode === node.ip;
                  return (
                    <button
                      key={node.ip}
                      onClick={() => handleNodeClick(node.ip)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all
                        ${isSelected
                          ? "bg-gold/10 border border-gold/20"
                          : "hover:bg-background/40 border border-transparent"
                        }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.canvasColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {node.hostname !== "Unknown" ? node.hostname : node.ip}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{node.ip}</p>
                      </div>
                      {node.dnsHits > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 tabular-nums">
                          {node.dnsHits} DNS
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredNodes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No devices match filter</p>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  );
}
