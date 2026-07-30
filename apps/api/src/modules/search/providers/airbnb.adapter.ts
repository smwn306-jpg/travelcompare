import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { HotelSearchParams, NormalizedOffer, ProviderAdapter } from "./provider.interface.js";

const HOST = "airbnb19.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function headers() {
  return { "x-rapidapi-host": HOST, "x-rapidapi-key": config.rapidApi.key ?? "" };
}

/**
 * Airbnb מזהה מיקום לפי placeId של Google Maps, לא שם עיר חופשי — צריך
 * שלב תרגום נפרד. ה-wrapper הזה חושף endpoint autoComplete לכך.
 */
async function resolvePlaceId(query: string): Promise<string | null> {
  // ה-endpoint הקודם (/api/v2/autoCompleteSuggestions) אושר כשגוי בלוגים
  // (404 "Endpoint does not exist"). זה השם הנפוץ ביותר לאותה פונקציה
  // ב-wrapper הזה — אם זה עדיין שגוי, הלוג יראה שוב את השגיאה המדויקת.
  const url = `${BASE_URL}/api/v1/searchLocation?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("Airbnb autocomplete failed", { status: res.status, body: body.slice(0, 500) });
    return null;
  }

  const data = (await res.json()) as any;
  const first = data?.data?.[0] ?? data?.results?.[0];
  return first?.placeId ?? first?.id ?? null;
}

async function searchByPlaceId(placeId: string, params: HotelSearchParams): Promise<any[]> {
  const query = new URLSearchParams({
    placeId,
    adults: String(params.adults),
    checkin: params.checkIn,
    checkout: params.checkOut,
    currency: params.currency ?? "ILS",
    ib: "false",
    guestFavorite: "false",
  });

  const url = `${BASE_URL}/api/v2/searchPropertyByPlaceId?${query.toString()}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("Airbnb property search failed", { status: res.status, body: body.slice(0, 500) });
    return [];
  }

  const data = (await res.json()) as any;
  const results = data?.data?.list ?? data?.data ?? [];
  logger.info("Airbnb raw response shape", {
    topLevelKeys: Object.keys(data ?? {}),
    firstResultSample: JSON.stringify(Array.isArray(results) && results[0] ? results[0] : null).slice(0, 1500),
  });
  return results;
}

function normalize(raw: any): NormalizedOffer {
  const listing = raw?.listing ?? raw;
  return {
    providerId: "airbnb",
    providerName: "Airbnb",
    hotelName: listing?.name ?? listing?.title ?? "וילה / דירה (שם לא זמין)",
    originalPrice: null,
    price: Number(raw?.pricingQuote?.rate?.amount ?? raw?.price?.total?.amount ?? 0),
    currency: raw?.pricingQuote?.rate?.currency ?? "ILS",
    reviewScore: listing?.avgRating ?? null,
    stars: null, // אין ל-Airbnb דירוג כוכבים במובן המלונאי
    imageUrl: listing?.contextualPictures?.[0]?.picture ?? listing?.pictureUrl ?? null,
    deepLink: listing?.id ? `https://www.airbnb.com/rooms/${listing.id}` : null,
    address: listing?.localizedCity ?? null,
    raw,
  };
}

export const airbnbAdapter: ProviderAdapter = {
  providerId: "airbnb",
  providerName: "Airbnb",

  async search(params: HotelSearchParams): Promise<NormalizedOffer[]> {
    if (!config.rapidApi.key) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const placeId = await resolvePlaceId(params.destination);
    if (!placeId) {
      logger.warn("Could not resolve Airbnb placeId for", { destination: params.destination });
      return [];
    }

    const results = await searchByPlaceId(placeId, params);
    return results.map(normalize).filter((o) => o.price > 0);
  },
};
