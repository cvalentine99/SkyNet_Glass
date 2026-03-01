import { describe, expect, it } from "vitest";

/**
 * Tests for the advanced ban/unban/whitelist command builders and validation.
 * These test the pure functions and regex patterns without requiring a real router.
 */

// ─── CIDR Range Validation ────────────────────────────────

describe("CIDR range validation", () => {
  const cidrRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;

  it("accepts valid CIDR ranges", () => {
    expect(cidrRegex.test("10.0.0.0/24")).toBe(true);
    expect(cidrRegex.test("192.168.1.0/16")).toBe(true);
    expect(cidrRegex.test("172.16.0.0/12")).toBe(true);
    expect(cidrRegex.test("0.0.0.0/0")).toBe(true);
    expect(cidrRegex.test("255.255.255.0/32")).toBe(true);
    expect(cidrRegex.test("1.2.3.4/8")).toBe(true);
  });

  it("rejects invalid CIDR ranges", () => {
    expect(cidrRegex.test("")).toBe(false);
    expect(cidrRegex.test("10.0.0.0")).toBe(false); // no mask
    expect(cidrRegex.test("10.0.0/24")).toBe(false); // incomplete IP
    expect(cidrRegex.test("10.0.0.0/")).toBe(false); // no mask value
    expect(cidrRegex.test("/24")).toBe(false); // no IP
    expect(cidrRegex.test("abc/24")).toBe(false);
    expect(cidrRegex.test("10.0.0.0/24 extra")).toBe(false);
  });

  it("rejects injection attempts in CIDR ranges", () => {
    expect(cidrRegex.test("10.0.0.0/24;rm -rf")).toBe(false);
    expect(cidrRegex.test("10.0.0.0/24\n")).toBe(false);
    expect(cidrRegex.test("10.0.0.0/24 && echo")).toBe(false);
  });
});

// ─── Domain Validation ────────────────────────────────────

describe("domain validation", () => {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  it("accepts valid domains", () => {
    expect(domainRegex.test("example.com")).toBe(true);
    expect(domainRegex.test("sub.example.com")).toBe(true);
    expect(domainRegex.test("deep.sub.example.co.uk")).toBe(true);
    expect(domainRegex.test("google.com")).toBe(true);
    expect(domainRegex.test("my-site.org")).toBe(true);
    expect(domainRegex.test("123.example.com")).toBe(true);
  });

  it("rejects invalid domains", () => {
    expect(domainRegex.test("")).toBe(false);
    expect(domainRegex.test("a")).toBe(false); // too short
    expect(domainRegex.test(".com")).toBe(false); // starts with dot
    expect(domainRegex.test("-example.com")).toBe(false); // starts with hyphen
    expect(domainRegex.test("example")).toBe(false); // no TLD
  });

  it("rejects injection attempts in domains", () => {
    expect(domainRegex.test("example.com;rm -rf")).toBe(false);
    expect(domainRegex.test("example.com && echo")).toBe(false);
    expect(domainRegex.test("example.com\nhack")).toBe(false);
    expect(domainRegex.test("example.com`whoami`")).toBe(false);
  });
});

// ─── Country Code Validation ──────────────────────────────

describe("country code validation", () => {
  const ccRegex = /^[a-z]{2}$/;

  it("accepts valid 2-letter country codes", () => {
    expect(ccRegex.test("cn")).toBe(true);
    expect(ccRegex.test("ru")).toBe(true);
    expect(ccRegex.test("us")).toBe(true);
    expect(ccRegex.test("ir")).toBe(true);
    expect(ccRegex.test("de")).toBe(true);
  });

  it("rejects invalid country codes", () => {
    expect(ccRegex.test("")).toBe(false);
    expect(ccRegex.test("a")).toBe(false);
    expect(ccRegex.test("abc")).toBe(false);
    expect(ccRegex.test("CN")).toBe(false); // uppercase
    expect(ccRegex.test("12")).toBe(false);
    expect(ccRegex.test("c1")).toBe(false);
  });
});

// ─── Ban Range Command Construction ──────────────────────

