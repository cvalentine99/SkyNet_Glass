import { describe, expect, it } from "vitest";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for LAN-only authentication bypass.
 * Verifies that every request gets a local admin user without OAuth.
 */

function createMockOpts() {
  return {
    req: {
      protocol: "http",
      headers: {},
      query: {},
    } as any,
    res: {
      clearCookie: () => {},
      cookie: () => {},
      redirect: () => {},
    } as any,
  };
}

describe("LAN-only auth bypass", () => {
  describe("createContext", () => {
    it("always returns a non-null user", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      expect(ctx.user).not.toBeNull();
    });

    it("returns a user with admin role", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      expect(ctx.user!.role).toBe("admin");
    });

    it("returns a user with local-admin openId", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      expect(ctx.user!.openId).toBe("local-admin");
    });

    it("returns a user with expected fields", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      const user = ctx.user!;
      expect(user.id).toBe(1);
      expect(user.name).toBe("Admin");
      expect(user.email).toBe("admin@skynet.local");
      expect(user.loginMethod).toBe("local");
    });

    it("returns user without requiring any cookies or headers", async () => {
      const opts = {
        req: { protocol: "http", headers: {} } as any,
        res: { clearCookie: () => {}, cookie: () => {} } as any,
      };
      const ctx = await createContext(opts);
      expect(ctx.user).not.toBeNull();
      expect(ctx.user!.role).toBe("admin");
    });

    it("preserves req and res on context", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      expect(ctx.req).toBe(opts.req);
      expect(ctx.res).toBe(opts.res);
    });
  });

  describe("auth.me via tRPC", () => {
    it("returns the local admin user from auth.me", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      const caller = appRouter.createCaller(ctx);

      const me = await caller.auth.me();
      expect(me).not.toBeNull();
      expect(me!.openId).toBe("local-admin");
      expect(me!.role).toBe("admin");
      expect(me!.name).toBe("Admin");
    });
  });

  describe("auth.logout via tRPC", () => {
    it("returns success even in LAN-only mode", async () => {
      const clearedCookies: string[] = [];
      const ctx: TrpcContext = {
        user: {
          id: 1,
          openId: "local-admin",
          name: "Admin",
          email: "admin@skynet.local",
          loginMethod: "local",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "http", headers: {} } as any,
        res: {
          clearCookie: (name: string) => {
            clearedCookies.push(name);
          },
        } as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });

  describe("protected procedures accessible without OAuth", () => {
    it("can call skynet.getConfig without authentication error", async () => {
      const opts = createMockOpts();
      const ctx = await createContext(opts);
      const caller = appRouter.createCaller(ctx);

      // This should not throw UNAUTHORIZED since user is always present
      const result = await caller.skynet.getConfig();
      // Result can be null (no config saved yet) but should not throw
      expect(result === null || typeof result === "object").toBe(true);
    });
  });
});
