/**
 * cache.test.ts
 *
 * Unit-tests for:
 *  - CacheService (utils/cacheService.ts)
 *  - cacheMiddleware (middlewares/cache.middleware.ts)
 *
 * Redis is mocked for all tests so no running Redis instance is needed.
 */

/* ─── Mock the Redis client ─────────────────────────────────────────────── */
const mockRedis = {
  isReady: true,
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
};

jest.mock('../utils/redis', () => ({
  __esModule: true,
  default: mockRedis,
}));

/* ─── Imports (after mock setup) ───────────────────────────────────────── */
import express, { Request, Response } from 'express';
import request from 'supertest';
import cacheService, { CACHE_TTL, CACHE_KEYS } from '../utils/cacheService';
import { cacheMiddleware } from '../middlewares/cache.middleware';

/* ═══════════════════════════════════════════════════════════════════════════
   CacheService
   ═══════════════════════════════════════════════════════════════════════════ */
describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRedis.isReady = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── isReady ──────────────────────────────────────────────────────────────
  describe('isReady()', () => {
    it('returns true when the redis client is connected', () => {
      mockRedis.isReady = true;
      expect(cacheService.isReady()).toBe(true);
    });

    it('returns false when the redis client is not connected', () => {
      mockRedis.isReady = false;
      expect(cacheService.isReady()).toBe(false);
    });
  });

  // ── get ──────────────────────────────────────────────────────────────────
  describe('get()', () => {
    it('returns null on a cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await cacheService.get('missing:key');
      expect(result).toBeNull();
    });

    it('returns the parsed value on a cache hit', async () => {
      const payload = [{ id: 'doc-1', name: 'Dr. Smith' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(payload));
      const result = await cacheService.get('doctors:all');
      expect(result).toEqual(payload);
    });

    it('returns null (instead of throwing) when redis.get errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));
      const result = await cacheService.get('any:key');
      expect(result).toBeNull();
    });
  });

  // ── set ──────────────────────────────────────────────────────────────────
  describe('set()', () => {
    it('serialises the value and stores it with the given TTL', async () => {
      mockRedis.setEx.mockResolvedValue('OK');
      const data = { foo: 'bar' };
      await cacheService.set('test:key', data, 60);
      expect(mockRedis.setEx).toHaveBeenCalledWith('test:key', 60, JSON.stringify(data));
    });

    it('does not throw when redis.setEx errors', async () => {
      mockRedis.setEx.mockRejectedValue(new Error('write failed'));
      await expect(cacheService.set('test:key', {}, 60)).resolves.toBeUndefined();
    });
  });

  // ── del ──────────────────────────────────────────────────────────────────
  describe('del()', () => {
    it('calls redis.del with the exact key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await cacheService.del('doctors:all');
      expect(mockRedis.del).toHaveBeenCalledWith('doctors:all');
    });

    it('does not throw when redis.del errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('del failed'));
      await expect(cacheService.del('doctors:all')).resolves.toBeUndefined();
    });
  });

  // ── delPattern ───────────────────────────────────────────────────────────
  describe('delPattern()', () => {
    it('deletes all keys matching the pattern', async () => {
      const matched = ['timeslots:doc-1:2026-02-27', 'timeslots:doc-1:all'];
      mockRedis.keys.mockResolvedValue(matched);
      mockRedis.del.mockResolvedValue(2);

      await cacheService.delPattern('timeslots:doc-1:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('timeslots:doc-1:*');
      expect(mockRedis.del).toHaveBeenCalledWith(matched);
    });

    it('skips redis.del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);
      await cacheService.delPattern('timeslots:nonexistent:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('does not throw when redis.keys errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('SCAN failed'));
      await expect(cacheService.delPattern('some:*')).resolves.toBeUndefined();
    });
  });

  // ── TTL constants ─────────────────────────────────────────────────────────
  describe('CACHE_TTL constants', () => {
    it('ALL_DOCTORS is 300 seconds', () => {
      expect(CACHE_TTL.ALL_DOCTORS).toBe(300);
    });

    it('TIME_SLOTS is 60 seconds', () => {
      expect(CACHE_TTL.TIME_SLOTS).toBe(60);
    });

    it('SEARCH_DOCTORS is 3600 seconds', () => {
      expect(CACHE_TTL.SEARCH_DOCTORS).toBe(3600);
    });

    it('USER_APPOINTMENTS is 30 seconds', () => {
      expect(CACHE_TTL.USER_APPOINTMENTS).toBe(30);
    });
  });

  // ── CACHE_KEYS helpers ────────────────────────────────────────────────────
  describe('CACHE_KEYS helpers', () => {
    it('ALL_DOCTORS returns the correct key', () => {
      expect(CACHE_KEYS.ALL_DOCTORS).toBe('doctors:all');
    });

    it('DOCTORS_SEARCH builds the correct key', () => {
      expect(CACHE_KEYS.DOCTORS_SEARCH('cardiology', 'Mumbai')).toBe(
        'doctors:cardiology:Mumbai',
      );
    });

    it('DOCTORS_SEARCH handles empty strings', () => {
      expect(CACHE_KEYS.DOCTORS_SEARCH('', '')).toBe('doctors:all:all');
    });

    it('TIME_SLOTS builds the correct key with a date', () => {
      expect(CACHE_KEYS.TIME_SLOTS('doc-abc', '2026-02-27')).toBe(
        'timeslots:doc-abc:2026-02-27',
      );
    });

    it('TIME_SLOTS defaults date to "all" when omitted', () => {
      expect(CACHE_KEYS.TIME_SLOTS('doc-abc')).toBe('timeslots:doc-abc:all');
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   cacheMiddleware
   ═══════════════════════════════════════════════════════════════════════════ */
describe('cacheMiddleware', () => {
  let app: express.Express;

  /** Simple handler that returns { status: 'fresh' } */
  const freshHandler = (_req: Request, res: Response) => {
    res.status(200).json({ status: 'fresh' });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRedis.isReady = true;

    app = express();
    app.use(express.json());
    app.get('/data', cacheMiddleware(60), freshHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responds with X-Cache: MISS on the first request and caches the result', async () => {
    mockRedis.get.mockResolvedValue(null); // cache miss
    mockRedis.setEx.mockResolvedValue('OK');

    const res = await request(app).get('/data');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.body).toEqual({ status: 'fresh' });
    expect(mockRedis.setEx).toHaveBeenCalled();
  });

  it('responds with X-Cache: HIT and cached data on subsequent requests', async () => {
    const cached = { statusCode: 200, data: { status: 'cached' } };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const res = await request(app).get('/data');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body).toEqual({ status: 'cached' });
    // The real handler should NOT have been reached → setEx not called
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });

  it('falls through to the handler when Redis throws on get (fallback)', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis down'));
    mockRedis.setEx.mockResolvedValue('OK');

    const res = await request(app).get('/data');

    // Response still succeeds via the real handler
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'fresh' });
  });

  it('does not cache non-GET requests', async () => {
    app.post('/data', cacheMiddleware(60), (_req, res) => {
      res.status(201).json({ created: true });
    });

    const res = await request(app).post('/data').send({});

    expect(res.status).toBe(201);
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });

  it('skips caching when ttl is 0', async () => {
    app.get('/no-cache', cacheMiddleware(0), freshHandler);

    const res = await request(app).get('/no-cache');

    expect(res.status).toBe(200);
    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });

  it('does not cache error responses (4xx/5xx)', async () => {
    app.get('/error', cacheMiddleware(60), (_req, res) => {
      res.status(500).json({ error: 'boom' });
    });

    mockRedis.get.mockResolvedValue(null);

    const res = await request(app).get('/error');

    expect(res.status).toBe(500);
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });
});