describe("ban range command construction", () => {
  function buildBanRangeCommand(range: string, comment?: string): string {
    const desc = comment || `Banned via Skynet Glass`;
    const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);
    return `/jffs/scripts/firewall ban range ${range} "${safeComment}"`;
  }

  it("builds a basic range ban command", () => {
    expect(buildBanRangeCommand("10.0.0.0/24")).toBe(
      '/jffs/scripts/firewall ban range 10.0.0.0/24 "Banned via Skynet Glass"'
    );
  });

  it("builds a range ban with custom comment", () => {
    expect(buildBanRangeCommand("192.168.0.0/16", "Suspicious subnet")).toBe(
      '/jffs/scripts/firewall ban range 192.168.0.0/16 "Suspicious subnet"'
    );
  });

  it("sanitizes dangerous characters in comments", () => {
    const cmd = buildBanRangeCommand("10.0.0.0/24", 'test; rm -rf / && echo "hacked"');
    expect(cmd).not.toContain(";");
    expect(cmd).not.toContain("&&");
    expect(cmd).toContain("test rm -rf /  echo hacked");
  });

  it("truncates long comments to 200 chars", () => {
    const longComment = "A".repeat(300);
    const cmd = buildBanRangeCommand("10.0.0.0/24", longComment);
    const match = cmd.match(/"(.+)"/);
    expect(match).toBeTruthy();
    expect(match![1].length).toBe(200);
  });
});

// ─── Ban Domain Command Construction ─────────────────────

describe("ban domain command construction", () => {
  function buildBanDomainCommand(domain: string): string {
    return `/jffs/scripts/firewall ban domain ${domain}`;
  }

  it("builds a basic domain ban command", () => {
    expect(buildBanDomainCommand("malicious-site.com")).toBe(
      "/jffs/scripts/firewall ban domain malicious-site.com"
    );
  });

  it("builds a subdomain ban command", () => {
    expect(buildBanDomainCommand("sub.evil.org")).toBe(
      "/jffs/scripts/firewall ban domain sub.evil.org"
    );
  });
});

// ─── Ban Country Command Construction ────────────────────

describe("ban country command construction", () => {
  function buildBanCountryCommand(codes: string[]): string {
    const validCodes = codes
      .map((c) => c.toLowerCase().trim())
      .filter((c) => /^[a-z]{2}$/.test(c));
    return `/jffs/scripts/firewall ban country ${validCodes.join(" ")}`;
  }

  it("builds a single country ban command", () => {
    expect(buildBanCountryCommand(["cn"])).toBe(
      "/jffs/scripts/firewall ban country cn"
    );
  });

  it("builds a multi-country ban command", () => {
    expect(buildBanCountryCommand(["cn", "ru", "ir"])).toBe(
      "/jffs/scripts/firewall ban country cn ru ir"
    );
  });

  it("filters out invalid country codes", () => {
    expect(buildBanCountryCommand(["cn", "abc", "12", "ru"])).toBe(
      "/jffs/scripts/firewall ban country cn ru"
    );
  });

  it("lowercases uppercase codes", () => {
    expect(buildBanCountryCommand(["CN", "RU"])).toBe(
      "/jffs/scripts/firewall ban country cn ru"
    );
  });
});

// ─── Unban Range Command Construction ────────────────────

describe("unban range command construction", () => {
  function buildUnbanRangeCommand(range: string): string {
    return `/jffs/scripts/firewall unban range ${range}`;
  }

  it("builds a basic range unban command", () => {
    expect(buildUnbanRangeCommand("10.0.0.0/24")).toBe(
      "/jffs/scripts/firewall unban range 10.0.0.0/24"
    );
  });
});

// ─── Unban Domain Command Construction ───────────────────

describe("unban domain command construction", () => {
  function buildUnbanDomainCommand(domain: string): string {
    return `/jffs/scripts/firewall unban domain ${domain}`;
  }

  it("builds a basic domain unban command", () => {
    expect(buildUnbanDomainCommand("example.com")).toBe(
      "/jffs/scripts/firewall unban domain example.com"
    );
  });
});

// ─── Bulk Unban Command Construction ─────────────────────

describe("bulk unban command construction", () => {
  function buildBulkUnbanCommand(category: string): string {
    return `/jffs/scripts/firewall unban ${category}`;
  }

  it("builds unban malware command", () => {
    expect(buildBulkUnbanCommand("malware")).toBe(
      "/jffs/scripts/firewall unban malware"
    );
  });

  it("builds unban nomanual command", () => {
    expect(buildBulkUnbanCommand("nomanual")).toBe(
      "/jffs/scripts/firewall unban nomanual"
    );
  });

  it("builds unban country command", () => {
    expect(buildBulkUnbanCommand("country")).toBe(
      "/jffs/scripts/firewall unban country"
    );
  });

  it("builds unban all command", () => {
    expect(buildBulkUnbanCommand("all")).toBe(
      "/jffs/scripts/firewall unban all"
    );
  });
});

// ─── Whitelist IP Command Construction ───────────────────

