import { describe, it, expect } from "vitest";
import {
  parseDhcpLeases,
  parseDnsmasqLine,
  parseDnsmasqLines,
  extractSinkholedRequests,
  filterSinkholedRequests,
  summarizeSinkholedRequests,
} from "./skynet-dns-parser";

// ─── DHCP Lease Parsing ─────────────────────────────────────────────────────

describe("parseDhcpLeases", () => {
  it("parses a standard DHCP lease line", () => {
    const raw = "1709312400 AA:BB:CC:DD:EE:FF 192.168.1.100 MyLaptop *";
    const map = parseDhcpLeases(raw);
    expect(map.size).toBe(1);
    const lease = map.get("192.168.1.100");
    expect(lease).toBeDefined();
    expect(lease!.mac).toBe("AA:BB:CC:DD:EE:FF");
    expect(lease!.hostname).toBe("MyLaptop");
    expect(lease!.epoch).toBe(1709312400);
  });

  it("handles wildcard hostname as Unknown", () => {
    const raw = "1709312400 AA:BB:CC:DD:EE:FF 192.168.1.101 * *";
    const map = parseDhcpLeases(raw);
    expect(map.get("192.168.1.101")!.hostname).toBe("Unknown");
  });

  it("parses multiple leases", () => {
    const raw = [
      "1709312400 AA:BB:CC:DD:EE:01 192.168.1.10 Phone *",
      "1709312500 AA:BB:CC:DD:EE:02 192.168.1.20 Tablet *",
      "1709312600 AA:BB:CC:DD:EE:03 192.168.1.30 Desktop *",
    ].join("\n");
    const map = parseDhcpLeases(raw);
    expect(map.size).toBe(3);
    expect(map.get("192.168.1.10")!.hostname).toBe("Phone");
    expect(map.get("192.168.1.20")!.hostname).toBe("Tablet");
    expect(map.get("192.168.1.30")!.hostname).toBe("Desktop");
  });

  it("skips blank lines and malformed entries", () => {
    const raw = [
      "",
      "not-a-number MAC IP HOST",
      "1709312400 AA:BB:CC:DD:EE:FF 192.168.1.100 Valid *",
      "   ",
      "short",
    ].join("\n");
    const map = parseDhcpLeases(raw);
    expect(map.size).toBe(1);
  });

  it("overwrites duplicate IPs with the latest entry", () => {
    const raw = [
      "1709312400 AA:BB:CC:DD:EE:01 192.168.1.10 OldName *",
      "1709312500 AA:BB:CC:DD:EE:02 192.168.1.10 NewName *",
    ].join("\n");
    const map = parseDhcpLeases(raw);
    expect(map.size).toBe(1);
    expect(map.get("192.168.1.10")!.hostname).toBe("NewName");
  });
});

// ─── dnsmasq Line Parsing ───────────────────────────────────────────────────

