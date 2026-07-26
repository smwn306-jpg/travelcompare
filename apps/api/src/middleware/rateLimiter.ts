import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";
import { config } from "../config/index.js";
import { TooManyRequestsError } from "./errorHandler.js";

/**
 * Stricter limiter for authentication endpoints (login/register/refresh),
 * to slow down credential-stuffing and brute-force attempts. Backed by
 * Redis so the limit is shared across every API instance, not per-process.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  limit: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>,
  }),
  handler: () => {
    throw new TooManyRequestsError("Too many attempts. Please try again later.");
  },
});

/** A looser, general-purpose limiter for the rest of the API. */
export const generalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>,
  }),
  handler: () => {
    throw new TooManyRequestsError("Too many requests. Please slow down.");
  },
});
