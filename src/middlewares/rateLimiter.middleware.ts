import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import redisClient from "../utils/redis";

const noRateLimit = (_req: Request, _res: Response, next: NextFunction) =>
  next();

const memoryStore = new Map<string, { count: number; resetTime: number }>();

const redisStore = {
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      if (!redisClient.isReady) {
        return memoryFallback(key);
      }
      const now = Date.now();
      const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
      const resetTime = new Date(now + windowMs);

      const current = await redisClient.get(key);

      if (!current) {
        await redisClient.set(key, '1', { PX: windowMs as any });
        return { totalHits: 1, resetTime };
      }


      const totalHits = await redisClient.incr(key) as number;
      return { totalHits, resetTime };

    } catch (error) {
      return memoryFallback(key);
    }
  },

  async decrement(key: string): Promise<void> {
    try {
      await redisClient.decr(key);
    } catch (_) { }
  },

  async resetKey(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (_) { }
  },
};

function memoryFallback(key: string): { totalHits: number; resetTime: Date } {
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return { totalHits: 1, resetTime: new Date(now + windowMs) };
  }

  entry.count++;
  memoryStore.set(key, entry);
  return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
}

export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '5'),
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const identifier =
      (req as any)?.body?.email ||
      (req as any)?.body?.data ||
      req.ip ||
      "unknown";

    return typeof identifier === "string" ? identifier : String(identifier);
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000);
    res.status(429).set('Retry-After', retryAfter.toString()).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      retryAfter,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`login:${key}`),
    decrement: (key: string) => redisStore.decrement(`login:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`login:${key}`),
  },
});

export const authenticatedRateLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.AUTHENTICATED_RATE_LIMIT || '100'),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip || 'unknown';
  },
  skip: (req: Request) => !(req as any).user,
  handler: (req: Request, res: Response) => {
    res.status(429).set('Retry-After', '60').json({
      success: false,
      message: 'Too many requests. Please slow down.',
      retryAfter: 60,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`auth:${key}`),
    decrement: (key: string) => redisStore.decrement(`auth:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`auth:${key}`),
  },
});

export const unauthenticatedRateLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.UNAUTHENTICATED_RATE_LIMIT || '20'),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  skip: (req: Request) => !!(req as any).user,
  handler: (req: Request, res: Response) => {
    res.status(429).set('Retry-After', '60').json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: 60,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`unauth:${key}`),
    decrement: (key: string) => redisStore.decrement(`unauth:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`unauth:${key}`),
  },
});

export const signupRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.SIGNUP_RATE_LIMIT || '10'),
  message: { success: false, message: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000);
    res.status(429).set('Retry-After', retryAfter.toString()).json({
      success: false,
      message: 'Too many signup attempts. Please try again later.',
      retryAfter,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`signup:${key}`),
    decrement: (key: string) => redisStore.decrement(`signup:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`signup:${key}`),
  },
});

export const emailResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 emails per hour
  message: { success: false, message: 'Too many verification emails sent. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    // Rate limit by email address to prevent abuse per email
    const email = (req as any)?.body?.email;
    if (email && typeof email === 'string') {
      return `email:${email}`;
    }
    // Fallback to IP if email not provided (will be caught by validation)
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = 3600; // 1 hour in seconds
    res.status(429).set('Retry-After', retryAfter.toString()).json({
      success: false,
      message: 'Too many verification emails sent. Please try again in an hour.',
      retryAfter,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`email-resend:${key}`),
    decrement: (key: string) => redisStore.decrement(`email-resend:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`email-resend:${key}`),
  },
});

// Rate limiter for email verification endpoint to prevent token brute-forcing
export const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 verification attempts per 15 minutes
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    // Rate limit by email to prevent brute-force attacks on specific accounts
    const email = req.query.email as string;
    if (email && typeof email === 'string') {
      return `verify:${email}`;
    }
    // Fallback to IP
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = 900; // 15 minutes in seconds
    res.status(429).set('Retry-After', retryAfter.toString()).json({
      success: false,
      message: 'Too many verification attempts. Please try again in 15 minutes.',
      retryAfter,
    });
  },
  store: {
    increment: (key: string) => redisStore.increment(`email-verify:${key}`),
    decrement: (key: string) => redisStore.decrement(`email-verify:${key}`),
    resetKey: (key: string) => redisStore.resetKey(`email-verify:${key}`),
  },
});

export const globalRateLimiter = (req: Request, res: Response, next: any) => {
  if ((req as any).user) {
    return authenticatedRateLimiter(req, res, next);
  }
  return unauthenticatedRateLimiter(req, res, next);
};
