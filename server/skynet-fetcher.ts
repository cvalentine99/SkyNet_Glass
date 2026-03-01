/**
 * Skynet Fetcher
 *
 * Fetches stats.js from the router, parses it, and caches the result.
 * Also provides a polling manager and ban/unban command execution.
 */

import axios from "axios";
import { createHash } from "crypto";
import { parseSkynetStats, type SkynetStats } from "./skynet-parser";
import {
  getSkynetConfig,
  getCachedStats,
  saveCachedStats,
  getLastContentHash,
  saveStatsSnapshot,
} from "./skynet-db";
import { checkAlerts, initAlertBaseline } from "./skynet-alerts";

// ─── Auth Helper ───────────────────────────────────────────

/**
 * Build HTTP Basic Auth headers from optional username/password.
 * ASUS routers use standard HTTP Basic Auth for their WebUI.
 * Returns an empty object if no credentials are provided.
 */
export function buildAuthHeaders(
  username?: string | null,
  password?: string | null
): Record<string, string> {
  if (!username) return {};
  const credentials = Buffer.from(`${username}:${password ?? ""}`).toString("base64");
  return { Authorization: `Basic ${credentials}` };
}

// ─── HTTPS Agent helper ────────────────────────────────────

async function getHttpsAgent(protocol: string) {
  if (protocol === "https") {
    const https = await import("https");
    return new https.Agent({ rejectUnauthorized: false });
  }
  return undefined;
}

// ─── In-memory state ────────────────────────────────────────

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let lastFetchTime: Date | null = null;
let lastFetchError: string | null = null;
let isFetching = false;

// ─── Fetch stats from router ────────────────────────────────

