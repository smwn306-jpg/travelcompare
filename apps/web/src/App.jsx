import React, { useState, useMemo, useEffect } from "react";
import {
  Search, MapPin, Users, Calendar, Plane, Hotel, Filter,
  TrendingUp, Users2, Globe2, ShieldCheck, LayoutDashboard,
  Plus, Trash2, Star, ArrowRight, Settings, LogOut, User, X, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

// כתובת ה-API האמיתי, החי על Render (חובר בפועל — לא נתוני דמו)
const API_BASE = "https://travelcompare.onrender.com";

// ---------- Design tokens ----------
// Primary: deep navy (#0B2545) — trust, travel-industry convention
// Secondary: sea teal (#1B7F79) — the "confirmed / value" color
// Accent: warm amber (#F0A202) — the single CTA color, used sparingly
// Background: soft fog (#F5F7FA)
// Alert/save: coral (#E4572E) for discounts

const PROVIDERS = [
  { name: "Booking.com", color: "#003580" },
  { name: "אשת טורס", color: "#1B7F79" },
  { name: "איסתא", color: "#0B2545" },
  { name: "Fattal", color: "#8A5A44" },
  { name: "Diesenhaus", color: "#6C4F77" },
];

const DESTINATIONS_ABROAD = [
  "אנטליה, טורקיה", "איסטנבול, טורקיה", "פראג, צ'כיה", "בטומי, גאורגיה",
  "טביליסי, גאורגיה", "פאפוס, קפריסין", "לרנקה, קפריסין", "בודפשט, הונגריה",
  "בנקוק, תאילנד", "פוקט, תאילנד", "בַּרְצֶלוֹנָה, ספרד", "מדריד, ספרד",
  "אתונה, יוון", "כרתים, יוון", "רודוס, יוון", "מילאנו, איטליה",
  "רומא, איטליה", "ונציה, איטליה", "פריז, צרפת", "ניס, צרפת",
  "לונדון, אנגליה", "אמסטרדם, הולנד", "ברלין, גרמניה", "וינה, אוסטריה",
  "ליסבון, פורטוגל", "דובאי, איחוד האמירויות", "זנזיבר, טנזניה", "בָּאלִי, אינדונזיה",
];
const DESTINATIONS_ISRAEL = [
  "אילת", "טבריה", "ים המלח", "צפת", "כרמל / חיפה", "נצרת ואגם הכנרת",
  "ירושלים", "תל אביב", "הרי ירושלים", "רמת הגולן", "מצפה רמון", "עין גדי",
  "נהריה ואזור הגליל המערבי", "קיסריה", "מכתש רמון",
];

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ממפה שם עיר (בעברית, תואם לרשימת היעדים למעלה) לקוד/י שדה תעופה.
// ערים עם כמה שדות תעופה (כמו לונדון) מחזירות כמה קודים — במקרה כזה
// המשתמש יתבקש לבחור. ברירת המחדל למקור: תל אביב.
const CITY_AIRPORTS = {
  "תל אביב": ["TLV"],
  "אנטליה, טורקיה": ["AYT"],
  "איסטנבול, טורקיה": ["IST", "SAW"],
  "פראג, צ'כיה": ["PRG"],
  "בטומי, גאורגיה": ["BUS"],
  "טביליסי, גאורגיה": ["TBS"],
  "פאפוס, קפריסין": ["PFO"],
  "לרנקה, קפריסין": ["LCA"],
  "בודפשט, הונגריה": ["BUD"],
  "בנקוק, תאילנד": ["BKK", "DMK"],
  "פוקט, תאילנד": ["HKT"],
  "בַּרְצֶלוֹנָה, ספרד": ["BCN"],
  "מדריד, ספרד": ["MAD"],
  "אתונה, יוון": ["ATH"],
  "כרתים, יוון": ["HER"],
  "רודוס, יוון": ["RHO"],
  "מילאנו, איטליה": ["MXP", "LIN", "BGY"],
  "רומא, איטליה": ["FCO", "CIA"],
  "ונציה, איטליה": ["VCE"],
  "פריז, צרפת": ["CDG", "ORY"],
  "ניס, צרפת": ["NCE"],
  "לונדון, אנגליה": ["LHR", "LGW", "STN", "LTN", "LCY"],
  "אמסטרדם, הולנד": ["AMS"],
  "ברלין, גרמניה": ["BER"],
  "וינה, אוסטריה": ["VIE"],
  "ליסבון, פורטוגל": ["LIS"],
  "דובאי, איחוד האמירויות": ["DXB"],
  "זנזיבר, טנזניה": ["ZNZ"],
  "בָּאלִי, אינדונזיה": ["DPS"],
  "ניו יורק": ["JFK", "EWR", "LGA"],
  "טוקיו": ["NRT", "HND"],
};

/** מוצא קודי שדה תעופה לפי טקסט חופשי — התאמה מדויקת קודם, ואז התאמה חלקית. */
function lookupAirports(cityText) {
  if (!cityText) return [];
  if (CITY_AIRPORTS[cityText]) return CITY_AIRPORTS[cityText];
  const match = Object.keys(CITY_AIRPORTS).find(
    (key) => key.includes(cityText.trim()) || cityText.trim().includes(key.split(",")[0])
  );
  return match ? CITY_AIRPORTS[match] : [];
}

function AirportCityInput({ label, value, onCityChange, resolvedCode, onCodeChange }) {
  const options = lookupAirports(value);

  useEffect(() => {
    if (options.length > 0 && !options.includes(resolvedCode)) {
      onCodeChange(options[0]);
    } else if (options.length === 0 && resolvedCode) {
      onCodeChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onCityChange(e.target.value)}
        placeholder="שם עיר, למשל: אתונה"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
      />
      {options.length > 1 && (
        <select
          value={resolvedCode}
          onChange={(e) => onCodeChange(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs mt-1.5 focus:outline-none"
        >
          {options.map((code) => (
            <option key={code} value={code}>שדה תעופה: {code}</option>
          ))}
        </select>
      )}
      {options.length === 0 && value && (
        <p className="text-xs text-[#F0A202] mt-1">לא זוהה שדה תעופה לעיר הזו — נסה שם באנגלית או קוד IATA (למשל LHR)</p>
      )}
    </div>
  );
}

function formatDateInput(date) {
  return date.toISOString().split("T")[0];
}
function defaultCheckIn() {
  const d = new Date();
  d.setDate(d.getDate() + 14); // ברירת מחדל: מתחיל בעוד שבועיים
  return formatDateInput(d);
}
function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 21); // שבוע אחרי ה-check-in
  return formatDateInput(d);
}
// ממפה שם ספק לאתר הבית האמיתי שלו (אין לנו deep-link אמיתי לחדר הספציפי
// כי אלה נתוני הדגמה — אבל הכפתור לפחות לוקח בפועל לספק האמיתי).
const PROVIDER_HOMEPAGE = {
  // ספקים אמיתיים (חיים היום)
  "Booking.com": "https://www.booking.com",
  "Hotels.com": "https://www.hotels.com",
  "TripAdvisor": "https://www.tripadvisor.com",
  "Airbnb": "https://www.airbnb.com",
  "Google Flights": "https://www.google.com/travel/flights",
  // שמות מדגמת ההדגמה (עדיין בשימוש כשהחיפוש החי לא זמין)
  "אשת טורס": "https://www.eshet-tours.co.il",
  "איסתא": "https://www.issta.co.il",
  "Fattal": "https://www.fattal.com",
  "Diesenhaus": "https://www.diesenhaus.com",
};
function providerUrl(providerName) {
  return PROVIDER_HOMEPAGE[providerName] || "#";
}

function formatHebrewDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function nightsBetween(checkInStr, checkOutStr) {
  const inDate = new Date(checkInStr);
  const outDate = new Date(checkOutStr);
  const diff = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1; // תמיד לפחות לילה אחד, גם אם התאריכים לא הגיוניים
}

function generateOffers({ destination, people, budget, includeFlight, nights }) {
  const rnd = seedRandom(destination.length * 97 + people * 13 + budget);
  const offers = [];
  const count = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const provider = PROVIDERS[Math.floor(rnd() * PROVIDERS.length)];
    const basePrice = Math.round((budget * (0.55 + rnd() * 0.5)) / 50) * 50;
    const stars = 3 + Math.floor(rnd() * 3);
    const discount = rnd() > 0.6 ? Math.floor(rnd() * 25) + 5 : 0;
    const originalPrice = discount ? Math.round(basePrice / (1 - discount / 100)) : basePrice;
    offers.push({
      id: `${destination}-${i}`,
      provider: provider.name,
      color: provider.color,
      hotelName: `מלון ${["הנסיכה", "המפרץ", "גני הים", "אורות הים", "פרל", "רויאל", "גראנד"][Math.floor(rnd() * 7)]} ${destination.split(",")[0]}`,
      stars,
      price: basePrice,
      originalPrice,
      discount,
      includesFlight: includeFlight,
      nights,
      board: ["בוקר", "חצי פנסיון", "הכל כלול", "ללא ארוחות"][Math.floor(rnd() * 4)],
      rating: (7.5 + rnd() * 2.4).toFixed(1),
    });
  }
  return offers.sort((a, b) => a.price - b.price);
}

// ---------- Admin mock data ----------
const segmentByDestination = [
  { name: "אנטליה", value: 342 }, { name: "אילת", value: 289 },
  { name: "פראג", value: 176 }, { name: "בטומי", value: 154 },
  { name: "ים המלח", value: 121 }, { name: "בנקוק", value: 98 },
];
const segmentByBudget = [
  { range: "עד ₪2,000", value: 210 }, { range: "₪2,000-4,000", value: 480 },
  { range: "₪4,000-7,000", value: 340 }, { range: "₪7,000+", value: 150 },
];
const monthlySearches = [
  { month: "ינו", searches: 890 }, { month: "פבר", searches: 1020 },
  { month: "מרץ", searches: 1240 }, { month: "אפר", searches: 1580 },
  { month: "מאי", searches: 1740 }, { month: "יונ", searches: 2100 },
  { month: "יול", searches: 2430 },
];
const PIE_COLORS = ["#0B2545", "#1B7F79", "#F0A202", "#E4572E", "#6C4F77", "#8A5A44"];

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-lg bg-[#0B2545]/5 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#0B2545]" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-[#1B7F79] mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function AdminDashboard({ packages, setPackages, onExit }) {
  const [newDest, setNewDest] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const addPackage = () => {
    if (!newDest.trim() || !newPrice) return;
    setPackages([
      { id: Date.now(), destination: newDest.trim(), price: Number(newPrice), active: true },
      ...packages,
    ]);
    setNewDest("");
    setNewPrice("");
  };
  const removePackage = (id) => setPackages(packages.filter((p) => p.id !== id));
  const toggleActive = (id) =>
    setPackages(packages.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-[#0B2545] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#F0A202]" />
            <span className="font-bold text-lg">לוח בקרה — מנהל</span>
          </div>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            חזרה לאתר
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users2} label="חיפושים החודש" value="2,430" sub="+39.6% מהחודש הקודם" />
          <StatCard icon={Globe2} label="יעדים פעילים" value={packages.filter(p=>p.active).length} sub={`מתוך ${packages.length} סה״כ`} />
          <StatCard icon={TrendingUp} label="שיעור המרה" value="4.8%" sub="חיפוש → יציאה לספק" />
          <StatCard icon={ShieldCheck} label="ניסיונות התחברות חשודים" value="0" sub="24 שעות אחרונות" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <h3 className="font-bold text-slate-800 mb-1">חיפושים לפי יעד</h3>
            <p className="text-xs text-slate-500 mb-4">חתך משתמשים לפי יעד מבוקש (30 הימים האחרונים)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={segmentByDestination}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0B2545" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-1">חתך תקציב</h3>
            <p className="text-xs text-slate-500 mb-4">התפלגות משתמשים</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={segmentByBudget} dataKey="value" nameKey="range" innerRadius={45} outerRadius={80}>
                  {segmentByBudget.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-1">מגמת חיפושים חודשית</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlySearches}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="searches" stroke="#F0A202" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Package management */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-4">ניהול יעדים / חבילות באתר</h3>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              value={newDest}
              onChange={(e) => setNewDest(e.target.value)}
              placeholder="שם יעד חדש (למשל: מרסיי, צרפת)"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
            />
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              type="number"
              placeholder="מחיר החל מ-(₪)"
              className="sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
            />
            <button
              onClick={addPackage}
              className="flex items-center justify-center gap-1.5 bg-[#0B2545] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0B2545]/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> הוסף
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {packages.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${p.active ? "bg-[#1B7F79]" : "bg-slate-300"}`} />
                  <span className="font-medium text-slate-800">{p.destination}</span>
                  <span className="text-sm text-slate-500">מ-₪{p.price.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(p.id)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {p.active ? "הסתר מהאתר" : "הצג באתר"}
                  </button>
                  <button
                    onClick={() => removePackage(p.id)}
                    className="text-slate-400 hover:text-[#E4572E] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[#1B7F79]/5 border border-[#1B7F79]/20 rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-[#1B7F79] shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">אבטחת מידע: </span>
            בפרויקט האמיתי כאן ייכנסו הצפנת סיסמאות (bcrypt/Argon2), HTTPS מלא, הפרדת הרשאות Admin/User בצד השרת,
            הגנת CSRF/Rate-limiting על טפסי התחברות, ולוג ביקורת (audit log) על פעולות מנהל — לא רק תצוגה בצד לקוח.
          </p>
        </div>
      </main>
    </div>
  );
}

function AuthModal({ mode, onClose, onSuccess }) {
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const path = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? form
        : { email: form.email, password: form.password };

      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "משהו השתבש");
      }

      onSuccess(data.user, data.accessToken);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "השרת בטיר החינמי אולי \"נרדם\" — נסה שוב בעוד 30-60 שניות"
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute left-4 top-4 text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {isRegister ? "הרשמה" : "התחברות"}
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          מחובר בפועל לשרת חי: <span className="font-mono">{API_BASE.replace("https://", "")}</span>
        </p>

        <div className="space-y-3">
          {isRegister && (
            <input
              placeholder="שם מלא"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
            />
          )}
          <input
            placeholder="אימייל"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
          />
          <input
            placeholder="סיסמה (לפחות 10 תווים, אות גדולה+קטנה+מספר)"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
          />
        </div>

        {error && (
          <p className="text-xs text-[#E4572E] bg-[#E4572E]/10 rounded-lg px-3 py-2 mt-3">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !form.email || !form.password || (isRegister && !form.fullName)}
          className="w-full flex items-center justify-center gap-2 bg-[#0B2545] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 mt-4 hover:bg-[#0B2545]/90 transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isRegister ? "הרשמה" : "התחברות"}
        </button>

        <button
          onClick={() => { setIsRegister((v) => !v); setError(""); }}
          className="w-full text-center text-xs text-slate-500 mt-3 hover:text-slate-800"
        >
          {isRegister ? "כבר יש לך חשבון? התחבר" : "אין לך חשבון? הירשם"}
        </button>
      </div>
    </div>
  );
}

function FeaturedDeals() {
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/deals/featured`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDeals(data.deals ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("השרת בטיר החינמי אולי \"נרדם\" — רענן את הדף בעוד 30-60 שניות");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <p className="text-center text-sm text-slate-400 py-10">{error}</p>;
  }

  if (deals === null) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-14">
        <Loader2 className="w-5 h-5 animate-spin" /> טוען דילים חמים...
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="py-14 text-center">
        <Hotel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400">אין כרגע דילים פעילים — נסה לחפש יעד למעלה</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <h2 className="text-lg font-bold text-slate-800 mb-1">🔥 דילים חמים עכשיו</h2>
      <p className="text-xs text-slate-500 mb-4">
        נתונים אמיתיים מהשרת החי — לא דורש חיפוש, מתעדכן אוטומטית
      </p>
      <div className="space-y-3">
        {deals.map((deal) => (
          <div
            key={deal.id}
            className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#0B2545] text-white">
                  {deal.provider}
                </span>
                {deal.originalPrice && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E4572E]/10 text-[#E4572E]">
                    חיסכון {Math.round((1 - deal.price / deal.originalPrice) * 100)}%
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-800">{deal.hotelName}</h3>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: deal.stars }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-[#F0A202] text-[#F0A202]" />
                  ))}
                </span>
                <span>{deal.destination}</span>
                <span>{deal.nights} לילות</span>
                <span>{deal.boardType}</span>
                {deal.includesFlight && (
                  <span className="flex items-center gap-1 text-[#1B7F79]">
                    <Plane className="w-3 h-3" /> כולל טיסה
                  </span>
                )}
              </div>
              {(deal.travelDateStart || deal.includesFlight) && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                  {deal.travelDateStart && deal.travelDateEnd && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatHebrewDate(deal.travelDateStart)} – {formatHebrewDate(deal.travelDateEnd)}
                    </span>
                  )}
                  {deal.includesFlight && deal.flightDepartureTime && (
                    <span className="flex items-center gap-1">
                      <Plane className="w-3 h-3 rotate-45" />
                      טיסת הלוך {deal.flightDepartureTime}
                    </span>
                  )}
                  {deal.includesFlight && deal.flightReturnTime && (
                    <span className="flex items-center gap-1">
                      <Plane className="w-3 h-3 -rotate-[135deg]" />
                      טיסת חזור {deal.flightReturnTime}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
              {deal.originalPrice && (
                <span className="text-xs text-slate-400 line-through">₪{deal.originalPrice.toLocaleString()}</span>
              )}
              <span className="text-xl font-bold text-[#0B2545]">₪{deal.price.toLocaleString()}</span>
              <span className="text-xs text-slate-400">₪{Math.round(deal.price / 2).toLocaleString()} לאדם (ל-2 נוסעים)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealModal({ offer, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {offer.imageUrl && (
          <img src={offer.imageUrl} alt={offer.hotelName} className="w-full h-48 object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: offer.color || "#0B2545" }}
            >
              {offer.provider}
            </span>
            {offer.discount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E4572E]/10 text-[#E4572E]">
                חיסכון {offer.discount}%
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">{offer.hotelName}</h2>
          {offer.address && <p className="text-sm text-slate-500 mb-3">{offer.address}</p>}

          <div className="flex items-center gap-3 text-sm text-slate-600 mb-4">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: offer.stars || 0 }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-[#F0A202] text-[#F0A202]" />
              ))}
            </span>
            <span>{offer.rating} / 10</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            {offer.discount > 0 && (
              <span className="text-sm text-slate-400 line-through block">₪{offer.originalPrice?.toLocaleString()}</span>
            )}
            <span className="text-2xl font-bold text-[#0B2545]">
              ₪{(offer.packageFlight ? offer.price + offer.packageFlight.price : offer.price).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {offer.packageFlight ? "מחיר משולב: מלון + טיסה" : `₪${Math.round(offer.price / (offer.totalTravelers || 2)).toLocaleString()} לאדם`}
            </p>
          </div>

          {offer.packageFlight && (
            <div className="bg-[#0B2545]/5 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Plane className="w-3.5 h-3.5" /> הטיסה בחבילה
              </p>
              <p className="text-sm text-slate-700">
                {offer.packageFlight.airline || "חברת תעופה"} · {offer.packageFlight.departureAirport} → {offer.packageFlight.arrivalAirport}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">₪{offer.packageFlight.price.toLocaleString()} לטיסה</p>
            </div>
          )}

          <p className="text-xs text-slate-400 mb-4">
            💡 המחיר והזמינות מוצגים לפי מה שהספק החזיר בזמן החיפוש — ייתכנו שינויים קלים עד להשלמת ההזמנה בפועל אצל הספק.
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <a
                href={offer.deepLink || providerUrl(offer.provider)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-sm font-semibold text-white bg-[#0B2545] rounded-lg px-4 py-2.5 hover:bg-[#0B2545]/90 transition-colors"
              >
                {offer.packageFlight ? "המשך למלון ↗" : "המשך להזמנה אצל הספק ↗"}
              </a>
              {offer.packageFlight && (
                <a
                  href={offer.packageFlight.deepLink || providerUrl(offer.packageFlight.providerName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-sm font-semibold text-white bg-[#1B7F79] rounded-lg px-4 py-2.5 hover:bg-[#1B7F79]/90 transition-colors"
                >
                  המשך לטיסה ↗
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg px-4 py-2.5 hover:bg-slate-200 transition-colors"
            >
              סגור, המשך לחפש
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VacationFinderApp() {
  const [view, setView] = useState(() =>
    typeof window !== "undefined" && window.location.pathname === "/admin" ? "admin" : "search"
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authModal, setAuthModal] = useState(null); // null | "login" | "register"
  const [form, setForm] = useState({
    scope: "abroad", // abroad | israel
    destination: DESTINATIONS_ABROAD[0],
    adults: 2,
    children: 0,
    checkIn: defaultCheckIn(),
    checkOut: defaultCheckOut(),
    budget: 4000,
    searchType: "hotels", // hotels | flights | both
    departureCity: "תל אביב",
    departureAirport: "TLV",
    arrivalAirport: "",
  });
  const [results, setResults] = useState(null);
  const [sortBy, setSortBy] = useState("price");
  const [packages, setPackages] = useState([
    { id: 1, destination: "אנטליה, טורקיה", price: 2600, active: true },
    { id: 2, destination: "אילת", price: 1200, active: true },
    { id: 3, destination: "פראג, צ'כיה", price: 3100, active: true },
    { id: 4, destination: "בטומי, גאורגיה", price: 2900, active: false },
  ]);

  const destinationList = form.scope === "abroad" ? DESTINATIONS_ABROAD : DESTINATIONS_ISRAEL;
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const totalTravelers = form.adults + form.children;

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIsDemo, setSearchIsDemo] = useState(false);

  const [flightResults, setFlightResults] = useState(null);
  const [flightIsDemo, setFlightIsDemo] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [resultsTab, setResultsTab] = useState("hotels"); // hotels | flights — רלוונטי רק במסך צר

  const fetchHotels = async () => {
    try {
      const query = new URLSearchParams({
        destination: form.destination,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: String(form.adults),
        children: String(form.children),
      });
      const res = await fetch(`${API_BASE}/api/search/hotels?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.offers || data.offers.length === 0) throw new Error("no live offers");

      const mapped = data.offers.map((o, i) => ({
        id: `${o.providerId}-${i}`,
        provider: o.providerName,
        color: "#003580",
        hotelName: o.hotelName,
        stars: o.stars ?? 4,
        price: o.price,
        originalPrice: o.originalPrice ?? o.price,
        discount: o.originalPrice ? Math.round((1 - o.price / o.originalPrice) * 100) : 0,
        includesFlight: false,
        nights,
        board: "לא צוין",
        rating: o.reviewScore ? Number(o.reviewScore).toFixed(1) : "—",
        deepLink: o.deepLink,
        imageUrl: o.imageUrl,
        address: o.address,
      }));
      setResults(mapped);
      setSearchIsDemo(false);
    } catch {
      setResults(generateOffers({ ...form, nights, people: totalTravelers }));
      setSearchIsDemo(true);
    }
  };

  const fetchFlights = async () => {
    try {
      if (!form.departureAirport || !form.arrivalAirport) throw new Error("missing airports");
      const query = new URLSearchParams({
        departureId: form.departureAirport,
        arrivalId: form.arrivalAirport,
        departureDate: form.checkIn,
        adults: String(form.adults),
      });
      const res = await fetch(`${API_BASE}/api/search/flights?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.offers || data.offers.length === 0) throw new Error("no live flights");

      setFlightResults(data.offers);
      setFlightIsDemo(false);
    } catch {
      setFlightResults(null);
      setFlightIsDemo(true);
    }
  };

  const handleSearch = async () => {
    setSearchLoading(true);
    setView("results");

    const tasks = [];
    if (form.searchType === "hotels" || form.searchType === "both") tasks.push(fetchHotels());
    else setResults(null);
    if (form.searchType === "flights" || form.searchType === "both") tasks.push(fetchFlights());
    else setFlightResults(null);

    await Promise.all(tasks);
    setSearchLoading(false);
  };

  const sortedResults = useMemo(() => {
    if (!results) return [];
    const copy = [...results];
    if (sortBy === "price") copy.sort((a, b) => a.price - b.price);
    if (sortBy === "rating") copy.sort((a, b) => b.rating - a.rating);
    if (sortBy === "stars") copy.sort((a, b) => b.stars - a.stars);
    return copy;
  }, [results, sortBy]);

  // חבילות מוצעות: מלון ספציפי + טיסה ספציפית ביחד, עם מחיר משולב אחד —
  // מזווגים את הטיסה הזולה ביותר עם 3 המלונות הזולים ביותר.
  const packageOffers = useMemo(() => {
    if (form.searchType !== "both" || !results || !flightResults || flightResults.length === 0) return [];
    const cheapestFlight = [...flightResults].sort((a, b) => a.price - b.price)[0];
    const cheapestHotels = [...results].sort((a, b) => a.price - b.price).slice(0, 3);
    return cheapestHotels.map((hotel) => ({
      hotel,
      flight: cheapestFlight,
      combinedPrice: hotel.price + cheapestFlight.price,
    }));
  }, [form.searchType, results, flightResults]);

  const goToAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setView("admin");
  };
  const exitAdmin = () => {
    window.history.pushState({}, "", "/");
    setView("search");
  };

  if (view === "admin") {
    if (!currentUser) {
      return (
        <div dir="rtl" className="min-h-screen bg-[#0B2545] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <ShieldCheck className="w-10 h-10 text-[#0B2545] mx-auto mb-3" />
            <h1 className="text-lg font-bold text-slate-800 mb-1">כניסת מנהל</h1>
            <p className="text-sm text-slate-500 mb-5">האזור הזה דורש התחברות עם חשבון מנהל</p>
            <button
              onClick={() => setAuthModal("login")}
              className="w-full bg-[#0B2545] text-white font-semibold rounded-lg py-2.5 hover:bg-[#0B2545]/90 transition-colors"
            >
              התחברות
            </button>
            <button onClick={exitAdmin} className="w-full text-xs text-slate-400 mt-3 hover:text-slate-700">
              חזרה לאתר
            </button>
          </div>
          {authModal && (
            <AuthModal
              mode={authModal}
              onClose={() => setAuthModal(null)}
              onSuccess={(user, token) => {
                setCurrentUser(user);
                setAccessToken(token);
                setAuthModal(null);
              }}
            />
          )}
        </div>
      );
    }

    if (currentUser.role !== "admin") {
      return (
        <div dir="rtl" className="min-h-screen bg-[#0B2545] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <ShieldCheck className="w-10 h-10 text-[#E4572E] mx-auto mb-3" />
            <h1 className="text-lg font-bold text-slate-800 mb-1">אין הרשאה</h1>
            <p className="text-sm text-slate-500 mb-5">
              מחובר בתור {currentUser.fullName}, אבל לחשבון הזה אין הרשאות מנהל
            </p>
            <button
              onClick={exitAdmin}
              className="w-full bg-[#0B2545] text-white font-semibold rounded-lg py-2.5 hover:bg-[#0B2545]/90 transition-colors"
            >
              חזרה לאתר
            </button>
          </div>
        </div>
      );
    }

    return <AdminDashboard packages={packages} setPackages={setPackages} onExit={exitAdmin} />;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F5F7FA]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Top bar */}
      <header className="bg-[#0B2545] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("search")}>
            <Plane className="w-5 h-5 text-[#F0A202] rotate-45" />
            <span className="font-bold text-lg tracking-tight">חופשה·חכמה</span>
          </div>
        </div>
      </header>

      {/* Hero + search form (Booking-style sticky search bar) */}
      <section className="bg-[#0B2545] pb-16 pt-6">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-white text-2xl sm:text-3xl font-bold mb-6">
            חופשה אחת, השוואה בין כל האתרים
          </h1>

          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-5">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setForm((f) => ({ ...f, scope: "abroad", destination: DESTINATIONS_ABROAD[0] }))}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  form.scope === "abroad" ? "bg-[#0B2545] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" /> חו״ל
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, scope: "israel", destination: DESTINATIONS_ISRAEL[0] }))}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  form.scope === "israel" ? "bg-[#0B2545] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> בארץ
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> יעד
                </label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  placeholder="הקלד כל יעד — למשל: לונדון, טוקיו, ניו יורק..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> יציאה
                </label>
                <input
                  type="date"
                  value={form.checkIn}
                  min={formatDateInput(new Date())}
                  onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> חזרה
                </label>
                <input
                  type="date"
                  value={form.checkOut}
                  min={form.checkIn}
                  onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> מבוגרים
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.adults}
                  onChange={(e) => setForm((f) => ({ ...f, adults: Math.max(1, Number(e.target.value)) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> ילדים
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.children}
                  onChange={(e) => setForm((f) => ({ ...f, children: Math.max(0, Number(e.target.value)) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>{nights} לילות</span>
              <span>·</span>
              <span>{totalTravelers} נוסעים סה״כ{form.children > 0 ? ` (${form.adults} מבוגרים, ${form.children} ילדים)` : ""}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">תקציב כולל (₪)</label>
                <input
                  type="number"
                  step={100}
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B2545]/30"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="flex gap-2">
                <button
                  onClick={() => setForm((f) => ({ ...f, searchType: "hotels" }))}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    form.searchType === "hotels" ? "bg-[#0B2545] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Hotel className="w-3.5 h-3.5" /> מלונות בלבד
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, searchType: "flights" }))}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    form.searchType === "flights" ? "bg-[#0B2545] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" /> טיסות בלבד
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, searchType: "both" }))}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    form.searchType === "both" ? "bg-[#0B2545] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  מלונות + טיסות
                </button>
              </div>

              <button
                onClick={handleSearch}
                className="flex items-center gap-2 bg-[#F0A202] hover:bg-[#d9930a] text-[#0B2545] font-bold px-6 py-2.5 rounded-lg transition-colors"
              >
                <Search className="w-4 h-4" /> חפש חופשה
              </button>
            </div>

            {form.searchType !== "hotels" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                <AirportCityInput
                  label="עיר יציאה"
                  value={form.departureCity}
                  onCityChange={(v) => setForm((f) => ({ ...f, departureCity: v }))}
                  resolvedCode={form.departureAirport}
                  onCodeChange={(code) => setForm((f) => ({ ...f, departureAirport: code }))}
                />
                <AirportCityInput
                  label={`עיר יעד (טיסה) — לפי שדה "יעד" למעלה`}
                  value={form.destination}
                  onCityChange={(v) => setForm((f) => ({ ...f, destination: v }))}
                  resolvedCode={form.arrivalAirport}
                  onCodeChange={(code) => setForm((f) => ({ ...f, arrivalAirport: code }))}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="max-w-6xl mx-auto px-6 -mt-8">
        {view === "results" && searchLoading && (
          <div className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#0B2545]" />
            <p className="text-sm text-slate-500">
              {form.searchType === "flights" ? "מחפש טיסות..." : form.searchType === "both" ? "מחפש מלונות וטיסות..." : "מחפש מלונות אמיתיים אצל הספק..."}
            </p>
          </div>
        )}

        {view === "results" && !searchLoading && packageOffers.length > 0 && (
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-800 mb-1">📦 חבילות מוצעות — מלון + טיסה ביחד</h2>
            <p className="text-xs text-slate-500 mb-3">מלון ספציפי משולב עם הטיסה הזולה ביותר שנמצאה, מחיר אחד לשניהם</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {packageOffers.map((pkg, i) => (
                <div key={i} className="bg-white rounded-xl border-2 border-[#F0A202]/40 p-4">
                  <p className="font-bold text-slate-800 text-sm">{pkg.hotel.hotelName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {Array.from({ length: pkg.hotel.stars }).map((_, s) => "★").join("")} · {pkg.hotel.provider}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                    <Plane className="w-3 h-3" />
                    {pkg.flight.departureAirport} → {pkg.flight.arrivalAirport} · {pkg.flight.airline || "טיסה"}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className="text-lg font-bold text-[#0B2545]">₪{pkg.combinedPrice.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 block">מלון + טיסה, סה״כ ל-{totalTravelers} נוסעים</span>
                  </div>
                  <button
                    onClick={() => setSelectedOffer({ ...pkg.hotel, totalTravelers, packageFlight: pkg.flight })}
                    className="w-full mt-3 text-sm font-semibold text-white bg-[#0B2545] rounded-lg px-3 py-2 hover:bg-[#0B2545]/90 transition-colors"
                  >
                    צפה בחבילה
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "results" && !searchLoading && (
          <div className={`pb-12 ${form.searchType === "both" ? "grid grid-cols-1 lg:grid-cols-2 gap-5 items-start" : "space-y-5"}`}>
            {form.searchType === "both" && (
              <div className="lg:hidden flex gap-2 -mb-2">
                <button
                  onClick={() => setResultsTab("hotels")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    resultsTab === "hotels" ? "bg-[#0B2545] text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  <Hotel className="w-4 h-4" /> מלונות
                </button>
                <button
                  onClick={() => setResultsTab("flights")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    resultsTab === "flights" ? "bg-[#0B2545] text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  <Plane className="w-4 h-4" /> טיסות
                </button>
              </div>
            )}

            {form.searchType !== "flights" && results && (
              <div className={`space-y-5 ${form.searchType === "both" && resultsTab !== "hotels" ? "hidden lg:block" : ""}`}>
                <div className="bg-white rounded-xl shadow-lg p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      🏨 {results.length} הצעות מלונות ל{form.destination} · {nights} לילות · {totalTravelers} נוסעים
                    </p>
                    {searchIsDemo ? (
                      <p className="text-xs text-[#F0A202] font-medium">⚠️ חיפוש חי לא זמין כרגע — מוצגים נתוני הדגמה</p>
                    ) : (
                      <p className="text-xs text-[#1B7F79] font-medium">✓ נתונים חיים מהספק, עכשיו</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    >
                      <option value="price">מיין לפי: מחיר</option>
                      <option value="rating">מיין לפי: דירוג</option>
                      <option value="stars">מיין לפי: כוכבים</option>
                    </select>
                  </div>
                </div>

                {!searchIsDemo && (
                  <p className="text-xs text-slate-400">
                    ⚠️ המחיר מוצג לפי מה שהספק החזיר בזמן החיפוש — ייתכן פער קטן עד ההזמנה בפועל. הקישור "צפה בדיל" →
                    "המשך להזמנה" מוביל לתוצאות חיפוש עם שם המלון אצל הספק (לא בהכרח לעמוד המדויק).
                  </p>
                )}

                <div className="space-y-3">
                  {sortedResults.map((offer) => (
                    <div
                      key={offer.id}
                      className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: offer.color }}
                          >
                            {offer.provider}
                          </span>
                          {offer.discount > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#E4572E]/10 text-[#E4572E]">
                              חיסכון {offer.discount}%
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-800">{offer.hotelName}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: offer.stars }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-[#F0A202] text-[#F0A202]" />
                            ))}
                          </span>
                          <span>{offer.rating} / 10</span>
                          <span>{offer.board}</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 sm:text-left">
                        {offer.discount > 0 && (
                          <span className="text-xs text-slate-400 line-through">₪{offer.originalPrice.toLocaleString()}</span>
                        )}
                        <span className="text-xl font-bold text-[#0B2545]">₪{offer.price.toLocaleString()}</span>
                        <span className="text-xs text-slate-400">
                          ₪{Math.round(offer.price / totalTravelers).toLocaleString()} לאדם · סה״כ ל-{totalTravelers} נוסעים
                        </span>
                        <button
                          onClick={() => setSelectedOffer({ ...offer, totalTravelers })}
                          className="flex items-center gap-1 text-sm font-semibold text-white bg-[#0B2545] rounded-lg px-4 py-2 hover:bg-[#0B2545]/90 transition-colors mt-2 sm:mt-1"
                        >
                          צפה בדיל <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.searchType !== "hotels" && (
              <div className={`space-y-5 ${form.searchType === "both" && resultsTab !== "flights" ? "hidden lg:block" : ""}`}>
                <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      ✈️ טיסות {form.departureAirport} → {form.arrivalAirport || "?"}
                    </p>
                    {flightIsDemo ? (
                      <p className="text-xs text-[#F0A202] font-medium">
                        ⚠️ חיפוש טיסות חי לא זמין כרגע (בדוק שהזנת קודי שדות תעופה תקינים)
                      </p>
                    ) : (
                      <p className="text-xs text-[#1B7F79] font-medium">✓ נתונים חיים, עכשיו</p>
                    )}
                  </div>
                </div>

                {flightResults && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#F0A202] font-medium">
                      ⚠️ המחיר המוצג הוא הערכה גסה בלבד ולא תמיד מדויק (לפי בדיקה מול גוגל טיסות עצמו) — ייתכן
                      שאינו כולל את כל הנוסעים או שהוא לכיוון אחד בלבד. תמיד יש לבדוק את המחיר הסופי אצל הספק לפני הזמנה.
                    </p>
                    {flightResults.map((flight, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <div className="flex-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#0B2545] text-white">
                            {flight.providerName}
                          </span>
                          <h3 className="font-bold text-slate-800 mt-1">
                            {flight.airline || "חברת תעופה"} · {flight.departureAirport} → {flight.arrivalAirport}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            {flight.departureTime && <span>יציאה {flight.departureTime}</span>}
                            {flight.arrivalTime && <span>נחיתה {flight.arrivalTime}</span>}
                            {flight.stops !== null && <span>{flight.stops === 0 ? "ישירה" : `${flight.stops} עצירות`}</span>}
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                          <span className="text-xl font-bold text-[#0B2545]">₪{flight.price.toLocaleString()}</span>
                          <span className="text-xs text-slate-400">מחיר משוער — יש לאמת אצל הספק</span>
                          {flight.deepLink && (
                            <a
                              href={flight.deepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm font-semibold text-white bg-[#0B2545] rounded-lg px-4 py-2 hover:bg-[#0B2545]/90 transition-colors mt-2 sm:mt-1"
                            >
                              למעבר לספק <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === "search" && <FeaturedDeals />}
      </main>

      {selectedOffer && <DealModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />}
    </div>
  );
}
