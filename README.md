# TravelCompare — שלב 0+1: Setup + Auth

זהו הבסיס הראשון של הפרויקט: מבנה מלא, Docker Compose, ומודול Auth **עובד ונבדק** (הרשמה, התחברות, refresh token rotation, logout, RBAC).

## מה יש כאן בפועל

- `docker-compose.yml` — Postgres + Redis + ה-API, מוכן להרצה
- `apps/api/prisma/schema.prisma` — סכימת בסיס נתונים מלאה לפי מסמך הארכיטקטורה (User, RefreshToken, SearchHistory, Favorite, PriceAlert, Provider, Deal, PriceHistory, AdminAuditLog)
- `apps/api/src/modules/auth/` — מודול Auth מלא: register / login / refresh / logout / me
- Middleware: אימות JWT, RBAC (`requireRole`), rate limiting מבוסס Redis, טיפול שגיאות מרכזי, ולידציית Zod
- `apps/api/tests/auth.service.test.ts` — **4 בדיקות יחידה, כולן עוברות** (`npx vitest run`)

הקוד **נבדק בפועל** בזמן הכתיבה: `npx tsc --noEmit` עובר נקי, `npx vitest run` עובר (4/4), ו-`npm run build` מייצר `dist/` תקין.

## איך מריצים

### דרישה מוקדמת
Node.js 20+, Docker + Docker Compose מותקנים.

### שלבים

```bash
# 1. משתני סביבה
cp .env.example .env
# ערוך את .env והכנס ערכים אמיתיים (במיוחד JWT_ACCESS_SECRET / JWT_REFRESH_SECRET)
# לייצור ערך אקראי חזק: openssl rand -hex 64

# 2. הרמת Postgres + Redis
docker compose up -d postgres redis

# 3. התקנת תלויות ה-API
cd apps/api
npm install

# 4. יצירת הטבלאות במסד הנתונים
npx prisma migrate dev --name init

# 5. הרצת השרת במצב פיתוח
npm run dev
```

השרת יעלה על `http://localhost:4000`. בדיקת בריאות: `GET http://localhost:4000/health`

### בדיקות
```bash
cd apps/api
npm test
```

### הרצה מלאה עם Docker (כולל ה-API עצמו)
```bash
docker compose up --build
```

## בדיקה ידנית עם curl

```bash
# הרשמה
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"StrongPass123","fullName":"ישראל ישראלי"}'

# התחברות (שומר את ה-refresh token cookie לקובץ cookies.txt)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"StrongPass123"}'

# שימוש ב-access token שהתקבל כדי לגשת ל-endpoint מוגן
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN_FROM_LOGIN_RESPONSE>"

# רענון access token באמצעות ה-refresh cookie
curl -X POST http://localhost:4000/api/auth/refresh -b cookies.txt -c cookies.txt

# יציאה
curl -X POST http://localhost:4000/api/auth/logout -b cookies.txt
```

## החלטות אבטחה שכבר מיושמות בשלב הזה

- סיסמאות מוצפנות עם **Argon2id** (לא bcrypt/plaintext)
- Refresh token נשמר במסד הנתונים **כ-hash בלבד** (SHA-256), לא כטקסט גלוי
- Refresh token מועבר רק דרך **HttpOnly + Secure + SameSite=strict cookie**, מוגבל לנתיב `/api/auth` — לא נגיש ל-JavaScript בצד הלקוח ולא נשלח לשאר ה-API
- **Token rotation**: כל שימוש ב-refresh token מבטל אותו ומנפיק זוג חדש
- Rate limiting קשיח יותר (ברירת מחדל: 10 ניסיונות ל-15 דקות) על endpoints של Auth, מבוסס Redis כך שהוא משותף בין כל instance של ה-API
- הודעת שגיאה זהה בין "משתמש לא קיים" ל"סיסמה שגויה" — מונע user enumeration
- RBAC נאכף ב-middleware בצד השרת (`requireRole`), לא רק הסתרת UI
- כל קלט עובר ולידציית Zod לפני שהוא מגיע ללוגיקה העסקית
- משתני סביבה מאומתים בעת ההפעלה — שרת עם קונפיגורציה חסרה/פגומה לא יעלה בכלל

## מגבלה ידועה בסביבה שבה נכתב הקוד

ניסיתי להריץ `prisma generate` בסביבת הפיתוח שלי כדי לייצר את ה-Prisma Client, אבל זה נכשל כי `binaries.prisma.sh` חסום ברשת המוגבלת שבה אני עובד. **זו מגבלת סביבה, לא באג בקוד** — אצלך במחשב (רשת רגילה) הפקודה `npx prisma generate` (או `npx prisma migrate dev`, שמריצה אותה אוטומטית) תעבוד כרגיל. כל שאר הקוד נבדק ועבר (type-check, unit tests, build) ללא תלות בשלב הזה.

## מה הלאה (שלב 2)

לפי התוכנית במסמך הארכיטקטורה: שכבת ה-Provider (`ProviderAdapter` interface) + Adapter ראשון אמיתי מול Amadeus (sandbox חינמי לטיסות) + Adapter מדומה לספק ישראלי, כהכנה לחיבור אמיתי מול איסתא/אשת טורס בהמשך.