describe("parseDnsmasqLine", () => {
  it("parses a query line", () => {
    const line =
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] ads.example.com from 192.168.1.100";
    const entry = parseDnsmasqLine(line, 1);
    expect(entry).not.toBeNull();
    expect(entry!.action).toBe("query");
    expect(entry!.queryType).toBe("A");
    expect(entry!.domain).toBe("ads.example.com");
    expect(entry!.clientIp).toBe("192.168.1.100");
    expect(entry!.isSinkholed).toBe(false);
  });

  it("parses an AAAA query line", () => {
    const line =
      "Mar  1 10:15:30 dnsmasq[1234]: query[AAAA] tracker.example.com from 192.168.1.50";
    const entry = parseDnsmasqLine(line, 5);
    expect(entry!.queryType).toBe("AAAA");
    expect(entry!.domain).toBe("tracker.example.com");
  });

  it("parses a config (sinkhole) line with NXDOMAIN", () => {
    const line =
      "Mar  1 10:15:31 dnsmasq[1234]: config ads.example.com is NXDOMAIN";
    const entry = parseDnsmasqLine(line, 2);
    expect(entry!.action).toBe("config");
    expect(entry!.domain).toBe("ads.example.com");
    expect(entry!.resolvedIp).toBe("NXDOMAIN");
    expect(entry!.isSinkholed).toBe(true);
  });

  it("parses a config line with 0.0.0.0", () => {
    const line =
      "Mar  1 10:15:31 dnsmasq[1234]: config malware.bad.com is 0.0.0.0";
    const entry = parseDnsmasqLine(line, 3);
    expect(entry!.isSinkholed).toBe(true);
    expect(entry!.resolvedIp).toBe("0.0.0.0");
  });

  it("parses a reply line (not sinkholed)", () => {
    const line =
      "Mar  1 10:15:32 dnsmasq[1234]: reply google.com is 142.250.80.46";
    const entry = parseDnsmasqLine(line, 4);
    expect(entry!.action).toBe("reply");
    expect(entry!.domain).toBe("google.com");
    expect(entry!.resolvedIp).toBe("142.250.80.46");
    expect(entry!.isSinkholed).toBe(false);
  });

  it("parses a cached line", () => {
    const line =
      "Mar  1 10:15:33 dnsmasq[1234]: cached example.com is 93.184.216.34";
    const entry = parseDnsmasqLine(line, 5);
    expect(entry!.action).toBe("cached");
    expect(entry!.isSinkholed).toBe(false);
  });

  it("parses a forwarded line", () => {
    const line =
      "Mar  1 10:15:34 dnsmasq[1234]: forwarded example.com to 8.8.8.8";
    const entry = parseDnsmasqLine(line, 6);
    expect(entry!.action).toBe("forwarded");
    expect(entry!.domain).toBe("example.com");
    expect(entry!.resolvedIp).toBe("8.8.8.8");
    expect(entry!.isSinkholed).toBe(false);
  });

  it("returns null for non-dnsmasq lines", () => {
    expect(parseDnsmasqLine("some random log line", 1)).toBeNull();
    expect(parseDnsmasqLine("", 1)).toBeNull();
    expect(
      parseDnsmasqLine("Mar  1 10:15:30 kernel: something else", 1)
    ).toBeNull();
  });

  it("resolves device name from DHCP leases", () => {
    const leaseMap = new Map();
    leaseMap.set("192.168.1.100", {
      epoch: 1709312400,
      mac: "AA:BB:CC:DD:EE:FF",
      ip: "192.168.1.100",
      hostname: "MyPhone",
      clientId: "*",
    });
    const line =
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] ads.com from 192.168.1.100";
    const entry = parseDnsmasqLine(line, 1, leaseMap);
    expect(entry!.deviceName).toBe("MyPhone");
  });

  it("detects sinkholed reply with 0.0.0.0", () => {
    const line =
      "Mar  1 10:15:31 dnsmasq[1234]: reply bad.domain.com is 0.0.0.0";
    const entry = parseDnsmasqLine(line, 1);
    expect(entry!.isSinkholed).toBe(true);
  });

  it("detects sinkholed cached with ::", () => {
    const line =
      "Mar  1 10:15:31 dnsmasq[1234]: cached bad.domain.com is ::";
    const entry = parseDnsmasqLine(line, 1);
    expect(entry!.isSinkholed).toBe(true);
  });
});

// ─── Bulk Line Parsing ──────────────────────────────────────────────────────

describe("parseDnsmasqLines", () => {
  it("parses multiple lines and skips invalid ones", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] ads.com from 192.168.1.100",
      "some random line",
      "Mar  1 10:15:31 dnsmasq[1234]: config ads.com is NXDOMAIN",
      "",
      "Mar  1 10:15:32 dnsmasq[1234]: reply google.com is 142.250.80.46",
    ].join("\n");

    const entries = parseDnsmasqLines(raw);
    expect(entries.length).toBe(3);
    expect(entries[0].action).toBe("query");
    expect(entries[1].action).toBe("config");
    expect(entries[2].action).toBe("reply");
  });

  it("assigns correct line numbers", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] a.com from 192.168.1.1",
      "skip this",
      "Mar  1 10:15:31 dnsmasq[1234]: config a.com is NXDOMAIN",
    ].join("\n");

    const entries = parseDnsmasqLines(raw);
    expect(entries[0].lineNumber).toBe(1);
    expect(entries[1].lineNumber).toBe(3);
  });
});