export async function fetchStatsFromRouter(): Promise<{
  stats: SkynetStats | null;
  error: string | null;
  changed: boolean;
}> {
  if (isFetching) {
    return { stats: null, error: "Fetch already in progress", changed: false };
  }

  isFetching = true;
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { stats: null, error: "No router configuration found. Please configure your router connection first.", changed: false };
    }

    const url = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}${config.statsPath}`;
    const authHeaders = buildAuthHeaders(config.username, config.password);

    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent: await getHttpsAgent(config.routerProtocol),
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...authHeaders,
      },
    });

    const rawJs = response.data as string;

    // Check if content changed
    const hash = createHash("md5").update(rawJs).digest("hex");
    const lastHash = await getLastContentHash();
    const changed = hash !== lastHash;

    // Parse the stats
    const stats = parseSkynetStats(rawJs);

    // Cache the result
    await saveCachedStats(stats, hash);

    // Save historical snapshot if data changed
    if (changed) {
      try {
        // Count unique countries from all connection types
        const allCountries = new Set<string>();
        [...(stats.topInboundBlocks || []), ...(stats.topOutboundBlocks || []), ...(stats.topHttpBlocks || [])].forEach(c => {
          if (c.country) allCountries.add(c.country);
        });

        // Build country distribution for historical playback
        const countryMap = new Map<string, { code: string; country: string; hits: number }>();
        [...(stats.topInboundBlocks || []), ...(stats.topOutboundBlocks || []), ...(stats.topHttpBlocks || [])].forEach(c => {
          if (c.country) {
            const existing = countryMap.get(c.country);
            if (existing) {
              existing.hits += c.hits;
            } else {
              countryMap.set(c.country, { code: c.country, country: c.country, hits: c.hits });
            }
          }
        });
        const countryData = Array.from(countryMap.values()).map(c => ({
          code: c.code,
          country: c.country,
          blocks: c.hits,
        }));

        await saveStatsSnapshot({
          ipsBanned: stats.kpi.ipsBanned || 0,
          rangesBanned: stats.kpi.rangesBanned || 0,
          inboundBlocks: stats.kpi.inboundBlocks || 0,
          outboundBlocks: stats.kpi.outboundBlocks || 0,
          totalBlocks: (stats.kpi.inboundBlocks || 0) + (stats.kpi.outboundBlocks || 0),
          uniqueCountries: allCountries.size,
          uniquePorts: (stats.inboundPortHits || []).length,
          contentHash: hash,
          countryData,
        });
      } catch (histErr) {
        console.warn("[Skynet] Failed to save history snapshot:", histErr);
      }
    }

    // Run alert checks after successful fetch
    try {
      const alerts = await checkAlerts(stats);
      if (alerts.length > 0) {
        console.log(`[Skynet Alerts] Triggered ${alerts.length} alert(s):`, alerts.map(a => a.type).join(", "));
      }
    } catch (alertErr) {
      console.warn("[Skynet Alerts] Error checking alerts:", alertErr);
    }

    lastFetchTime = new Date();
    lastFetchError = null;

    return { stats, error: null, changed };
  } catch (err: any) {
    const errorMsg = err.code === "ECONNREFUSED"
      ? "Connection refused — is the router reachable?"
      : err.code === "ETIMEDOUT" || err.code === "ECONNABORTED"
        ? "Connection timed out — check router address and port"
        : err.response?.status === 404
          ? "stats.js not found — is Skynet WebUI enabled?"
          : err.response?.status === 401 || err.response?.status === 403
            ? "Authentication required — check router credentials"
            : `Fetch failed: ${err.message}`;

    lastFetchError = errorMsg;
    return { stats: null, error: errorMsg, changed: false };
  } finally {
    isFetching = false;
  }
}

// ─── Trigger router stat regeneration ───────────────────────

export async function triggerRouterGenstats(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { success: false, error: "No router configuration found" };
    }

    const baseUrl = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}`;
    const authHeaders = buildAuthHeaders(config.username, config.password);

    // The router's httpd expects a form POST to /start_apply.htm
    await axios.post(
      `${baseUrl}/start_apply.htm`,
      new URLSearchParams({
        action_script: "start_SkynetStats",
        action_mode: "apply",
        action_wait: "45",
        modified: "0",
        current_page: "",
        next_page: "",
      }).toString(),
      {
        timeout: 10000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...authHeaders,
        },
        httpsAgent: await getHttpsAgent(config.routerProtocol),
      }
    );

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to trigger stat regeneration: ${err.message}`,
    };
  }
}

// ─── Ban/Unban IP via router ────────────────────────────────

/**
 * Execute a Skynet firewall command on the router.
 *
 * The ASUS router's httpd supports running shell commands via
 * POST /apply.cgi with SystemCmd. However, the more reliable
 * method for Merlin firmware is to use the custom script trigger:
 *
 * POST /start_apply.htm with:
 *   action_script = "start_firewall"  (triggers service-event)
 *
 * For Skynet specifically, we write the command to a temp file
 * and trigger it via the SystemCmd mechanism.
 *
 * Skynet command format (from README.md):
 *   Ban:   firewall ban ip 8.8.8.8 "Comment"
 *   Unban: firewall unban ip 8.8.8.8
 */
async function executeRouterCommand(command: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { success: false, error: "No router configuration found" };
    }

    const baseUrl = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}`;
    const authHeaders = buildAuthHeaders(config.username, config.password);
    const httpsAgent = await getHttpsAgent(config.routerProtocol);

    // Step 1: Write the command via SystemCmd (apply.cgi)
    // ASUS Merlin routers support executing commands via /apply.cgi
    await axios.post(
      `${baseUrl}/apply.cgi`,
      new URLSearchParams({
        current_page: "Main_Analysis_Content.asp",
        next_page: "Main_Analysis_Content.asp",
        action_mode: " Refresh ",
        SystemCmd: command,
      }).toString(),
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${baseUrl}/Main_Analysis_Content.asp`,
          ...authHeaders,
        },
        httpsAgent,
      }
    );

    return { success: true, error: null };
  } catch (err: any) {
    const errorMsg = err.response?.status === 401 || err.response?.status === 403
      ? "Authentication failed — check router credentials"
      : `Command execution failed: ${err.message}`;
    return { success: false, error: errorMsg };
  }
}

/**
 * Ban an IP address via Skynet.
 * Executes: firewall ban ip <ip> "<comment>"
 */
export async function banIP(ip: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  // Validate IP format (basic check)
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }

  const desc = comment || `Banned via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  // Sanitize comment — remove shell-unsafe characters
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);

  const cmd = `/jffs/scripts/firewall ban ip ${ip} "${safeComment}"`;
  return executeRouterCommand(cmd);
}

