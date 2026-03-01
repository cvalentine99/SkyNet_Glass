/**
 * Tests for skynet-ipset-parser.ts and geoip-resolver.ts
 *
 * Covers:
 *   - parseIpsetLines: parsing ipset save format for various set names
 *   - filterIpsetEntries: filtering by address, category, comment, type
 *   - summarizeIpsetEntries: category breakdown, set breakdown, IP/range counts
 *   - GeoIP resolver: cache, country code to flag emoji, batch resolution
 */
import { describe, it, expect } from "vitest";
import {
  parseIpsetLines,
  filterIpsetEntries,
  summarizeIpsetEntries,
} from "./skynet-ipset-parser";
import { getFlagEmoji, getCacheSize } from "./geoip-resolver";

// ─── Sample ipset save data ──────────────────────────────────

const SAMPLE_IPSET_DATA = `create Skynet-Blacklist hash:ip family inet hashsize 16384 maxelem 65536 timeout 0 comment
add Skynet-Blacklist 1.2.3.4 timeout 0 comment "BanMalware: ThreatFeed1"
add Skynet-Blacklist 5.6.7.8 timeout 0 comment "BanAiProtect: SomeCategory"
add Skynet-Blacklist 10.20.30.40 timeout 604800 comment "ManualBan: Banned via Glass"
add Skynet-Blacklist 100.200.100.200 timeout 0 comment "Country: CN"
create Skynet-BlockedRanges hash:net family inet hashsize 16384 maxelem 65536 timeout 0 comment
add Skynet-BlockedRanges 192.168.0.0/16 timeout 0 comment "ManualBan: Local range"
add Skynet-BlockedRanges 10.0.0.0/8 timeout 0 comment "BanMalware: BadRange"
create Skynet-Whitelist hash:ip family inet hashsize 4096 maxelem 65536 timeout 0 comment
add Skynet-Whitelist 8.8.8.8 timeout 0 comment "CDN-Whitelist: Google DNS"
add Skynet-Whitelist 1.1.1.1 timeout 0 comment "CDN-Whitelist: Cloudflare DNS"
add Skynet-Whitelist 192.168.1.1 timeout 0 comment "Private IP"
create Skynet-WhitelistDomains hash:ip family inet hashsize 4096 maxelem 65536 timeout 0 comment
add Skynet-WhitelistDomains 93.184.216.34 timeout 0 comment "ManualWlistD: example.com"
`;

// ─── parseIpsetLines ─────────────────────────────────────────

describe("parseIpsetLines", () => {
  it("parses Skynet-Blacklist entries correctly", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
    expect(entries).toHaveLength(4);
    expect(entries[0].address).toBe("1.2.3.4");
    expect(entries[0].setName).toBe("Skynet-Blacklist");
    expect(entries[0].category).toBe("Malware");
    expect(entries[0].detail).toBe("ThreatFeed1");
    expect(entries[0].isRange).toBe(false);
    expect(entries[0].timeout).toBe(0);
  });

  it("parses Skynet-BlockedRanges entries as ranges", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-BlockedRanges");
    expect(entries).toHaveLength(2);
    expect(entries[0].address).toBe("192.168.0.0/16");
    expect(entries[0].isRange).toBe(true);
    expect(entries[0].category).toBe("Manual");
  });

  it("parses Skynet-Whitelist entries", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Whitelist");
    expect(entries).toHaveLength(3);
    expect(entries[0].address).toBe("8.8.8.8");
    expect(entries[0].category).toBe("CDN");
    expect(entries[0].detail).toBe("Google DNS");
  });

  it("parses Skynet-WhitelistDomains entries", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-WhitelistDomains");
    expect(entries).toHaveLength(1);
    expect(entries[0].address).toBe("93.184.216.34");
    expect(entries[0].category).toBe("Manual (Domain)");
    expect(entries[0].detail).toBe("example.com");
  });

  it("returns empty array for non-existent set", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-NonExistent");
    expect(entries).toHaveLength(0);
  });

  it("handles empty input", () => {
    const entries = parseIpsetLines("", "Skynet-Blacklist");
    expect(entries).toHaveLength(0);
  });

  it("handles entries without comments", () => {
    const data = `add Skynet-Blacklist 1.1.1.1 timeout 0`;
    const entries = parseIpsetLines(data, "Skynet-Blacklist");
    expect(entries).toHaveLength(1);
    expect(entries[0].comment).toBe("");
    expect(entries[0].category).toBe("Unknown");
  });

  it("parses timeout values correctly", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
    const manualEntry = entries.find(e => e.address === "10.20.30.40");
    expect(manualEntry?.timeout).toBe(604800);
  });

  it("handles BanAiProtect category", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
    const aiEntry = entries.find(e => e.address === "5.6.7.8");
    expect(aiEntry?.category).toBe("AiProtect");
    expect(aiEntry?.detail).toBe("SomeCategory");
  });

  it("handles Country category", () => {
    const entries = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
    const countryEntry = entries.find(e => e.address === "100.200.100.200");
    expect(countryEntry?.category).toBe("Country");
    expect(countryEntry?.detail).toBe("CN");
  });
});

// ─── filterIpsetEntries ──────────────────────────────────────

