import type { Request, Response } from "express";
import { config } from "../../config/index.js";
import { UnauthorizedError } from "../../middleware/errorHandler.js";
import * as authService from "./auth.service.js";
import type { RegisterInput, LoginInput } from "./auth.schemas.js";

const REFRESH_COOKIE_NAME = "tc_refresh_token";

/** Refresh token lives ONLY in an HttpOnly cookie — never in JSON, never in localStorage. */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/api/auth", // only sent to auth endpoints, not the whole API
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, mirrors JWT_REFRESH_EXPIRES_IN default
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

export async function register(req: Request, res: Response) {
  const input = req.body as RegisterInput;
  const { user, tokens } = await authService.registerUser(input);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({ user, accessToken: tokens.accessToken });
}

export async function login(req: Request, res: Response) {
  const input = req.body as LoginInput;
  const { user, tokens } = await authService.loginUser(input);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json({ user, accessToken: tokens.accessToken });
}

export async function refresh(req: Request, res: Response) {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!presentedToken) {
    throw new UnauthorizedError("No refresh token provided");
  }

  const tokens = await authService.refreshTokens(presentedToken);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json({ accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response) {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (presentedToken) {
    await authService.logoutUser(presentedToken);
  }
  clearRefreshCookie(res);
  res.status(204).send();
}