// ─── Sinkhole Extraction ────────────────────────────────────────────────────

describe("extractSinkholedRequests", () => {
  it("correlates query + config lines into sinkholed requests", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] ads.tracker.com from 192.168.1.100",
      "Mar  1 10:15:30 dnsmasq[1234]: config ads.tracker.com is NXDOMAIN",
    ].join("\n");

    const results = extractSinkholedRequests(raw);
    expect(results.length).toBe(1);
    expect(results[0].domain).toBe("ads.tracker.com");
    expect(results[0].clientIp).toBe("192.168.1.100");
    expect(results[0].sinkholedTo).toBe("NXDOMAIN");
    expect(results[0].queryType).toBe("A");
  });

  it("handles config without preceding query (unknown client)", () => {
    const raw =
      "Mar  1 10:15:30 dnsmasq[1234]: config orphan.domain.com is 0.0.0.0";
    const results = extractSinkholedRequests(raw);
    expect(results.length).toBe(1);
    expect(results[0].clientIp).toBe("unknown");
    expect(results[0].deviceName).toBe("Unknown");
  });

  it("resolves device names from DHCP leases", () => {
    const leaseMap = new Map();
    leaseMap.set("192.168.1.50", {
      epoch: 1709312400,
      mac: "AA:BB:CC:DD:EE:FF",
      ip: "192.168.1.50",
      hostname: "SmartTV",
      clientId: "*",
    });

    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] telemetry.samsung.com from 192.168.1.50",
      "Mar  1 10:15:30 dnsmasq[1234]: config telemetry.samsung.com is NXDOMAIN",
    ].join("\n");

    const results = extractSinkholedRequests(raw, leaseMap);
    expect(results[0].deviceName).toBe("SmartTV");
    expect(results[0].clientIp).toBe("192.168.1.50");
  });

  it("handles multiple sinkholed domains from different devices", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] ads.com from 192.168.1.10",
      "Mar  1 10:15:30 dnsmasq[1234]: config ads.com is NXDOMAIN",
      "Mar  1 10:15:31 dnsmasq[1234]: query[AAAA] tracker.com from 192.168.1.20",
      "Mar  1 10:15:31 dnsmasq[1234]: config tracker.com is 0.0.0.0",
      "Mar  1 10:15:32 dnsmasq[1234]: query[A] malware.bad.com from 192.168.1.30",
      "Mar  1 10:15:32 dnsmasq[1234]: config malware.bad.com is NXDOMAIN",
    ].join("\n");

    const results = extractSinkholedRequests(raw);
    expect(results.length).toBe(3);
    expect(results[0].clientIp).toBe("192.168.1.10");
    expect(results[1].clientIp).toBe("192.168.1.20");
    expect(results[1].queryType).toBe("AAAA");
    expect(results[2].clientIp).toBe("192.168.1.30");
  });

  it("also catches sinkholed reply lines (0.0.0.0)", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] bad.site.com from 192.168.1.10",
      "Mar  1 10:15:30 dnsmasq[1234]: reply bad.site.com is 0.0.0.0",
    ].join("\n");

    const results = extractSinkholedRequests(raw);
    expect(results.length).toBe(1);
    expect(results[0].sinkholedTo).toBe("0.0.0.0");
  });

  it("ignores normal reply lines", () => {
    const raw = [
      "Mar  1 10:15:30 dnsmasq[1234]: query[A] google.com from 192.168.1.10",
      "Mar  1 10:15:30 dnsmasq[1234]: reply google.com is 142.250.80.46",
    ].join("\n");

    const results = extractSinkholedRequests(raw);
    expect(results.length).toBe(0);
  });
});

// ─── Filtering ──────────────────────────────────────────────────────────────

