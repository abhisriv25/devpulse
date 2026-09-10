import { Router } from "express";
import express from "express";
import { webhookRateLimiter } from "../middleware/rate-limit.js";
import { verifyGithubWebhookSignature } from "./webhook-signature.service.js";
import { persistWebhookEvent } from "./webhook-event.service.js";

export const webhookRouter = Router();

/**
 * POST /webhooks/github — GitHub's delivery endpoint.
 *
 * Deliberately does the minimum to get an event durably stored and
 * acknowledged: verify → parse → persist → 2xx. No PR sync, no risk
 * scoring, no fetching anything back from GitHub's API happens here — that
 * would make GitHub's own retry/backoff behavior our problem (a slow
 * downstream call turning into a webhook timeout, which GitHub retries,
 * which fires the slow call again...). Later slices process RECEIVED rows
 * out-of-band.
 *
 * `express.raw` is scoped to this one route (not applied globally) because
 * signature verification needs the exact bytes GitHub signed — re-parsing
 * and re-serializing JSON is not guaranteed to reproduce them byte-for-byte.
 */
webhookRouter.post(
  "/webhooks/github",
  webhookRateLimiter,
  express.raw({ type: "application/json", limit: "5mb" }),
  async (req, res) => {
    const rawBody = req.body as Buffer;
    const signature = req.header("X-Hub-Signature-256");
    const deliveryId = req.header("X-GitHub-Delivery");
    const eventType = req.header("X-GitHub-Event");

    if (!verifyGithubWebhookSignature(rawBody, signature)) {
      req.log?.warn({ deliveryId }, "Webhook signature verification failed");
      return res.status(401).json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } });
    }

    if (!deliveryId || !eventType) {
      return res
        .status(400)
        .json({ error: { code: "INVALID_WEBHOOK", message: "Missing X-GitHub-Delivery or X-GitHub-Event" } });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: { code: "INVALID_JSON", message: "Body is not valid JSON" } });
    }

    try {
      const result = await persistWebhookEvent({ deliveryId, eventType, payload });

      if (result.outcome === "duplicate") {
        // GitHub retried a delivery we already have. Not an error — return
        // success without doing anything further, so GitHub stops retrying.
        req.log?.info({ deliveryId, eventType }, "Duplicate webhook delivery, already recorded");
        return res.status(200).json({ status: "already_processed" });
      }

      req.log?.info({ deliveryId, eventType }, "Webhook delivery received");
      return res.status(202).json({ status: "received" });
    } catch (err) {
      req.log?.error({ err, deliveryId, eventType }, "Failed to persist webhook event");
      // 500 here is honest — GitHub will retry, which is exactly what we
      // want if this was a transient DB blip.
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Could not record webhook event" } });
    }
  }
);
