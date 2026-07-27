import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./db/prisma.js";
import { redis } from "./lib/redis.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`🚀 TravelCompare API listening on port ${config.port} [${config.env}]`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  });

  // Force-exit if something hangs during shutdown.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});
