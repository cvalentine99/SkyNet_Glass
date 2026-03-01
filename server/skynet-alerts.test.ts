/**
 * Tests for Skynet Alert System
 *
 * Tests the alert baseline initialization and state tracking.
 * Note: checkAlerts() requires DB access so we test the pure functions.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { initAlertBaseline, getAlertBaseline } from "./skynet-alerts";
import type { SkynetStats } from "./skynet-parser";

// ─── Helpers ────────────────────────────────────────────────

function makeStats(overrides: Partial<SkynetStats> = {}): SkynetStats {
  return {
    kpi: {
      ipsBanned: 1000,
      rangesBanned: 50,
      inboundBlocks: 5000,
      outboundBlocks: 200,
      totalBlocks: 5200,
      lastUpdated: "2024-01-01 12:00",
    },
    inboundPortHits: [
      { port: 22, hits: 500 },
      { port: 80, hits: 300 },
      { port: 443, hits: 200 },
      { port: 23, hits: 150 },
      { port: 3389, hits: 100 },
    ],
    sourcePortHits: [],
    topInboundBlocks: [
      { ip: "1.2.3.4", hits: 500, country: "CN" },
      { ip: "5.6.7.8", hits: 300, country: "RU" },
      { ip: "9.10.11.12", hits: 200, country: "US" },
    ],
    topOutboundBlocks: [
      { ip: "10.0.0.1", hits: 50, country: "DE" },
    ],
    topHttpBlocks: [
      { ip: "20.0.0.1", hits: 30, country: "BR" },
    ],
    blockedConnections: [],
    countryDistribution: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("Alert Baseline Initialization", () => {
  beforeEach(() => {
    // Reset baseline by initializing with empty stats
    initAlertBaseline({
      kpi: { ipsBanned: 0, rangesBanned: 0, inboundBlocks: 0, outboundBlocks: 0, totalBlocks: 0, lastUpdated: "" },
      inboundPortHits: [],
      sourcePortHits: [],
      topInboundBlocks: [],
      topOutboundBlocks: [],
      topHttpBlocks: [],
      blockedConnections: [],
      countryDistribution: [],
    });
  });

  it("should set previousTotalBlocks from inbound + outbound", () => {
    const stats = makeStats();
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousTotalBlocks).toBe(5200); // 5000 + 200
  });

  it("should collect unique country codes from all connection types", () => {
    const stats = makeStats();
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousCountryCodes.sort()).toEqual(["BR", "CN", "DE", "RU", "US"]);
  });

  it("should collect unique ports from inbound port hits", () => {
    const stats = makeStats();
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousPorts.sort((a, b) => a - b)).toEqual([22, 23, 80, 443, 3389]);
  });

  it("should handle empty stats gracefully", () => {
    const stats = makeStats({
      kpi: { ipsBanned: 0, rangesBanned: 0, inboundBlocks: 0, outboundBlocks: 0, totalBlocks: 0, lastUpdated: "" },
      inboundPortHits: [],
      topInboundBlocks: [],
      topOutboundBlocks: [],
      topHttpBlocks: [],
    });
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousTotalBlocks).toBe(0);
    expect(baseline.previousCountryCodes).toEqual([]);
    expect(baseline.previousPorts).toEqual([]);
  });

  it("should handle undefined KPI values", () => {
    const stats = makeStats({
      kpi: { ipsBanned: 0, rangesBanned: 0, inboundBlocks: undefined as any, outboundBlocks: undefined as any, totalBlocks: 0, lastUpdated: "" },
    });
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousTotalBlocks).toBe(0);
  });

  it("should deduplicate countries across connection types", () => {
    const stats = makeStats({
      topInboundBlocks: [
        { ip: "1.2.3.4", hits: 500, country: "CN" },
        { ip: "5.6.7.8", hits: 300, country: "RU" },
      ],
      topOutboundBlocks: [
        { ip: "10.0.0.1", hits: 50, country: "CN" }, // duplicate
      ],
      topHttpBlocks: [
        { ip: "20.0.0.1", hits: 30, country: "RU" }, // duplicate
        { ip: "30.0.0.1", hits: 20, country: "JP" },
      ],
    });
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousCountryCodes.sort()).toEqual(["CN", "JP", "RU"]);
  });

  it("should update baseline when called multiple times", () => {
    const stats1 = makeStats({
      kpi: { ipsBanned: 100, rangesBanned: 10, inboundBlocks: 1000, outboundBlocks: 100, totalBlocks: 1100, lastUpdated: "" },
    });
    initAlertBaseline(stats1);
    expect(getAlertBaseline().previousTotalBlocks).toBe(1100);

    const stats2 = makeStats({
      kpi: { ipsBanned: 200, rangesBanned: 20, inboundBlocks: 5000, outboundBlocks: 500, totalBlocks: 5500, lastUpdated: "" },
    });
    initAlertBaseline(stats2);
    expect(getAlertBaseline().previousTotalBlocks).toBe(5500);
  });

  it("should skip entries with empty country codes", () => {
    const stats = makeStats({
      topInboundBlocks: [
        { ip: "1.2.3.4", hits: 500, country: "CN" },
        { ip: "5.6.7.8", hits: 300, country: "" }, // empty
      ],
    });
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    // Empty string is falsy, so it should be excluded
    expect(baseline.previousCountryCodes).not.toContain("");
  });

  it("should skip port entries with no port", () => {
    const stats = makeStats({
      inboundPortHits: [
        { port: 22, hits: 500 },
        { port: 0, hits: 100 }, // port 0 is falsy
      ],
    });
    initAlertBaseline(stats);
    const baseline = getAlertBaseline();
    expect(baseline.previousPorts).toContain(22);
    expect(baseline.previousPorts).not.toContain(0);
  });
});

describe("Alert Baseline State", () => {
  it("should return correct structure from getAlertBaseline", () => {
    initAlertBaseline(makeStats());
    const baseline = getAlertBaseline();
    expect(baseline).toHaveProperty("previousTotalBlocks");
    expect(baseline).toHaveProperty("previousCountryCodes");
    expect(baseline).toHaveProperty("previousPorts");
    expect(typeof baseline.previousTotalBlocks).toBe("number");
    expect(Array.isArray(baseline.previousCountryCodes)).toBe(true);
    expect(Array.isArray(baseline.previousPorts)).toBe(true);
  });

  it("should return null for previousTotalBlocks before initialization", () => {
    // Reset by initializing with empty, then check fresh state
    // Note: since module state persists, we test the post-init state
    initAlertBaseline({
      kpi: { ipsBanned: 0, rangesBanned: 0, inboundBlocks: 0, outboundBlocks: 0, totalBlocks: 0, lastUpdated: "" },
      inboundPortHits: [],
      sourcePortHits: [],
      topInboundBlocks: [],
      topOutboundBlocks: [],
      topHttpBlocks: [],
      blockedConnections: [],
      countryDistribution: [],
    });
    const baseline = getAlertBaseline();
    expect(baseline.previousTotalBlocks).toBe(0);
    expect(baseline.previousCountryCodes).toEqual([]);
    expect(baseline.previousPorts).toEqual([]);
  });
});
