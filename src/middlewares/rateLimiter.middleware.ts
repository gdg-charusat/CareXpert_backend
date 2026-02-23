import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import redisClient from '../utils/redis';

// Memory store fallback
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Redis store implementation
const redisStore = {
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      const now = Date.now();
      const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
      const resetTime = new Date(now + windowMs);

      const current = await redisClient.get(key);
      
      if (!current) {
        await redisClient.set(key, '1', { PX: windowMs });
        return { totalHits: 1, resetTime };
      }

      const totalHits = await redisClient.incr(key);
      return { totalHits, resetTime };
    } catch (error) {
      console.error('Redis store error, using memory fallback:', error);
      return memoryFallback(key);
    }
  },

  async decrement(key: string): Promise<void> {
    try {
      await redisClient.decr(key);
    } catch (error) {
      console.error('Redis decrement error:', error);
    }
  },

  async resetKey(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis reset error:', error);
    }
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

// Login rate limiter (5 attempts per 15 minutes)
export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.LOGIN_RATE_LIMIT || '5'),
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body.email || req.ip || 'unknown';
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

// Authenticated user rate limiter (100 req/min)
export const authenticatedRateLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.AUTHENTICATED_RATE_LIMIT || '100'),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
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

// Unauthenticated user rate limiter (20 req/min)
export const unauthenticatedRateLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.UNAUTHENTICATED_RATE_LIMIT || '20'),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
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

// Global rate limiter (combines authenticated and unauthenticated)
export const globalRateLimiter = (req: Request, res: Response, next: any) => {
  if ((req as any).user) {
    return authenticatedRateLimiter(req, res, next);
  }
  return unauthenticatedRateLimiter(req, res, next);
};