/**
 * Unban an IP address via Skynet.
 * Executes: firewall unban ip <ip>
 */
export async function unbanIP(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }

  const cmd = `/jffs/scripts/firewall unban ip ${ip}`;
  return executeRouterCommand(cmd);
}

// ─── Advanced Ban Commands ─────────────────────────────────

/**
 * Ban an IP range via Skynet.
 * Executes: firewall ban range X.X.X.X/CIDR "comment"
 */
export async function banRange(range: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(range)) {
    return { success: false, error: `Invalid CIDR range: ${range}` };
  }

  const desc = comment || `Banned via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);

  const cmd = `/jffs/scripts/firewall ban range ${range} "${safeComment}"`;
  return executeRouterCommand(cmd);
}

/**
 * Ban a domain via Skynet (resolves all IPs and bans them).
 * Executes: firewall ban domain example.com
 */
export async function banDomain(domain: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  // Basic domain validation
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }

  const cmd = `/jffs/scripts/firewall ban domain ${domain}`;
  return executeRouterCommand(cmd);
}

/**
 * Ban by country code(s) via Skynet.
 * Executes: firewall ban country CC CC ...
 */
export async function banCountry(countryCodes: string[]): Promise<{
  success: boolean;
  error: string | null;
}> {
  const validCodes = countryCodes
    .map(c => c.toLowerCase().trim())
    .filter(c => /^[a-z]{2}$/.test(c));

  if (validCodes.length === 0) {
    return { success: false, error: "No valid 2-letter country codes provided" };
  }

  const cmd = `/jffs/scripts/firewall ban country ${validCodes.join(" ")}`;
  return executeRouterCommand(cmd);
}

// ─── Advanced Unban Commands ───────────────────────────────

/**
 * Unban an IP range via Skynet.
 * Executes: firewall unban range X.X.X.X/CIDR
 */
export async function unbanRange(range: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(range)) {
    return { success: false, error: `Invalid CIDR range: ${range}` };
  }

  const cmd = `/jffs/scripts/firewall unban range ${range}`;
  return executeRouterCommand(cmd);
}

/**
 * Unban a domain via Skynet.
 * Executes: firewall unban domain example.com
 */
export async function unbanDomain(domain: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }

  const cmd = `/jffs/scripts/firewall unban domain ${domain}`;
  return executeRouterCommand(cmd);
}

/**
 * Bulk unban by category via Skynet.
 * Supported categories:
 *   - "malware" → unban malware (removes malware list bans)
 *   - "nomanual" → unban nomanual (removes all non-manual bans)
 *   - "country" → unban country (removes country bans)
 *   - "all" → unban all (removes ALL bans)
 */
export async function unbanBulk(category: "malware" | "nomanual" | "country" | "all"): Promise<{
  success: boolean;
  error: string | null;
}> {
  const validCategories = ["malware", "nomanual", "country", "all"];
  if (!validCategories.includes(category)) {
    return { success: false, error: `Invalid unban category: ${category}` };
  }

  const cmd = `/jffs/scripts/firewall unban ${category}`;
  return executeRouterCommand(cmd);
}

// ─── Whitelist Commands ────────────────────────────────────

/**
 * Add an IP to the Skynet whitelist.
 * Executes: firewall whitelist ip X.X.X.X "comment"
 */
export async function whitelistIP(ip: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }

  const desc = comment || `Whitelisted via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);

  const cmd = `/jffs/scripts/firewall whitelist ip ${ip} "${safeComment}"`;
  return executeRouterCommand(cmd);
}

/**
 * Add a domain to the Skynet whitelist.
 * Executes: firewall whitelist domain example.com "comment"
 */
