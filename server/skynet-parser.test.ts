import { describe, expect, it } from "vitest";
import { parseSkynetStats, validateStatsJs } from "./skynet-parser";

/**
 * Realistic stats.js content matching the EXACT format produced by
 * Skynet's WriteStats_ToJS and WriteData_ToJS functions in firewall.sh.
 *
 * Key format details:
 * - SetXxx() functions use tab indentation and NO semicolons on innerHTML
 * - var declarations use "var X; X = []; X.unshift(...);" pattern
 * - Values in .unshift() are single-quoted, separated by "', '"
 * - Empty sections produce: X.unshift('');
 */
const REALISTIC_STATS_JS = `function SetBLCount1() {
\tdocument.getElementById("blcount1").innerHTML = "1247"
}

function SetBLCount2() {
\tdocument.getElementById("blcount2").innerHTML = "89"
}

function SetHits1() {
\tdocument.getElementById("hits1").innerHTML = "45832"
}

function SetHits2() {
\tdocument.getElementById("hits2").innerHTML = "2156"
}

function SetStatsDate() {
\tdocument.getElementById("statsdate").innerHTML = "Monitoring From Feb 15 00:01:23 To Feb 28 23:58:12"
}

function SetStatsSize() {
\tdocument.getElementById("statssize").innerHTML = "Log Size - (14.2M)B"
}

var DataInPortHits;
DataInPortHits = [];
DataInPortHits.unshift('12847', '8934', '6721');

var LabelInPortHits;
LabelInPortHits = [];
LabelInPortHits.unshift('23', '22', '445');

var DataSPortHits;
DataSPortHits = [];
DataSPortHits.unshift('3421', '2987');

var LabelSPortHits;
LabelSPortHits = [];
LabelSPortHits.unshift('54832', '49152');

var LabelInConn_IPs;
LabelInConn_IPs = [];
LabelInConn_IPs.unshift('185.220.101.34', '45.148.10.92');

var LabelInConn_BanReason;
LabelInConn_BanReason = [];
LabelInConn_BanReason.unshift('Brute Force SSH', 'Port Scan');

var LabelInConn_AlienVault;
LabelInConn_AlienVault = [];
LabelInConn_AlienVault.unshift('https://otx.alienvault.com/indicator/ip/185.220.101.34', 'https://otx.alienvault.com/indicator/ip/45.148.10.92');

var LabelInConn_Country;
LabelInConn_Country = [];
LabelInConn_Country.unshift('DE', 'RU');

var LabelInConn_AssDomains;
LabelInConn_AssDomains = [];
LabelInConn_AssDomains.unshift('tor-exit.spiritof.de exit-relay.tor.net', 'scan.botnet.ru');

var LabelOutConn_IPs;
LabelOutConn_IPs = [];
LabelOutConn_IPs.unshift('');

var LabelOutConn_BanReason;
LabelOutConn_BanReason = [];
LabelOutConn_BanReason.unshift('');

var LabelOutConn_AlienVault;
LabelOutConn_AlienVault = [];
LabelOutConn_AlienVault.unshift('');

var LabelOutConn_Country;
LabelOutConn_Country = [];
LabelOutConn_Country.unshift('');

var LabelOutConn_AssDomains;
LabelOutConn_AssDomains = [];
LabelOutConn_AssDomains.unshift('');

var LabelHTTPConn_IPs;
LabelHTTPConn_IPs = [];
LabelHTTPConn_IPs.unshift('118.25.6.39');

var LabelHTTPConn_BanReason;
LabelHTTPConn_BanReason = [];
LabelHTTPConn_BanReason.unshift('HTTP Flood');

var LabelHTTPConn_AlienVault;
LabelHTTPConn_AlienVault = [];
LabelHTTPConn_AlienVault.unshift('https://otx.alienvault.com/indicator/ip/118.25.6.39');

var LabelHTTPConn_Country;
LabelHTTPConn_Country = [];
LabelHTTPConn_Country.unshift('CN');

var LabelHTTPConn_AssDomains;
LabelHTTPConn_AssDomains = [];
LabelHTTPConn_AssDomains.unshift('ddos-node.tencent.cn');

var DataTIConnHits;
DataTIConnHits = [];
DataTIConnHits.unshift('4521', '3876');

var LabelTIConnHits_IPs;
LabelTIConnHits_IPs = [];
LabelTIConnHits_IPs.unshift('185.220.101.34', '45.148.10.92');

var LabelTIConnHits_Country;
LabelTIConnHits_Country = [];
LabelTIConnHits_Country.unshift('DE', 'RU');

var DataTOConnHits;
DataTOConnHits = [];
DataTOConnHits.unshift('');

var LabelTOConnHits_IPs;
LabelTOConnHits_IPs = [];
LabelTOConnHits_IPs.unshift('');

var LabelTOConnHits_Country;
LabelTOConnHits_Country = [];
LabelTOConnHits_Country.unshift('');

var DataTHConnHits;
DataTHConnHits = [];
DataTHConnHits.unshift('1654');

var LabelTHConnHits_IPs;
LabelTHConnHits_IPs = [];
LabelTHConnHits_IPs.unshift('118.25.6.39');

var LabelTHConnHits_Country;
LabelTHConnHits_Country = [];
LabelTHConnHits_Country.unshift('CN');

var DataTCConnHits;
DataTCConnHits = [];
DataTCConnHits.unshift('200', '150');

var LabelTCConnHits;
LabelTCConnHits = [];
LabelTCConnHits.unshift('192.168.1.100 (Desktop)', '192.168.1.101 (Phone)');
`;

