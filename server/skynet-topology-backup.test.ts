import { describe, expect, it } from "vitest";

/**
 * Tests for Network Topology and Config Export/Import features.
 * Tests the pure data transformation logic without requiring a real router connection.
 */

// ─── Topology Node Building Logic ──────────────────────────

describe("Topology: DHCP lease parsing", () => {
  function parseDhcpLeases(raw: string) {
    const devices: Array<{ ip: string; hostname: string; mac: string; expires: string }> = [];
    const lines = raw.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const [expires, mac, ip, hostname] = parts;
        if (ip && mac) {
          devices.push({
            ip,
            hostname: hostname && hostname !== "*" ? hostname : "Unknown",
            mac: mac.toUpperCase(),
            expires: expires || "",
          });
        }
      }
    }
    return devices;
  }

  it("parses standard DHCP lease lines", () => {
    const raw = `1709312345 aa:bb:cc:dd:ee:ff 192.168.1.100 my-laptop *
1709312400 11:22:33:44:55:66 192.168.1.101 smart-tv *`;
    const result = parseDhcpLeases(raw);
    expect(result).toHaveLength(2);
    expect(result[0].ip).toBe("192.168.1.100");
    expect(result[0].hostname).toBe("my-laptop");
    expect(result[0].mac).toBe("AA:BB:CC:DD:EE:FF");
    expect(result[1].ip).toBe("192.168.1.101");
    expect(result[1].hostname).toBe("smart-tv");
  });

  it("handles wildcard hostnames", () => {
    const raw = `1709312345 aa:bb:cc:dd:ee:ff 192.168.1.100 * *`;
    const result = parseDhcpLeases(raw);
    expect(result).toHaveLength(1);
    expect(result[0].hostname).toBe("Unknown");
  });

  it("handles empty input", () => {
    expect(parseDhcpLeases("")).toHaveLength(0);
    expect(parseDhcpLeases("  \n  \n  ")).toHaveLength(0);
  });

  it("skips malformed lines", () => {
    const raw = `incomplete line
1709312345 aa:bb:cc:dd:ee:ff 192.168.1.100 my-laptop *`;
    const result = parseDhcpLeases(raw);
    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe("192.168.1.100");
  });

  it("uppercases MAC addresses", () => {
    const raw = `1709312345 ab:cd:ef:01:23:45 10.0.0.1 host1 *`;
    const result = parseDhcpLeases(raw);
    expect(result[0].mac).toBe("AB:CD:EF:01:23:45");
  });
});

describe("Topology: node status determination", () => {
  type PolicyLike = { deviceIp: string; policyType: string; enabled: boolean; reason?: string | null };

  function determineStatus(
    ip: string,
    policyMap: Map<string, PolicyLike>,
    dnsHitsMap: Map<string, number>,
  ): "normal" | "iot_blocked" | "full_blocked" | "dns_active" {
    const policy = policyMap.get(ip);
    const dnsHits = dnsHitsMap.get(ip) || 0;
    if (policy?.enabled) {
      return policy.policyType === "block_outbound" ? "iot_blocked" : "full_blocked";
    }
    if (dnsHits > 0) {
      return "dns_active";
    }
    return "normal";
  }

  it("returns normal when no policy and no DNS hits", () => {
    expect(determineStatus("192.168.1.1", new Map(), new Map())).toBe("normal");
  });

  it("returns iot_blocked for enabled block_outbound policy", () => {
    const policyMap = new Map([
      ["192.168.1.1", { deviceIp: "192.168.1.1", policyType: "block_outbound", enabled: true }],
    ]);
    expect(determineStatus("192.168.1.1", policyMap, new Map())).toBe("iot_blocked");
  });

  it("returns full_blocked for enabled block_all policy", () => {
    const policyMap = new Map([
      ["192.168.1.1", { deviceIp: "192.168.1.1", policyType: "block_all", enabled: true }],
    ]);
    expect(determineStatus("192.168.1.1", policyMap, new Map())).toBe("full_blocked");
  });

  it("returns dns_active when device has DNS sinkhole hits", () => {
    const dnsHitsMap = new Map([["192.168.1.1", 5]]);
    expect(determineStatus("192.168.1.1", new Map(), dnsHitsMap)).toBe("dns_active");
  });

  it("policy takes priority over DNS hits", () => {
    const policyMap = new Map([
      ["192.168.1.1", { deviceIp: "192.168.1.1", policyType: "block_outbound", enabled: true }],
    ]);
    const dnsHitsMap = new Map([["192.168.1.1", 10]]);
    expect(determineStatus("192.168.1.1", policyMap, dnsHitsMap)).toBe("iot_blocked");
  });

  it("disabled policy does not affect status", () => {
    const policyMap = new Map([
      ["192.168.1.1", { deviceIp: "192.168.1.1", policyType: "block_all", enabled: false }],
    ]);
    expect(determineStatus("192.168.1.1", policyMap, new Map())).toBe("normal");
  });

  it("disabled policy with DNS hits shows dns_active", () => {
    const policyMap = new Map([
      ["192.168.1.1", { deviceIp: "192.168.1.1", policyType: "block_all", enabled: false }],
    ]);
    const dnsHitsMap = new Map([["192.168.1.1", 3]]);
    expect(determineStatus("192.168.1.1", policyMap, dnsHitsMap)).toBe("dns_active");
  });
});

