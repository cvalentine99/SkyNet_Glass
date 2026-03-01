import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  getSkynetConfig,
  upsertSkynetConfig,
  getStatsHistory,
  updateTargetLocation,
  getAlertConfig,
  upsertAlertConfig,
  getAlertHistory,
  getDevicePolicies,
  getDevicePolicyByIp,
  createDevicePolicy,
  updateDevicePolicyEnabled,
  deleteDevicePolicy,
} from "./skynet-db";
import {
  buildAuthHeaders,
  fetchStatsFromRouter,
  getStats,
  getPollingStatus,
  startPolling,
  stopPolling,
  triggerRouterGenstats,
  banIP,
  unbanIP,
  banRange,
  banDomain,
  banCountry,
  unbanRange,
  unbanDomain,
  unbanBulk,
  whitelistIP,
  whitelistDomain,
  removeWhitelistIP,
  removeWhitelistDomain,
  refreshWhitelist,
  fetchSyslog,
  fetchIpsetData,
  bulkBanImport,
  fetchDnsmasqLog,
  fetchDhcpLeases,
  iotBanDevice,
  iotUnbanDevice,
  fullBanDevice,
  iotSetPorts,
  iotSetProto,
} from "./skynet-fetcher";
import {
  parseIpsetLines,
  filterIpsetEntries,
  summarizeIpsetEntries,
  type IpsetFilter,
} from "./skynet-ipset-parser";
import { resolveIPs, getCacheSize, type GeoInfo } from "./geoip-resolver";
import {
  parseSyslogLines,
  filterLogEntries,
  summarizeLogEntries,
  type LogFilter,
} from "./skynet-syslog-parser";
import {
  parseDhcpLeases,
  extractSinkholedRequests,
  filterSinkholedRequests,
  summarizeSinkholedRequests,
} from "./skynet-dns-parser";