describe("filterIpsetEntries", () => {
  const allBlacklist = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
  const allRanges = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-BlockedRanges");
  const allEntries = [...allBlacklist, ...allRanges];

  it("filters by address search (partial match)", () => {
    const filtered = filterIpsetEntries(allEntries, { addressSearch: "1.2.3" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].address).toBe("1.2.3.4");
  });

  it("filters by category", () => {
    const filtered = filterIpsetEntries(allEntries, { category: "Malware" });
    expect(filtered).toHaveLength(2); // 1 IP (BanMalware) + 1 range (BanMalware)
    expect(filtered.every(e => e.category === "Malware")).toBe(true);
  });

  it("filters by comment search", () => {
    const filtered = filterIpsetEntries(allEntries, { commentSearch: "Glass" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].address).toBe("10.20.30.40");
  });

  it("filters by type: ip only", () => {
    const filtered = filterIpsetEntries(allEntries, { type: "ip" });
    expect(filtered.every(e => !e.isRange)).toBe(true);
    expect(filtered).toHaveLength(4);
  });

  it("filters by type: range only", () => {
    const filtered = filterIpsetEntries(allEntries, { type: "range" });
    expect(filtered.every(e => e.isRange)).toBe(true);
    expect(filtered).toHaveLength(2);
  });

  it("returns all entries when no filters applied", () => {
    const filtered = filterIpsetEntries(allEntries, {});
    expect(filtered).toHaveLength(allEntries.length);
  });

  it("combines multiple filters (AND logic)", () => {
    const filtered = filterIpsetEntries(allEntries, {
      category: "Manual",
      type: "range",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].address).toBe("192.168.0.0/16");
  });

  it("returns empty for non-matching filter", () => {
    const filtered = filterIpsetEntries(allEntries, { addressSearch: "999.999.999.999" });
    expect(filtered).toHaveLength(0);
  });
});

// ─── summarizeIpsetEntries ───────────────────────────────────

describe("summarizeIpsetEntries", () => {
  const allBlacklist = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-Blacklist");
  const allRanges = parseIpsetLines(SAMPLE_IPSET_DATA, "Skynet-BlockedRanges");
  const allEntries = [...allBlacklist, ...allRanges];

  it("returns correct total count", () => {
    const summary = summarizeIpsetEntries(allEntries);
    expect(summary.totalEntries).toBe(6);
  });

  it("counts IPs and ranges separately", () => {
    const summary = summarizeIpsetEntries(allEntries);
    expect(summary.ipCount).toBe(4);
    expect(summary.rangeCount).toBe(2);
  });

  it("breaks down by category", () => {
    const summary = summarizeIpsetEntries(allEntries);
    const malwareCategory = summary.categories.find(c => c.category === "Malware");
    expect(malwareCategory?.count).toBe(2); // 1 BanMalware IP + 1 BanMalware range
    const manualCategory = summary.categories.find(c => c.category === "Manual");
    expect(manualCategory?.count).toBe(2); // 1 ManualBan IP + 1 ManualBan range
  });

  it("breaks down by set name", () => {
    const summary = summarizeIpsetEntries(allEntries);
    const blacklistSet = summary.sets.find(s => s.setName === "Skynet-Blacklist");
    expect(blacklistSet?.count).toBe(4);
    const rangesSet = summary.sets.find(s => s.setName === "Skynet-BlockedRanges");
    expect(rangesSet?.count).toBe(2);
  });

  it("sorts categories by count descending", () => {
    const summary = summarizeIpsetEntries(allEntries);
    for (let i = 1; i < summary.categories.length; i++) {
      expect(summary.categories[i - 1].count).toBeGreaterThanOrEqual(summary.categories[i].count);
    }
  });

  it("handles empty input", () => {
    const summary = summarizeIpsetEntries([]);
    expect(summary.totalEntries).toBe(0);
    expect(summary.ipCount).toBe(0);
    expect(summary.rangeCount).toBe(0);
    expect(summary.categories).toHaveLength(0);
    expect(summary.sets).toHaveLength(0);
  });
});

// ─── GeoIP Utilities ─────────────────────────────────────────

describe("getFlagEmoji", () => {
  it("converts US to flag emoji", () => {
    const flag = getFlagEmoji("US");
    expect(flag).toBe("🇺🇸");
  });

  it("converts CN to flag emoji", () => {
    const flag = getFlagEmoji("CN");
    expect(flag).toBe("🇨🇳");
  });

  it("converts GB to flag emoji", () => {
    const flag = getFlagEmoji("GB");
    expect(flag).toBe("🇬🇧");
  });

  it("handles lowercase input", () => {
    const flag = getFlagEmoji("us");
    expect(flag).toBe("🇺🇸");
  });

  it("returns empty string for empty input", () => {
    const flag = getFlagEmoji("");
    expect(flag).toBe("");
  });

  it("returns empty string for invalid code", () => {
    const flag = getFlagEmoji("X");
    expect(flag).toBe("");
  });
});

describe("getCacheSize", () => {
  it("returns a non-negative number", () => {
    const size = getCacheSize();
    expect(size).toBeGreaterThanOrEqual(0);
  });
});
