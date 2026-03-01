import type { Express, Request, Response } from "express";

/**
 * LAN-only mode: OAuth routes are disabled.
 * The callback endpoint simply redirects to the dashboard.
 * No external OAuth provider is contacted.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    // LAN-only: no OAuth flow, just redirect home
    res.redirect(302, "/");
  });
}
