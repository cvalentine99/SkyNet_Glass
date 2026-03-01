/**
 * ThreatMapPanel — Interactive global threat map using Google Maps
 * Features:
 *   - Dark-styled world map matching Obsidian Glass theme
 *   - Severity-colored circle markers at country centroids
 *   - Marker size proportional to block count
 *   - Click markers for IP details popup (InfoWindow)
 *   - Animated pulse effect on critical markers
 *   - Empty state when no data
 */
import { useRef, useCallback, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { MapView } from "@/components/Map";
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

// Country centroids for plotting markers
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

// Dark map style matching Obsidian Glass
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#080818" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#111115" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }, { weight: 0.5 }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#333344" }] },
  { featureType: "administrative.country", elementType: "labels", stylers: [{ visibility: "on" }] },
];

function getSeverityColor(blocks: number): string {
  if (blocks >= 3000) return "#e54545"; // critical red
  if (blocks >= 1500) return "#e87c3e"; // high orange
  if (blocks >= 500) return "#c9a227";  // medium gold
  return "#4ade80";                     // low green
}

function getSeverityGlow(blocks: number): string {
  if (blocks >= 3000) return "rgba(229, 69, 69, 0.4)";
  if (blocks >= 1500) return "rgba(232, 124, 62, 0.4)";
  if (blocks >= 500) return "rgba(201, 162, 39, 0.3)";
  return "rgba(74, 222, 128, 0.2)";
}

function getMarkerRadius(blocks: number, maxBlocks: number): number {
  const minR = 8;
  const maxR = 32;
  if (maxBlocks === 0) return minR;
  const ratio = Math.sqrt(blocks / maxBlocks);
  return minR + ratio * (maxR - minR);
}

export function ThreatMapPanel({ countryData }: ThreatMapPanelProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const prevDataRef = useRef<string>("");

  const clearMarkers = useCallback(() => {
    for (const m of markersRef.current) {
      m.map = null;
    }
    markersRef.current = [];
  }, []);

  const plotMarkers = useCallback((map: google.maps.Map, data: CountryData[]) => {
    clearMarkers();

    if (!data.length) return;

    const maxBlocks = Math.max(...data.map(d => d.blocks));

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    for (const entry of data) {
      const centroid = COUNTRY_CENTROIDS[entry.code];
      if (!centroid) continue;

      const radius = getMarkerRadius(entry.blocks, maxBlocks);
      const color = getSeverityColor(entry.blocks);
      const glow = getSeverityGlow(entry.blocks);
      const isCritical = entry.blocks >= 3000;

      // Create custom marker element
      const el = document.createElement("div");
      el.style.cssText = `
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, ${color}cc 0%, ${color}44 60%, transparent 100%);
        border: 1.5px solid ${color}aa;
        box-shadow: 0 0 ${radius}px ${glow}, inset 0 0 ${radius / 2}px ${glow};
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      `;

      // Pulse animation for critical markers
      if (isCritical) {
        const pulse = document.createElement("div");
        pulse.style.cssText = `
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1px solid ${color}66;
          animation: threatPulse 2s ease-out infinite;
        `;
        el.appendChild(pulse);
      }

      // Inner dot
      const dot = document.createElement("div");
      dot.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${Math.max(4, radius * 0.3)}px;
        height: ${Math.max(4, radius * 0.3)}px;
        border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 6px ${color};
      `;
      el.appendChild(dot);

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.15)";
        el.style.boxShadow = `0 0 ${radius * 1.5}px ${glow}, inset 0 0 ${radius}px ${glow}`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.boxShadow = `0 0 ${radius}px ${glow}, inset 0 0 ${radius / 2}px ${glow}`;
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: centroid,
        content: el,
        title: `${entry.country}: ${entry.blocks.toLocaleString()} blocks`,
      });

      marker.addListener("click", () => {
        const severity = entry.blocks >= 3000 ? "CRITICAL" : entry.blocks >= 1500 ? "HIGH" : entry.blocks >= 500 ? "MEDIUM" : "LOW";
        infoWindowRef.current!.setContent(`
          <div style="
            background: #111118;
            color: #e8e0d0;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            min-width: 180px;
            border: 1px solid ${color}44;
          ">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px; color: ${color};">
              ${entry.country}
            </div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">
              Country Code: ${entry.code}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; color: #888;">Total Blocks</span>
              <span style="font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: ${color};">
                ${entry.blocks.toLocaleString()}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; color: #888;">Share</span>
              <span style="font-size: 12px; font-weight: 500; color: #e8e0d0;">
                ${entry.percentage}%
              </span>
            </div>
            <div style="
              margin-top: 8px;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 0.05em;
              text-align: center;
              background: ${color}22;
              color: ${color};
              border: 1px solid ${color}44;
            ">
              ${severity}
            </div>
          </div>
        `);
        infoWindowRef.current!.open(map, marker);
      });

      markersRef.current.push(marker);
    }
  }, [clearMarkers]);

  // Re-plot markers when data changes
  useEffect(() => {
    const dataKey = JSON.stringify(countryData.map(d => `${d.code}:${d.blocks}`));
    if (mapRef.current && dataKey !== prevDataRef.current) {
      prevDataRef.current = dataKey;
      plotMarkers(mapRef.current, countryData);
    }
  }, [countryData, plotMarkers]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Apply dark styling
    map.setOptions({
      styles: DARK_MAP_STYLES,
      backgroundColor: "#0a0a0a",
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },
      gestureHandling: "cooperative",
      restriction: {
        latLngBounds: {
          north: 85,
          south: -85,
          west: -180,
          east: 180,
        },
        strictBounds: false,
      },
    });

    // Plot initial data
    if (countryData.length > 0) {
      prevDataRef.current = JSON.stringify(countryData.map(d => `${d.code}:${d.blocks}`));
      plotMarkers(map, countryData);
    }
  }, [countryData, plotMarkers]);

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
        <div className="rounded-lg overflow-hidden border border-border/50" style={{ background: "#0a0a0a" }}>
          <MapView
            className="w-full h-[420px]"
            initialCenter={{ lat: 20, lng: 15 }}
            initialZoom={2}
            onMapReady={handleMapReady}
          />
          {/* Inject pulse animation CSS */}
          <style>{`
            @keyframes threatPulse {
              0% { transform: scale(1); opacity: 0.6; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            /* Override Google Maps InfoWindow styling */
            .gm-style-iw-d { overflow: hidden !important; }
            .gm-style-iw { background: transparent !important; padding: 0 !important; box-shadow: none !important; border-radius: 8px !important; }
            .gm-style-iw-tc { display: none !important; }
            .gm-ui-hover-effect { display: none !important; }
            .gm-style-iw-chr { display: none !important; }
          `}</style>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 h-[420px] flex flex-col items-center justify-center gap-4" style={{ background: "#0a0a0a" }}>
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
