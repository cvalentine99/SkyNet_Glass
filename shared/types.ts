/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/** Shared types for the Skynet Glass dashboard */

export interface SkynetKpi {
  ipsBanned: number;
  rangesBanned: number;
  inboundBlocks: number;
  outboundBlocks: number;
  monitoringFrom: string;
  monitoringTo: string;
  logSize: string;
}

export interface SkynetConnectionInfo {
  ip: string;
  banReason: string;
  alienVaultUrl: string;
  country: string;
  associatedDomains: string[];
}

export interface SkynetTopBlock {
  hits: number;
  ip: string;
  country: string;
}

export interface SkynetStatsData {
  kpi: SkynetKpi;
  inboundPortHits: { port: number; hits: number }[];
  sourcePortHits: { port: number; hits: number }[];
  lastInboundConnections: SkynetConnectionInfo[];
  lastOutboundConnections: SkynetConnectionInfo[];
  lastHttpConnections: SkynetConnectionInfo[];
  topHttpBlocks: SkynetTopBlock[];
  topInboundBlocks: SkynetTopBlock[];
  topOutboundBlocks: SkynetTopBlock[];
  topBlockedDevices: { hits: number; label: string }[];
}
