import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { FlightSearchParams, FlightProviderAdapter, NormalizedFlightOffer } from "./provider.interface.js";

const HOST = "google-flights2.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function headers() {
  return { "x-rapidapi-host": HOST, "x-rapidapi-key": config.rapidApi.key ?? "" };
}

function normalizeFlight(raw: any, params: FlightSearchParams): NormalizedFlightOffer {
  // מבנה מאושר מתוך תשובה אמיתית (ולא ניחוש יותר):
  // raw = { departure_time, arrival_time, flights: [{ departure_airport: { airport_code, airport_name, time }, arrival_airport: {...}, airline, flight_number }], price, stops, booking_token }
  const firstLeg = raw?.flights?.[0];
  return {
    providerId: "google-flights",
    providerName: "Google Flights",
    airline: firstLeg?.airline ?? null,
    departureAirport: firstLeg?.departure_airport?.airport_code ?? params.departureId,
    arrivalAirport: firstLeg?.arrival_airport?.airport_code ?? params.arrivalId,
    departureTime: raw?.departure_time ?? null,
    arrivalTime: raw?.arrival_time ?? null,
    price: Number(raw?.price ?? 0),
    currency: raw?.currency ?? "USD",
    stops: typeof raw?.stops === "number" ? raw.stops : Array.isArray(raw?.flights) ? raw.flights.length - 1 : null,
    // booking_token הוא לא כתובת שאפשר לפתוח ישירות (דורש קריאת API נוספת) —
    // קישור חיפוש אמיתי בגוגל טיסות הוא אמין הרבה יותר, בדיוק כמו שעשינו ל-Booking.
    deepLink: `https://www.google.com/travel/flights?q=${encodeURIComponent(
      `Flights from ${params.departureId} to ${params.arrivalId} on ${params.departureDate}`
    )}`,
    raw,
  };
}

export const googleFlightsAdapter: FlightProviderAdapter = {
  providerId: "google-flights",
  providerName: "Google Flights",

  async search(params: FlightSearchParams): Promise<NormalizedFlightOffer[]> {
    if (!config.rapidApi.key) {
      throw new Error("RAPIDAPI_KEY is not configured");
    }

    const query = new URLSearchParams({
      departure_id: params.departureId,
      arrival_id: params.arrivalId,
      outbound_date: params.departureDate,
      travel_class: "ECONOMY",
      adults: String(params.adults),
      show_hidden: "1",
      currency: params.currency ?? "USD",
      language_code: "en-US",
      country_code: "IL",
      search_type: "best",
    });

    const url = `${BASE_URL}/api/v1/searchFlights?${query.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("Google Flights search failed", { status: res.status, body: body.slice(0, 500) });
      return [];
    }

    const data = (await res.json()) as any;
    const results = data?.data?.itineraries?.topFlights ?? data?.data ?? [];
    logger.info("Google Flights raw response shape", {
      topLevelKeys: Object.keys(data ?? {}),
      dataKeys: Object.keys(data?.data ?? {}),
      status: data?.status,
      apiMessage: data?.message,
      isResultsArray: Array.isArray(results),
      firstResultSample: JSON.stringify(Array.isArray(results) && results[0] ? results[0] : null).slice(0, 1500),
    });

    return (Array.isArray(results) ? results : []).map((r) => normalizeFlight(r, params)).filter((f) => f.price > 0);
  },
};
