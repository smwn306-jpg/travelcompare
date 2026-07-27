import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { UnauthorizedError, ForbiddenError } from "./errorHandler.js";

export interface AccessTokenPayload {
  sub: string; // user id
  role: "user" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` access token and attaches
 * the decoded payload to req.user. This runs on every protected route —
 * it does NOT touch the database, so it stays fast.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/**
 * Role-based access control. Use AFTER `authenticate`.
 * Example: router.get('/admin/stats', authenticate, requireRole('admin'), handler)
 *
 * This is enforced server-side on every request — hiding an admin button in
 * the UI is never sufficient on its own.
 */
export function requireRole(...allowedRoles: Array<"user" | "admin">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }
    next();
  };
}
