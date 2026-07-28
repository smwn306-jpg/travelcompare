import { z } from "zod";

/**
 * All environment variables are parsed and validated once, at boot.
 * If anything required is missing, the process fails fast with a clear
 * error instead of crashing later mid-request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // אופציונלי בכוונה — עד שיוגדרו, חיפוש המלונות האמיתי פשוט לא זמין
  // (מחזיר שגיאה ברורה), אבל שאר השרת ממשיך לעבוד כרגיל.
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().default("booking-com15.p.rapidapi.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly and immediately — a misconfigured server should never start.
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === "production",
  port: parsed.data.PORT,
  corsOrigin: parsed.data.CORS_ORIGIN,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },
  authRateLimit: {
    windowMs: parsed.data.AUTH_RATE_LIMIT_WINDOW_MS,
    max: parsed.data.AUTH_RATE_LIMIT_MAX,
  },
  rapidApi: {
    key: parsed.data.RAPIDAPI_KEY,
    host: parsed.data.RAPIDAPI_HOST,
  },
} as const;