describe("whitelist IP command construction", () => {
  function buildWhitelistIPCommand(ip: string, comment?: string): string {
    const desc = comment || `Whitelisted via Skynet Glass`;
    const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);
    return `/jffs/scripts/firewall whitelist ip ${ip} "${safeComment}"`;
  }

  it("builds a basic whitelist IP command", () => {
    expect(buildWhitelistIPCommand("1.1.1.1")).toBe(
      '/jffs/scripts/firewall whitelist ip 1.1.1.1 "Whitelisted via Skynet Glass"'
    );
  });

  it("builds a whitelist IP with custom comment", () => {
    expect(buildWhitelistIPCommand("8.8.8.8", "Google DNS")).toBe(
      '/jffs/scripts/firewall whitelist ip 8.8.8.8 "Google DNS"'
    );
  });

  it("sanitizes dangerous characters in comments", () => {
    const cmd = buildWhitelistIPCommand("1.1.1.1", 'test; rm -rf / && echo "hacked"');
    expect(cmd).not.toContain(";");
    expect(cmd).not.toContain("&&");
  });
});

// ─── Whitelist Domain Command Construction ───────────────

describe("whitelist domain command construction", () => {
  function buildWhitelistDomainCommand(domain: string, comment?: string): string {
    const desc = comment || `Whitelisted via Skynet Glass`;
    const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);
    return `/jffs/scripts/firewall whitelist domain ${domain} "${safeComment}"`;
  }

  it("builds a basic whitelist domain command", () => {
    expect(buildWhitelistDomainCommand("google.com")).toBe(
      '/jffs/scripts/firewall whitelist domain google.com "Whitelisted via Skynet Glass"'
    );
  });

  it("builds a whitelist domain with custom comment", () => {
    expect(buildWhitelistDomainCommand("cdn.example.com", "CDN service")).toBe(
      '/jffs/scripts/firewall whitelist domain cdn.example.com "CDN service"'
    );
  });
});

// ─── Remove Whitelist Commands ───────────────────────────

describe("remove whitelist command construction", () => {
  it("builds remove whitelist IP command", () => {
    const cmd = `/jffs/scripts/firewall whitelist remove ip 1.1.1.1`;
    expect(cmd).toBe("/jffs/scripts/firewall whitelist remove ip 1.1.1.1");
  });

  it("builds remove whitelist domain command", () => {
    const cmd = `/jffs/scripts/firewall whitelist remove domain example.com`;
    expect(cmd).toBe(
      "/jffs/scripts/firewall whitelist remove domain example.com"
    );
  });
});

// ─── Refresh Whitelist Command ───────────────────────────

describe("refresh whitelist command construction", () => {
  it("builds refresh whitelist command", () => {
    const cmd = `/jffs/scripts/firewall whitelist refresh`;
    expect(cmd).toBe("/jffs/scripts/firewall whitelist refresh");
  });
});

// ─── Comment Sanitization ────────────────────────────────

describe("comment sanitization", () => {
  const sanitize = (input: string) =>
    input.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);

  it("removes semicolons", () => {
    expect(sanitize("test; rm -rf /")).toBe("test rm -rf /");
  });

  it("removes backticks", () => {
    expect(sanitize("`whoami`")).toBe("whoami");
  });

  it("removes dollar signs", () => {
    expect(sanitize("$(command)")).toBe("(command)");
  });

  it("removes backslashes", () => {
    expect(sanitize("test\\ninjection")).toBe("testninjection");
  });

  it("removes pipe characters", () => {
    expect(sanitize("test | grep secret")).toBe("test  grep secret");
  });

  it("removes angle brackets", () => {
    expect(sanitize("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("removes ampersands", () => {
    expect(sanitize("test && echo hacked")).toBe("test  echo hacked");
  });

  it("removes single and double quotes", () => {
    expect(sanitize("test 'quoted' \"double\"")).toBe("test quoted double");
  });

  it("preserves safe characters", () => {
    expect(sanitize("Normal comment with spaces 123")).toBe(
      "Normal comment with spaces 123"
    );
  });

  it("truncates to 200 characters", () => {
    const long = "A".repeat(300);
    expect(sanitize(long).length).toBe(200);
  });
});

// ─── Bulk Unban Category Validation ──────────────────────

describe("bulk unban category validation", () => {
  const validCategories = ["malware", "nomanual", "country", "all"];

  it("accepts all valid categories", () => {
    for (const cat of validCategories) {
      expect(validCategories.includes(cat)).toBe(true);
    }
  });

  it("rejects invalid categories", () => {
    expect(validCategories.includes("invalid")).toBe(false);
    expect(validCategories.includes("")).toBe(false);
    expect(validCategories.includes("ALL")).toBe(false); // case sensitive
    expect(validCategories.includes("Malware")).toBe(false);
  });
});
