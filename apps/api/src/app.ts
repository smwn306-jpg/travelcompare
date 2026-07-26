import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { generalRateLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./modules/auth/auth.routes.js";

export function createApp() {
  const app = express();

  // Behind Nginx/a load balancer in production, so req.ip reflects the real client.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
    })
  );
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true, // required so the refresh-token cookie is sent/received
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use(
    morgan(config.isProduction ? "combined" : "dev", {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
  app.use(generalRateLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: config.env, timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);

  // Future modules mount the same way:
  // app.use("/api/search", searchRoutes);
  // app.use("/api/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
