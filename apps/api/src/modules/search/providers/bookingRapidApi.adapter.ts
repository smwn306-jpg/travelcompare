import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { HotelSearchParams, NormalizedOffer, ProviderAdapter } from "./provider.interface.js";

const BASE_URL = `https://${config.rapidApi.host}`;

function rapidApiHeaders() {
  return {
    "x-rapidapi-host": config.rapidApi.host,
    "x-rapidapi-key": config.rapidApi.key ?? "",
  };
}

/**
 * שלב 1: RapidAPI (booking-com15) לא מקבל שם עיר בחיפוש המלונות ישירות —
 * צריך קודם "לתרגם" אותו ל-dest_id הפנימי שלהם דרך searchDestination.
 */
async function resolveDestinationId(query: string): Promise<string | null> {
  const url = `${BASE_URL}/api/v1/hotels/searchDestination?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: rapidApiHeaders() });

  if (!res.ok) {
    logger.warn("Booking RapidAPI destination search failed", { status: res.status });
    return null;
  }

  const data = (await res.json()) as any;
  // הערה: לא הצלחתי לבדוק בפועל את הצורה המדויקת של התשובה (אין לי גישה
  // לאינטרנט מהסביבה שבה אני עובד) — data?.data?.[0]?.dest_id הוא הניחוש
  // הכי סביר לפי המבנה המוכר של ה-wrapper הזה. אם זה שגוי, הלוג למטה
  // (deals:booking-raw בקונסול) יראה את הצורה האמיתית לתיקון מהיר.
  const first = data?.data?.[0];
  return first?.dest_id ?? first?.destId ?? null;
}

/**
 * שלב 2: חיפוש מלונות בפועל, אחרי שיש לנו dest_id.
 */
async function searchHotelsByDestId(
  destId: string,
  params: HotelSearchParams
): Promise<any[]> {
  const query = new URLSearchParams({
    dest_id: destId,
    search_type: "CITY",
    arrival_date: params.checkIn,
    departure_date: params.checkOut,
    adults: String(params.adults),
    children_age: params.children > 0 ? Array(params.children).fill("10").join(",") : "0",
    room_qty: "1",
    page_number: "1",
    units: "metric",
    temperature_unit: "c",
    languagecode: "he",
    currency_code: params.currency ?? "ILS",
  });

  const url = `${BASE_URL}/api/v1/hotels/searchHotels?${query.toString()}`;
  const res = await fetch(url, { headers: rapidApiHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("Booking RapidAPI hotel search failed", { status: res.status, body: body.slice(0, 500) });
    return [];
  }

  const data = (await res.json()) as any;
  const hotels = data?.data?.hotels ?? data?.data?.result ?? [];
  logger.info("Booking RapidAPI raw response shape", {
    topLevelKeys: Object.keys(data ?? {}),
    dataKeys: Object.keys(data?.data ?? {}),
    firstHotelSample: JSON.stringify(hotels[0] ?? null).slice(0, 1500),
  });
  return hotels;
}

function normalizeHotel(raw: any, params: HotelSearchParams): NormalizedOffer {
  // כאן גם — שדות משוערים לפי המבנה המוכר. ראה הערת הלוג למעלה.
  const property = raw?.property ?? raw;
  return {
    providerId: "booking-rapidapi",
    providerName: "Booking.com",
    hotelName: property?.name ?? "מלון (שם לא זמין)",
    price: Number(property?.priceBreakdown?.grossPrice?.value ?? property?.price ?? 0),
    originalPrice: property?.priceBreakdown?.strikethroughPrice?.value
      ? Number(property.priceBreakdown.strikethroughPrice.value)
      : null,
    currency: property?.priceBreakdown?.grossPrice?.currency ?? "ILS",
    reviewScore: property?.reviewScore ?? null,
    stars: property?.propertyClass ?? property?.stars ?? null,
    imageUrl: property?.photoUrls?.[0] ?? raw?.hotel_id_photo_url ?? null,
    // אין לנו גישה רשמית ל-Booking Affiliate API (דורשת אישור עסקי), אז אין
    // לנו קישור ישיר מובטח לדף המלון המדויק. שימוש רק בשם המלון (בלי לערבב
    // עם שם העיר בעברית, שבלבל את מנוע החיפוש של Booking בגרסה הקודמת) +
    // תאריכים + מספר נוסעים — זה נותן ל-Booking הכי הרבה סיכוי להציג את
    // אותו מלון בדיוק כתוצאה המרכזית.
    deepLink: property?.name
      ? `https://www.booking.com/searchresults.html?${new URLSearchParams({
          ss: property.name,
          checkin: property?.checkinDate ?? "",
          checkout: property?.checkoutDate ?? "",
          group_adults: String(params.adults ?? 2),
          group_children: String(params.children ?? 0),
          no_rooms: "1",
        }).toString()}`
      : null,
    address: property?.wishlistName ?? property?.address ?? null,
    raw,
  };
}

export const bookingRapidApiAdapter: ProviderAdapter = {
  providerId: "booking-rapidapi",
  providerName: "Booking.com",

  async search(params: HotelSearchParams): Promise<NormalizedOffer[]> {
    if (!config.rapidApi.key) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const destId = await resolveDestinationId(params.destination);
    if (!destId) {
      logger.warn("Could not resolve destination id for", { destination: params.destination });
      return [];
    }

    const hotels = await searchHotelsByDestId(destId, params);
    return hotels.map((h: any) => normalizeHotel(h, params)).filter((offer) => offer.price > 0);
  },
};
