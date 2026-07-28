// ממשק אחיד שכל ספק (Booking, Amadeus, וכו') חייב לממש.
// זה בדיוק מה שתואר במסמך הארכיטקטורה — הוספת ספק חדש = קובץ Adapter חדש,
// בלי לגעת בשאר המערכת.

export interface NormalizedOffer {
  providerId: string;       // "booking-rapidapi"
  providerName: string;     // "Booking.com"
  hotelName: string;
  price: number;
  currency: string;
  reviewScore: number | null;
  stars: number | null;
  imageUrl: string | null;
  deepLink: string | null;  // קישור חזרה לספק, אם קיים
  address: string | null;
  raw?: unknown;             // התשובה הגולמית — שימושי לדיבוג בזמן שמכוונים שדות
}

export interface HotelSearchParams {
  destination: string;   // שם עיר/יעד בטקסט חופשי, כמו שהמשתמש הקליד
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  adults: number;
  children: number;
  currency?: string;      // ברירת מחדל ILS אם הספק תומך
}

export interface NormalizedFlightOffer {
  providerId: string;
  providerName: string;
  airline: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string | null;
  arrivalTime: string | null;
  price: number;
  currency: string;
  stops: number | null;
  deepLink: string | null;
  raw?: unknown;
}

export interface FlightSearchParams {
  departureId: string; // קוד שדה תעופה, כמו "TLV"
  arrivalId: string;
  departureDate: string; // YYYY-MM-DD
  adults: number;
  currency?: string;
}

export interface FlightProviderAdapter {
  providerId: string;
  providerName: string;
  search(params: FlightSearchParams): Promise<NormalizedFlightOffer[]>;
}

export interface ProviderAdapter {
  providerId: string;
  providerName: string;
  search(params: HotelSearchParams): Promise<NormalizedOffer[]>;
}
