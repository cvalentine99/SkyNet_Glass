/**
 * Environment variables for Skynet Glass (LAN-only mode).
 *
 * Required (bare metal):
 *   NODE_ENV, PORT, DATABASE_URL, JWT_SECRET
 *
 * Optional (notifications — only needed if you want push alerts):
 *   BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY
 */
export const ENV = {
  // ─── Required ──────────────────────────────────────────
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // ─── Optional (notifications / LLM / storage) ─────────
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // ─── Deprecated (kept for compatibility, not required) ─
  appId: process.env.VITE_APP_ID ?? "skynet-glass",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};
