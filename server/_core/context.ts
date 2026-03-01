import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * LAN-only mode: always return a static local admin user.
 * No Manus OAuth required — every request is treated as authenticated.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user: User = {
    id: 1,
    openId: "local-admin",
    name: "Admin",
    email: "admin@skynet.local",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
