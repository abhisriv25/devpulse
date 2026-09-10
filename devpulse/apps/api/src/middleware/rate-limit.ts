import rateLimit from "express-rate-limit";

/**
 * GitHub's webhook traffic is legitimately bursty — installing a GitHub
 * App on an org with hundreds of repos, or a flurry of PR activity, can
 * fire many deliveries in a short window from a small set of GitHub IP
 * ranges. This is intentionally generous: it exists to blunt abuse from a
 * single bad actor hammering the endpoint, not to throttle real GitHub
 * traffic. Signature verification (not rate limiting) is the real defense
 * against unauthorized requests here.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tighter limit for user-initiated auth/install flows, where legitimate
 * traffic is "one human clicking a button" rather than a platform relaying
 * many events.
 */
export const authFlowRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
