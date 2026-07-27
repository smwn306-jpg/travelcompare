import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Validates req[target] against the given Zod schema and replaces it with
 * the parsed (and coerced/defaulted) value. Throws ZodError on failure,
 * which is caught by the global errorHandler and turned into a 400.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    req[target] = schema.parse(req[target]);
    next();
  };
}