describe("filterSinkholedRequests", () => {
  const entries = [
    {
      timestamp: "Mar  1 10:15:30",
      domain: "ads.tracker.com",
      clientIp: "192.168.1.10",
      deviceName: "Phone",
      queryType: "A",
      sinkholedTo: "NXDOMAIN",
      lineNumber: 1,
    },
    {
      timestamp: "Mar  1 10:15:31",
      domain: "telemetry.samsung.com",
      clientIp: "192.168.1.20",
      deviceName: "SmartTV",
      queryType: "AAAA",
      sinkholedTo: "0.0.0.0",
      lineNumber: 2,
    },
    {
      timestamp: "Mar  1 10:15:32",
      domain: "malware.bad.com",
      clientIp: "192.168.1.10",
      deviceName: "Phone",
      queryType: "A",
      sinkholedTo: "NXDOMAIN",
      lineNumber: 3,
    },
  ];

  it("returns all entries with no filters", () => {
    const result = filterSinkholedRequests(entries, {});
    expect(result.length).toBe(3);
  });

  it("filters by device IP", () => {
    const result = filterSinkholedRequests(entries, {
      deviceIp: "192.168.1.10",
    });
    expect(result.length).toBe(2);
    expect(result.every((e) => e.clientIp === "192.168.1.10")).toBe(true);
  });

  it("filters by domain substring", () => {
    const result = filterSinkholedRequests(entries, { domain: "samsung" });
    expect(result.length).toBe(1);
    expect(result[0].domain).toBe("telemetry.samsung.com");
  });

  it("filters by query type", () => {
    const result = filterSinkholedRequests(entries, { queryType: "AAAA" });
    expect(result.length).toBe(1);
    expect(result[0].queryType).toBe("AAAA");
  });

  it("ALL query type returns all entries", () => {
    const result = filterSinkholedRequests(entries, { queryType: "ALL" });
    expect(result.length).toBe(3);
  });

  it("combines multiple filters", () => {
    const result = filterSinkholedRequests(entries, {
      deviceIp: "192.168.1.10",
      domain: "malware",
    });
    expect(result.length).toBe(1);
    expect(result[0].domain).toBe("malware.bad.com");
  });
});

// ─── Summarization ──────────────────────────────────────────────────────────

describe("summarizeSinkholedRequests", () => {
  const entries = [
    {
      timestamp: "Mar  1 10:15:30",
      domain: "ads.tracker.com",
      clientIp: "192.168.1.10",
      deviceName: "Phone",
      queryType: "A",
      sinkholedTo: "NXDOMAIN",
      lineNumber: 1,
    },
    {
      timestamp: "Mar  1 10:15:31",
      domain: "ads.tracker.com",
      clientIp: "192.168.1.20",
      deviceName: "SmartTV",
      queryType: "A",
      sinkholedTo: "NXDOMAIN",
      lineNumber: 2,
    },
    {
      timestamp: "Mar  1 10:15:32",
      domain: "telemetry.samsung.com",
      clientIp: "192.168.1.20",
      deviceName: "SmartTV",
      queryType: "AAAA",
      sinkholedTo: "0.0.0.0",
      lineNumber: 3,
    },
    {
      timestamp: "Mar  1 10:15:33",
      domain: "malware.bad.com",
      clientIp: "192.168.1.30",
      deviceName: "Desktop",
      queryType: "A",
      sinkholedTo: "NXDOMAIN",
      lineNumber: 4,
    },
  ];

  it("counts total sinkholed entries", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.totalSinkholed).toBe(4);
  });

  it("counts unique devices", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.uniqueDevices).toBe(3);
  });

  it("counts unique blocked domains", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.uniqueBlockedDomains).toBe(3);
  });

  it("ranks top blocked domains by count", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.topBlockedDomains[0].domain).toBe("ads.tracker.com");
    expect(summary.topBlockedDomains[0].count).toBe(2);
  });

  it("ranks top offending devices by count", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.topOffendingDevices[0].ip).toBe("192.168.1.20");
    expect(summary.topOffendingDevices[0].count).toBe(2);
    expect(summary.topOffendingDevices[0].hostname).toBe("SmartTV");
  });

  it("provides query type breakdown", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.queryTypeBreakdown["A"]).toBe(3);
    expect(summary.queryTypeBreakdown["AAAA"]).toBe(1);
  });

  it("provides time span", () => {
    const summary = summarizeSinkholedRequests(entries);
    expect(summary.timeSpan).not.toBeNull();
    expect(summary.timeSpan!.earliest).toBe("Mar  1 10:15:30");
    expect(summary.timeSpan!.latest).toBe("Mar  1 10:15:33");
  });

  it("handles empty entries", () => {
    const summary = summarizeSinkholedRequests([]);
    expect(summary.totalSinkholed).toBe(0);
    expect(summary.uniqueDevices).toBe(0);
    expect(summary.uniqueBlockedDomains).toBe(0);
    expect(summary.topBlockedDomains.length).toBe(0);
    expect(summary.topOffendingDevices.length).toBe(0);
    expect(summary.timeSpan).toBeNull();
  });
});

