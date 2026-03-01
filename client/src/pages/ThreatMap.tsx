/**
 * ThreatMap — Full-screen 3D Globe Threat Visualization
 *
 * Design: Cinematic war-room aesthetic with a rotating 3D globe,
 * animated attack arcs, pulsing origin rings, and a glass HUD overlay.
 *
 * Data sources:
 *   - Country distribution from Skynet stats (via useSkynetStats)
 *   - GeoIP resolution for lat/lon coordinates
 *   - Real-time blocked connection feed
 *
 * Visual features:
 *   - NASA Black Marble night texture on globe
 *   - Severity-colored arcs (red=critical, orange=high, gold=medium, green=low)
 *   - Animated dash arcs that "travel" from source to target
 *   - Pulsing rings at attack origin points
 *   - Glass HUD panels with live stats
 *   - Threat feed ticker
 *   - Auto-rotation with pause on interaction
 */
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useSkynetStats } from "@/hooks/useSkynetStats";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Globe,
  Activity,
  AlertTriangle,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Crosshair,
  Radio,
  Zap,
  Eye,
  EyeOff,
  RotateCw,
} from "lucide-react";

// ─── Earth Textures (CDN) ─────────────────────────────────
const EARTH_NIGHT_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/earth-night_9ca3e69c.jpg";
const EARTH_TOPOLOGY_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/earth-topology_9ec01acd.jpg";

// ─── Country Centroids ────────────────────────────────────
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  CN: { lat: 35.86, lng: 104.19 },
  RU: { lat: 61.52, lng: 105.32 },
  US: { lat: 37.09, lng: -95.71 },
  NL: { lat: 52.13, lng: 5.29 },
  DE: { lat: 51.17, lng: 10.45 },
  RO: { lat: 45.94, lng: 24.97 },
  BR: { lat: -14.24, lng: -51.93 },
  IN: { lat: 20.59, lng: 78.96 },
  VN: { lat: 14.06, lng: 108.28 },
  UA: { lat: 48.38, lng: 31.17 },
  LT: { lat: 55.17, lng: 23.88 },
  SG: { lat: 1.35, lng: 103.82 },
  KR: { lat: 35.91, lng: 127.77 },
  JP: { lat: 36.20, lng: 138.25 },
  FR: { lat: 46.23, lng: 2.21 },
  GB: { lat: 55.38, lng: -3.44 },
  CA: { lat: 56.13, lng: -106.35 },
  AU: { lat: -25.27, lng: 133.78 },
  ID: { lat: -0.79, lng: 113.92 },
  TH: { lat: 15.87, lng: 100.99 },
  TW: { lat: 23.70, lng: 120.96 },
  HK: { lat: 22.40, lng: 114.11 },
  IR: { lat: 32.43, lng: 53.69 },
  TR: { lat: 38.96, lng: 35.24 },
  PK: { lat: 30.38, lng: 69.35 },
  BD: { lat: 23.68, lng: 90.36 },
  MX: { lat: 23.63, lng: -102.55 },
  AR: { lat: -38.42, lng: -63.62 },
  CO: { lat: 4.57, lng: -74.30 },
  EG: { lat: 26.82, lng: 30.80 },
  PL: { lat: 51.92, lng: 19.15 },
  IT: { lat: 41.87, lng: 12.57 },
  ES: { lat: 40.46, lng: -3.75 },
  SE: { lat: 60.13, lng: 18.64 },
  NO: { lat: 60.47, lng: 8.47 },
  FI: { lat: 61.92, lng: 25.75 },
  ZA: { lat: -30.56, lng: 22.94 },
  PH: { lat: 12.88, lng: 121.77 },
  MY: { lat: 4.21, lng: 101.98 },
  CL: { lat: -35.68, lng: -71.54 },
  PE: { lat: -9.19, lng: -75.02 },
  BG: { lat: 42.73, lng: 25.49 },
  CZ: { lat: 49.82, lng: 15.47 },
  HU: { lat: 47.16, lng: 19.50 },
  KZ: { lat: 48.02, lng: 66.92 },
  BY: { lat: 53.71, lng: 27.95 },
  MD: { lat: 47.41, lng: 28.37 },
};

