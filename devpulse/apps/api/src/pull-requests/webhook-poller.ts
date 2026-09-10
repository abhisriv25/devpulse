import { logger } from "../logger.js";
import { processPendingWebhookEvents } from "./pull-request-processor.service.js";

const POLL_INTERVAL_MS = 3000;

/**
 * Slice 4's stand-in for a real job queue: a plain interval poll for
 * RECEIVED WebhookEvent rows. Deliberately not BullMQ — nothing in the
 * architecture doc calls for a queue at this slice, and a poller is enough
 * to prove "webhook arrives → PR gets synced" end-to-end without new
 * infrastructure. Everything queue-shaped already lives behind
 * processPendingWebhookEvents(), so swapping this for a real worker later
 * is a contained change, not a rewrite.
 *
 * Started only from server.ts, never from app.ts/buildApp() — tests build
 * the app directly and must not have a background timer left running
 * against a mocked or absent database.
 */
export function startWebhookEventPoller(): NodeJS.Timeout {
  return setInterval(() => {
    processPendingWebhookEvents().catch((err) => {
      logger.error({ err }, "Webhook event poller run failed");
    });
  }, POLL_INTERVAL_MS);
}
