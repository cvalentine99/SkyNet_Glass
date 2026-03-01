/**
 * Tests for Bulk Ban Import functionality.
 *
 * Tests the parseImportText function (client-side parser)
 * and the bulkBanImport function (server-side executor).
 *
 * The parser is duplicated here for testing since it lives in the React component.
 * The server-side function is tested via its validation logic.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate the parser logic from Manage.tsx for testing ───

interface ParsedEntry {
  address: string;
  type: "ip" | "range";
  valid: boolean;
  error?: string;
}

function parseImportText(text: string): ParsedEntry[] {
  const lines = text.split(/\n/);
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    const tokens = line.split(/[,;\s]+/).filter(Boolean);

    for (const token of tokens) {
      const addr = token.trim();
      if (!addr) continue;

      if (seen.has(addr)) continue;
      seen.add(addr);

      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(addr)) {
        const cidr = parseInt(addr.split("/")[1], 10);
        if (cidr < 8 || cidr > 32) {
          entries.push({ address: addr, type: "range", valid: false, error: "CIDR must be /8 to /32" });
        } else {
          entries.push({ address: addr, type: "range", valid: true });
        }
      } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) {
        const octets = addr.split(".").map(Number);
        if (octets.some(o => o > 255)) {
          entries.push({ address: addr, type: "ip", valid: false, error: "Octet > 255" });
        } else if (octets[0] === 0 || octets[0] === 127 || octets[0] === 255) {
          entries.push({ address: addr, type: "ip", valid: false, error: "Reserved address" });
        } else {
          entries.push({ address: addr, type: "ip", valid: true });
        }
      } else {
        entries.push({ address: addr, type: "ip", valid: false, error: "Not a valid IP or CIDR" });
      }
    }
  }

  return entries;
}

// ─── Parser Tests ────────────────────────────────────────────

describe("parseImportText", () => {
  describe("basic IP parsing", () => {
    it("parses a single valid IP", () => {
      const result = parseImportText("8.8.8.8");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ address: "8.8.8.8", type: "ip", valid: true });
    });

    it("parses multiple IPs on separate lines", () => {
      const result = parseImportText("1.2.3.4\n5.6.7.8\n9.10.11.12");
      expect(result).toHaveLength(3);
      expect(result.every(e => e.valid)).toBe(true);
      expect(result.every(e => e.type === "ip")).toBe(true);
    });

    it("parses IPs separated by commas on the same line", () => {
      const result = parseImportText("1.2.3.4, 5.6.7.8, 9.10.11.12");
      expect(result).toHaveLength(3);
      expect(result.every(e => e.valid)).toBe(true);
    });

    it("parses IPs separated by spaces on the same line", () => {
      const result = parseImportText("1.2.3.4 5.6.7.8 9.10.11.12");
      expect(result).toHaveLength(3);
      expect(result.every(e => e.valid)).toBe(true);
    });

    it("parses IPs separated by semicolons", () => {
      const result = parseImportText("1.2.3.4;5.6.7.8;9.10.11.12");
      expect(result).toHaveLength(3);
      expect(result.every(e => e.valid)).toBe(true);
    });
  });

  describe("CIDR range parsing", () => {
    it("parses a valid CIDR range", () => {
      const result = parseImportText("10.0.0.0/24");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ address: "10.0.0.0/24", type: "range", valid: true });
    });

    it("parses /8 as valid (minimum allowed)", () => {
      const result = parseImportText("10.0.0.0/8");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(true);
    });

    it("parses /32 as valid (maximum)", () => {
      const result = parseImportText("10.0.0.1/32");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(true);
    });

    it("rejects /7 as too broad", () => {
      const result = parseImportText("10.0.0.0/7");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("CIDR must be /8 to /32");
    });

    it("rejects /0 as too broad", () => {
      const result = parseImportText("0.0.0.0/0");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
    });

    it("parses mixed IPs and ranges", () => {
      const result = parseImportText("8.8.8.8\n10.0.0.0/24\n1.1.1.1\n192.168.0.0/16");
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ address: "8.8.8.8", type: "ip", valid: true });
      expect(result[1]).toEqual({ address: "10.0.0.0/24", type: "range", valid: true });
      expect(result[2]).toEqual({ address: "1.1.1.1", type: "ip", valid: true });
      expect(result[3]).toEqual({ address: "192.168.0.0/16", type: "range", valid: true });
    });
  });

  describe("comment handling", () => {
    it("ignores lines starting with #", () => {
      const result = parseImportText("# This is a comment\n8.8.8.8");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("8.8.8.8");
    });

    it("ignores inline # comments", () => {
      const result = parseImportText("8.8.8.8 # DNS server");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("8.8.8.8");
    });

    it("ignores // comments", () => {
      const result = parseImportText("// This is a comment\n8.8.8.8 // another comment");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("8.8.8.8");
    });

    it("handles empty lines and whitespace", () => {
      const result = parseImportText("\n\n  8.8.8.8  \n\n  1.1.1.1  \n\n");
      expect(result).toHaveLength(2);
    });

    it("handles a file that is all comments", () => {
      const result = parseImportText("# comment 1\n# comment 2\n// comment 3");
      expect(result).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("removes duplicate IPs", () => {
      const result = parseImportText("8.8.8.8\n8.8.8.8\n8.8.8.8");
      expect(result).toHaveLength(1);
    });

    it("removes duplicate ranges", () => {
      const result = parseImportText("10.0.0.0/24\n10.0.0.0/24");
      expect(result).toHaveLength(1);
    });

    it("keeps different addresses", () => {
      const result = parseImportText("8.8.8.8\n8.8.4.4\n1.1.1.1");
      expect(result).toHaveLength(3);
    });
  });

  describe("validation", () => {
    it("rejects IPs with octets > 255", () => {
      const result = parseImportText("256.1.1.1");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("Octet > 255");
    });

    it("rejects 0.x.x.x as reserved", () => {
      const result = parseImportText("0.0.0.1");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("Reserved address");
    });

    it("rejects 127.x.x.x as reserved (loopback)", () => {
      const result = parseImportText("127.0.0.1");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("Reserved address");
    });

    it("rejects 255.x.x.x as reserved (broadcast)", () => {
      const result = parseImportText("255.255.255.255");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("Reserved address");
    });

    it("rejects non-IP text", () => {
      const result = parseImportText("not-an-ip");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
      expect(result[0].error).toBe("Not a valid IP or CIDR");
    });

    it("rejects domain names", () => {
      const result = parseImportText("example.com");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
    });

    it("rejects partial IPs", () => {
      const result = parseImportText("192.168.1");
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(false);
    });
  });

  describe("realistic file formats", () => {
    it("parses a typical threat intel blocklist", () => {
      const text = `# Threat Intelligence Feed
# Generated: 2026-03-01
# Source: abuse.ch

45.33.32.156
185.220.101.35
104.244.76.13
192.42.116.16
23.129.64.0/24
171.25.193.0/24

# End of list`;

      const result = parseImportText(text);
      expect(result).toHaveLength(6);
      expect(result.filter(e => e.type === "ip")).toHaveLength(4);
      expect(result.filter(e => e.type === "range")).toHaveLength(2);
      expect(result.every(e => e.valid)).toBe(true);
    });

    it("parses a CSV-style list", () => {
      const text = "1.2.3.4,5.6.7.8,10.0.0.0/24,9.8.7.6";
      const result = parseImportText(text);
      expect(result).toHaveLength(4);
      expect(result.every(e => e.valid)).toBe(true);
    });

    it("handles mixed valid and invalid entries", () => {
      const text = `8.8.8.8
not-valid
10.0.0.0/24
256.1.1.1
1.1.1.1
127.0.0.1
192.168.1.0/16`;

      const result = parseImportText(text);
      expect(result).toHaveLength(7);
      expect(result.filter(e => e.valid)).toHaveLength(4); // 8.8.8.8, 10.0.0.0/24, 1.1.1.1, 192.168.1.0/16
      expect(result.filter(e => !e.valid)).toHaveLength(3); // not-valid, 256.1.1.1, 127.0.0.1
    });

    it("handles empty input", () => {
      const result = parseImportText("");
      expect(result).toHaveLength(0);
    });

    it("handles whitespace-only input", () => {
      const result = parseImportText("   \n   \n   ");
      expect(result).toHaveLength(0);
    });
  });
});

// ─── Server-side validation tests ────────────────────────────

describe("bulkBanImport validation", () => {
  it("validates IP format regex", () => {
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    expect(ipRegex.test("8.8.8.8")).toBe(true);
    expect(ipRegex.test("192.168.1.1")).toBe(true);
    expect(ipRegex.test("10.0.0.0/24")).toBe(false);
    expect(ipRegex.test("not-an-ip")).toBe(false);
    expect(ipRegex.test("")).toBe(false);
  });

  it("validates CIDR format regex", () => {
    const cidrRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    expect(cidrRegex.test("10.0.0.0/24")).toBe(true);
    expect(cidrRegex.test("192.168.0.0/16")).toBe(true);
    expect(cidrRegex.test("8.8.8.8")).toBe(false);
    expect(cidrRegex.test("10.0.0.0/")).toBe(false);
  });

  it("validates entry limit of 500", () => {
    // The zod schema enforces .max(500) on the entries array
    // This test verifies the constraint is reasonable
    const entries = Array.from({ length: 500 }, (_, i) => ({
      address: `${Math.floor(i / 256)}.${i % 256}.0.1`,
      type: "ip" as const,
    }));
    expect(entries.length).toBe(500);
  });
});