// ─── Validation Tests ──────────────────────────────────────

describe("validateStatsJs", () => {
  it("returns null for valid stats.js content", () => {
    expect(validateStatsJs(REALISTIC_STATS_JS)).toBeNull();
  });

  it("rejects empty content", () => {
    const err = validateStatsJs("");
    expect(err).toContain("Empty response");
  });

  it("rejects whitespace-only content", () => {
    const err = validateStatsJs("   \n\n  ");
    expect(err).toContain("Empty response");
  });

  it("rejects HTML login pages", () => {
    const html = '<!DOCTYPE html><html><head><title>Login</title></head><body>Please login</body></html>';
    const err = validateStatsJs(html);
    expect(err).toContain("HTML page");
    expect(err).toContain("login page");
  });

  it("rejects HTML with <html> tag", () => {
    const html = '<html><body>Error</body></html>';
    const err = validateStatsJs(html);
    expect(err).toContain("HTML page");
  });

  it("rejects JSON error responses", () => {
    const json = '{"error": "not found"}';
    const err = validateStatsJs(json);
    expect(err).toContain("JSON");
  });

  it("rejects random JavaScript without Skynet signatures", () => {
    const randomJs = 'var x = 42; console.log("hello world");';
    const err = validateStatsJs(randomJs);
    expect(err).toContain("doesn't appear to be a valid Skynet stats.js");
    expect(err).toContain("First 200 chars");
  });

  it("rejects JS with unshift but no SetXxx functions", () => {
    const partialJs = 'var DataInPortHits = []; DataInPortHits.unshift("1","2");';
    const err = validateStatsJs(partialJs);
    expect(err).toContain("missing Skynet KPI functions");
  });

  it("accepts minimal valid stats.js with just SetBLCount1", () => {
    const minimal = 'function SetBLCount1() {\n\tdocument.getElementById("blcount1").innerHTML = "0"\n}';
    expect(validateStatsJs(minimal)).toBeNull();
  });
});

// ─── Parser Tests (realistic format) ───────────────────────

