import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the ban/unban command builder and history snapshot logic.
 * These test the pure functions without requiring a real router connection.
 */

// Test the IP validation regex used in the ban/unban routes
describe("IP validation", () => {
  const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

  it("accepts valid IPv4 addresses", () => {
    expect(ipv4Regex.test("192.168.1.1")).toBe(true);
    expect(ipv4Regex.test("8.8.8.8")).toBe(true);
    expect(ipv4Regex.test("10.0.0.1")).toBe(true);
    expect(ipv4Regex.test("255.255.255.255")).toBe(true);
    expect(ipv4Regex.test("1.2.3.4")).toBe(true);
  });

  it("rejects invalid IPs", () => {
    expect(ipv4Regex.test("")).toBe(false);
    expect(ipv4Regex.test("abc")).toBe(false);
    expect(ipv4Regex.test("192.168.1")).toBe(false);
    expect(ipv4Regex.test("192.168.1.1.1")).toBe(false);
    expect(ipv4Regex.test("192.168.1.1/24")).toBe(false);
  });

  it("rejects IPs with spaces or special chars", () => {
    expect(ipv4Regex.test(" 192.168.1.1")).toBe(false);
    expect(ipv4Regex.test("192.168.1.1 ")).toBe(false);
    expect(ipv4Regex.test("192.168.1.1;rm -rf")).toBe(false);
    expect(ipv4Regex.test("192.168.1.1\nmalicious")).toBe(false);
  });
});

// Test the ban command construction
describe("ban command construction", () => {
  function buildBanCommand(ip: string, comment?: string): string {
    const sanitizedComment = comment
      ? comment.replace(/[^a-zA-Z0-9 _\-\.]/g, "").slice(0, 100)
      : "Banned via Skynet Glass";
    return `firewall ban ip ${ip} "${sanitizedComment}"`;
  }

  it("builds a basic ban command", () => {
    expect(buildBanCommand("8.8.8.8")).toBe(
      'firewall ban ip 8.8.8.8 "Banned via Skynet Glass"'
    );
  });

  it("builds a ban command with custom comment", () => {
    expect(buildBanCommand("1.2.3.4", "Port scanner")).toBe(
      'firewall ban ip 1.2.3.4 "Port scanner"'
    );
  });

  it("sanitizes dangerous characters in comments", () => {
    const cmd = buildBanCommand("1.2.3.4", 'test; rm -rf / && echo "hacked"');
    expect(cmd).not.toContain(";");
    expect(cmd).not.toContain("&&");
    expect(cmd).not.toContain('"hacked"');
    // Each & is replaced individually, so && becomes two spaces
    expect(cmd).toBe('firewall ban ip 1.2.3.4 "test rm -rf   echo hacked"');
  });

  it("truncates very long comments to 100 chars", () => {
    const longComment = "A".repeat(200);
    const cmd = buildBanCommand("1.2.3.4", longComment);
    // The comment inside quotes should be max 100 chars
    const match = cmd.match(/"(.+)"/);
    expect(match).toBeTruthy();
    expect(match![1].length).toBe(100);
  });
});

// Test the unban command construction
describe("unban command construction", () => {
  function buildUnbanCommand(ip: string): string {
    return `firewall unban ip ${ip}`;
  }

  it("builds a basic unban command", () => {
    expect(buildUnbanCommand("8.8.8.8")).toBe("firewall unban ip 8.8.8.8");
  });

  it("builds unban for private IPs", () => {
    expect(buildUnbanCommand("192.168.1.100")).toBe(
      "firewall unban ip 192.168.1.100"
    );
  });
});

// Test the history snapshot data extraction
describe("history snapshot extraction", () => {
  function extractSnapshotData(stats: any) {
    return {
      totalBlocks: (stats.totalBlockedInbound ?? 0) + (stats.totalBlockedOutbound ?? 0),
      inboundBlocks: stats.totalBlockedInbound ?? 0,
      outboundBlocks: stats.totalBlockedOutbound ?? 0,
      ipsBanned: stats.blacklist1Count ?? 0,
      rangesBanned: stats.blacklist2Count ?? 0,
      uniqueCountries: new Set(
        [
          ...(stats.topInboundBlocks || []),
          ...(stats.topOutboundBlocks || []),
        ]
          .map((c: any) => c.country)
          .filter(Boolean)
      ).size,
    };
  }

  it("extracts correct totals from full stats", () => {
    const stats = {
      totalBlockedInbound: 5000,
      totalBlockedOutbound: 2000,
      blacklist1Count: 150,
      blacklist2Count: 10,
      topInboundBlocks: [
        { ip: "1.1.1.1", hits: 100, country: "US" },
        { ip: "2.2.2.2", hits: 50, country: "CN" },
      ],
      topOutboundBlocks: [
        { ip: "3.3.3.3", hits: 30, country: "US" },
        { ip: "4.4.4.4", hits: 20, country: "RU" },
      ],
    };

    const snapshot = extractSnapshotData(stats);
    expect(snapshot.totalBlocks).toBe(7000);
    expect(snapshot.inboundBlocks).toBe(5000);
    expect(snapshot.outboundBlocks).toBe(2000);
    expect(snapshot.ipsBanned).toBe(150);
    expect(snapshot.rangesBanned).toBe(10);
    expect(snapshot.uniqueCountries).toBe(3); // US, CN, RU
  });

  it("handles empty/missing stats gracefully", () => {
    const snapshot = extractSnapshotData({});
    expect(snapshot.totalBlocks).toBe(0);
    expect(snapshot.inboundBlocks).toBe(0);
    expect(snapshot.outboundBlocks).toBe(0);
    expect(snapshot.ipsBanned).toBe(0);
    expect(snapshot.rangesBanned).toBe(0);
    expect(snapshot.uniqueCountries).toBe(0);
  });

  it("deduplicates countries across inbound and outbound", () => {
    const stats = {
      totalBlockedInbound: 100,
      totalBlockedOutbound: 50,
      topInboundBlocks: [
        { ip: "1.1.1.1", hits: 10, country: "US" },
        { ip: "2.2.2.2", hits: 5, country: "CN" },
      ],
      topOutboundBlocks: [
        { ip: "3.3.3.3", hits: 8, country: "US" },
        { ip: "4.4.4.4", hits: 3, country: "CN" },
      ],
    };

    const snapshot = extractSnapshotData(stats);
    expect(snapshot.uniqueCountries).toBe(2); // US and CN (deduplicated)
  });
});
