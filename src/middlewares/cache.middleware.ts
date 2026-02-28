/**
 * cache.middleware.ts
 *
 * Reusable Express middleware that caches GET responses in Redis.
 *
 * Usage:
 *   import { cacheMiddleware } from '../middlewares/cache.middleware';
 *
 *   router.get('/endpoint', cacheMiddleware(300), handler);
 *
 * The middleware:
 *   1. Builds a cache key from the request URL (method + path + query string).
 *   2. Returns the cached response if present (HTTP 200 with X-Cache: HIT header).
 *   3. Intercepts the outgoing JSON response, stores it in Redis with the given
 *      TTL, and passes the response through normally.
 *   4. If Redis is unavailable the middleware is a transparent no-op (the request
 *      always reaches the real handler and the response is never cached on that
 *      cycle).  This is the "fallback mechanism" required by the issue.
 */

import { Request, Response, NextFunction } from 'express';
import cacheService from '../utils/cacheService';

/**
 * Build a deterministic cache key for a request.
 * The key is prefixed with `route:` so it is easy to find and flush in bulk.
 */
function buildCacheKey(req: Request): string {
  // Sort query params so ?a=1&b=2 and ?b=2&a=1 produce the same key
  const sortedQuery = Object.keys(req.query)
    .sort()
    .map((k) => `${k}=${req.query[k]}`)
    .join('&');

  const queryPart = sortedQuery ? `?${sortedQuery}` : '';
  return `route:GET:${req.path}${queryPart}`;
}

/**
 * Express middleware factory.
 *
 * @param ttl  Time-to-live in **seconds** for the cached entry.
 *             Pass 0 to disable caching (useful during testing).
 */
export function cacheMiddleware(ttl: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET' || ttl === 0) {
      return next();
    }

    const key = buildCacheKey(req);

    try {
      const cached = await cacheService.get<{ statusCode: number; data: unknown }>(key);

      if (cached) {
        // Cache HIT – respond immediately without touching the DB
        res.setHeader('X-Cache', 'HIT');
        res.status(cached.statusCode ?? 200).json(cached.data);
        return;
      }
    } catch {
      // Redis unavailable – fall through to the real handler (no-op fallback)
      return next();
    }

    // Cache MISS – intercept res.json() to store the response
    const originalJson = res.json.bind(res);

    res.json = (body: unknown): Response => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService
          .set(key, { statusCode: res.statusCode, data: body }, ttl)
          .catch((err) => console.error('Cache middleware set error:', err));
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate all route-level cache entries matching a URL path pattern.
 *
 * @param pathPattern  Glob pattern, e.g. `route:GET:/patient/fetchAllDoctors*`
 */
export async function invalidateRouteCache(pathPattern: string): Promise<void> {
  await cacheService.delPattern(pathPattern);
}