export const appRouter = router({
  system: systemRouter,

  // Keep auth for the template but it's not used for gating
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Skynet Router ─────────────────────────────────────────
  skynet: router({
    /** Get the current router connection configuration */
    getConfig: publicProcedure.query(async () => {
      const config = await getSkynetConfig();
      return config
        ? {
            routerAddress: config.routerAddress,
            routerPort: config.routerPort,
            routerProtocol: config.routerProtocol,
            statsPath: config.statsPath,
            pollingInterval: config.pollingInterval,
            pollingEnabled: !!config.pollingEnabled,
            username: config.username ?? "",
            hasPassword: !!config.password,
          }
        : null;
    }),

    /** Save router connection configuration */
    saveConfig: publicProcedure
      .input(
        z.object({
          routerAddress: z.string().min(1, "Router address is required"),
          routerPort: z.number().int().min(1).max(65535).default(80),
          routerProtocol: z.enum(["http", "https"]).default("http"),
          statsPath: z.string().default("/user/skynet/stats.js"),
          pollingInterval: z.number().int().min(30).max(86400).default(300),
          pollingEnabled: z.boolean().default(true),
          username: z.string().optional(),
          password: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const config = await upsertSkynetConfig({
          ...input,
          username: input.username || null,
          password: input.password || null,
        });

        // Restart polling with new settings
        if (input.pollingEnabled) {
          await startPolling();
        } else {
          stopPolling();
        }

        return { success: true, config };
      }),

    /** Get the latest stats (from cache or fresh fetch) */
    getStats: publicProcedure.query(async () => {
      return await getStats();
    }),

    /** Force a fresh fetch from the router */
    fetchNow: publicProcedure.mutation(async () => {
      const result = await fetchStatsFromRouter();
      return {
        success: !!result.stats,
        changed: result.changed,
        error: result.error,
      };
    }),

    /** Trigger the router to regenerate stats (runs genstats on the router) */
    triggerGenstats: publicProcedure.mutation(async () => {
      return await triggerRouterGenstats();
    }),

    /** Get the polling status */
    getStatus: publicProcedure.query(() => {
      return getPollingStatus();
    }),

    /** Start polling */
    startPolling: publicProcedure.mutation(async () => {
      await startPolling();
      return { success: true };
    }),

    /** Stop polling */
    stopPolling: publicProcedure.mutation(() => {
      stopPolling();
      return { success: true };
    }),

    // ─── Ban/Unban IP ─────────────────────────────────────────

    /**
     * Ban an IP address via Skynet.
     * Sends: /jffs/scripts/firewall ban ip <ip> "<comment>"
     * via the router's apply.cgi SystemCmd mechanism.
     */
    banIP: publicProcedure
      .input(
        z.object({
          ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, "Invalid IP address"),
          comment: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await banIP(input.ip, input.comment);
      }),

    /**
     * Unban an IP address via Skynet.
     * Sends: /jffs/scripts/firewall unban ip <ip>
     * via the router's apply.cgi SystemCmd mechanism.
     */
    unbanIP: publicProcedure
      .input(
        z.object({
          ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, "Invalid IP address"),
        })
      )
      .mutation(async ({ input }) => {
        return await unbanIP(input.ip);
      }),

    // ─── Advanced Ban ──────────────────────────────────────────

    /** Ban an IP range via Skynet */
    banRange: publicProcedure
      .input(
        z.object({
          range: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, "Invalid CIDR range"),
          comment: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await banRange(input.range, input.comment);
      }),

    /** Ban a domain via Skynet (resolves all IPs) */
    banDomain: publicProcedure
      .input(
        z.object({
          domain: z.string().min(3, "Domain is required"),
        })
      )
      .mutation(async ({ input }) => {
        return await banDomain(input.domain);
      }),

    /** Ban by country code(s) via Skynet */
    banCountry: publicProcedure
      .input(
        z.object({
          countryCodes: z.array(z.string().length(2)).min(1, "At least one country code required"),
        })
      )
      .mutation(async ({ input }) => {
        return await banCountry(input.countryCodes);
      }),

    // ─── Advanced Unban ────────────────────────────────────────

    /** Unban an IP range via Skynet */
    unbanRange: publicProcedure
      .input(
        z.object({
          range: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, "Invalid CIDR range"),
        })
      )
      .mutation(async ({ input }) => {
        return await unbanRange(input.range);
      }),

    /** Unban a domain via Skynet */
    unbanDomain: publicProcedure
      .input(
        z.object({
          domain: z.string().min(3, "Domain is required"),
        })
      )
      .mutation(async ({ input }) => {
        return await unbanDomain(input.domain);
      }),

    /** Bulk unban by category via Skynet */
    unbanBulk: publicProcedure
      .input(
        z.object({
          category: z.enum(["malware", "nomanual", "country", "all"]),
        })
      )
      .mutation(async ({ input }) => {
        return await unbanBulk(input.category);
      }),

    // ─── Whitelist ─────────────────────────────────────────────

    /** Add an IP to the Skynet whitelist */
    whitelistIP: publicProcedure
      .input(
        z.object({
          ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, "Invalid IP address"),
          comment: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await whitelistIP(input.ip, input.comment);
      }),

    /** Add a domain to the Skynet whitelist */
    whitelistDomain: publicProcedure
      .input(
        z.object({
          domain: z.string().min(3, "Domain is required"),
          comment: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await whitelistDomain(input.domain, input.comment);
      }),

    /** Remove an IP from the Skynet whitelist */
    removeWhitelistIP: publicProcedure
      .input(
        z.object({
          ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, "Invalid IP address"),
        })
      )
      .mutation(async ({ input }) => {
        return await removeWhitelistIP(input.ip);
      }),

    /** Remove a domain from the Skynet whitelist */
    removeWhitelistDomain: publicProcedure
      .input(
        z.object({
          domain: z.string().min(3, "Domain is required"),
        })
      )
      .mutation(async ({ input }) => {
        return await removeWhitelistDomain(input.domain);
      }),

    /** Refresh Skynet shared whitelists */
    refreshWhitelist: publicProcedure.mutation(async () => {
      return await refreshWhitelist();
    }),

    /**
     * Bulk ban import — accepts a list of IPs/ranges parsed from a text file.
     * Processes each entry sequentially with a 500ms delay between commands.
     * Max 500 entries per import to prevent router overload.
     */
    bulkBanImport: publicProcedure
      .input(
        z.object({
          entries: z.array(
            z.object({
              address: z.string().min(1),
              type: z.enum(["ip", "range"]),
              comment: z.string().max(200).optional(),
            })
          ).min(1).max(500),
        })
      )
      .mutation(async ({ input }) => {
        return await bulkBanImport(input.entries);
      }),

    // ─── Historical Stats ─────────────────────────────────────

    /**
     * Get historical stats snapshots for trend charts.
     * Returns data points within the specified time range.
     */
    getHistory: publicProcedure
      .input(
        z.object({
          hoursBack: z.number().int().min(1).max(8760).default(24), // max 1 year
        }).optional()
      )
      .query(async ({ input }) => {
        const hoursBack = input?.hoursBack ?? 24;
        const history = await getStatsHistory(hoursBack);
        return history.map(h => ({
          id: h.id,
          ipsBanned: h.ipsBanned,
          rangesBanned: h.rangesBanned,
          inboundBlocks: h.inboundBlocks,
          outboundBlocks: h.outboundBlocks,
          totalBlocks: h.totalBlocks,
          uniqueCountries: h.uniqueCountries,
          uniquePorts: h.uniquePorts,
          countryData: h.countryData as Array<{ code: string; country: string; blocks: number }> | null,
          snapshotAt: h.snapshotAt,
        }));
      }),

    // ─── Syslog / Log Viewer ─────────────────────────────────

    /**
     * Fetch and parse syslog entries from the router.
     * Returns structured log entries with optional filtering.
     *
     * API command: grep "BLOCKED" /tmp/syslog.log ... | tail -N
     * Executed via: POST /apply.cgi { SystemCmd: "..." }
     * Output read from: GET /cmdRet_check.htm
     */
    getLogs: publicProcedure
      .input(
        z.object({
          maxLines: z.number().int().min(50).max(2000).default(500),
          direction: z.enum(["INBOUND", "OUTBOUND", "INVALID", "IOT", "ALL"]).default("ALL"),
          ipSearch: z.string().optional(),
          protocol: z.string().optional(),
          port: z.number().int().min(1).max(65535).optional(),
          dstPort: z.number().int().min(1).max(65535).optional(),
        })
      )
      .query(async ({ input }) => {
        const result = await fetchSyslog({ maxLines: input.maxLines });

        if (result.error) {
          return {
            entries: [],
            summary: null,
            error: result.error,
            rawLineCount: 0,
          };
        }

        // Parse all lines
        const entries = parseSyslogLines(result.raw);

        // Apply filters
        const filter: LogFilter = {};
        if (input.direction && input.direction !== "ALL") filter.direction = input.direction;
        if (input.ipSearch) filter.ipSearch = input.ipSearch;
        if (input.protocol) filter.protocol = input.protocol;
        if (input.port) filter.port = input.port;
        if (input.dstPort) filter.dstPort = input.dstPort;

        const filteredEntries = filterLogEntries(entries, filter);
        const summary = summarizeLogEntries(entries);

        // Return newest first, limit to 500 for performance
        const sortedEntries = filteredEntries
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 500);

        return {
          entries: sortedEntries.map(e => ({
            lineNum: e.lineNum,
            timestamp: e.timestamp,
            date: e.date,
            hostname: e.hostname,
            direction: e.direction,
            inInterface: e.inInterface,
            outInterface: e.outInterface,
            srcIp: e.srcIp,
            dstIp: e.dstIp,
            length: e.length,
            ttl: e.ttl,
            protocol: e.protocol,
            srcPort: e.srcPort,
            dstPort: e.dstPort,
            tcpFlags: e.tcpFlags,
          })),
          summary,
          error: null,
          rawLineCount: entries.length,
        };
      }),

    // ─── Ipset Browser ─────────────────────────────────────

    /**
     * Fetch and parse ipset data from the router.
     * Returns blacklist entries (Skynet-Blacklist + Skynet-BlockedRanges).
     *
     * API command: grep '^add Skynet-Blacklist\|Skynet-BlockedRanges ' /opt/share/skynet/skynet.ipset
     * Executed via: POST /apply.cgi { SystemCmd: "..." }
     * Output read from: GET /cmdRet_check.htm
     */
    getBlacklist: publicProcedure
      .input(
        z.object({
          addressSearch: z.string().optional(),
          category: z.string().optional(),
          commentSearch: z.string().optional(),
          type: z.enum(["ip", "range", "all"]).default("all"),
        }).optional()
      )
      .query(async ({ input }) => {
        // Fetch blacklist + blocked ranges
        const result = await fetchIpsetData();

        if (result.error) {
          return { entries: [], summary: null, error: result.error };
        }

        // Parse only blacklist/blocked ranges
        const blacklistEntries = parseIpsetLines(result.raw, "Skynet-Blacklist");
        const rangeEntries = parseIpsetLines(result.raw, "Skynet-BlockedRanges");
        const allEntries = [...blacklistEntries, ...rangeEntries];

        // Apply filters
        const filter: IpsetFilter = {
          addressSearch: input?.addressSearch || undefined,
          category: input?.category || undefined,
          commentSearch: input?.commentSearch || undefined,
          type: input?.type || "all",
        };

        const filtered = filterIpsetEntries(allEntries, filter);
        const summary = summarizeIpsetEntries(allEntries);

        return {
          entries: filtered.slice(0, 2000),
          summary,
          error: null,
        };
      }),

    /**
     * Fetch and parse whitelist data from the router.
     * Returns whitelist entries (Skynet-Whitelist + Skynet-WhitelistDomains).
     */
    getWhitelist: publicProcedure
      .input(
        z.object({
          addressSearch: z.string().optional(),
          category: z.string().optional(),
          commentSearch: z.string().optional(),
          type: z.enum(["ip", "range", "all"]).default("all"),
        }).optional()
      )
      .query(async ({ input }) => {
        const result = await fetchIpsetData();

        if (result.error) {
          return { entries: [], summary: null, error: result.error };
        }

        const wlEntries = parseIpsetLines(result.raw, "Skynet-Whitelist");
        const wlDomainEntries = parseIpsetLines(result.raw, "Skynet-WhitelistDomains");
        const allEntries = [...wlEntries, ...wlDomainEntries];

        const filter: IpsetFilter = {
          addressSearch: input?.addressSearch || undefined,
          category: input?.category || undefined,
          commentSearch: input?.commentSearch || undefined,
          type: input?.type || "all",
        };

        const filtered = filterIpsetEntries(allEntries, filter);
        const summary = summarizeIpsetEntries(allEntries);

        return {
          entries: filtered.slice(0, 2000),
          summary,
          error: null,
        };
      }),

    // ─── GeoIP Enrichment ──────────────────────────────────

    /**
     * Resolve GeoIP data for a list of IP addresses.
     * Uses ip-api.com batch endpoint with server-side caching.
     * Returns a map of IP → { countryCode, country, city, isp, org, as, asname, flag }.
     */
    resolveGeoIP: publicProcedure
      .input(
        z.object({
          ips: z.array(z.string()).max(200),
        })
      )
      .query(async ({ input }) => {
        const results = await resolveIPs(input.ips);
        const geoMap: Record<string, GeoInfo> = {};
        results.forEach((geo, ip) => {
          geoMap[ip] = geo;
        });
        return {
          geoMap,
          cacheSize: getCacheSize(),
        };
      }),

    // ─── Target Location ──────────────────────────────────

    /** Get the configured target location for the threat map */
    getTargetLocation: publicProcedure.query(async () => {
      const config = await getSkynetConfig();
      return {
        lat: config?.targetLat ?? null,
        lng: config?.targetLng ?? null,
      };
    }),

    /** Save the target location (router's geographic position) */
    saveTargetLocation: publicProcedure
      .input(
        z.object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
      )
      .mutation(async ({ input }) => {
        await updateTargetLocation(input.lat, input.lng);
        return { success: true };
      }),

    // ─── Alert Configuration ─────────────────────────────

    /** Get the current alert configuration */
    getAlertConfig: publicProcedure.query(async () => {
      const config = await getAlertConfig();
      return config
        ? {
            alertsEnabled: !!config.alertsEnabled,
            blockSpikeThreshold: config.blockSpikeThreshold,
            blockSpikeEnabled: !!config.blockSpikeEnabled,
            newCountryEnabled: !!config.newCountryEnabled,
            newPortEnabled: !!config.newPortEnabled,
            countryMinBlocks: config.countryMinBlocks,
            cooldownMinutes: config.cooldownMinutes,
          }
        : null;
    }),

    /** Save alert configuration */
    saveAlertConfig: publicProcedure
      .input(
        z.object({
          alertsEnabled: z.boolean(),
          blockSpikeThreshold: z.number().int().min(10).max(100000).default(1000),
          blockSpikeEnabled: z.boolean().default(true),
          newCountryEnabled: z.boolean().default(true),
          newPortEnabled: z.boolean().default(false),
          countryMinBlocks: z.number().int().min(1).max(10000).default(50),
          cooldownMinutes: z.number().int().min(5).max(1440).default(30),
        })
      )
      .mutation(async ({ input }) => {
        const config = await upsertAlertConfig(input);
        return { success: true, config };
      }),

    /** Get alert history */
    getAlertHistory: publicProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(200).default(50),
        }).optional()
      )
      .query(async ({ input }) => {
        const history = await getAlertHistory(input?.limit ?? 50);
        return history;
      }),

    // ─── DNS Sinkhole ──────────────────────────────────────

    /**
     * Fetch and parse dnsmasq logs to identify sinkholed DNS requests.
     * Correlates query + config lines to show which devices tried to reach blocked domains.
     */
    getDnsSinkhole: publicProcedure
      .input(
        z.object({
          maxLines: z.number().int().min(100).max(5000).default(1000),
          deviceIp: z.string().optional(),
          domain: z.string().optional(),
          queryType: z.enum(["ALL", "A", "AAAA", "CNAME", "PTR", "MX", "TXT", "SRV", "SOA"]).default("ALL"),
        }).optional()
      )
      .query(async ({ input }) => {
        // Fetch dnsmasq log and DHCP leases in parallel
        const [dnsResult, leaseResult] = await Promise.all([
          fetchDnsmasqLog(input?.maxLines ?? 1000),
          fetchDhcpLeases(),
        ]);

        if (dnsResult.error && !dnsResult.raw) {
          return {
            entries: [],
            summary: null,
            devices: [],
            error: dnsResult.error,
          };
        }

        // Parse DHCP leases for device name resolution
        const leaseMap = leaseResult.raw
          ? parseDhcpLeases(leaseResult.raw)
          : undefined;

        // Extract sinkholed requests with device correlation
        const sinkholed = extractSinkholedRequests(dnsResult.raw, leaseMap);

        // Apply filters
        const filtered = filterSinkholedRequests(sinkholed, {
          deviceIp: input?.deviceIp || undefined,
          domain: input?.domain || undefined,
          queryType: input?.queryType || "ALL",
        });

        // Build summary
        const summary = summarizeSinkholedRequests(filtered);

        // Build device list from DHCP leases
        const devices: Array<{ ip: string; hostname: string; mac: string }> = [];
        if (leaseMap) {
          Array.from(leaseMap.values()).forEach((lease) => {
            devices.push({
              ip: lease.ip,
              hostname: lease.hostname,
              mac: lease.mac,
            });
          });
        }

        return {
          entries: filtered.slice(0, 2000),
          summary,
          devices,
          error: dnsResult.error,
        };
      }),

    /**
     * Fetch DHCP leases to list all known devices on the network.
     */
    getDevices: publicProcedure.query(async () => {
      const result = await fetchDhcpLeases();

      if (result.error) {
        return { devices: [], error: result.error };
      }

      const leaseMap = parseDhcpLeases(result.raw);
      const devices = Array.from(leaseMap.values()).map((lease) => ({
        ip: lease.ip,
        hostname: lease.hostname,
        mac: lease.mac,
        epoch: lease.epoch,
      }));

      return { devices, error: null };
    }),

    // ─── Device Policies ──────────────────────────────────

    /** List all device policies */
    getDevicePolicies: publicProcedure.query(async () => {
      const policies = await getDevicePolicies();
      return policies;
    }),

    /** Create a new device policy and apply it on the router */
    createDevicePolicy: publicProcedure
      .input(
        z.object({
          deviceIp: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),
          deviceName: z.string().optional(),
          macAddress: z.string().optional(),
          policyType: z.enum(["block_outbound", "block_all"]),
          reason: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Check if policy already exists for this IP
        const existing = await getDevicePolicyByIp(input.deviceIp);
        if (existing) {
          return { success: false, error: `Policy already exists for ${input.deviceIp}`, policy: existing };
        }

        // Apply on router
        let result;
        if (input.policyType === "block_outbound") {
          result = await iotBanDevice(input.deviceIp);
        } else {
          result = await fullBanDevice(input.deviceIp, input.reason);
        }

        if (!result.success) {
          return { success: false, error: result.error, policy: null };
        }

        // Save to DB
        const policy = await createDevicePolicy({
          deviceIp: input.deviceIp,
          deviceName: input.deviceName,
          macAddress: input.macAddress,
          policyType: input.policyType,
          reason: input.reason,
        });

        return { success: true, error: null, policy };
      }),

    /** Remove a device policy and unblock on the router */
    removeDevicePolicy: publicProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const policies = await getDevicePolicies();
        const policy = policies.find(p => p.id === input.id);
        if (!policy) {
          return { success: false, error: "Policy not found" };
        }

        // Unblock on router
        let result;
        if (policy.policyType === "block_outbound") {
          result = await iotUnbanDevice(policy.deviceIp);
        } else {
          // For full ban, unban the IP from Skynet blacklist
          result = await unbanIP(policy.deviceIp);
        }

        // Delete from DB regardless (user wants it removed)
        await deleteDevicePolicy(input.id);

        return { success: true, error: result.success ? null : result.error };
      }),

    /** Toggle a device policy enabled/disabled */
    toggleDevicePolicy: publicProcedure
      .input(z.object({
        id: z.number().int(),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const policies = await getDevicePolicies();
        const policy = policies.find(p => p.id === input.id);
        if (!policy) {
          return { success: false, error: "Policy not found" };
        }

        if (input.enabled) {
          // Re-enable: apply block on router
          const result = policy.policyType === "block_outbound"
            ? await iotBanDevice(policy.deviceIp)
            : await fullBanDevice(policy.deviceIp, policy.reason ?? undefined);
          if (!result.success) {
            return { success: false, error: result.error };
          }
        } else {
          // Disable: unblock on router
          const result = policy.policyType === "block_outbound"
            ? await iotUnbanDevice(policy.deviceIp)
            : await unbanIP(policy.deviceIp);
          if (!result.success) {
            return { success: false, error: result.error };
          }
        }

        await updateDevicePolicyEnabled(input.id, input.enabled);
        return { success: true, error: null };
      }),

    /** Set allowed ports for IOT-blocked devices */
    iotSetPorts: publicProcedure
      .input(z.object({
        ports: z.string().regex(/^(reset|\d{1,5}(,\d{1,5})*)$/),
      }))
      .mutation(async ({ input }) => {
        return iotSetPorts(input.ports);
      }),

    /** Set allowed protocol for IOT-blocked devices */
    iotSetProto: publicProcedure
      .input(z.object({
        proto: z.enum(["udp", "tcp", "all"]),
      }))
      .mutation(async ({ input }) => {
        return iotSetProto(input.proto);
      }),

    // ─── Network Topology ──────────────────────────────────

    /**
     * Get aggregated topology data: DHCP devices + device policies + DNS activity summary.
     * Returns a list of network nodes for the topology map.
     */
    getTopology: publicProcedure.query(async () => {
      // Get DHCP leases for device discovery
      let devices: Array<{ ip: string; hostname: string; mac: string; expires: string }> = [];
      try {
        const leaseResult = await fetchDhcpLeases();
        if (leaseResult.raw) {
          const leaseLines = leaseResult.raw.trim().split("\n").filter(Boolean);
          for (const line of leaseLines) {
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
        }
      } catch {
        // No DHCP data available
      }

      // Get device policies
      const policies = await getDevicePolicies();
      const policyMap = new Map(policies.map(p => [p.deviceIp, p]));

      // Get DNS sinkhole summary per device
      let dnsHitsMap = new Map<string, number>();
      try {
        const dnsResult = await fetchDnsmasqLog(500);
        if (dnsResult.raw) {
          const { extractSinkholedRequests } = await import("./skynet-dns-parser");
          const sinkholed = extractSinkholedRequests(dnsResult.raw);
          for (const entry of sinkholed) {
            dnsHitsMap.set(entry.clientIp, (dnsHitsMap.get(entry.clientIp) || 0) + 1);
          }
        }
      } catch {
        // No DNS data available
      }

      // Build topology nodes
      const nodes = devices.map(d => {
        const policy = policyMap.get(d.ip);
        const dnsHits = dnsHitsMap.get(d.ip) || 0;
        let status: "normal" | "iot_blocked" | "full_blocked" | "dns_active" = "normal";
        if (policy?.enabled) {
          status = policy.policyType === "block_outbound" ? "iot_blocked" : "full_blocked";
        } else if (dnsHits > 0) {
          status = "dns_active";
        }
        return {
          ip: d.ip,
          hostname: d.hostname,
          mac: d.mac,
          status,
          policyType: policy?.policyType ?? null,
          policyEnabled: policy?.enabled ? true : false,
          policyReason: policy?.reason ?? null,
          dnsHits,
        };
      });

      // Also include devices from policies that aren't in DHCP leases
      for (const policy of policies) {
        if (!devices.find(d => d.ip === policy.deviceIp)) {
          nodes.push({
            ip: policy.deviceIp,
            hostname: policy.deviceName || "Unknown",
            mac: policy.macAddress || "Unknown",
            status: policy.enabled
              ? (policy.policyType === "block_outbound" ? "iot_blocked" as const : "full_blocked" as const)
              : "normal" as const,
            policyType: policy.policyType,
            policyEnabled: policy.enabled ? true : false,
            policyReason: policy.reason ?? null,
            dnsHits: dnsHitsMap.get(policy.deviceIp) || 0,
          });
        }
      }

      return {
        nodes,
        totalDevices: nodes.length,
        blockedDevices: nodes.filter(n => n.status === "iot_blocked" || n.status === "full_blocked").length,
        dnsActiveDevices: nodes.filter(n => n.dnsHits > 0).length,
      };
    }),

    // ─── Config Export / Import ──────────────────────────────

    /** Export all configuration as a JSON backup */
    exportConfig: publicProcedure.query(async () => {
      const config = await getSkynetConfig();
      const alertCfg = await getAlertConfig();
      const policies = await getDevicePolicies();

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
    }),

    /** Import configuration from a JSON backup */
    importConfig: publicProcedure
      .input(z.object({
        routerConfig: z.object({
          routerAddress: z.string(),
          routerPort: z.number(),
          routerProtocol: z.string(),
          statsPath: z.string(),
          pollingInterval: z.number(),
          pollingEnabled: z.any(),
          targetLat: z.number().nullable().optional(),
          targetLng: z.number().nullable().optional(),
        }).nullable().optional(),
        alertConfig: z.object({
          alertsEnabled: z.any(),
          blockSpikeThreshold: z.number(),
          blockSpikeEnabled: z.any(),
          newCountryEnabled: z.any(),
          newPortEnabled: z.any(),
          countryMinBlocks: z.number(),
          cooldownMinutes: z.number(),
        }).nullable().optional(),
        devicePolicies: z.array(z.object({
          deviceIp: z.string(),
          deviceName: z.string().nullable().optional(),
          macAddress: z.string().nullable().optional(),
          policyType: z.enum(["block_outbound", "block_all"]),
          enabled: z.any(),
          reason: z.string().nullable().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const results = { routerConfig: false, alertConfig: false, devicePolicies: 0 };

        // Import router config
        if (input.routerConfig) {
          try {
            await upsertSkynetConfig({
              routerAddress: input.routerConfig.routerAddress,
              routerPort: input.routerConfig.routerPort,
              routerProtocol: input.routerConfig.routerProtocol,
              statsPath: input.routerConfig.statsPath,
              pollingInterval: input.routerConfig.pollingInterval,
              pollingEnabled: !!input.routerConfig.pollingEnabled,
              targetLat: input.routerConfig.targetLat ?? undefined,
              targetLng: input.routerConfig.targetLng ?? undefined,
            });
            results.routerConfig = true;
          } catch { /* skip */ }
        }

        // Import alert config
        if (input.alertConfig) {
          try {
            await upsertAlertConfig({
              alertsEnabled: !!input.alertConfig.alertsEnabled,
              blockSpikeThreshold: input.alertConfig.blockSpikeThreshold,
              blockSpikeEnabled: !!input.alertConfig.blockSpikeEnabled,
              newCountryEnabled: !!input.alertConfig.newCountryEnabled,
              newPortEnabled: !!input.alertConfig.newPortEnabled,
              countryMinBlocks: input.alertConfig.countryMinBlocks,
              cooldownMinutes: input.alertConfig.cooldownMinutes,
            });
            results.alertConfig = true;
          } catch { /* skip */ }
        }

        // Import device policies (skip duplicates)
        if (input.devicePolicies) {
          for (const p of input.devicePolicies) {
            try {
              const existing = await getDevicePolicyByIp(p.deviceIp);
              if (!existing) {
                await createDevicePolicy({
                  deviceIp: p.deviceIp,
                  deviceName: p.deviceName,
                  macAddress: p.macAddress,
                  policyType: p.policyType,
                  reason: p.reason,
                });
                results.devicePolicies++;
              }
            } catch { /* skip individual failures */ }
          }
        }

        return { success: true, results };
      }),

    /** Test connection to the router */
    testConnection: publicProcedure
      .input(
        z.object({
          routerAddress: z.string().min(1),
          routerPort: z.number().int().min(1).max(65535),
          routerProtocol: z.enum(["http", "https"]),
          statsPath: z.string(),
          username: z.string().optional(),
          password: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const axios = (await import("axios")).default;
          const url = `${input.routerProtocol}://${input.routerAddress}:${input.routerPort}${input.statsPath}`;

          const authHeaders = buildAuthHeaders(input.username, input.password);

          const response = await axios.get(url, {
            timeout: 10000,
            httpsAgent:
              input.routerProtocol === "https"
                ? new (await import("https")).Agent({ rejectUnauthorized: false })
                : undefined,
            headers: {
              ...authHeaders,
            },
          });

          const content = response.data as string;
          const isValid =
            content.includes("SetBLCount1") ||
            content.includes("DataInPortHits") ||
            content.includes("SetHits1");

          return {
            success: true,
            isValidStatsFile: isValid,
            contentLength: content.length,
            error: isValid
              ? null
              : "File was fetched but doesn't appear to be a valid Skynet stats.js",
          };
        } catch (err: any) {
          return {
            success: false,
            isValidStatsFile: false,
            contentLength: 0,
            error:
              err.code === "ECONNREFUSED"
                ? "Connection refused"
                : err.code === "ETIMEDOUT"
                  ? "Connection timed out"
                  : err.response?.status === 401
                    ? "Authentication failed — check username/password"
                    : err.response?.status === 403
                      ? "Access forbidden — check credentials"
                      : err.response?.status === 404
                        ? "File not found (404)"
                        : `Error: ${err.message}`,
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
