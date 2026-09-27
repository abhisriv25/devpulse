import rateLimit from "express-rate-limit";

/** GitHub's own webhook traffic is legitimately bursty (an installation
 * syncing hundreds of repos can fire many deliveries in a short window) —
 * generous on purpose, not tuned to throttle a real installation. */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/** User-initiated OAuth/install entry points don't need anywhere near that
 * volume — a much tighter limit on the routes a person (or an attacker)
 * can trigger directly. */
export const authFlowRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
