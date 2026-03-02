import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3006): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3006");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Database health check
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await (db as any).execute("SELECT 1");
        console.log("[Database] Connection OK");
      } else {
        console.error("[FATAL] Cannot connect to MySQL. Check DATABASE_URL in .env.",
          process.env.DATABASE_URL ? "(set but may be invalid)" : "(NOT SET)");
      }
    } catch (err: any) {
      console.error(`[FATAL] Cannot connect to MySQL. Error: ${err.message}`);
      console.error("[FATAL] Fix: run 'sudo bash install.sh' or set DATABASE_URL in .env");
    }

    // Auto-start Skynet polling if a router config exists
    try {
      const { startPolling } = await import("../skynet-fetcher");
      await startPolling();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("No router configuration")) {
        console.log("[Skynet] Auto-start polling skipped: no router config saved yet. Go to /settings to configure.");
      } else {
        console.error(`[Skynet] Auto-start polling FAILED: ${msg}`);
        console.error("[Skynet] Polling will not run until the issue is resolved. Check SSH credentials and router connectivity.");
      }
    }
  });
}

startServer().catch(console.error);
