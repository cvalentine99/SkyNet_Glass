/**
 * ThreatMapPanel — Interactive global threat map using react-simple-maps
 * Self-contained SVG map — no Google Maps API required, works on LAN deployments.
 * Features:
 *   - Dark-styled world map matching Obsidian Glass theme
 *   - Severity-colored circle markers at country centroids
 *   - Marker size proportional to block count
 *   - Hover tooltips with country details
 *   - Animated pulse effect on critical markers
 *   - Empty state when no data
 */
import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { Globe, MapPin } from "lucide-react";

interface CountryData {
  country: string;
  code: string;
  blocks: number;
  percentage: number;
}

interface ThreatMapPanelProps {
  countryData: CountryData[];
}

// TopoJSON world atlas (hosted on unpkg CDN — no API key needed)
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country centroids for plotting markers
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  CN: [104.19, 35.86],
  RU: [105.32, 61.52],
  US: [-95.71, 37.09],
  NL: [5.29, 52.13],
  DE: [10.45, 51.17],
  RO: [24.97, 45.94],
  BR: [-51.93, -14.24],
  IN: [78.96, 20.59],
  VN: [108.28, 14.06],
  UA: [31.17, 48.38],
  LT: [23.88, 55.17],
  SG: [103.82, 1.35],
  KR: [127.77, 35.91],
  JP: [138.25, 36.20],
  FR: [2.21, 46.23],
  GB: [-3.44, 55.38],
  CA: [-106.35, 56.13],
  AU: [133.78, -25.27],
  ID: [113.92, -0.79],
  TH: [100.99, 15.87],
  TW: [120.96, 23.70],
  HK: [114.11, 22.40],
  IR: [53.69, 32.43],
  TR: [35.24, 38.96],
  PK: [69.35, 30.38],
  BD: [90.36, 23.68],
  MX: [-102.55, 23.63],
  AR: [-63.62, -38.42],
  CO: [-74.30, 4.57],
  EG: [30.80, 26.82],
  PL: [19.15, 51.92],
  IT: [12.57, 41.87],
  ES: [-3.75, 40.46],
  SE: [18.64, 60.13],
  NO: [8.47, 60.47],
  FI: [25.75, 61.92],
  ZA: [22.94, -30.56],
  PH: [121.77, 12.88],
  MY: [101.98, 4.21],
  CL: [-71.54, -35.68],
  PE: [-75.02, -9.19],
  BG: [25.49, 42.73],
  CZ: [15.47, 49.82],
  HU: [19.50, 47.16],
  KZ: [66.92, 48.02],
  BY: [27.95, 53.71],
  MD: [28.37, 47.41],
};

function getSeverityColor(blocks: number): string {
  if (blocks >= 3000) return "#e54545";
  if (blocks >= 1500) return "#e87c3e";
  if (blocks >= 500) return "#c9a227";
  return "#4ade80";
}

function getMarkerRadius(blocks: number, maxBlocks: number): number {
  const minR = 4;
  const maxR = 18;
  if (maxBlocks === 0) return minR;
  const ratio = Math.sqrt(blocks / maxBlocks);
  return minR + ratio * (maxR - minR);
}

interface TooltipData {
  country: string;
  code: string;
  blocks: number;
  percentage: number;
  x: number;
  y: number;
}

export function ThreatMapPanel({ countryData }: ThreatMapPanelProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const maxBlocks = useMemo(
    () => Math.max(...countryData.map((d) => d.blocks), 1),
    [countryData]
  );

  const hasData = countryData.length > 0;

  return (
    <GlassCard delay={0.5}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold/10">
            <Globe className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Global Threat Map</h3>
            <p className="text-[11px] text-muted-foreground">
              {hasData
                ? `${countryData.length} countries · ${countryData.reduce((s, c) => s + c.blocks, 0).toLocaleString()} total blocks`
                : "Connect your router to see threat origins"}
            </p>
          </div>
        </div>
        {hasData && (
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#e54545" }} />
              <span className="text-muted-foreground">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#e87c3e" }} />
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#c9a227" }} />
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#4ade80" }} />
              <span className="text-muted-foreground">Low</span>
            </div>
          </div>
        )}
      </div>

      {hasData ? (
        <div
          className="rounded-lg overflow-hidden border border-border/50 relative"
          style={{ background: "#060610" }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 130,
              center: [15, 20],
            }}
            style={{ width: "100%", height: "420px" }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#151520"
                      stroke="#1e1e30"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#1e1e30", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {countryData.map((entry) => {
                const coords = COUNTRY_CENTROIDS[entry.code];
                if (!coords) return null;

                const radius = getMarkerRadius(entry.blocks, maxBlocks);
                const color = getSeverityColor(entry.blocks);
                const isCritical = entry.blocks >= 3000;

                return (
                  <Marker key={entry.code} coordinates={coords}>
                    {/* Outer glow */}
                    <circle
                      r={radius + 3}
                      fill={color}
                      fillOpacity={0.12}
                      stroke="none"
                    />
                    {/* Pulse ring for critical */}
                    {isCritical && (
                      <circle
                        r={radius + 2}
                        fill="none"
                        stroke={color}
                        strokeWidth={1}
                        strokeOpacity={0.4}
                        className="animate-ping"
                        style={{ transformOrigin: "center", animationDuration: "2s" }}
                      />
                    )}
                    {/* Main circle */}
                    <circle
                      r={radius}
                      fill={color}
                      fillOpacity={0.6}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeOpacity={0.8}
                      onMouseEnter={(e) => {
                        const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
                        if (rect) {
                          setTooltip({
                            ...entry,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{ cursor: "pointer", transition: "fill-opacity 0.2s" }}
                    />
                    {/* Inner bright dot */}
                    <circle
                      r={Math.max(2, radius * 0.25)}
                      fill={color}
                      fillOpacity={0.95}
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          <AnimatePresence>
            {tooltip && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute pointer-events-none z-50"
                style={{
                  left: tooltip.x + 12,
                  top: tooltip.y - 10,
                }}
              >
                <div
                  className="glass-card-bright p-3 text-xs border border-border/30 min-w-[160px]"
                  style={{ boxShadow: `0 0 20px ${getSeverityColor(tooltip.blocks)}33` }}
                >
                  <p className="font-semibold text-foreground mb-1.5" style={{ color: getSeverityColor(tooltip.blocks) }}>
                    {tooltip.country}
                    <span className="text-muted-foreground ml-1.5 font-normal">({tooltip.code})</span>
                  </p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-muted-foreground">Blocks</span>
                    <span className="font-mono font-bold tabular-nums" style={{ color: getSeverityColor(tooltip.blocks) }}>
                      {tooltip.blocks.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Share</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {tooltip.percentage}%
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inject pulse animation CSS */}
          <style>{`
            @keyframes threatPulse {
              0% { transform: scale(1); opacity: 0.6; }
              100% { transform: scale(2.2); opacity: 0; }
            }
          `}</style>
        </div>
      ) : (
        <div
          className="rounded-lg border border-border/50 h-[420px] flex flex-col items-center justify-center gap-4"
          style={{ background: "#060610" }}
        >
          <div className="p-4 rounded-full" style={{ background: "oklch(0.769 0.108 85.805 / 8%)" }}>
            <MapPin className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No Threat Data</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Connect your router in Settings to see threat origins plotted on the map
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