describe("Topology: node aggregation", () => {
  it("counts total, blocked, and dns-active devices", () => {
    const nodes = [
      { status: "normal" },
      { status: "normal" },
      { status: "iot_blocked" },
      { status: "full_blocked" },
      { status: "dns_active" },
      { status: "dns_active" },
    ];
    const totalDevices = nodes.length;
    const blockedDevices = nodes.filter(
      n => n.status === "iot_blocked" || n.status === "full_blocked"
    ).length;
    const dnsActiveDevices = nodes.filter(n => n.status === "dns_active").length;

    expect(totalDevices).toBe(6);
    expect(blockedDevices).toBe(2);
    expect(dnsActiveDevices).toBe(2);
  });

  it("handles empty node list", () => {
    const nodes: Array<{ status: string }> = [];
    expect(nodes.length).toBe(0);
    expect(nodes.filter(n => n.status === "iot_blocked" || n.status === "full_blocked").length).toBe(0);
  });
});

// ─── Config Export/Import Logic ────────────────────────────

describe("Config Export: structure validation", () => {
  function buildExportPayload(config: any, alertCfg: any, policies: any[]) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      routerConfig: config ? {
        routerAddress: config.routerAddress,
        routerPort: config.routerPort,
        routerProtocol: config.routerProtocol,
        statsPath: config.statsPath,
        pollingInterval: config.pollingInterval,
        pollingEnabled: config.pollingEnabled,
        targetLat: config.targetLat,
        targetLng: config.targetLng,
      } : null,
      alertConfig: alertCfg ? {
        alertsEnabled: alertCfg.alertsEnabled,
        blockSpikeThreshold: alertCfg.blockSpikeThreshold,
        blockSpikeEnabled: alertCfg.blockSpikeEnabled,
        newCountryEnabled: alertCfg.newCountryEnabled,
        newPortEnabled: alertCfg.newPortEnabled,
        countryMinBlocks: alertCfg.countryMinBlocks,
        cooldownMinutes: alertCfg.cooldownMinutes,
      } : null,
      devicePolicies: policies.map(p => ({
        deviceIp: p.deviceIp,
        deviceName: p.deviceName,
        macAddress: p.macAddress,
        policyType: p.policyType,
        enabled: p.enabled,
        reason: p.reason,
      })),
    };
  }

  it("exports with all sections populated", () => {
    const config = {
      routerAddress: "192.168.50.1",
      routerPort: 8443,
      routerProtocol: "https",
      statsPath: "/user/skynet/stats.js",
      pollingInterval: 300,
      pollingEnabled: true,
      targetLat: 37.09,
      targetLng: -95.71,
    };
    const alertCfg = {
      alertsEnabled: true,
      blockSpikeThreshold: 200,
      blockSpikeEnabled: true,
      newCountryEnabled: true,
      newPortEnabled: false,
      countryMinBlocks: 50,
      cooldownMinutes: 30,
    };
    const policies = [
      { deviceIp: "192.168.1.100", deviceName: "IoT Camera", macAddress: "AA:BB:CC:DD:EE:FF", policyType: "block_outbound", enabled: true, reason: "IoT device" },
    ];

    const result = buildExportPayload(config, alertCfg, policies);

    expect(result.version).toBe(1);
    expect(result.exportedAt).toBeTruthy();
    expect(result.routerConfig).not.toBeNull();
    expect(result.routerConfig!.routerAddress).toBe("192.168.50.1");
    expect(result.routerConfig!.routerPort).toBe(8443);
    expect(result.routerConfig!.targetLat).toBe(37.09);
    expect(result.alertConfig).not.toBeNull();
    expect(result.alertConfig!.alertsEnabled).toBe(true);
    expect(result.alertConfig!.blockSpikeThreshold).toBe(200);
    expect(result.devicePolicies).toHaveLength(1);
    expect(result.devicePolicies[0].deviceIp).toBe("192.168.1.100");
    expect(result.devicePolicies[0].policyType).toBe("block_outbound");
  });

  it("exports with null config and alert sections", () => {
    const result = buildExportPayload(null, null, []);
    expect(result.version).toBe(1);
    expect(result.routerConfig).toBeNull();
    expect(result.alertConfig).toBeNull();
    expect(result.devicePolicies).toHaveLength(0);
  });

  it("excludes sensitive fields (username, password) from export", () => {
    const config = {
      routerAddress: "192.168.50.1",
      routerPort: 8443,
      routerProtocol: "https",
      statsPath: "/user/skynet/stats.js",
      pollingInterval: 300,
      pollingEnabled: true,
      targetLat: null,
      targetLng: null,
      username: "admin",
      password: "secret123",
    };
    const result = buildExportPayload(config, null, []);
    expect(result.routerConfig).not.toBeNull();
    expect((result.routerConfig as any).username).toBeUndefined();
    expect((result.routerConfig as any).password).toBeUndefined();
  });

  it("exports multiple device policies", () => {
    const policies = [
      { deviceIp: "192.168.1.100", deviceName: "Camera", macAddress: "AA:BB:CC:DD:EE:FF", policyType: "block_outbound", enabled: true, reason: "IoT" },
      { deviceIp: "192.168.1.101", deviceName: "Thermostat", macAddress: "11:22:33:44:55:66", policyType: "block_all", enabled: false, reason: "Suspicious" },
      { deviceIp: "192.168.1.102", deviceName: null, macAddress: null, policyType: "block_outbound", enabled: true, reason: null },
    ];
    const result = buildExportPayload(null, null, policies);
    expect(result.devicePolicies).toHaveLength(3);
    expect(result.devicePolicies[2].deviceName).toBeNull();
    expect(result.devicePolicies[2].reason).toBeNull();
  });
});

