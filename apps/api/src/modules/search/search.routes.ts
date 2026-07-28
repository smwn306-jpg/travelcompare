import { Router } from "express";
import { z } from "zod";
import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import { validate } from "../../middleware/validate.js";
import { bookingRapidApiAdapter } from "./providers/bookingRapidApi.adapter.js";
import { hotels4Adapter } from "./providers/hotels4.adapter.js";
import { tripAdvisorAdapter } from "./providers/tripadvisor.adapter.js";
import { airbnbAdapter } from "./providers/airbnb.adapter.js";
import { googleFlightsAdapter } from "./providers/googleFlights.adapter.js";
import type { NormalizedOffer } from "./providers/provider.interface.js";

const router = Router();
const CACHE_TTL_SECONDS = 300; // חיפוש חי — קאש ל-5 דקות, לא לכל בקשה

// כל הספקים הפעילים לחיפוש מלונות/אירוח. הוספת ספק חדש = שורה אחת כאן.
const HOTEL_PROVIDERS = [bookingRapidApiAdapter, hotels4Adapter, tripAdvisorAdapter, airbnbAdapter];

const searchQuerySchema = z.object({
  destination: z.string().min(2),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(20).default(2),
  children: z.coerce.number().int().min(0).max(20).default(0),
});

/**
 * GET /api/search/hotels?destination=...&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2&children=0
 * ציבורי, לא דורש התחברות. מריץ את כל ספקי המלונות/אירוח במקביל —
 * ספק אחד שנופל לא מפיל את השאר (Promise.allSettled).
 */
router.get("/hotels", validate(searchQuerySchema, "query"), async (req, res) => {
  const params = req.query as unknown as z.infer<typeof searchQuerySchema>;
  const cacheKey = `search:hotels:${JSON.stringify(params)}`;

  try {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      res.json({ offers: JSON.parse(cached), cached: true, source: "live" });
      return;
    }

    if (!process.env.RAPIDAPI_KEY) {
      res.status(503).json({
        error: {
          code: "SEARCH_NOT_CONFIGURED",
          message: "חיפוש חי עדיין לא מוגדר בשרת (חסר מפתח RapidAPI)",
        },
      });
      return;
    }

    const settled = await Promise.allSettled(HOTEL_PROVIDERS.map((p) => p.search(params)));

    const offers: NormalizedOffer[] = [];
    settled.forEach((result, i) => {
      const provider = HOTEL_PROVIDERS[i];
      if (result.status === "fulfilled") {
        offers.push(...result.value);
      } else {
        logger.warn(`Provider ${provider.providerId} failed`, { error: String(result.reason) });
      }
    });

    if (offers.length === 0) {
      res.status(502).json({
        error: { code: "PROVIDER_ERROR", message: "אף ספק לא החזיר תוצאות כרגע, נסה שוב בעוד רגע" },
      });
      return;
    }

    offers.sort((a, b) => a.price - b.price);

    redis.set(cacheKey, JSON.stringify(offers), "EX", CACHE_TTL_SECONDS).catch((err) => {
      logger.warn("Failed to cache hotel search results", { error: err.message });
    });

    res.json({ offers, cached: false, source: "live" });
  } catch (err) {
    const error = err as Error;
    logger.error("Hotel search failed", { error: error.message });
    res.status(502).json({
      error: { code: "PROVIDER_ERROR", message: "השירות לא זמין כרגע, נסה שוב בעוד רגע" },
    });
  }
});

const flightQuerySchema = z.object({
  departureId: z.string().min(3).max(4),
  arrivalId: z.string().min(3).max(4),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "departureDate must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(20).default(1),
});

/**
 * GET /api/search/flights?departureId=TLV&arrivalId=JFK&departureDate=YYYY-MM-DD&adults=1
 */
router.get("/flights", validate(flightQuerySchema, "query"), async (req, res) => {
  const params = req.query as unknown as z.infer<typeof flightQuerySchema>;
  const cacheKey = `search:flights:${JSON.stringify(params)}`;

  try {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      res.json({ offers: JSON.parse(cached), cached: true, source: "live" });
      return;
    }

    if (!process.env.RAPIDAPI_KEY) {
      res.status(503).json({
        error: { code: "SEARCH_NOT_CONFIGURED", message: "חיפוש טיסות עדיין לא מוגדר בשרת (חסר מפתח RapidAPI)" },
      });
      return;
    }

    const offers = await googleFlightsAdapter.search(params);

    if (offers.length === 0) {
      res.status(502).json({
        error: { code: "PROVIDER_ERROR", message: "לא נמצאו טיסות כרגע, נסה שוב בעוד רגע" },
      });
      return;
    }

    redis.set(cacheKey, JSON.stringify(offers), "EX", CACHE_TTL_SECONDS).catch((err) => {
      logger.warn("Failed to cache flight search results", { error: err.message });
    });

    res.json({ offers, cached: false, source: "live" });
  } catch (err) {
    const error = err as Error;
    logger.error("Flight search failed", { error: error.message });
    res.status(502).json({
      error: { code: "PROVIDER_ERROR", message: "השירות לא זמין כרגע, נסה שוב בעוד רגע" },
    });
  }
});

export default router;
