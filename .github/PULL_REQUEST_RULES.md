## Team Number : Team 153

## Description
This PR introduces a **Redis-based caching layer** for frequently queried, read-heavy endpoints to improve response times and reduce database load.

Endpoints such as `GET /patient/fetchAllDoctors`, `GET /patient/search-doctors`, and `GET /patient/:doctorId/timeSlots` were hitting the database on every request. With Redis caching in place, repeated reads are served directly from memory, significantly reducing latency and PostgreSQL query load — especially under high traffic.

A reusable `cacheMiddleware` is also added so any future route can opt into caching with a single line. All cache entries are automatically invalidated whenever related data changes (appointment booking/cancellation, timeslot add/update/delete).

## Related Issue
<!-- Link to the issue this PR addresses -->
Closes #103

## Type of Change
<!-- Please check the relevant option(s) -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [x] Documentation update
- [x] Code refactoring
- [x] Performance improvement
- [ ] Style/UI improvement

## Changes Made
- **`src/utils/cacheService.ts`** — Enhanced with exported `CACHE_TTL` constants (300s / 3600s / 60s / 30s) and `CACHE_KEYS` helper functions for structured, scalable cache key generation; added `isReady()` health check method
- **`src/middlewares/cache.middleware.ts`** *(new)* — Reusable Express middleware (`cacheMiddleware(ttl)`) that serves `X-Cache: HIT` from Redis and populates cache on `X-Cache: MISS`; silently falls back to DB if Redis is unavailable
- **`src/controllers/patient.controller.ts`** — Added Redis caching to `fetchAllDoctors` (5 min TTL) and `availableTimeSlots` (1 min TTL); `searchDoctors` TTL now uses the shared constant; `bookAppointment` invalidates timeslot and doctor-listing caches on success
- **`src/controllers/doctor.controller.ts`** — Imported `cacheService`; added cache invalidation (`timeslots:{doctorId}:*` + `doctors:all`) to `addTimeslot`, `generateBulkTimeSlots`, `updateTimeSlot`, `deleteTimeSlot`, `cancelAppointment`, and `updateAppointmentStatus` (CANCELLED path)
- **`src/__tests__/cache.test.ts`** *(new)* — 27 unit tests covering `CacheService` (get/set/del/delPattern/isReady, TTL constants, key helpers) and `cacheMiddleware` (HIT/MISS, fallback, non-GET, TTL=0, error response exclusion); Redis fully mocked — no running instance needed
- **`tsconfig.json`** — Fixed `compizerOptions` typo → `compilerOptions`; added `"jest"` to `types`; removed `src/__tests__` from `exclude` so IDE recognises Jest globals in test files
- **`.env.example`** — Documented `REDIS_URL` and optional `CACHE_TTL_*` override variables
- **`README.md`** — Added full **Caching Strategy** section: setup instructions, cached endpoints table, `X-Cache` header docs, fallback behaviour, invalidation rules table, middleware usage example, and test run instructions

## Screenshots (if applicable)
<!-- Add before/after screenshots for UI changes -->

**Before:**

**After:**


## Testing
<!-- Describe the tests you ran to verify your changes -->
- [ ] Tested on Desktop (Chrome/Firefox/Safari)
- [ ] Tested on Mobile (iOS/Android)
- [ ] Tested responsive design (different screen sizes)
- [x] No console errors or warnings
- [x] Code builds successfully (`npm run build`)

**Cache-specific tests:**
- [x] `npx jest --testPathPatterns=cache` — 27/27 tests pass (Redis fully mocked)
- [x] `npx jest --forceExit` — 60/60 tests pass across all test suites
- [x] `npx tsc --noEmit` — zero TypeScript errors

## Checklist
<!-- Mark completed items with [x] -->
- [x] My code follows the project's code style guidelines
- [x] I have performed a self-review of my code
- [x] I have commented my code where necessary
- [x] My changes generate no new warnings
- [x] I have tested my changes thoroughly
- [x] All TypeScript types are properly defined
- [ ] Tailwind CSS classes are used appropriately (no inline styles)
- [ ] Component is responsive across different screen sizes
- [x] I have read and followed the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines

## Additional Notes
- **No breaking changes** — if Redis is unavailable, all cache operations fail silently and every request falls through to the database. The application behaves exactly as before, just without the performance benefit.
- **Environment variable driven** — `REDIS_URL` is read from `.env` (default: `redis://localhost:6379`). Cache TTLs are defined as named constants in `cacheService.ts` and can be overridden via env vars (see `.env.example`).
- **Cache key design** — Keys follow the pattern `{resource}:{param1}:{param2}` (e.g. `timeslots:doc-uuid:2026-02-27`) and are invalidated using glob patterns (`timeslots:{doctorId}:*`) so all date variants for a doctor are cleared in one operation.
- **Future extensibility** — The `cacheMiddleware(ttl)` factory can be applied to any new read-only route in one line; pass `cacheMiddleware(0)` to disable caching (useful in tests).
- **Redis adapter** — The project already uses `@socket.io/redis-adapter` for Socket.IO horizontal scaling on the same `REDIS_URL`, so no additional infrastructure is required.