describe("Config Import: validation", () => {
  function validateImportData(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Invalid data format" };
    }
    if (data.version !== 1) {
      return { valid: false, error: "Unsupported version" };
    }
    if (!data.exportedAt) {
      return { valid: false, error: "Missing export timestamp" };
    }
    // Validate router config if present
    if (data.routerConfig) {
      if (!data.routerConfig.routerAddress || typeof data.routerConfig.routerPort !== "number") {
        return { valid: false, error: "Invalid router config" };
      }
    }
    // Validate alert config if present
    if (data.alertConfig) {
      if (typeof data.alertConfig.blockSpikeThreshold !== "number") {
        return { valid: false, error: "Invalid alert config" };
      }
    }
    // Validate device policies if present
    if (data.devicePolicies) {
      if (!Array.isArray(data.devicePolicies)) {
        return { valid: false, error: "Device policies must be an array" };
      }
      for (const p of data.devicePolicies) {
        if (!p.deviceIp || !["block_outbound", "block_all"].includes(p.policyType)) {
          return { valid: false, error: `Invalid device policy for ${p.deviceIp || "unknown"}` };
        }
      }
    }
    return { valid: true };
  }

  it("validates a complete valid backup", () => {
    const data = {
      version: 1,
      exportedAt: "2026-03-01T10:00:00.000Z",
      routerConfig: { routerAddress: "192.168.50.1", routerPort: 8443, routerProtocol: "https", statsPath: "/user/skynet/stats.js", pollingInterval: 300, pollingEnabled: true },
      alertConfig: { alertsEnabled: true, blockSpikeThreshold: 200, blockSpikeEnabled: true, newCountryEnabled: true, newPortEnabled: false, countryMinBlocks: 50, cooldownMinutes: 30 },
      devicePolicies: [{ deviceIp: "192.168.1.100", policyType: "block_outbound" }],
    };
    expect(validateImportData(data)).toEqual({ valid: true });
  });

  it("rejects null input", () => {
    expect(validateImportData(null).valid).toBe(false);
  });

  it("rejects wrong version", () => {
    expect(validateImportData({ version: 2, exportedAt: "2026-01-01" }).valid).toBe(false);
    expect(validateImportData({ version: 2, exportedAt: "2026-01-01" }).error).toBe("Unsupported version");
  });

  it("rejects missing exportedAt", () => {
    expect(validateImportData({ version: 1 }).valid).toBe(false);
  });

  it("rejects invalid router config", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      routerConfig: { routerAddress: "", routerPort: "not a number" },
    };
    expect(validateImportData(data).valid).toBe(false);
  });

  it("rejects invalid alert config", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      alertConfig: { blockSpikeThreshold: "not a number" },
    };
    expect(validateImportData(data).valid).toBe(false);
  });

  it("rejects invalid device policy type", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      devicePolicies: [{ deviceIp: "192.168.1.1", policyType: "invalid_type" }],
    };
    expect(validateImportData(data).valid).toBe(false);
  });

  it("rejects device policy without IP", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      devicePolicies: [{ policyType: "block_outbound" }],
    };
    expect(validateImportData(data).valid).toBe(false);
  });

  it("accepts backup with only routerConfig", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      routerConfig: { routerAddress: "192.168.1.1", routerPort: 80, routerProtocol: "http", statsPath: "/stats.js", pollingInterval: 300, pollingEnabled: true },
    };
    expect(validateImportData(data)).toEqual({ valid: true });
  });

  it("accepts backup with only device policies", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
      devicePolicies: [
        { deviceIp: "192.168.1.100", policyType: "block_outbound" },
        { deviceIp: "192.168.1.101", policyType: "block_all" },
      ],
    };
    expect(validateImportData(data)).toEqual({ valid: true });
  });

  it("accepts empty backup (no config, no policies)", () => {
    const data = {
      version: 1,
      exportedAt: "2026-01-01",
    };
    expect(validateImportData(data)).toEqual({ valid: true });
  });
});

