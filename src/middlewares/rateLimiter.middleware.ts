import { Request, Response, NextFunction } from "express";

const noRateLimit = (_req: Request, _res: Response, next: NextFunction) =>
  next();

export const loginRateLimiter = noRateLimit;
export const authenticatedRateLimiter = noRateLimit;
export const unauthenticatedRateLimiter = noRateLimit;
export const signupRateLimiter = noRateLimit;
export const globalRateLimiter = noRateLimit;
