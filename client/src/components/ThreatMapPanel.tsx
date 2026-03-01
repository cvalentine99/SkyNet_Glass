/**
 * ThreatMapPanel — World threat map visualization
 * Design: Glass Cockpit — dark world map with glowing threat dots
 * Accepts data via props; no direct sample data import.
 */
import { motion } from "framer-motion";

const THREAT_MAP_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663252172531/4K4AhZ9R9x8zpv2SdeL5Bz/threat-map-bg-CZ4ntoCeJFouTqxXLHNzWj.webp";

interface CountryData {
  country: string;
  code: string;
  blocks: number;
  percentage: number;
}

interface ThreatMapPanelProps {
  countryData: CountryData[];
}

export function ThreatMapPanel({ countryData }: ThreatMapPanelProps) {
  const topCountries = countryData.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="glass-card p-5 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Global Threat Map</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Geographic distribution of blocked threats</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#E74C3C" }} />
            <span className="text-muted-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#C9A962" }} />
            <span className="text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#4ECDC4" }} />
            <span className="text-muted-foreground">Medium</span>
          </div>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <img
          src={THREAT_MAP_URL}
          alt="Global threat map"
          className="w-full h-full object-cover"
        />
        {/* Overlay gradient for blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

        {/* Top countries overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex gap-2">
          {topCountries.map((c, i) => (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="glass-card-bright px-2.5 py-1.5 text-[10px] flex items-center gap-1.5"
            >
              <span className="font-medium text-foreground">{c.code}</span>
              <span className="text-muted-foreground">|</span>
              <span className="font-mono tabular-nums text-gold">{c.blocks.toLocaleString()}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