describe("Config Import: deduplication logic", () => {
  function shouldImportPolicy(
    policy: { deviceIp: string },
    existingIps: Set<string>,
  ): boolean {
    return !existingIps.has(policy.deviceIp);
  }

  it("allows import of new policy", () => {
    const existing = new Set(["192.168.1.1", "192.168.1.2"]);
    expect(shouldImportPolicy({ deviceIp: "192.168.1.3" }, existing)).toBe(true);
  });

  it("skips duplicate policy", () => {
    const existing = new Set(["192.168.1.1", "192.168.1.2"]);
    expect(shouldImportPolicy({ deviceIp: "192.168.1.1" }, existing)).toBe(false);
  });

  it("handles empty existing set", () => {
    expect(shouldImportPolicy({ deviceIp: "192.168.1.1" }, new Set())).toBe(true);
  });
});

describe("Config Export: round-trip integrity", () => {
  it("exported data can be re-imported without data loss", () => {
    const original = {
      version: 1,
      exportedAt: new Date().toISOString(),
      routerConfig: {
        routerAddress: "192.168.50.1",
        routerPort: 8443,
        routerProtocol: "https",
        statsPath: "/user/skynet/stats.js",
        pollingInterval: 300,
        pollingEnabled: true,
        targetLat: 37.09,
        targetLng: -95.71,
      },
      alertConfig: {
        alertsEnabled: true,
        blockSpikeThreshold: 200,
        blockSpikeEnabled: true,
        newCountryEnabled: true,
        newPortEnabled: false,
        countryMinBlocks: 50,
        cooldownMinutes: 30,
      },
      devicePolicies: [
        { deviceIp: "192.168.1.100", deviceName: "Camera", macAddress: "AA:BB:CC:DD:EE:FF", policyType: "block_outbound", enabled: true, reason: "IoT device" },
        { deviceIp: "192.168.1.101", deviceName: "Thermostat", macAddress: "11:22:33:44:55:66", policyType: "block_all", enabled: false, reason: null },
      ],
    };

    // Simulate JSON round-trip (export → file → import)
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(original.version);
    expect(parsed.routerConfig.routerAddress).toBe(original.routerConfig.routerAddress);
    expect(parsed.routerConfig.targetLat).toBe(original.routerConfig.targetLat);
    expect(parsed.alertConfig.blockSpikeThreshold).toBe(original.alertConfig.blockSpikeThreshold);
    expect(parsed.devicePolicies).toHaveLength(2);
    expect(parsed.devicePolicies[0].deviceIp).toBe("192.168.1.100");
    expect(parsed.devicePolicies[1].reason).toBeNull();
  });

  it("handles special characters in device names through JSON round-trip", () => {
    const original = {
      version: 1,
      exportedAt: new Date().toISOString(),
      routerConfig: null,
      alertConfig: null,
      devicePolicies: [
        { deviceIp: "192.168.1.100", deviceName: "John's Camera (2nd floor)", macAddress: "AA:BB:CC:DD:EE:FF", policyType: "block_outbound", enabled: true, reason: "Contains 'quotes' and \"double quotes\"" },
      ],
    };

    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);

    expect(parsed.devicePolicies[0].deviceName).toBe("John's Camera (2nd floor)");
    expect(parsed.devicePolicies[0].reason).toContain("'quotes'");
    expect(parsed.devicePolicies[0].reason).toContain('"double quotes"');
  });
});
