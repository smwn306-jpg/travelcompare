import { PrismaClient } from "@prisma/client";
import { config } from "../config/index.js";

/**
 * A single shared Prisma instance. In dev, we attach it to globalThis to
 * survive tsx's hot-reload without exhausting Postgres connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: config.isProduction ? ["error", "warn"] : ["error", "warn", "query"],
  });

if (!config.isProduction) {
  global.__prisma__ = prisma;
}