export async function whitelistDomain(domain: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }

  const desc = comment || `Whitelisted via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'\`$\\|&<>]/g, "").slice(0, 200);

  const cmd = `/jffs/scripts/firewall whitelist domain ${domain} "${safeComment}"`;
  return executeRouterCommand(cmd);
}

/**
 * Remove an IP from the Skynet whitelist.
 * Executes: firewall whitelist remove ip X.X.X.X
 */
export async function removeWhitelistIP(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }

  const cmd = `/jffs/scripts/firewall whitelist remove ip ${ip}`;
  return executeRouterCommand(cmd);
}

/**
 * Remove a domain from the Skynet whitelist.
 * Executes: firewall whitelist remove domain example.com
 */
export async function removeWhitelistDomain(domain: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }

  const cmd = `/jffs/scripts/firewall whitelist remove domain ${domain}`;
  return executeRouterCommand(cmd);
}

/**
 * Refresh the Skynet shared whitelists.
 * Executes: firewall whitelist refresh
 */
export async function refreshWhitelist(): Promise<{
  success: boolean;
  error: string | null;
}> {
  const cmd = `/jffs/scripts/firewall whitelist refresh`;
  return executeRouterCommand(cmd);
}

// ─── Syslog Fetcher ────────────────────────────────────────

/**
 * Fetch syslog / skynet.log from the router.
 *
 * Strategy:
 *   1. Try to read the consolidated skynet.log via SystemCmd + cmdRet
 *   2. The router's apply.cgi writes command output to /tmp/syscmd.log
 *      which we can then fetch via HTTP.
 *
 * We use `cat <logfile> | tail -<lines>` to limit output size.
 * Default log path: /tmp/syslog.log (can also be /jffs/syslog.log or custom)
 */
export async function fetchSyslog(options?: {
  logPath?: string;
  maxLines?: number;
}): Promise<{
  raw: string;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { raw: "", error: "No router configuration found" };
    }

    const baseUrl = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}`;
    const authHeaders = buildAuthHeaders(config.username, config.password);
    const httpsAgent = await getHttpsAgent(config.routerProtocol);
    const logPath = options?.logPath || "/tmp/syslog.log";
    const maxLines = options?.maxLines || 500;

    // Step 1: Execute cat command on the router to read syslog
    // We grep for BLOCKED lines and tail to limit output
    const cmd = `grep "BLOCKED" ${logPath} /tmp/syslog.log-1 /jffs/syslog.log /jffs/syslog.log-1 2>/dev/null | tail -${maxLines}`;

    await axios.post(
      `${baseUrl}/apply.cgi`,
      new URLSearchParams({
        current_page: "Main_Analysis_Content.asp",
        next_page: "Main_Analysis_Content.asp",
        action_mode: " Refresh ",
        SystemCmd: cmd,
      }).toString(),
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${baseUrl}/Main_Analysis_Content.asp`,
          ...authHeaders,
        },
        httpsAgent,
      }
    );

    // Step 2: Fetch the command output from /tmp/syscmd.log
    // The router writes SystemCmd output to this file
    const outputResponse = await axios.get(`${baseUrl}/cmdRet_check.htm`, {
      timeout: 10000,
      headers: {
        Referer: `${baseUrl}/Main_Analysis_Content.asp`,
        ...authHeaders,
      },
      httpsAgent,
    });

    // The response is wrapped in <pre> tags
    let raw = outputResponse.data as string;
    // Strip HTML wrapper if present
    raw = raw.replace(/<[^>]+>/g, "").trim();

    return { raw, error: null };
  } catch (err: any) {
    const errorMsg =
      err.response?.status === 401 || err.response?.status === 403
        ? "Authentication failed — check router credentials"
        : `Failed to fetch syslog: ${err.message}`;
    return { raw: "", error: errorMsg };
  }
}

// ─── Fetch Ipset Data ──────────────────────────────────────

/**
 * Fetch ipset data from the router.
 *
 * Reads the skynet.ipset file which contains all ipset save data.
 * Optionally filters by set name (e.g. Skynet-Blacklist).
 */
export async function fetchIpsetData(options?: {
  setName?: string;
}): Promise<{
  raw: string;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { raw: "", error: "No router configuration found" };
    }

    const baseUrl = `${config.routerProtocol}://${config.routerAddress}:${config.routerPort}`;
    const authHeaders = buildAuthHeaders(config.username, config.password);
    const httpsAgent = await getHttpsAgent(config.routerProtocol);

    // Build the command to read ipset data
    // The skynet.ipset file is at /opt/share/skynet/skynet.ipset (or /jffs/addons/shared-whitelists/shared-whitelist)
    // For live data, use: ipset save <setname>
    let cmd: string;
    if (options?.setName) {
      // Filter for specific set
      cmd = `grep '^add ${options.setName} ' /opt/share/skynet/skynet.ipset 2>/dev/null || ipset save ${options.setName} 2>/dev/null`;
    } else {
      // Get all sets
      cmd = `cat /opt/share/skynet/skynet.ipset 2>/dev/null || { ipset save Skynet-Blacklist; ipset save Skynet-BlockedRanges; ipset save Skynet-Whitelist; ipset save Skynet-WhitelistDomains; } 2>/dev/null`;
    }

    await axios.post(
      `${baseUrl}/apply.cgi`,
      new URLSearchParams({
        current_page: "Main_Analysis_Content.asp",
        next_page: "Main_Analysis_Content.asp",
        action_mode: " Refresh ",
        SystemCmd: cmd,
      }).toString(),
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: `${baseUrl}/Main_Analysis_Content.asp`,
          ...authHeaders,
        },
        httpsAgent,
      }
    );

    // Wait a moment for large ipset files
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch the command output
    const outputResponse = await axios.get(`${baseUrl}/cmdRet_check.htm`, {
      timeout: 15000,
      headers: {
        Referer: `${baseUrl}/Main_Analysis_Content.asp`,
        ...authHeaders,
      },
      httpsAgent,
    });

    let raw = outputResponse.data as string;
    raw = raw.replace(/<[^>]+>/g, "").trim();

    return { raw, error: null };
  } catch (err: any) {
    const errorMsg =
      err.response?.status === 401 || err.response?.status === 403
        ? "Authentication failed — check router credentials"
        : `Failed to fetch ipset data: ${err.message}`;
    return { raw: "", error: errorMsg };
  }
}

