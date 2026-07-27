import { Router } from "express";
import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import { getFeaturedDeals } from "./deals.service.js";

const router = Router();
const CACHE_KEY = "deals:featured";
const CACHE_TTL_SECONDS = 60; // דילים "חיים" מתעדכנים כל דקה, לא בכל בקשה

/**
 * GET /api/deals/featured — public, no authentication required.
 * Powers a homepage "hot deals right now" section that needs no search form.
 */
router.get("/featured", async (_req, res, next) => {
  try {
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) {
      res.json({ deals: JSON.parse(cached), cached: true });
      return;
    }

    const deals = await getFeaturedDeals(20);

    // Best-effort cache write — if Redis is briefly unavailable, we still
    // serve the real data, just without the speed-up next time.
    redis.set(CACHE_KEY, JSON.stringify(deals), "EX", CACHE_TTL_SECONDS).catch((err) => {
      logger.warn("Failed to cache featured deals", { error: err.message });
    });

    res.json({ deals, cached: false });
  } catch (err) {
    next(err);
  }
});

export default router;
