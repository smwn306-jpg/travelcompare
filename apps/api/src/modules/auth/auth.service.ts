import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma.js";
import { config } from "../../config/index.js";
import { ConflictError, UnauthorizedError } from "../../middleware/errorHandler.js";
import { logger } from "../../lib/logger.js";
import type { RegisterInput, LoginInput } from "./auth.schemas.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: "user" | "admin";
}

/** Hashes a raw refresh token before persisting it — the DB never stores the usable token itself. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toPublicUser(user: { id: string; email: string; fullName: string; role: string }): PublicUser {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role as "user" | "admin" };
}

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, config.jwt.accessSecret, {
    // jsonwebtoken's types want its own branded string-literal type for
    // duration strings like "15m" — our value is validated by zod at boot
    // (see config/index.ts) to match that exact pattern, so this cast is safe.
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

function refreshExpiryDate(): Date {
  // config.jwt.refreshExpiresIn is a string like "30d" — parsed manually to
  // avoid pulling in the `ms` package purely for one conversion.
  const match = /^(\d+)([smhd])$/.exec(config.jwt.refreshExpiresIn);
  const value = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : "d";
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
  return new Date(Date.now() + value * unitMs);
}

export async function registerUser(input: RegisterInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: "user",
    },
  });

  const tokens = await issueTokens(user.id, user.role);
  logger.info("User registered", { userId: user.id });

  return { user: toPublicUser(user), tokens };
}

export async function loginUser(input: LoginInput): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Constant-shaped error: we don't reveal whether the email exists or the
  // password was wrong — both produce the same message and similar timing.
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordValid = await argon2.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = await issueTokens(user.id, user.role);
  logger.info("User logged in", { userId: user.id });

  return { user: toPublicUser(user), tokens };
}

async function issueTokens(userId: string, role: string): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Rotates a refresh token: the presented token is revoked and a brand new
 * pair is issued. Rotation limits the damage of a leaked refresh token,
 * since reuse of a revoked token can be detected and treated as a signal
 * of compromise.
 */
export async function refreshTokens(presentedToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(presentedToken);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Account is no longer active");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  return issueTokens(user.id, user.role);
}

export async function logoutUser(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}
