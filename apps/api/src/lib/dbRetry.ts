import { logger } from "./logger.js";

/**
 * Neon's free tier suspends the database compute after a few minutes of
 * inactivity. The next query after a suspend sometimes hits the connection
 * while it's still waking up and fails once — retrying after a short delay
 * almost always succeeds. This wraps any async DB call with that retry.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 800): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = (err as Error).message ?? "";
    const isConnectionIssue = /can't reach database server|connection.*closed|timeout/i.test(message);

    if (retries > 0 && isConnectionIssue) {
      logger.warn("DB connection issue, retrying after wake-up delay", { retriesLeft: retries });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return withDbRetry(fn, retries - 1, delayMs);
    }
    throw err;
  }
}