describe("parseSkynetStats — realistic format", () => {
  const stats = parseSkynetStats(REALISTIC_STATS_JS);

  it("parses KPI values correctly", () => {
    expect(stats.kpi.ipsBanned).toBe(1247);
    expect(stats.kpi.rangesBanned).toBe(89);
    expect(stats.kpi.inboundBlocks).toBe(45832);
    expect(stats.kpi.outboundBlocks).toBe(2156);
  });

  it("parses monitoring date range", () => {
    expect(stats.kpi.monitoringFrom).toBe("Feb 15 00:01:23");
    expect(stats.kpi.monitoringTo).toBe("Feb 28 23:58:12");
  });

  it("parses log size", () => {
    expect(stats.kpi.logSize).toBe("14.2MB");
  });

  it("parses inbound port hits", () => {
    expect(stats.inboundPortHits).toHaveLength(3);
    expect(stats.inboundPortHits[0]).toEqual({ port: 23, hits: 12847 });
    expect(stats.inboundPortHits[1]).toEqual({ port: 22, hits: 8934 });
    expect(stats.inboundPortHits[2]).toEqual({ port: 445, hits: 6721 });
  });

  it("parses source port hits", () => {
    expect(stats.sourcePortHits).toHaveLength(2);
    expect(stats.sourcePortHits[0]).toEqual({ port: 54832, hits: 3421 });
    expect(stats.sourcePortHits[1]).toEqual({ port: 49152, hits: 2987 });
  });

  it("parses inbound connections with full details", () => {
    expect(stats.lastInboundConnections).toHaveLength(2);
    const first = stats.lastInboundConnections[0];
    expect(first.ip).toBe("185.220.101.34");
    expect(first.banReason).toBe("Brute Force SSH");
    expect(first.country).toBe("DE");
    expect(first.associatedDomains).toEqual(["tor-exit.spiritof.de", "exit-relay.tor.net"]);
    expect(first.alienVaultUrl).toContain("alienvault.com");
  });

  it("handles empty outbound connections (unshift with empty string)", () => {
    // Skynet writes .unshift('') when there are no outbound blocks
    expect(stats.lastOutboundConnections).toHaveLength(0);
  });

  it("parses HTTP connections", () => {
    expect(stats.lastHttpConnections).toHaveLength(1);
    expect(stats.lastHttpConnections[0].ip).toBe("118.25.6.39");
    expect(stats.lastHttpConnections[0].banReason).toBe("HTTP Flood");
    expect(stats.lastHttpConnections[0].country).toBe("CN");
  });

  it("parses top inbound blocks", () => {
    expect(stats.topInboundBlocks).toHaveLength(2);
    expect(stats.topInboundBlocks[0]).toEqual({
      hits: 4521,
      ip: "185.220.101.34",
      country: "DE",
    });
  });

  it("handles empty top outbound blocks (unshift with empty string)", () => {
    expect(stats.topOutboundBlocks).toHaveLength(0);
  });

  it("parses top HTTP blocks", () => {
    expect(stats.topHttpBlocks).toHaveLength(1);
    expect(stats.topHttpBlocks[0].ip).toBe("118.25.6.39");
    expect(stats.topHttpBlocks[0].country).toBe("CN");
  });

  it("parses top blocked devices with device names", () => {
    expect(stats.topBlockedDevices).toHaveLength(2);
    expect(stats.topBlockedDevices[0]).toEqual({
      hits: 200,
      label: "192.168.1.100 (Desktop)",
    });
    expect(stats.topBlockedDevices[1]).toEqual({
      hits: 150,
      label: "192.168.1.101 (Phone)",
    });
  });
});

// ─── Edge Cases ────────────────────────────────────────────

