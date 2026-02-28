import { Request, Response, NextFunction } from "express";
import { incrementRateLimitKey, getRateLimitKey } from "../utils/redis";

/**
 * Rate Limiter Middleware
 * Provides various rate limiting strategies for different endpoints
 */

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create a rate limiter middleware
 */
const createRateLimiter = (options: RateLimiterOptions) => {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => req.ip || "unknown",
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const currentCount = incrementRateLimitKey(key, windowMs);

    if (currentCount > max) {
      const entry = getRateLimitKey(key);
      const retryAfter = entry ? Math.ceil((entry.resetTime - Date.now()) / 1000) : 60;
      
      res.setHeader("Retry-After", retryAfter.toString());
      res.setHeader("X-RateLimit-Limit", max.toString());
      res.setHeader("X-RateLimit-Remaining", "0");
      
      res.status(429).json({
        success: false,
        statusCode: 429,
        message,
        retryAfter,
      });
      return;
    }

    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", (max - currentCount).toString());
    
    next();
  };
};

/**
 * Login rate limiter - 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many login attempts. Please try again in 15 minutes.",
  keyGenerator: (req: Request) => `login:${req.ip}`,
});

/**
 * Signup rate limiter - 3 signups per hour per IP
 */
export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many signup attempts. Please try again in 1 hour.",
  keyGenerator: (req: Request) => `signup:${req.ip}`,
});

/**
 * Global rate limiter - 100 requests per minute per IP
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many requests. Please slow down.",
  keyGenerator: (req: Request) => `global:${req.ip}`,
});

/**
 * Email resend rate limiter - 3 resends per hour per email
 */
export const emailResendLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many email resend requests. Please try again in 1 hour.",
  keyGenerator: (req: Request) => `email-resend:${(req.body?.email || "").trim().toLowerCase()}`,
});

/**
 * Email verification rate limiter - 10 attempts per hour per IP
 */
export const emailVerificationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many verification attempts. Please try again later.",
  keyGenerator: (req: Request) => `email-verify:${req.ip}`,
});

/**
 * Password reset request rate limiter - 3 requests per hour per email
 */
export const passwordResetRequestLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many password reset requests. Please try again in 1 hour.",
  keyGenerator: (req: Request) => `pwd-reset-req:${(req.body?.email || "").trim().toLowerCase()}`,
});

/**
 * Password reset rate limiter - 5 attempts per hour per IP
 */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many password reset attempts. Please try again later.",
  keyGenerator: (req: Request) => `pwd-reset:${req.ip}`,
});

export default {
  loginRateLimiter,
  signupRateLimiter,
  globalRateLimiter,
  emailResendLimiter,
  emailVerificationLimiter,
  passwordResetRequestLimiter,
  passwordResetLimiter,
  createRateLimiter,
};