// ─── Polling Manager ────────────────────────────────────────

export async function startPolling(): Promise<void> {
  stopPolling();

  const config = await getSkynetConfig();
  if (!config || !config.pollingEnabled) return;

  const intervalMs = (config.pollingInterval || 300) * 1000;

  // Initial fetch
  await fetchStatsFromRouter();

  pollingTimer = setInterval(async () => {
    await fetchStatsFromRouter();
  }, intervalMs);

  console.log(`[Skynet] Polling started — interval: ${config.pollingInterval}s`);
}

export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log("[Skynet] Polling stopped");
  }
}

export function getPollingStatus() {
  return {
    isPolling: pollingTimer !== null,
    isFetching,
    lastFetchTime,
    lastFetchError,
  };
}

// ─── Get stats (from cache or fresh fetch) ──────────────────

export async function getStats(): Promise<{
  stats: SkynetStats | null;
  fetchedAt: Date | null;
  source: "cache" | "fresh" | "none";
  error: string | null;
}> {
  // Try cache first
  const cached = await getCachedStats();
  if (cached) {
    return {
      stats: cached.stats,
      fetchedAt: cached.fetchedAt,
      source: "cache",
      error: null,
    };
  }

  // No cache — try fresh fetch
  const result = await fetchStatsFromRouter();
  if (result.stats) {
    return {
      stats: result.stats,
      fetchedAt: new Date(),
      source: "fresh",
      error: null,
    };
  }

  return {
    stats: null,
    fetchedAt: null,
    source: "none",
    error: result.error,
  };
}
