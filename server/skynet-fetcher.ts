/**
 * Skynet Fetcher — SSH Edition
 *
 * All router communication uses SSH instead of HTTP.
 * Reads files directly from the router filesystem and executes
 * Skynet commands via SSH shell.
 *
 * Key paths on the router:
 *   stats.js:       /tmp/var/wwwext/skynet/stats.js
 *   syslog:         /tmp/syslog.log, /jffs/syslog.log
 *   DHCP leases:    /var/lib/misc/dnsmasq.leases
 *   dnsmasq log:    /opt/var/log/dnsmasq.log
 *   ipset data:     /opt/share/skynet/skynet.ipset
 *   firewall script: /jffs/scripts/firewall
 */

import { createHash } from "crypto";
import { parseSkynetStats, validateStatsJs, type SkynetStats } from "./skynet-parser";
import {
  getSkynetConfig,
  getCachedStats,
  saveCachedStats,
  getLastContentHash,
  saveStatsSnapshot,
} from "./skynet-db";
import { checkAlerts, initAlertBaseline } from "./skynet-alerts";
import { sshExec, type SSHConfig } from "./skynet-ssh";

// ─── SSH Config Builder ────────────────────────────────────────

/**
 * Build an SSHConfig from the database config row.
 */
function buildSSHConfig(config: {
  routerAddress: string;
  sshPort?: number | null;
  username?: string | null;
  password?: string | null;
}): SSHConfig {
  return {
    host: config.routerAddress,
    port: config.sshPort ?? 22,
    username: config.username || "admin",
    password: config.password || undefined,
  };
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

    const ssh = buildSSHConfig(config);

    // Read stats.js directly from the router filesystem
    const result = await sshExec(ssh, "cat /tmp/var/wwwext/skynet/stats.js 2>/dev/null", { timeout: 30000 });

    if (result.code !== 0 || !result.stdout.trim()) {
      // Try alternate location
      const alt = await sshExec(ssh, "cat /tmp/mnt/*/skynet/webui/stats.js 2>/dev/null | head -2000", { timeout: 15000 });
      if (alt.code !== 0 || !alt.stdout.trim()) {
        return { stats: null, error: "stats.js not found on router. Is Skynet installed and has 'genstats' been run?", changed: false };
      }
      return processStatsContent(alt.stdout);
    }

    return processStatsContent(result.stdout);
  } catch (err: any) {
    const errorMsg = formatSSHError(err);
    lastFetchError = errorMsg;
    return { stats: null, error: errorMsg, changed: false };
  } finally {
    isFetching = false;
  }
}

/**
 * Process raw stats.js content: validate, parse, cache, snapshot, alert.
 */
async function processStatsContent(rawJs: string): Promise<{
  stats: SkynetStats | null;
  error: string | null;
  changed: boolean;
}> {
  // Validate the content before parsing
  const validationError = validateStatsJs(rawJs);
  if (validationError) {
    lastFetchError = validationError;
    return { stats: null, error: validationError, changed: false };
  }

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
      const allCountries = new Set<string>();
      [...(stats.topInboundBlocks || []), ...(stats.topOutboundBlocks || []), ...(stats.topHttpBlocks || [])].forEach(c => {
        if (c.country) allCountries.add(c.country);
      });

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

  // Run alert checks
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

    const ssh = buildSSHConfig(config);

    // Run Skynet's genstats command directly
    const result = await sshExec(ssh, "/jffs/scripts/firewall stats", { timeout: 60000 });

    if (result.code !== 0 && result.stderr.trim()) {
      return { success: false, error: `Genstats failed: ${result.stderr.trim().slice(0, 200)}` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: `Failed to trigger stat regeneration: ${formatSSHError(err)}` };
  }
}

// ─── Execute Skynet Commands ────────────────────────────────

/**
 * Execute a Skynet firewall command on the router via SSH.
 * Much simpler than the old HTTP apply.cgi + cmdRet_check.htm dance.
 */
async function executeRouterCommand(command: string): Promise<{
  success: boolean;
  output: string;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { success: false, output: "", error: "No router configuration found" };
    }

    const ssh = buildSSHConfig(config);
    const result = await sshExec(ssh, command, { timeout: 30000 });

    if (result.code !== 0 && result.stderr.trim()) {
      return {
        success: false,
        output: result.stdout,
        error: `Command failed (exit ${result.code}): ${result.stderr.trim().slice(0, 300)}`,
      };
    }

    return { success: true, output: result.stdout, error: null };
  } catch (err: any) {
    return { success: false, output: "", error: formatSSHError(err) };
  }
}

// ─── Ban/Unban IP ──────────────────────────────────────────

