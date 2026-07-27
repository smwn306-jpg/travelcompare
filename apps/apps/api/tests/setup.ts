// Ensures config/index.ts's env validation passes in the test environment,
// without needing a real .env file or real secrets.
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test_access_secret_at_least_16_chars";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test_refresh_secret_at_least_16_chars";
