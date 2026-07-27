import { Redis } from "ioredis";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err: Error) => {
  logger.error("Redis connection error", { error: err.message });
});

redis.on("connect", () => {
  logger.info("Redis connected");
});