export async function banIP(ip: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }

  const desc = comment || `Banned via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall ban ip ${ip} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function unbanIP(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  const cmd = `/jffs/scripts/firewall unban ip ${ip}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function banRange(cidr: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(cidr)) {
    return { success: false, error: `Invalid CIDR range: ${cidr}` };
  }
  const desc = comment || `Range banned via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall ban range ${cidr} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function unbanRange(cidr: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(cidr)) {
    return { success: false, error: `Invalid CIDR range: ${cidr}` };
  }
  const cmd = `/jffs/scripts/firewall unban range ${cidr}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

// ─── Domain Ban/Unban ─────────────────────────────────────

export async function banDomain(domain: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }
  const desc = comment || `Domain banned via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall ban domain ${domain} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function unbanDomain(domain: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }
  const cmd = `/jffs/scripts/firewall unban domain ${domain}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

// ─── Country Ban/Unban ────────────────────────────────────

export async function banCountry(countryCodes: string[]): Promise<{
  success: boolean;
  results: Array<{ code: string; success: boolean; error: string | null }>;
}> {
  const results: Array<{ code: string; success: boolean; error: string | null }> = [];
  for (const code of countryCodes) {
    if (!/^[A-Z]{2}$/.test(code)) {
      results.push({ code, success: false, error: `Invalid country code: ${code}` });
      continue;
    }
    const cmd = `/jffs/scripts/firewall ban country ${code}`;
    const result = await executeRouterCommand(cmd);
    results.push({ code, success: result.success, error: result.error });
    // Delay between country bans to avoid overwhelming the router
    if (countryCodes.indexOf(code) < countryCodes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return { success: results.every(r => r.success), results };
}

// ─── Bulk Unban ───────────────────────────────────────────

export async function unbanBulk(category: "malware" | "nomanual" | "country" | "all"): Promise<{
  success: boolean;
  error: string | null;
}> {
  const cmd = `/jffs/scripts/firewall unban ${category}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

// ─── Whitelist ──────────────────────────────────────────────

export async function whitelistIP(ip: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  const desc = comment || `Whitelisted via Skynet Glass`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall whitelist ip ${ip} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function removeWhitelistIP(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  const cmd = `/jffs/scripts/firewall whitelist remove entry ip ${ip}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function whitelistDomain(domain: string, comment?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }
  const desc = comment || `Whitelisted via Skynet Glass`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall whitelist domain ${domain} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function removeWhitelistDomain(domain: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return { success: false, error: `Invalid domain: ${domain}` };
  }
  const cmd = `/jffs/scripts/firewall whitelist remove domain ${domain}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function refreshWhitelist(): Promise<{
  success: boolean;
  error: string | null;
}> {
  const cmd = `/jffs/scripts/firewall whitelist refresh`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

// ─── Bulk Import ──────────────────────────────────────────

export async function bulkBanImport(
  entries: Array<{ address: string; type: "ip" | "range"; comment?: string }>
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{ address: string; type: "ip" | "range"; success: boolean; error: string | null }>;
}> {
  const results: Array<{ address: string; type: "ip" | "range"; success: boolean; error: string | null }> = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (entry.type === "ip") {
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entry.address)) {
        results.push({ address: entry.address, type: entry.type, success: false, error: "Invalid IP format" });
        skipped++;
        continue;
      }
    } else if (entry.type === "range") {
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(entry.address)) {
        results.push({ address: entry.address, type: entry.type, success: false, error: "Invalid CIDR format" });
        skipped++;
        continue;
      }
    }

    let result: { success: boolean; error: string | null };
    if (entry.type === "ip") {
      result = await banIP(entry.address, entry.comment);
    } else {
      result = await banRange(entry.address, entry.comment);
    }

    results.push({ address: entry.address, type: entry.type, ...result });
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    // Small delay between commands to avoid overwhelming the router
    if (entries.indexOf(entry) < entries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return { total: entries.length, succeeded, failed, skipped, results };
}

// ─── Syslog Fetcher ────────────────────────────────────────

/**
 * Fetch syslog from the router via SSH.
 * Directly reads and greps the log files — no more 2-step apply.cgi dance.
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

    const ssh = buildSSHConfig(config);
    const maxLines = options?.maxLines || 500;

    // Grep for Skynet patterns across all syslog files
    const cmd = `tail -n ${maxLines} /tmp/syslog.log 2>/dev/null | grep -iE "PRIOR|skynet|DROP|REJECT|BLOCKED|DENY"`;
    const result = await sshExec(ssh, cmd, { timeout: 15000 });

    return { raw: result.stdout, error: null };
  } catch (err: any) {
    return { raw: "", error: `Failed to fetch syslog: ${formatSSHError(err)}` };
  }
}

// ─── Fetch Ipset Data ──────────────────────────────────────

/**
 * Fetch ipset data from the router via SSH.
 * Reads the skynet.ipset file or runs ipset save directly.
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

    const ssh = buildSSHConfig(config);

    let cmd: string;
    if (options?.setName) {
      cmd = `grep '^add ${options.setName} ' /opt/share/skynet/skynet.ipset 2>/dev/null || ipset save ${options.setName} 2>/dev/null`;
    } else {
      cmd = `cat /opt/share/skynet/skynet.ipset 2>/dev/null || { ipset save Skynet-Blacklist; ipset save Skynet-BlockedRanges; ipset save Skynet-Whitelist; ipset save Skynet-WhitelistDomains; } 2>/dev/null`;
    }

    const result = await sshExec(ssh, cmd, { timeout: 60000 });
    return { raw: result.stdout, error: null };
  } catch (err: any) {
    return { raw: "", error: `Failed to fetch ipset data: ${formatSSHError(err)}` };
  }
}

// ─── DNS Sinkhole Data Fetchers ─────────────────────────────

/**
 * Fetch dnsmasq log from the router via SSH.
 */
export async function fetchDnsmasqLog(maxLines: number = 500): Promise<{
  raw: string;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { raw: "", error: "No router configuration found" };
    }

    const ssh = buildSSHConfig(config);
    const cmd = `tail -n ${maxLines} /opt/var/log/dnsmasq.log 2>/dev/null || echo "DNSMASQ_LOG_NOT_FOUND"`;
    const result = await sshExec(ssh, cmd, { timeout: 15000 });

    if (result.stdout.includes("DNSMASQ_LOG_NOT_FOUND")) {
      return { raw: "", error: "dnsmasq log not found — is dnsmasq logging enabled on the router?" };
    }

    return { raw: result.stdout, error: null };
  } catch (err: any) {
    return { raw: "", error: `Failed to fetch dnsmasq log: ${formatSSHError(err)}` };
  }
}

/**
 * Fetch DHCP leases from the router via SSH.
 */
export async function fetchDhcpLeases(): Promise<{
  raw: string;
  error: string | null;
}> {
  try {
    const config = await getSkynetConfig();
    if (!config) {
      return { raw: "", error: "No router configuration found" };
    }

    const ssh = buildSSHConfig(config);
    const cmd = `cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo "LEASES_NOT_FOUND"`;
    const result = await sshExec(ssh, cmd, { timeout: 10000 });

    if (result.stdout.includes("LEASES_NOT_FOUND")) {
      return { raw: "", error: "DHCP leases file not found" };
    }

    return { raw: result.stdout, error: null };
  } catch (err: any) {
    return { raw: "", error: `Failed to fetch DHCP leases: ${formatSSHError(err)}` };
  }
}

// ─── IOT Device Blocking ───────────────────────────────────

export async function iotBanDevice(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  if (!isPrivateIP(ip)) {
    return { success: false, error: `${ip} is not a LAN IP address` };
  }
  const cmd = `/jffs/scripts/firewall iot ban ${ip}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function iotUnbanDevice(ip: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  const cmd = `/jffs/scripts/firewall iot unban ${ip}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function fullBanDevice(ip: string, reason?: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return { success: false, error: `Invalid IP address: ${ip}` };
  }
  const desc = reason || `DeviceBlock via Skynet Glass ${new Date().toISOString().slice(0, 19)}`;
  const safeComment = desc.replace(/[;"'`$\\|&<>]/g, "").slice(0, 200);
  const cmd = `/jffs/scripts/firewall ban ip ${ip} "${safeComment}"`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function iotSetPorts(ports: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (ports !== "reset" && !/^\d{1,5}(,\d{1,5})*$/.test(ports)) {
    return { success: false, error: `Invalid port specification: ${ports}` };
  }
  const cmd = `/jffs/scripts/firewall iot ports ${ports}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
}

export async function iotSetProto(proto: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!['udp', 'tcp', 'all'].includes(proto)) {
    return { success: false, error: `Invalid protocol: ${proto}. Must be udp, tcp, or all` };
  }
  const cmd = `/jffs/scripts/firewall iot proto ${proto}`;
  const result = await executeRouterCommand(cmd);
  return { success: result.success, error: result.error };
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
  const cached = await getCachedStats();
  if (cached) {
    return {
      stats: cached.stats,
      fetchedAt: cached.fetchedAt,
      source: "cache",
      error: null,
    };
  }

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

// ─── Helpers ────────────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

/**
 * Format SSH errors into user-friendly messages.
 */
function formatSSHError(err: any): string {
  const msg = err.message || String(err);
  if (msg.includes("Authentication failed") || msg.includes("All configured authentication methods failed")) {
    return "SSH authentication failed — check username and password";
  }
  if (msg.includes("timed out")) {
    return "SSH connection timed out — check router IP and SSH port";
  }
  if (msg.includes("ECONNREFUSED")) {
    return "SSH connection refused — is SSH enabled on the router?";
  }
  if (msg.includes("EHOSTUNREACH") || msg.includes("ENETUNREACH")) {
    return "Router unreachable — check network connectivity";
  }
  return `SSH error: ${msg}`;
}
