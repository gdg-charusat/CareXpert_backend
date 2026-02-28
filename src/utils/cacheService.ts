import redisClient from './redis';

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------
export const CACHE_TTL = {
  ALL_DOCTORS: 300,       // 5 minutes  – doctor list changes infrequently
  SEARCH_DOCTORS: 3600,   // 1 hour     – search results
  TIME_SLOTS: 60,         // 1 minute   – slot availability changes often
  USER_APPOINTMENTS: 30,  // 30 seconds – personal appointment data
} as const;

// ---------------------------------------------------------------------------
// Canonical cache-key builders
// ---------------------------------------------------------------------------
export const CACHE_KEYS = {
  ALL_DOCTORS: 'doctors:all',
  DOCTORS_SEARCH: (specialty: string, location: string) =>
    `doctors:${specialty || 'all'}:${location || 'all'}`,
  TIME_SLOTS: (doctorId: string, date?: string) =>
    `timeslots:${doctorId}:${date || 'all'}`,
} as const;

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------
class CacheService {
  /**
   * Returns true when the underlying Redis client is connected and usable.
   * All public methods silently swallow errors, so the app continues to work
   * even when Redis is unavailable (cache-miss fallback to DB).
   */
  isReady(): boolean {
    try {
      return !!(redisClient as any).isReady;
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (typeof (redisClient as any).get === 'function') {
        const data = await (redisClient as any).get(key);
        return data ? (JSON.parse(data.toString()) as T) : null;
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      if (typeof (redisClient as any).setEx === 'function') {
        await (redisClient as any).setEx(key, ttl, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (typeof (redisClient as any).del === 'function') {
        await (redisClient as any).del(key);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      if (typeof (redisClient as any).keys === 'function' && typeof (redisClient as any).del === 'function') {
        const keys = await (redisClient as any).keys(pattern);
        if (keys.length > 0) {
          await (redisClient as any).del(keys);
        }
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }
}

export default new CacheService();
