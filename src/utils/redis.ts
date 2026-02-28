/**
 * Redis client configuration
 * Used for rate limiting and caching
 */

// For now, we use in-memory storage for rate limiting
// This can be replaced with Redis when redis is available

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export const getRateLimitKey = (key: string): { count: number; resetTime: number } | null => {
  const entry = rateLimitStore[key];
  if (!entry) return null;
  if (Date.now() > entry.resetTime) {
    delete rateLimitStore[key];
    return null;
  }
  return entry;
};

export const setRateLimitKey = (key: string, count: number, ttlMs: number): void => {
  rateLimitStore[key] = {
    count,
    resetTime: Date.now() + ttlMs,
  };
};

export const incrementRateLimitKey = (key: string, ttlMs: number): number => {
  const entry = rateLimitStore[key];
  if (!entry || Date.now() > entry.resetTime) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: Date.now() + ttlMs,
    };
    return 1;
  }
  entry.count += 1;
  return entry.count;
};

export default {
  getRateLimitKey,
  setRateLimitKey,
  incrementRateLimitKey,
};