describe("parseSkynetStats — edge cases", () => {
  it("handles empty/missing data gracefully", () => {
    const emptyStats = parseSkynetStats("");
    expect(emptyStats.kpi.ipsBanned).toBe(0);
    expect(emptyStats.kpi.rangesBanned).toBe(0);
    expect(emptyStats.kpi.inboundBlocks).toBe(0);
    expect(emptyStats.kpi.outboundBlocks).toBe(0);
    expect(emptyStats.kpi.monitoringFrom).toBe("");
    expect(emptyStats.kpi.monitoringTo).toBe("");
    expect(emptyStats.inboundPortHits).toEqual([]);
    expect(emptyStats.sourcePortHits).toEqual([]);
    expect(emptyStats.lastInboundConnections).toEqual([]);
    expect(emptyStats.lastOutboundConnections).toEqual([]);
    expect(emptyStats.lastHttpConnections).toEqual([]);
    expect(emptyStats.topInboundBlocks).toEqual([]);
    expect(emptyStats.topOutboundBlocks).toEqual([]);
    expect(emptyStats.topHttpBlocks).toEqual([]);
    expect(emptyStats.topBlockedDevices).toEqual([]);
  });

  it("handles compact format (no whitespace in functions)", () => {
    const compact = `function SetBLCount1(){document.getElementById("blcount1").innerHTML = "999"}
function SetHits1(){document.getElementById("hits1").innerHTML = "5000"}`;
    const stats = parseSkynetStats(compact);
    expect(stats.kpi.ipsBanned).toBe(999);
    expect(stats.kpi.inboundBlocks).toBe(5000);
  });

  it("handles stats.js with only KPIs and no chart data", () => {
    const kpiOnly = `function SetBLCount1() {
\tdocument.getElementById("blcount1").innerHTML = "500"
}

function SetBLCount2() {
\tdocument.getElementById("blcount2").innerHTML = "10"
}

function SetHits1() {
\tdocument.getElementById("hits1").innerHTML = "1000"
}

function SetHits2() {
\tdocument.getElementById("hits2").innerHTML = "200"
}

function SetStatsDate() {
\tdocument.getElementById("statsdate").innerHTML = "Monitoring From Mar 01 00:00:00 To Mar 01 12:00:00"
}

function SetStatsSize() {
\tdocument.getElementById("statssize").innerHTML = "Log Size - (2.1M)B"
}
`;
    const stats = parseSkynetStats(kpiOnly);
    expect(stats.kpi.ipsBanned).toBe(500);
    expect(stats.kpi.rangesBanned).toBe(10);
    expect(stats.kpi.inboundBlocks).toBe(1000);
    expect(stats.kpi.outboundBlocks).toBe(200);
    expect(stats.kpi.logSize).toBe("2.1MB");
    expect(stats.inboundPortHits).toEqual([]);
    expect(stats.topInboundBlocks).toEqual([]);
  });

  it("handles associated domains with wildcard '*'", () => {
    const js = `function SetBLCount1() {
\tdocument.getElementById("blcount1").innerHTML = "1"
}

var LabelInConn_IPs;
LabelInConn_IPs = [];
LabelInConn_IPs.unshift('1.2.3.4');

var LabelInConn_BanReason;
LabelInConn_BanReason = [];
LabelInConn_BanReason.unshift('Test');

var LabelInConn_AlienVault;
LabelInConn_AlienVault = [];
LabelInConn_AlienVault.unshift('https://example.com');

var LabelInConn_Country;
LabelInConn_Country = [];
LabelInConn_Country.unshift('**');

var LabelInConn_AssDomains;
LabelInConn_AssDomains = [];
LabelInConn_AssDomains.unshift('*');
`;
    const stats = parseSkynetStats(js);
    expect(stats.lastInboundConnections).toHaveLength(1);
    expect(stats.lastInboundConnections[0].country).toBe("**");
    expect(stats.lastInboundConnections[0].associatedDomains).toEqual([]);
  });

  it("handles device labels with parentheses and special chars", () => {
    const js = `function SetBLCount1() {
\tdocument.getElementById("blcount1").innerHTML = "0"
}

var DataTCConnHits;
DataTCConnHits = [];
DataTCConnHits.unshift('100');

var LabelTCConnHits;
LabelTCConnHits = [];
LabelTCConnHits.unshift('192.168.1.50 (John\\'s MacBook Pro)');
`;
    const stats = parseSkynetStats(js);
    expect(stats.topBlockedDevices).toHaveLength(1);
    expect(stats.topBlockedDevices[0].hits).toBe(100);
  });
});
