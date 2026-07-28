import { config } from "../../../config/index.js";
import { logger } from "../../../lib/logger.js";
import type { FlightSearchParams, FlightProviderAdapter, NormalizedFlightOffer } from "./provider.interface.js";

const HOST = "google-flights2.p.rapidapi.com";
const BASE_URL = `https://${HOST}`;

function headers() {
  return { "x-rapidapi-host": HOST, "x-rapidapi-key": config.rapidApi.key ?? "" };
}

function normalizeFlight(raw: any): NormalizedFlightOffer {
  // שדות משוערים לפי המבנה המוכר של ה-wrapper הזה — ראה הערה ב-search.routes.ts
  // לגבי איך לאתר את הצורה האמיתית מהלוגים אם משהו לא תואם.
  const flight = raw?.flights?.[0] ?? raw;
  return {
    providerId: "google-flights",
    providerName: "Google Flights",
    airline: flight?.airline_name ?? flight?.airline ?? null,
    departureAirport: flight?.departure_airport?.id ?? flight?.departure_id ?? "",
    arrivalAirport: flight?.arrival_airport?.id ?? flight?.arrival_id ?? "",
    departureTime: flight?.departure_time ?? null,
    arrivalTime: flight?.arrival_time ?? null,
    price: Number(raw?.price ?? 0),
    currency: raw?.currency ?? "USD",
    stops: Array.isArray(raw?.flights) ? raw.flights.length - 1 : null,
    deepLink: raw?.booking_url ?? null,
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
      travel_class: "ECONOMY",
      adults: String(params.adults),
      show_hidden: "1",
      currency: params.currency ?? "USD",
      language_code: "he",
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
    logger.debug("Google Flights raw response shape", { keys: Object.keys(data ?? {}) });

    const results = data?.data?.itineraries?.topFlights ?? data?.data ?? [];
    return (Array.isArray(results) ? results : []).map(normalizeFlight).filter((f) => f.price > 0);
  },
};
