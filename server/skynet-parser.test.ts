import { describe, expect, it } from "vitest";
import { parseSkynetStats } from "./skynet-parser";

// Minimal mock stats.js content matching the real Skynet output format
const MOCK_STATS_JS = `
function SetBLCount1(){document.getElementById("blcount1").innerHTML = "1247"}
function SetBLCount2(){document.getElementById("blcount2").innerHTML = "89"}
function SetHits1(){document.getElementById("hits1").innerHTML = "45832"}
function SetHits2(){document.getElementById("hits2").innerHTML = "2156"}
function SetStatsDate(){document.getElementById("statsdate").innerHTML = "Monitoring From Feb 15 00:01:23 To Feb 28 23:58:12"}
function SetStatsSize(){document.getElementById("statssize").innerHTML = "Log Size - (14.2M)B"}

var DataInPortHits = [];
DataInPortHits.unshift('12847', '8934', '6721');
var LabelInPortHits = [];
LabelInPortHits.unshift('23', '22', '445');

var DataSPortHits = [];
DataSPortHits.unshift('3421', '2987');
var LabelSPortHits = [];
LabelSPortHits.unshift('54832', '49152');

var LabelInConn_IPs = [];
LabelInConn_IPs.unshift('185.220.101.34', '45.148.10.92');
var LabelInConn_BanReason = [];
LabelInConn_BanReason.unshift('Brute Force SSH', 'Port Scan');
var LabelInConn_AlienVault = [];
LabelInConn_AlienVault.unshift('https://otx.alienvault.com/indicator/ip/185.220.101.34', 'https://otx.alienvault.com/indicator/ip/45.148.10.92');
var LabelInConn_Country = [];
LabelInConn_Country.unshift('Germany', 'Russia');
var LabelInConn_AssDomains = [];
LabelInConn_AssDomains.unshift('tor-exit.spiritof.de exit-relay.tor.net', 'scan.botnet.ru');

var LabelOutConn_IPs = [];
LabelOutConn_IPs.unshift('10.0.0.5');
var LabelOutConn_BanReason = [];
LabelOutConn_BanReason.unshift('Outbound Scan');
var LabelOutConn_AlienVault = [];
LabelOutConn_AlienVault.unshift('');
var LabelOutConn_Country = [];
LabelOutConn_Country.unshift('Local');
var LabelOutConn_AssDomains = [];
LabelOutConn_AssDomains.unshift('*');

var LabelHTTPConn_IPs = [];
LabelHTTPConn_IPs.unshift('118.25.6.39');
var LabelHTTPConn_BanReason = [];
LabelHTTPConn_BanReason.unshift('HTTP Flood');
var LabelHTTPConn_AlienVault = [];
LabelHTTPConn_AlienVault.unshift('https://otx.alienvault.com/indicator/ip/118.25.6.39');
var LabelHTTPConn_Country = [];
LabelHTTPConn_Country.unshift('China');
var LabelHTTPConn_AssDomains = [];
LabelHTTPConn_AssDomains.unshift('ddos-node.tencent.cn');

var DataTIConnHits = [];
DataTIConnHits.unshift('4521', '3876');
var LabelTIConnHits_IPs = [];
LabelTIConnHits_IPs.unshift('185.220.101.34', '45.148.10.92');
var LabelTIConnHits_Country = [];
LabelTIConnHits_Country.unshift('Germany', 'Russia');

var DataTOConnHits = [];
DataTOConnHits.unshift('500');
var LabelTOConnHits_IPs = [];
LabelTOConnHits_IPs.unshift('10.0.0.5');
var LabelTOConnHits_Country = [];
LabelTOConnHits_Country.unshift('Local');

var DataTHConnHits = [];
DataTHConnHits.unshift('1654');
var LabelTHConnHits_IPs = [];
LabelTHConnHits_IPs.unshift('118.25.6.39');
var LabelTHConnHits_Country = [];
LabelTHConnHits_Country.unshift('China');

var DataTCConnHits = [];
DataTCConnHits.unshift('200', '150');
var LabelTCConnHits = [];
LabelTCConnHits.unshift('192.168.1.100 (Desktop)', '192.168.1.101 (Phone)');
`;

describe("parseSkynetStats", () => {
  const stats = parseSkynetStats(MOCK_STATS_JS);

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
  });

  it("parses inbound connections", () => {
    expect(stats.lastInboundConnections).toHaveLength(2);
    const first = stats.lastInboundConnections[0];
    expect(first.ip).toBe("185.220.101.34");
    expect(first.banReason).toBe("Brute Force SSH");
    expect(first.country).toBe("Germany");
    expect(first.associatedDomains).toEqual(["tor-exit.spiritof.de", "exit-relay.tor.net"]);
    expect(first.alienVaultUrl).toContain("alienvault.com");
  });

  it("parses outbound connections", () => {
    expect(stats.lastOutboundConnections).toHaveLength(1);
    expect(stats.lastOutboundConnections[0].ip).toBe("10.0.0.5");
  });

  it("parses HTTP connections", () => {
    expect(stats.lastHttpConnections).toHaveLength(1);
    expect(stats.lastHttpConnections[0].ip).toBe("118.25.6.39");
    expect(stats.lastHttpConnections[0].banReason).toBe("HTTP Flood");
  });

  it("parses top inbound blocks", () => {
    expect(stats.topInboundBlocks).toHaveLength(2);
    expect(stats.topInboundBlocks[0]).toEqual({
      hits: 4521,
      ip: "185.220.101.34",
      country: "Germany",
    });
  });

  it("parses top outbound blocks", () => {
    expect(stats.topOutboundBlocks).toHaveLength(1);
    expect(stats.topOutboundBlocks[0].ip).toBe("10.0.0.5");
  });

  it("parses top HTTP blocks", () => {
    expect(stats.topHttpBlocks).toHaveLength(1);
    expect(stats.topHttpBlocks[0].ip).toBe("118.25.6.39");
    expect(stats.topHttpBlocks[0].country).toBe("China");
  });

  it("parses top blocked devices", () => {
    expect(stats.topBlockedDevices).toHaveLength(2);
    expect(stats.topBlockedDevices[0]).toEqual({
      hits: 200,
      label: "192.168.1.100 (Desktop)",
    });
  });

  it("handles empty/missing data gracefully", () => {
    const emptyStats = parseSkynetStats("");
    expect(emptyStats.kpi.ipsBanned).toBe(0);
    expect(emptyStats.kpi.rangesBanned).toBe(0);
    expect(emptyStats.inboundPortHits).toEqual([]);
    expect(emptyStats.lastInboundConnections).toEqual([]);
    expect(emptyStats.topInboundBlocks).toEqual([]);
  });
});
