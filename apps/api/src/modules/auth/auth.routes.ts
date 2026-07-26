import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authRateLimiter } from "../../middleware/rateLimiter.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import * as authController from "./auth.controller.js";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../middleware/errorHandler.js";

const router = Router();

// A small async wrapper so controllers can `throw` and rely on the global
// error handler, instead of every route needing its own try/catch.
function asyncHandler(fn: (...args: any[]) => Promise<any>) {
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next);
}

router.post("/register", authRateLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post("/refresh", authRateLimiter, asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));

/** Sanity-check endpoint: proves the access token + middleware chain works end to end. */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) throw new NotFoundError("User not found");
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  })
);

export default router;
