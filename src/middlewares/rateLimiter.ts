// Barrel re-export for rate limiter middleware
// Routes import from '../middlewares/rateLimiter' which resolves here
export {
  globalRateLimiter,
  loginRateLimiter,
  loginRateLimiter as signupRateLimiter,
  authenticatedRateLimiter,
  unauthenticatedRateLimiter,
} from "./rateLimiter.middleware";
