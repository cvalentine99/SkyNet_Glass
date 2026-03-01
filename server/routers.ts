import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getSkynetConfig, upsertSkynetConfig } from "./skynet-db";
import {
  fetchStatsFromRouter,
  getStats,
  getPollingStatus,
  startPolling,
  stopPolling,
  triggerRouterGenstats,
} from "./skynet-fetcher";

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
          statsPath: z.string().default("/ext/skynet/stats.js"),
          pollingInterval: z.number().int().min(30).max(86400).default(300),
          pollingEnabled: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const config = await upsertSkynetConfig(input);

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

    /** Test connection to the router */
    testConnection: publicProcedure
      .input(
        z.object({
          routerAddress: z.string().min(1),
          routerPort: z.number().int().min(1).max(65535),
          routerProtocol: z.enum(["http", "https"]),
          statsPath: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const axios = (await import("axios")).default;
          const url = `${input.routerProtocol}://${input.routerAddress}:${input.routerPort}${input.statsPath}`;

          const response = await axios.get(url, {
            timeout: 10000,
            httpsAgent:
              input.routerProtocol === "https"
                ? new (await import("https")).Agent({ rejectUnauthorized: false })
                : undefined,
          });

          const content = response.data as string;
          // Check if it looks like a valid stats.js file
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
                  : err.response?.status === 404
                    ? "File not found (404)"
                    : `Error: ${err.message}`,
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
