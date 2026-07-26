import winston from "winston";
import { config } from "../config/index.js";

/**
 * JSON-structured logs in production (easy to ship to a log aggregator),
 * human-readable colorized logs in development.
 */
export const logger = winston.createLogger({
  level: config.isProduction ? "info" : "debug",
  format: config.isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      ),
  transports: [new winston.transports.Console()],
});