// ─── Realistic Log Parsing ──────────────────────────────────────────────────

describe("realistic dnsmasq log", () => {
  const realisticLog = [
    "Mar  1 08:00:01 dnsmasq[5432]: query[A] graph.facebook.com from 192.168.1.100",
    "Mar  1 08:00:01 dnsmasq[5432]: forwarded graph.facebook.com to 8.8.8.8",
    "Mar  1 08:00:01 dnsmasq[5432]: reply graph.facebook.com is 157.240.1.35",
    "Mar  1 08:00:02 dnsmasq[5432]: query[A] ads.facebook.com from 192.168.1.100",
    "Mar  1 08:00:02 dnsmasq[5432]: config ads.facebook.com is NXDOMAIN",
    "Mar  1 08:00:03 dnsmasq[5432]: query[AAAA] ads.facebook.com from 192.168.1.100",
    "Mar  1 08:00:03 dnsmasq[5432]: config ads.facebook.com is NXDOMAIN",
    "Mar  1 08:00:05 dnsmasq[5432]: query[A] telemetry.microsoft.com from 192.168.1.50",
    "Mar  1 08:00:05 dnsmasq[5432]: config telemetry.microsoft.com is 0.0.0.0",
    "Mar  1 08:00:06 dnsmasq[5432]: query[A] www.google.com from 192.168.1.50",
    "Mar  1 08:00:06 dnsmasq[5432]: forwarded www.google.com to 8.8.8.8",
    "Mar  1 08:00:06 dnsmasq[5432]: reply www.google.com is 142.250.80.46",
    "Mar  1 08:00:10 dnsmasq[5432]: query[A] pixel.adsafeprotected.com from 192.168.1.200",
    "Mar  1 08:00:10 dnsmasq[5432]: config pixel.adsafeprotected.com is NXDOMAIN",
  ].join("\n");

  const leaseMap = new Map();
  leaseMap.set("192.168.1.100", {
    epoch: 1709312400,
    mac: "AA:BB:CC:DD:EE:01",
    ip: "192.168.1.100",
    hostname: "iPhone",
    clientId: "*",
  });
  leaseMap.set("192.168.1.50", {
    epoch: 1709312400,
    mac: "AA:BB:CC:DD:EE:02",
    ip: "192.168.1.50",
    hostname: "Windows-PC",
    clientId: "*",
  });

  it("extracts only sinkholed requests from mixed log", () => {
    const results = extractSinkholedRequests(realisticLog, leaseMap);
    expect(results.length).toBe(4);
  });

  it("correctly identifies devices", () => {
    const results = extractSinkholedRequests(realisticLog, leaseMap);
    expect(results[0].deviceName).toBe("iPhone");
    expect(results[0].domain).toBe("ads.facebook.com");
    expect(results[2].deviceName).toBe("Windows-PC");
    expect(results[2].domain).toBe("telemetry.microsoft.com");
  });

  it("handles unknown devices", () => {
    const results = extractSinkholedRequests(realisticLog, leaseMap);
    const unknownDevice = results.find(
      (r) => r.domain === "pixel.adsafeprotected.com"
    );
    expect(unknownDevice!.deviceName).toBe("Unknown");
    expect(unknownDevice!.clientIp).toBe("192.168.1.200");
  });

  it("produces accurate summary", () => {
    const results = extractSinkholedRequests(realisticLog, leaseMap);
    const summary = summarizeSinkholedRequests(results);
    expect(summary.totalSinkholed).toBe(4);
    expect(summary.uniqueDevices).toBe(3);
    expect(summary.uniqueBlockedDomains).toBe(3);
    expect(summary.topBlockedDomains[0].domain).toBe("ads.facebook.com");
    expect(summary.topBlockedDomains[0].count).toBe(2);
  });
});