// Default target location (user's router — US center as default)
const DEFAULT_TARGET = { lat: 37.09, lng: -95.71 };

// ─── Severity Helpers ─────────────────────────────────────

function getSeverityColor(blocks: number): string {
  if (blocks >= 3000) return "#ff3333";
  if (blocks >= 1500) return "#ff8c33";
  if (blocks >= 500) return "#ffcc33";
  return "#33ff88";
}

function getSeverityLabel(blocks: number): string {
  if (blocks >= 3000) return "CRITICAL";
  if (blocks >= 1500) return "HIGH";
  if (blocks >= 500) return "MEDIUM";
  return "LOW";
}

// ─── Arc & Ring Data Types ────────────────────────────────

interface ArcDatum {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
  stroke: number;
  dashLength: number;
  dashGap: number;
  animateTime: number;
  altitude: number;
  country: string;
  code: string;
  blocks: number;
}

interface RingDatum {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
  color: (t: number) => string;
  country: string;
  blocks: number;
}

interface PointDatum {
  lat: number;
  lng: number;
  size: number;
  color: string;
  country: string;
  blocks: number;
}

interface LabelDatum {
  lat: number;
  lng: number;
  text: string;
  color: string;
  size: number;
}

// ─── Main Component ───────────────────────────────────────

export default function ThreatMap() {
  const skynet = useSkynetStats();
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showHud, setShowHud] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [hoveredArc, setHoveredArc] = useState<ArcDatum | null>(null);

  // Dynamic import of react-globe.gl (it's a heavy library)
  useEffect(() => {
    import("react-globe.gl").then((mod) => {
      setGlobeComponent(() => mod.default);
    });
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });

    return () => observer.disconnect();
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ─── Build Globe Data ─────────────────────────────────────

  const countryData = skynet.countryDistribution;
  const maxBlocks = useMemo(
    () => Math.max(1, ...countryData.map((c) => c.blocks)),
    [countryData]
  );

  // Attack arcs from source countries to target
  const arcsData: ArcDatum[] = useMemo(() => {
    return countryData
      .filter((c) => COUNTRY_CENTROIDS[c.code])
      .map((c) => {
        const src = COUNTRY_CENTROIDS[c.code];
        const intensity = Math.sqrt(c.blocks / maxBlocks);
        const color = getSeverityColor(c.blocks);
        return {
          startLat: src.lat,
          startLng: src.lng,
          endLat: DEFAULT_TARGET.lat,
          endLng: DEFAULT_TARGET.lng,
          color: [`${color}cc`, `${color}33`] as [string, string],
          stroke: 0.4 + intensity * 2.2,
          dashLength: 0.4 + intensity * 0.8,
          dashGap: 0.2 + (1 - intensity) * 0.6,
          animateTime: 4000 - intensity * 2500,
          altitude: 0.1 + intensity * 0.4,
          country: c.country,
          code: c.code,
          blocks: c.blocks,
        };
      });
  }, [countryData, maxBlocks]);

  // Pulsing rings at attack origins
  const ringsData: RingDatum[] = useMemo(() => {
    return countryData
      .filter((c) => COUNTRY_CENTROIDS[c.code])
      .map((c) => {
        const src = COUNTRY_CENTROIDS[c.code];
        const intensity = Math.sqrt(c.blocks / maxBlocks);
        const color = getSeverityColor(c.blocks);
        return {
          lat: src.lat,
          lng: src.lng,
          maxR: 2 + intensity * 6,
          propagationSpeed: 1 + intensity * 3,
          repeatPeriod: 1200 - intensity * 800,
          color: (t: number) => {
            const alpha = Math.max(0, 1 - t);
            return `${color}${Math.round(alpha * 180)
              .toString(16)
              .padStart(2, "0")}`;
          },
          country: c.country,
          blocks: c.blocks,
        };
      });
  }, [countryData, maxBlocks]);

  // Glowing points at attack origins
  const pointsData: PointDatum[] = useMemo(() => {
    return countryData
      .filter((c) => COUNTRY_CENTROIDS[c.code])
      .map((c) => {
        const src = COUNTRY_CENTROIDS[c.code];
        const intensity = Math.sqrt(c.blocks / maxBlocks);
        return {
          lat: src.lat,
          lng: src.lng,
          size: 0.3 + intensity * 1.2,
          color: getSeverityColor(c.blocks),
          country: c.country,
          blocks: c.blocks,
        };
      });
  }, [countryData, maxBlocks]);

  // Country labels
  const labelsData: LabelDatum[] = useMemo(() => {
    return countryData
      .filter((c) => COUNTRY_CENTROIDS[c.code] && c.blocks >= 100)
      .slice(0, 15)
      .map((c) => {
        const src = COUNTRY_CENTROIDS[c.code];
        return {
          lat: src.lat + 2,
          lng: src.lng,
          text: `${c.code} · ${c.blocks.toLocaleString()}`,
          color: getSeverityColor(c.blocks),
          size: 0.6 + Math.sqrt(c.blocks / maxBlocks) * 0.6,
        };
      });
  }, [countryData, maxBlocks]);

  // Target ring (your router)
  const targetRings = useMemo(
    () => [
      {
        lat: DEFAULT_TARGET.lat,
        lng: DEFAULT_TARGET.lng,
        maxR: 4,
        propagationSpeed: 2,
        repeatPeriod: 2000,
        color: (t: number) => {
          const alpha = Math.max(0, 1 - t);
          return `#33ccff${Math.round(alpha * 200)
            .toString(16)
            .padStart(2, "0")}`;
        },
        country: "TARGET",
        blocks: 0,
      },
    ],
    []
  );

  // Globe ready callback
  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
    if (globeRef.current) {
      // Set initial camera position
      globeRef.current.pointOfView({ lat: 30, lng: -20, altitude: 2.2 }, 1500);
      // Enable auto-rotation
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.4;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
      }
    }
  }, []);

  // ─── Stats for HUD ────────────────────────────────────────

  const totalBlocks = skynet.kpiData.totalBlocks;
  const totalCountries = countryData.length;
  const criticalCount = countryData.filter((c) => c.blocks >= 3000).length;
  const highCount = countryData.filter(
    (c) => c.blocks >= 1500 && c.blocks < 3000
  ).length;

  // Threat feed (top 8 countries as a scrolling ticker)
  const threatFeed = useMemo(() => {
    return countryData.slice(0, 8).map((c) => ({
      country: c.country,
      code: c.code,
      blocks: c.blocks,
      severity: getSeverityLabel(c.blocks),
      color: getSeverityColor(c.blocks),
    }));
  }, [countryData]);

  // ─── Render ─────────────────────────────────────────────

  const hasData = countryData.length > 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      style={{ zIndex: isFullscreen ? 9999 : undefined }}
    >
      {/* Starfield background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, #0a0a1a 0%, #000005 70%, #000000 100%)",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,200,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(100,200,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Scan line animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-full h-[1px] opacity-20"
          style={{
            background:
              "linear-gradient(90deg, transparent, #33ccff44, transparent)",
            animation: "threatScanLine 8s linear infinite",
          }}
        />
      </div>

      {/* ─── 3D Globe ──────────────────────────────────────── */}
      {GlobeComponent && dimensions.width > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <GlobeComponent
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl={EARTH_NIGHT_URL}
            bumpImageUrl={EARTH_TOPOLOGY_URL}
            backgroundColor="rgba(0,0,0,0)"
            showAtmosphere={true}
            atmosphereColor="#1a6bff"
            atmosphereAltitude={0.2}
            // Arcs
            arcsData={arcsData}
            arcStartLat={(d: ArcDatum) => d.startLat}
            arcStartLng={(d: ArcDatum) => d.startLng}
            arcEndLat={(d: ArcDatum) => d.endLat}
            arcEndLng={(d: ArcDatum) => d.endLng}
            arcColor={(d: ArcDatum) => d.color}
            arcStroke={(d: ArcDatum) => d.stroke}
            arcDashLength={(d: ArcDatum) => d.dashLength}
            arcDashGap={(d: ArcDatum) => d.dashGap}
            arcDashAnimateTime={(d: ArcDatum) => d.animateTime}
            arcAltitude={(d: ArcDatum) => d.altitude}
            arcsTransitionDuration={800}
            onArcHover={(arc: ArcDatum | null) => setHoveredArc(arc)}
            // Rings (attack origins + target)
            ringsData={[...ringsData, ...targetRings]}
            ringLat={(d: RingDatum) => d.lat}
            ringLng={(d: RingDatum) => d.lng}
            ringMaxRadius={(d: RingDatum) => d.maxR}
            ringPropagationSpeed={(d: RingDatum) => d.propagationSpeed}
            ringRepeatPeriod={(d: RingDatum) => d.repeatPeriod}
            ringColor={(d: RingDatum) => d.color}
            // Points (glowing dots at origins)
            pointsData={pointsData}
            pointLat={(d: PointDatum) => d.lat}
            pointLng={(d: PointDatum) => d.lng}
            pointRadius={(d: PointDatum) => d.size}
            pointColor={(d: PointDatum) => d.color}
            pointAltitude={0.01}
            pointsMerge={true}
            // Labels
            labelsData={labelsData}
            labelLat={(d: LabelDatum) => d.lat}
            labelLng={(d: LabelDatum) => d.lng}
            labelText={(d: LabelDatum) => d.text}
            labelColor={(d: LabelDatum) => d.color}
            labelSize={(d: LabelDatum) => d.size}
            labelDotRadius={0.3}
            labelAltitude={0.01}
            labelResolution={2}
            onGlobeReady={handleGlobeReady}
          />
        </div>
      )}

      {/* Loading state */}
      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Globe className="w-16 h-16 text-cyan-400 animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-cyan-400/30 rounded-full animate-ping" />
            </div>
            <span className="text-cyan-400/80 text-sm font-mono tracking-wider uppercase">
              Initializing Threat Map
            </span>
          </div>
        </div>
      )}

      {/* ─── HUD Overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {showHud && (
          <>
            {/* Top-left: Navigation & Title */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="absolute top-4 left-4 z-40 flex items-center gap-3"
            >
              <button
                onClick={() => navigate("/")}
                className="p-2 rounded-lg bg-black/60 border border-cyan-500/20 backdrop-blur-xl
                  text-cyan-400 hover:text-white hover:border-cyan-400/40 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="px-4 py-2 rounded-lg bg-black/60 border border-cyan-500/20 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white tracking-wider uppercase">
                    Skynet Threat Map
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasData ? "bg-green-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  <span className="text-[10px] text-cyan-400/60 font-mono">
                    {hasData
                      ? "LIVE — MONITORING ACTIVE"
                      : "OFFLINE — NO DATA"}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Top-right: Controls */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.4 }}
              className="absolute top-4 right-4 z-40 flex items-center gap-2"
            >
              <button
                onClick={() => {
                  if (globeRef.current) {
                    globeRef.current.pointOfView(
                      { lat: 30, lng: -20, altitude: 2.2 },
                      1500
                    );
                  }
                }}
                className="p-2 rounded-lg bg-black/60 border border-cyan-500/20 backdrop-blur-xl
                  text-cyan-400 hover:text-white hover:border-cyan-400/40 transition-all"
                title="Reset view"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-black/60 border border-cyan-500/20 backdrop-blur-xl
                  text-cyan-400 hover:text-white hover:border-cyan-400/40 transition-all"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </motion.div>

            {/* Left panel: Threat Stats */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="absolute top-20 left-4 z-40 w-56"
            >
              <div className="rounded-xl bg-black/70 border border-cyan-500/15 backdrop-blur-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-cyan-500/10">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase">
                    Threat Overview
                  </span>
                </div>

                {/* Total blocks */}
                <div>
                  <div className="text-[10px] text-cyan-400/50 font-mono uppercase">
                    Total Blocks
                  </div>
                  <div className="text-2xl font-bold text-white tabular-nums font-mono">
                    {totalBlocks.toLocaleString()}
                  </div>
                </div>

                {/* Countries */}
                <div>
                  <div className="text-[10px] text-cyan-400/50 font-mono uppercase">
                    Source Countries
                  </div>
                  <div className="text-lg font-bold text-cyan-300 tabular-nums font-mono">
                    {totalCountries}
                  </div>
                </div>

                {/* Severity breakdown */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-cyan-400/50 font-mono uppercase">
                    Severity
                  </div>
                  <SeverityBar
                    label="CRITICAL"
                    count={criticalCount}
                    color="#ff3333"
                  />
                  <SeverityBar
                    label="HIGH"
                    count={highCount}
                    color="#ff8c33"
                  />
                  <SeverityBar
                    label="MEDIUM"
                    count={
                      countryData.filter(
                        (c) => c.blocks >= 500 && c.blocks < 1500
                      ).length
                    }
                    color="#ffcc33"
                  />
                  <SeverityBar
                    label="LOW"
                    count={countryData.filter((c) => c.blocks < 500).length}
                    color="#33ff88"
                  />
                </div>

                {/* KPI mini-cards */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/10">
                  <MiniKpi
                    label="IPs Banned"
                    value={skynet.kpiData.ipsBanned}
                    color="#ff3333"
                  />
                  <MiniKpi
                    label="Ranges"
                    value={skynet.kpiData.rangesBanned}
                    color="#ff8c33"
                  />
                  <MiniKpi
                    label="Inbound"
                    value={skynet.kpiData.inboundBlocks}
                    color="#ffcc33"
                  />
                  <MiniKpi
                    label="Outbound"
                    value={skynet.kpiData.outboundBlocks}
                    color="#33ccff"
                  />
                </div>
              </div>
            </motion.div>

            {/* Right panel: Top Threats */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute top-20 right-4 z-40 w-64"
            >
              <div className="rounded-xl bg-black/70 border border-cyan-500/15 backdrop-blur-2xl p-4">
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-cyan-500/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase">
                    Top Threats
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-hide">
                  {countryData.length === 0 ? (
                    <div className="text-center py-6">
                      <Radio className="w-6 h-6 text-cyan-400/30 mx-auto mb-2" />
                      <p className="text-[11px] text-cyan-400/40 font-mono">
                        NO THREATS DETECTED
                      </p>
                    </div>
                  ) : (
                    countryData.slice(0, 12).map((c, i) => (
                      <ThreatRow
                        key={c.code}
                        rank={i + 1}
                        country={c.country}
                        code={c.code}
                        blocks={c.blocks}
                        percentage={c.percentage}
                        isSelected={selectedCountry === c.code}
                        onClick={() => {
                          setSelectedCountry(
                            selectedCountry === c.code ? null : c.code
                          );
                          const centroid = COUNTRY_CENTROIDS[c.code];
                          if (centroid && globeRef.current) {
                            globeRef.current.pointOfView(
                              {
                                lat: centroid.lat,
                                lng: centroid.lng,
                                altitude: 1.5,
                              },
                              1200
                            );
                          }
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </motion.div>

            {/* Bottom: Threat Feed Ticker */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="absolute bottom-4 left-4 right-4 z-40"
            >
              <div className="rounded-xl bg-black/70 border border-cyan-500/15 backdrop-blur-2xl px-4 py-3">
                <div className="flex items-center gap-4">
                  {/* Live indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase">
                      LIVE FEED
                    </span>
                  </div>

                  {/* Scrolling ticker */}
                  <div className="flex-1 overflow-hidden">
                    {threatFeed.length === 0 ? (
                      <span className="text-[11px] text-cyan-400/40 font-mono">
                        Awaiting threat data...
                      </span>
                    ) : (
                      <div className="flex gap-6 animate-[threatTicker_30s_linear_infinite]">
                        {[...threatFeed, ...threatFeed].map((t, i) => (
                          <div
                            key={`${t.code}-${i}`}
                            className="flex items-center gap-2 shrink-0"
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            <span className="text-[11px] text-white/80 font-mono whitespace-nowrap">
                              <span style={{ color: t.color }}>
                                [{t.severity}]
                              </span>{" "}
                              {t.country} ({t.code}) —{" "}
                              {t.blocks.toLocaleString()} blocks
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 shrink-0 border-l border-cyan-500/10 pl-4">
                    <LegendDot color="#ff3333" label="Critical" />
                    <LegendDot color="#ff8c33" label="High" />
                    <LegendDot color="#ffcc33" label="Medium" />
                    <LegendDot color="#33ff88" label="Low" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Arc hover tooltip */}
            <AnimatePresence>
              {hoveredArc && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                    pointer-events-none"
                >
                  <div className="rounded-lg bg-black/90 border border-cyan-500/30 backdrop-blur-xl px-4 py-3">
                    <div className="text-sm font-bold text-white">
                      {hoveredArc.country}
                    </div>
                    <div className="text-[11px] text-cyan-400/60 font-mono">
                      {hoveredArc.code} →{" "}
                      <span style={{ color: hoveredArc.color[0] }}>
                        {hoveredArc.blocks.toLocaleString()} blocks
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      {/* HUD toggle (always visible) */}
      <button
        onClick={() => setShowHud(!showHud)}
        className="absolute bottom-4 right-4 z-50 p-2 rounded-lg bg-black/60 border border-cyan-500/20
          backdrop-blur-xl text-cyan-400 hover:text-white hover:border-cyan-400/40 transition-all"
        style={{ bottom: showHud ? "72px" : "16px" }}
        title={showHud ? "Hide HUD" : "Show HUD"}
      >
        {showHud ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>

      {/* CSS Animations */}
      <style>{`
        @keyframes threatScanLine {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes threatTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes threatPulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function SeverityBar({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
      />
      <span className="text-[10px] font-mono text-white/60 w-16">{label}</span>
      <span
        className="text-[11px] font-bold font-mono tabular-nums"
        style={{ color }}
      >
        {count}
      </span>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2">
      <div className="text-[9px] text-cyan-400/40 font-mono uppercase">
        {label}
      </div>
      <div
        className="text-sm font-bold font-mono tabular-nums"
        style={{ color }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ThreatRow({
  rank,
  country,
  code,
  blocks,
  percentage,
  isSelected,
  onClick,
}: {
  rank: number;
  country: string;
  code: string;
  blocks: number;
  percentage: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = getSeverityColor(blocks);
  const severity = getSeverityLabel(blocks);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left
        ${
          isSelected
            ? "bg-cyan-500/10 border border-cyan-500/20"
            : "hover:bg-white/[0.03] border border-transparent"
        }`}
    >
      <span className="text-[10px] font-mono text-cyan-400/40 w-4 text-right">
        {rank}
      </span>
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}66` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-white/80 font-medium truncate">
            {country}
          </span>
          <span className="text-[9px] text-cyan-400/40 font-mono">{code}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className="text-[11px] font-bold font-mono tabular-nums"
          style={{ color }}
        >
          {blocks.toLocaleString()}
        </div>
        <div className="text-[9px] text-cyan-400/30 font-mono">
          {percentage}%
        </div>
      </div>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[9px] text-white/50 font-mono">{label}</span>
    </div>
  );
}
