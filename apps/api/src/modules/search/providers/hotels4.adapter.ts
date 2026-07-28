import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { HotelSearchParams, NormalizedOffer, ProviderAdapter } from "./provider.interface.js";

const HOST = "hotels4.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function headers() {
  return { "x-rapidapi-host": HOST, "x-rapidapi-key": config.rapidApi.key ?? "" };
}

/** שלב 1: מתרגם שם יעד לטקסט חופשי ל-regionId הפנימי של Hotels.com. */
async function resolveRegionId(query: string): Promise<string | null> {
  const url = `${BASE_URL}/locations/v2/search?query=${encodeURIComponent(query)}&locale=he_IL`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    logger.warn("Hotels4 location search failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as any;
  // ניחוש סביר לפי המבנה המוכר — ראה הערה כללית ב-search.routes.ts
  const suggestion = data?.suggestions?.find((s: any) => s?.group === "CITY_GROUP") ?? data?.suggestions?.[0];
  const entity = suggestion?.entities?.[0];
  return entity?.destinationId ?? entity?.geoId ?? null;
}

/** שלב 2: חיפוש מלונות בפועל לפי regionId. */
async function searchByRegion(regionId: string, params: HotelSearchParams): Promise<any[]> {
  const query = new URLSearchParams({
    destinationId: regionId,
    pageNumber: "1",
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults1: String(params.adults),
    currency: params.currency ?? "ILS",
    locale: "he_IL",
    sortOrder: "PRICE",
  });

  const url = `${BASE_URL}/properties/list?${query.toString()}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("Hotels4 property search failed", { status: res.status, body: body.slice(0, 500) });
    return [];
  }

  const data = (await res.json()) as any;
  const results = data?.data?.body?.searchResults?.results ?? [];
  logger.info("Hotels4 raw response shape", {
    topLevelKeys: Object.keys(data ?? {}),
    firstResultSample: JSON.stringify(results[0] ?? null).slice(0, 1500),
  });
  return results;
}

function normalize(raw: any): NormalizedOffer {
  return {
    providerId: "hotels4",
    providerName: "Hotels.com",
    hotelName: raw?.name ?? "מלון (שם לא זמין)",
    price: Number(raw?.ratePlan?.price?.exactCurrent ?? 0),
    currency: raw?.ratePlan?.price?.currencyInfo?.code ?? "ILS",
    reviewScore: raw?.guestReviews?.rating ? Number(raw.guestReviews.rating) : null,
    stars: raw?.starRating ?? null,
    imageUrl: raw?.optimizedThumbUrls?.srpDesktop ?? null,
    deepLink: raw?.id ? `https://www.hotels.com/ho${raw.id}` : null,
    address: raw?.address?.streetAddress ?? null,
    raw,
  };
}

export const hotels4Adapter: ProviderAdapter = {
  providerId: "hotels4",
  providerName: "Hotels.com",

  async search(params: HotelSearchParams): Promise<NormalizedOffer[]> {
    if (!config.rapidApi.key) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const regionId = await resolveRegionId(params.destination);
    if (!regionId) {
      logger.warn("Could not resolve Hotels4 region id for", { destination: params.destination });
      return [];
    }

    const results = await searchByRegion(regionId, params);
    return results.map(normalize).filter((o) => o.price > 0);
  },
};
