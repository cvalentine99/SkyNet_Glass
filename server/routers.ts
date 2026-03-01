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
