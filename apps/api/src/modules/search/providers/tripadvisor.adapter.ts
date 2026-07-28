import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { HotelSearchParams, NormalizedOffer, ProviderAdapter } from "./provider.interface.js";

const HOST = "tripadvisor16.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function headers() {
  return { "x-rapidapi-host": HOST, "x-rapidapi-key": config.rapidApi.key ?? "" };
}

/** שלב 1: מתרגם שם יעד ל-geoId הפנימי של TripAdvisor. */
async function resolveGeoId(query: string): Promise<string | null> {
  const url = `${BASE_URL}/api/v1/hotels/searchLocation?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("TripAdvisor location search failed", { status: res.status, body: body.slice(0, 500) });
    return null;
  }

  const data = (await res.json()) as any;
  const first = data?.data?.[0];
  return first?.geoId ?? first?.locationId ?? null;
}

/** שלב 2: חיפוש מלונות בפועל לפי geoId. */
async function searchByGeoId(geoId: string, params: HotelSearchParams): Promise<any[]> {
  const query = new URLSearchParams({
    geoId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    pageNumber: "1",
    currencyCode: params.currency ?? "ILS",
    adults: String(params.adults),
  });

  const url = `${BASE_URL}/api/v1/hotels/searchHotels?${query.toString()}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("TripAdvisor hotel search failed", { status: res.status, body: body.slice(0, 500) });
    return [];
  }

  const data = (await res.json()) as any;
  const results = data?.data?.data ?? [];
  logger.info("TripAdvisor raw response shape", {
    topLevelKeys: Object.keys(data ?? {}),
    firstResultSample: JSON.stringify(results[0] ?? null).slice(0, 1500),
  });
  return results;
}

function normalize(raw: any): NormalizedOffer {
  return {
    providerId: "tripadvisor",
    providerName: "TripAdvisor",
    hotelName: raw?.title ?? raw?.name ?? "מלון (שם לא זמין)",
    price: Number(String(raw?.priceForDisplay ?? raw?.price ?? "0").replace(/[^\d.]/g, "")),
    currency: raw?.currencySymbol ?? "ILS",
    reviewScore: raw?.bubbleRating?.rating ?? null,
    stars: raw?.starRating ?? null,
    imageUrl: raw?.photo?.images?.large?.url ?? null,
    deepLink: raw?.commerceInfo?.externalBooking?.url ?? null,
    address: raw?.secondaryInfo ?? null,
    raw,
  };
}

export const tripAdvisorAdapter: ProviderAdapter = {
  providerId: "tripadvisor",
  providerName: "TripAdvisor",

  async search(params: HotelSearchParams): Promise<NormalizedOffer[]> {
    if (!config.rapidApi.key) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const geoId = await resolveGeoId(params.destination);
    if (!geoId) {
      logger.warn("Could not resolve TripAdvisor geoId for", { destination: params.destination });
      return [];
    }

    const results = await searchByGeoId(geoId, params);
    return results.map(normalize).filter((o) => o.price > 0);
  },
};
